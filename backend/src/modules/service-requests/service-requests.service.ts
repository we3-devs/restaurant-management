import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { KitchenTicketsGateway } from '../kitchen-tickets/kitchen-tickets.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateGuestServiceRequestDto } from './dto/create-guest-service-request.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { ListServiceRequestsQueryDto } from './dto/list-service-requests-query.dto';
import { ServiceRequest } from './entities/service-request.entity';

const SERVICE_LABELS: Record<ServiceRequest['type'], string> = {
  water: 'water',
  bill: 'the bill',
  assistance: 'assistance',
  other: 'help',
};

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectRepository(ServiceRequest)
    private readonly serviceRequestsRepository: Repository<ServiceRequest>,
    private readonly diningTablesService: DiningTablesService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: KitchenTicketsGateway,
  ) {}

  async findAll(
    query: ListServiceRequestsQueryDto,
  ): Promise<PaginatedResponse<ServiceRequest>> {
    const { page, limit, outletId, diningTableId, status } = query;
    const where: FindOptionsWhere<ServiceRequest> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (diningTableId !== undefined) {
      where.diningTableId = diningTableId;
    }
    if (status !== undefined) {
      where.status = status;
    }

    const [requests, total] = await this.serviceRequestsRepository.findAndCount(
      {
        where,
        relations: ['diningTable'],
        order: {
          status: 'ASC',
          createdAt: 'DESC',
        },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      data: requests,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Staff-initiated (Floor table dialog / POS). */
  async create(
    dto: CreateServiceRequestDto,
    requestedBy: number,
  ): Promise<ServiceRequest> {
    const table = await this.diningTablesService.findOne(dto.diningTableId);
    return this.createForTable(
      table.outletId,
      table.id,
      dto.type,
      dto.note ?? null,
      requestedBy,
    );
  }

  /** Guest-initiated via the QR page — the table is resolved by its printed code. */
  async createFromGuest(
    dto: CreateGuestServiceRequestDto,
  ): Promise<ServiceRequest> {
    const table = await this.diningTablesService.findByCode(dto.tableCode);
    return this.createForTable(
      table.outletId,
      table.id,
      dto.type,
      dto.note ?? null,
      null,
    );
  }

  async resolve(id: number, resolvedBy: number): Promise<ServiceRequest> {
    const request = await this.findOne(id);
    request.status = 'resolved';
    request.resolvedBy = resolvedBy;
    request.resolvedAt = new Date();
    return this.serviceRequestsRepository.save(request);
  }

  async findOne(id: number): Promise<ServiceRequest> {
    const request = await this.serviceRequestsRepository.findOne({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException(`Service request ${id} not found`);
    }
    return request;
  }

  private async createForTable(
    outletId: number,
    diningTableId: number,
    type: ServiceRequest['type'],
    note: string | null,
    requestedBy: number | null,
  ): Promise<ServiceRequest> {
    const request = await this.serviceRequestsRepository.save(
      this.serviceRequestsRepository.create({
        outletId,
        diningTableId,
        type,
        note,
        requestedBy,
        status: 'pending',
      }),
    );

    const saved = await this.findOneWithTable(request.id);
    await this.notifyRequestCreated(saved);
    return saved;
  }

  private async findOneWithTable(id: number): Promise<ServiceRequest> {
    const request = await this.serviceRequestsRepository.findOne({
      where: { id },
      relations: ['diningTable'],
    });
    if (!request) {
      throw new NotFoundException(`Service request ${id} not found`);
    }
    return request;
  }

  /** Persists an outlet notification and pushes both it and the request over the websocket. */
  private async notifyRequestCreated(request: ServiceRequest): Promise<void> {
    const tableName =
      request.diningTable?.name ?? `Table ${request.diningTableId}`;
    const notification = await this.notificationsService.create({
      outletId: request.outletId,
      type: 'service_request',
      title: `${tableName} — needs ${SERVICE_LABELS[request.type]}`,
      body: request.note ?? null,
      tableName,
      data: JSON.stringify({
        serviceRequestId: request.id,
        type: request.type,
      }),
    });
    this.gateway.notifyServiceRequestCreated(request);
    this.gateway.notifyNotificationCreated(notification);
  }
}
