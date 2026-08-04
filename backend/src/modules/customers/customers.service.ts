import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OutletsService } from '../outlets/outlets.service';
import { SettingsService } from '../settings/settings.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
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
  ): Promise<PaginatedResponse<Customer>> {
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
      data: customers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by ReservationsService/OrdersService/TableSessionsService to validate a customerId. */
  async findOne(id: number): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const customer = this.customersRepository.create({
      name: dto.name,
      phone: dto.phone ?? null,
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

    return saved;
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    Object.assign(customer, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    try {
      return await this.customersRepository.save(customer);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.customersRepository.softDelete(id);
  }

  // -------------------------------------------------------- customer outlets

  async listOutlets(customerId: number): Promise<CustomerOutlet[]> {
    await this.findOne(customerId);
    return this.customerOutletsRepository.find({ where: { customerId } });
  }

  async updateOutlet(
    customerId: number,
    outletId: number,
    dto: UpdateCustomerOutletDto,
  ): Promise<CustomerOutlet> {
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
    return this.customerOutletsRepository.save(visit);
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
