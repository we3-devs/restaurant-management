import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { CustomersService } from '../customers/customers.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { OutletsService } from '../outlets/outlets.service';
import { ReservationsService } from '../reservations/reservations.service';
import { CreateTableSessionDto } from './dto/create-table-session.dto';
import { ListTableSessionsQueryDto } from './dto/list-table-sessions-query.dto';
import { TransferTableSessionDto } from './dto/transfer-table-session.dto';
import { TableSession } from './entities/table-session.entity';

const OPEN_SESSION_STATUSES: TableSession['status'][] = ['active', 'billing'];

@Injectable()
export class TableSessionsService {
  constructor(
    @InjectRepository(TableSession)
    private readonly tableSessionsRepository: Repository<TableSession>,
    private readonly diningTablesService: DiningTablesService,
    private readonly outletsService: OutletsService,
    private readonly customersService: CustomersService,
    @Inject(forwardRef(() => ReservationsService))
    private readonly reservationsService: ReservationsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: ListTableSessionsQueryDto,
  ): Promise<PaginatedResponse<TableSession>> {
    const { page, limit, outletId, diningTableId, status } = query;
    const where: FindOptionsWhere<TableSession> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (diningTableId !== undefined) {
      where.diningTableId = diningTableId;
    }
    if (status !== undefined) {
      where.status = status;
    }

    const [sessions, total] = await this.tableSessionsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: sessions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by OrdersService to validate a tableSessionId. */
  async findOne(id: number): Promise<TableSession> {
    const session = await this.tableSessionsRepository.findOne({
      where: { id },
    });
    if (!session) {
      throw new NotFoundException(`Table session ${id} not found`);
    }
    return session;
  }

  async create(
    dto: CreateTableSessionDto,
    startedBy: number,
  ): Promise<TableSession> {
    await this.outletsService.findOne(dto.outletId);
    await this.diningTablesService.findOne(dto.diningTableId);
    if (dto.customerId !== undefined) {
      await this.customersService.findOne(dto.customerId);
    }
    if (dto.reservationId !== undefined) {
      await this.reservationsService.findOne(dto.reservationId);
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertNoOpenSession(dto.diningTableId, manager);

      const session = manager.create(TableSession, {
        outletId: dto.outletId,
        diningTableId: dto.diningTableId,
        guestCount: dto.guestCount ?? 1,
        source: dto.source ?? 'staff',
        customerId: dto.customerId ?? null,
        reservationId: dto.reservationId ?? null,
        status: 'active',
        startedAt: new Date(),
        startedBy,
      });
      return manager.save(session);
    });

    await this.diningTablesService.setStatus(dto.diningTableId, 'occupied');

    return saved;
  }

  async end(id: number, endedBy: number): Promise<TableSession> {
    const session = await this.findOne(id);
    session.status = 'completed';
    session.endedAt = new Date();
    session.endedBy = endedBy;
    const saved = await this.tableSessionsRepository.save(session);

    await this.diningTablesService.setStatus(
      session.diningTableId,
      'available',
    );

    return saved;
  }

  /** Moves an in-progress session to a different table (e.g. guests relocate before paying). */
  async transfer(
    id: number,
    dto: TransferTableSessionDto,
    transferredBy: number,
  ): Promise<TableSession> {
    const session = await this.findOne(id);

    if (!OPEN_SESSION_STATUSES.includes(session.status)) {
      throw new ConflictException(
        `Table session ${id} is not open (status: ${session.status})`,
      );
    }
    if (dto.newDiningTableId === session.diningTableId) {
      throw new ConflictException(
        `Table session ${id} is already on table ${dto.newDiningTableId}`,
      );
    }

    const newTable = await this.diningTablesService.findOne(
      dto.newDiningTableId,
    );
    if (newTable.outletId !== session.outletId) {
      throw new BadRequestException(
        `Dining table ${dto.newDiningTableId} does not belong to outlet ${session.outletId}`,
      );
    }

    const oldDiningTableId = session.diningTableId;

    const saved = await this.dataSource.transaction(async (manager) => {
      await this.assertNoOpenSession(dto.newDiningTableId, manager);

      session.diningTableId = dto.newDiningTableId;
      session.transferredBy = transferredBy;
      session.transferredAt = new Date();
      return manager.save(session);
    });

    await this.diningTablesService.setStatus(oldDiningTableId, 'available');
    await this.diningTablesService.setStatus(dto.newDiningTableId, 'occupied');

    return saved;
  }

  private async assertNoOpenSession(
    diningTableId: number,
    manager: EntityManager,
  ): Promise<void> {
    const existing = await manager.findOne(TableSession, {
      where: { diningTableId, status: In(OPEN_SESSION_STATUSES) },
    });
    if (existing) {
      throw new ConflictException(
        `Dining table ${diningTableId} already has an open session`,
      );
    }
  }
}
