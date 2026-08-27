import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { normalizeNepalPhone } from '../../common/phone';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OutletsService } from '../outlets/outlets.service';
import { SettingsService } from '../settings/settings.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import {
  CustomerOutletResponseDto,
  CustomerResponseDto,
} from './dto/customer-response.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerOutletDto } from './dto/update-customer-outlet.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerOutlet } from './entities/customer-outlet.entity';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(CustomerOutlet)
    private readonly customerOutletsRepository: Repository<CustomerOutlet>,
    private readonly outletsService: OutletsService,
    private readonly loyaltyService: LoyaltyService,
    private readonly settingsService: SettingsService,
  ) {}

  async findAll(
    query: ListCustomersQueryDto,
  ): Promise<PaginatedResponse<CustomerResponseDto>> {
    const { page, limit, search } = query;
    const where: FindOptionsWhere<Customer>[] | FindOptionsWhere<Customer> =
      search
        ? [
            { name: ILike(`%${search}%`) },
            { phone: ILike(`%${search}%`) },
            { email: ILike(`%${search}%`) },
          ]
        : {};

    const [customers, total] = await this.customersRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: customers.map((customer) => this.toResponse(customer)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Internal lookup used by ReservationsService/OrdersService/TableSessionsService
   * to validate a customerId, and by the controller for the detail endpoint.
   * Returns the raw entity — callers that expose it externally must map it
   * via `toResponse()`.
   */
  async findOne(id: number): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async findOneResponse(id: number): Promise<CustomerResponseDto> {
    return this.toResponse(await this.findOne(id));
  }

  async create(dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    const phone = normalizeNepalPhone(dto.phone);
    const customer = this.customersRepository.create({
      name: dto.name,
      phone,
      email: dto.email ?? null,
      address: dto.address ?? null,
      dateOfBirth: dto.dateOfBirth ?? null,
    });

    let saved: Customer;
    try {
      saved = await this.customersRepository.save(customer);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }

    try {
      const loyaltySettings = await this.settingsService.getLoyaltySettings();
      const welcomeBonusPoints = Number(
        loyaltySettings.welcomeBonusPoints ?? 0,
      );
      if (welcomeBonusPoints > 0) {
        await this.loyaltyService.earnPoints(
          saved.id,
          welcomeBonusPoints,
          'welcome_bonus',
        );
        saved.welcomeBonusGranted = true;
        saved = await this.customersRepository.save(saved);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to grant welcome bonus for customer ${saved.id}: ${(error as Error).message}`,
      );
    }

    return this.toResponse(saved);
  }

  async findOrCreateByPhone(phone: string, name: string): Promise<Customer> {
    const normalized = normalizeNepalPhone(phone);
    const existing = await this.customersRepository.findOne({
      where: { phone: normalized },
    });
    if (existing) return existing;
    await this.create({ phone: normalized, name });
    return this.customersRepository.findOneOrFail({ where: { phone: normalized } });
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<CustomerResponseDto> {
    const customer = await this.findOne(id);
    const phone = dto.phone !== undefined ? normalizeNepalPhone(dto.phone) : undefined;

    Object.assign(customer, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(phone !== undefined && { phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      const saved = await this.customersRepository.save(customer);
      return this.toResponse(saved);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.customersRepository.softDelete(id);
  }

  // -------------------------------------------------------- customer outlets

  // A customer isn't itself outlet-scoped (they can walk into any outlet),
  // so unlike every other resource here, listOutlets narrows the *rows*
  // returned rather than blocking the whole call — a staff member sees only
  // this customer's visit history at outlets they themselves can access,
  // not a full cross-outlet picture.
  async listOutlets(
    customerId: number,
    accessibleOutletIds: number[] | 'ALL' = 'ALL',
  ): Promise<CustomerOutletResponseDto[]> {
    await this.findOne(customerId);
    const where: FindOptionsWhere<CustomerOutlet> = { customerId };
    if (accessibleOutletIds !== 'ALL') {
      where.outletId = In(accessibleOutletIds);
    }
    const visits = await this.customerOutletsRepository.find({ where });
    return visits.map((visit) => this.toOutletResponse(visit));
  }

  async updateOutlet(
    customerId: number,
    outletId: number,
    dto: UpdateCustomerOutletDto,
  ): Promise<CustomerOutletResponseDto> {
    await this.findOne(customerId);
    const visit = await this.customerOutletsRepository.findOne({
      where: { customerId, outletId },
    });
    if (!visit) {
      throw new NotFoundException(
        `Customer ${customerId} has no recorded visit to outlet ${outletId}`,
      );
    }

    visit.isFavoriteOutlet = dto.isFavoriteOutlet;
    const saved = await this.customerOutletsRepository.save(visit);
    return this.toOutletResponse(saved);
  }

  /**
   * Find-or-create the visit-stats row for (customerId, outletId). Called by
   * ReservationsService.create() — the one trigger point for visit tracking
   * this phase.
   */
  async upsertVisit(
    customerId: number,
    outletId: number,
    options?: { skipOutletValidation?: boolean },
  ): Promise<CustomerOutlet> {
    const start = Date.now();
    // Callers that already validated outletId this request (e.g.
    // TableSessionsService.create, which loads the outlet in its own
    // validation batch) can skip this — avoids a redundant round trip for
    // an id we already know is good.
    if (!options?.skipOutletValidation) {
      await this.outletsService.findOne(outletId);
    }
    const lookupOutletMs = Date.now() - start;

    const findStart = Date.now();
    const existing = await this.customerOutletsRepository.findOne({
      where: { customerId, outletId },
    });
    const findMs = Date.now() - findStart;
    const now = new Date();

    const saveStart = Date.now();
    const result = !existing
      ? await this.customerOutletsRepository.save(
          this.customerOutletsRepository.create({
            customerId,
            outletId,
            firstVisitedAt: now,
            lastVisitedAt: now,
            visitCount: 1,
          }),
        )
      : await this.customerOutletsRepository.save(
          Object.assign(existing, {
            visitCount: existing.visitCount + 1,
            lastVisitedAt: now,
          }),
        );
    this.logger.debug(
      `upsertVisit(${customerId}, ${outletId}) timing (ms): lookupOutlet=${lookupOutletMs} findExisting=${findMs} save=${Date.now() - saveStart} total=${Date.now() - start}`,
    );
    return result;
  }

  private toResponse(customer: Customer): CustomerResponseDto {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
    };
  }

  private toOutletResponse(visit: CustomerOutlet): CustomerOutletResponseDto {
    return {
      id: visit.id,
      customerId: visit.customerId,
      outletId: visit.outletId,
      firstVisitedAt: visit.firstVisitedAt,
      lastVisitedAt: visit.lastVisitedAt,
      visitCount: visit.visitCount,
      isFavoriteOutlet: visit.isFavoriteOutlet,
    };
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string })?.code === '23505'
    ) {
      return new ConflictException(
        'A customer with this phone or email already exists',
      );
    }
    return error;
  }
}
