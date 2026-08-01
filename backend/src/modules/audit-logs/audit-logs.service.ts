import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditAction, AuditLog } from './entities/audit-log.entity';

const EXPORT_ROW_CAP = 5000;

export interface RecordAuditInput {
  userId?: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | number | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  async record(input: RecordAuditInput): Promise<AuditLog> {
    return this.auditLogsRepository.save(
      this.auditLogsRepository.create({
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId:
          input.entityId === undefined || input.entityId === null
            ? null
            : String(input.entityId),
        oldValues: (input.oldValues as Record<string, unknown>) ?? null,
        newValues: (input.newValues as Record<string, unknown>) ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      }),
    );
  }

  private buildFilteredQuery(query: ListAuditLogsQueryDto) {
    const qb = this.auditLogsRepository.createQueryBuilder('log');
    if (query.userId !== undefined) {
      qb.andWhere('log.user_id = :userId', { userId: query.userId });
    }
    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.entityType) {
      qb.andWhere('log.entity_type = :entityType', {
        entityType: query.entityType,
      });
    }
    if (query.entityId) {
      qb.andWhere('log.entity_id = :entityId', { entityId: query.entityId });
    }
    if (query.dateFrom) {
      qb.andWhere('log.created_at >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }
    if (query.dateTo) {
      qb.andWhere('log.created_at <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }
    if (query.search) {
      qb.andWhere(
        '(log.entity_type ILIKE :search OR log.entity_id ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    return qb.orderBy('log.created_at', 'DESC');
  }

  async findAll(
    query: ListAuditLogsQueryDto,
  ): Promise<PaginatedResponse<AuditLog>> {
    const { page, limit } = query;
    const [data, total] = await this.buildFilteredQuery(query)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Uncapped-but-bounded row set for CSV export — same filters, no UI pagination. */
  async exportRows(query: ListAuditLogsQueryDto): Promise<AuditLog[]> {
    return this.buildFilteredQuery(query).take(EXPORT_ROW_CAP).getMany();
  }

  async purgeOlderThan(days: number): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000);
    const result = await this.auditLogsRepository.delete({
      createdAt: LessThan(cutoff),
    });
    return { deleted: result.affected ?? 0 };
  }
}
