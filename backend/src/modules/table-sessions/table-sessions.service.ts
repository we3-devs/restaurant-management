import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { OutletsService } from '../outlets/outlets.service';
import { CreateTableSessionDto } from './dto/create-table-session.dto';
import { ListTableSessionsQueryDto } from './dto/list-table-sessions-query.dto';
import { TableSession } from './entities/table-session.entity';

@Injectable()
export class TableSessionsService {
  constructor(
    @InjectRepository(TableSession)
    private readonly tableSessionsRepository: Repository<TableSession>,
    private readonly diningTablesService: DiningTablesService,
    private readonly outletsService: OutletsService,
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

    const session = this.tableSessionsRepository.create({
      outletId: dto.outletId,
      diningTableId: dto.diningTableId,
      guestCount: dto.guestCount ?? 1,
      source: dto.source ?? 'staff',
      status: 'active',
      startedAt: new Date(),
      startedBy,
    });
    const saved = await this.tableSessionsRepository.save(session);

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
}
