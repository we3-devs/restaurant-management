import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { OutletsService } from '../outlets/outlets.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerOutletDto } from './dto/update-customer-outlet.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerOutlet } from './entities/customer-outlet.entity';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(CustomerOutlet)
    private readonly customerOutletsRepository: Repository<CustomerOutlet>,
    private readonly outletsService: OutletsService,
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
    });

    try {
      return await this.customersRepository.save(customer);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    Object.assign(customer, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.address !== undefined && { address: dto.address }),
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
  ): Promise<CustomerOutlet> {
    await this.outletsService.findOne(outletId);
    const existing = await this.customerOutletsRepository.findOne({
      where: { customerId, outletId },
    });
    const now = new Date();

    if (!existing) {
      return this.customerOutletsRepository.save(
        this.customerOutletsRepository.create({
          customerId,
          outletId,
          firstVisitedAt: now,
          lastVisitedAt: now,
          visitCount: 1,
        }),
      );
    }

    existing.visitCount += 1;
    existing.lastVisitedAt = now;
    return this.customerOutletsRepository.save(existing);
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
