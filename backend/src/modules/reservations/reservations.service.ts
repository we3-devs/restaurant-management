import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CustomersService } from '../customers/customers.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { OutletsService } from '../outlets/outlets.service';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { AssignReservationTableDto } from './dto/assign-reservation-table.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationTable } from './entities/reservation-table.entity';
import { Reservation } from './entities/reservation.entity';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(ReservationTable)
    private readonly reservationTablesRepository: Repository<ReservationTable>,
    private readonly outletsService: OutletsService,
    private readonly customersService: CustomersService,
    private readonly diningTablesService: DiningTablesService,
    @Inject(forwardRef(() => TableSessionsService))
    private readonly tableSessionsService: TableSessionsService,
  ) {}

  async findAll(
    query: ListReservationsQueryDto,
  ): Promise<PaginatedResponse<Reservation>> {
    const { page, limit, outletId, customerId, status, source } = query;
    const where: FindOptionsWhere<Reservation> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (customerId !== undefined) {
      where.customerId = customerId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (source !== undefined) {
      where.source = source;
    }

    const [reservations, total] =
      await this.reservationsRepository.findAndCount({
        where,
        order: { reservedAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      data: reservations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by OrdersService/TableSessionsService to validate a reservationId. */
  async findOne(id: number): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }
    return reservation;
  }

  async create(
    dto: CreateReservationDto,
    createdBy: number,
  ): Promise<Reservation> {
    await this.outletsService.findOne(dto.outletId);
    await this.customersService.findOne(dto.customerId);

    const reservation = this.reservationsRepository.create({
      outletId: dto.outletId,
      customerId: dto.customerId,
      reservedAt: new Date(dto.reservedAt),
      guestCount: dto.guestCount ?? 1,
      source: dto.source ?? 'staff',
      specialRequest: dto.specialRequest ?? null,
      internalNote: dto.internalNote ?? null,
      depositAmount: dto.depositAmount ?? 0,
      createdBy,
      updatedBy: createdBy,
    });
    const saved = await this.reservationsRepository.save(reservation);

    await this.customersService.upsertVisit(dto.customerId, dto.outletId);

    return saved;
  }

  async update(id: number, dto: UpdateReservationDto): Promise<Reservation> {
    const reservation = await this.findOne(id);

    Object.assign(reservation, {
      ...(dto.reservedAt !== undefined && {
        reservedAt: new Date(dto.reservedAt),
      }),
      ...(dto.guestCount !== undefined && { guestCount: dto.guestCount }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.specialRequest !== undefined && {
        specialRequest: dto.specialRequest,
      }),
      ...(dto.internalNote !== undefined && {
        internalNote: dto.internalNote,
      }),
      ...(dto.depositAmount !== undefined && {
        depositAmount: dto.depositAmount,
      }),
      ...(dto.depositStatus !== undefined && {
        depositStatus: dto.depositStatus,
      }),
    });

    return this.reservationsRepository.save(reservation);
  }

  async updateStatus(
    id: number,
    dto: UpdateReservationStatusDto,
    changedBy: number,
  ): Promise<Reservation> {
    const reservation = await this.findOne(id);

    if (dto.status === 'seated') {
      const tables = await this.reservationTablesRepository.find({
        where: { reservationId: id },
        order: { id: 'ASC' },
      });
      const primaryTable = tables[0];
      if (!primaryTable) {
        throw new BadRequestException(
          `Reservation ${id} has no assigned tables — assign a table before seating`,
        );
      }

      await this.tableSessionsService.create(
        {
          outletId: reservation.outletId,
          diningTableId: primaryTable.diningTableId,
          guestCount: reservation.guestCount,
          source: 'reservation',
          customerId: reservation.customerId,
          reservationId: reservation.id,
        },
        changedBy,
      );
    }

    reservation.status = dto.status;
    reservation.updatedBy = changedBy;
    if (dto.status === 'confirmed') {
      reservation.confirmedAt = new Date();
    } else if (dto.status === 'seated') {
      reservation.seatedAt = new Date();
    } else if (dto.status === 'completed') {
      reservation.completedAt = new Date();
    } else if (dto.status === 'cancelled') {
      reservation.cancelledAt = new Date();
    } else if (dto.status === 'no_show') {
      reservation.noShowAt = new Date();
    }

    return this.reservationsRepository.save(reservation);
  }

  // -------------------------------------------------------- reservation tables

  async listTables(reservationId: number): Promise<ReservationTable[]> {
    await this.findOne(reservationId);
    return this.reservationTablesRepository.find({ where: { reservationId } });
  }

  async assignTable(
    reservationId: number,
    dto: AssignReservationTableDto,
  ): Promise<ReservationTable> {
    const reservation = await this.findOne(reservationId);
    const table = await this.diningTablesService.findOne(dto.diningTableId);
    if (table.outletId !== reservation.outletId) {
      throw new BadRequestException(
        `Dining table ${dto.diningTableId} does not belong to outlet ${reservation.outletId}`,
      );
    }

    const existing = await this.reservationTablesRepository.findOne({
      where: { reservationId, diningTableId: dto.diningTableId },
    });
    if (existing) {
      return existing; // idempotent
    }

    return this.reservationTablesRepository.save(
      this.reservationTablesRepository.create({
        reservationId,
        diningTableId: dto.diningTableId,
      }),
    );
  }

  async unassignTable(
    reservationId: number,
    diningTableId: number,
  ): Promise<void> {
    await this.findOne(reservationId);
    await this.reservationTablesRepository.delete({
      reservationId,
      diningTableId,
    });
  }
}
