import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Customer, CustomerAddress } from '../customers/entities/customer.entity';
import { FoodsService } from '../foods/foods.service';
import { LoyaltyAccount } from '../loyalty/entities/loyalty-account.entity';
import { LoyaltyTransaction } from '../loyalty/entities/loyalty-transaction.entity';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OrderPayment } from '../order-payments/entities/order-payment.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpsertAddressDto } from './dto/upsert-address.dto';

@Injectable()
export class CustomerPortalService {
  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderPayment)
    private readonly orderPaymentsRepository: Repository<OrderPayment>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    private readonly loyaltyService: LoyaltyService,
    private readonly auditLogsService: AuditLogsService,
    private readonly foodsService: FoodsService,
  ) {}

  private async requireCustomer(customerId: number): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
    return customer;
  }

  // --------------------------------------------------------------- profile

  async getProfile(customerId: number): Promise<Customer> {
    return this.requireCustomer(customerId);
  }

  async updateProfile(
    customerId: number,
    dto: UpdateProfileDto,
  ): Promise<Customer> {
    const customer = await this.requireCustomer(customerId);
    const oldValues = { ...customer };

    Object.assign(customer, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth }),
    });

    let saved: Customer;
    try {
      saved = await this.customersRepository.save(customer);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'A customer with this phone or email already exists',
        );
      }
      throw error;
    }

    await this.auditLogsService.record({
      action: 'update',
      entityType: 'customer_profile',
      entityId: customerId,
      oldValues,
      newValues: saved,
    });

    return saved;
  }

  async updatePreferences(
    customerId: number,
    dto: UpdatePreferencesDto,
  ): Promise<Customer> {
    const customer = await this.requireCustomer(customerId);
    if (dto.dietaryPreferences !== undefined) {
      customer.dietaryPreferences = dto.dietaryPreferences;
    }
    if (dto.allergies !== undefined) {
      customer.allergies = dto.allergies;
    }
    const saved = await this.customersRepository.save(customer);

    await this.auditLogsService.record({
      action: 'update',
      entityType: 'customer_preferences',
      entityId: customerId,
      newValues: {
        dietaryPreferences: saved.dietaryPreferences,
        allergies: saved.allergies,
      },
    });

    return saved;
  }

  // ------------------------------------------------------------- addresses

  async listAddresses(customerId: number): Promise<CustomerAddress[]> {
    const customer = await this.requireCustomer(customerId);
    return customer.addresses ?? [];
  }

  async addAddress(
    customerId: number,
    dto: UpsertAddressDto,
  ): Promise<CustomerAddress[]> {
    const customer = await this.requireCustomer(customerId);
    const addresses = customer.addresses ?? [];
    const address: CustomerAddress = {
      id: randomUUID(),
      label: dto.label,
      line1: dto.line1,
      line2: dto.line2,
      city: dto.city,
      isDefault: dto.isDefault ?? addresses.length === 0,
    };
    if (address.isDefault) {
      addresses.forEach((existing) => (existing.isDefault = false));
    }
    addresses.push(address);
    customer.addresses = addresses;
    await this.customersRepository.save(customer);
    return addresses;
  }

  async removeAddress(
    customerId: number,
    addressId: string,
  ): Promise<CustomerAddress[]> {
    const customer = await this.requireCustomer(customerId);
    const addresses = (customer.addresses ?? []).filter(
      (a) => a.id !== addressId,
    );
    customer.addresses = addresses;
    await this.customersRepository.save(customer);
    return addresses;
  }

  // -------------------------------------------------------------- favorites

  async listFavorites(customerId: number): Promise<number[]> {
    const customer = await this.requireCustomer(customerId);
    return customer.favoriteFoodIds ?? [];
  }

  async toggleFavorite(
    customerId: number,
    foodId: number,
  ): Promise<number[]> {
    const customer = await this.requireCustomer(customerId);
    const favorites = new Set(customer.favoriteFoodIds ?? []);
    if (favorites.has(foodId)) {
      favorites.delete(foodId);
    } else {
      favorites.add(foodId);
    }
    customer.favoriteFoodIds = Array.from(favorites);
    await this.customersRepository.save(customer);
    return customer.favoriteFoodIds;
  }

  // ---------------------------------------------------------------- orders

  async listOrders(
    customerId: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Order>> {
    const { page, limit } = query;
    const [data, total] = await this.ordersRepository.findAndCount({
      where: { customerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getOrder(
    customerId: number,
    orderId: number,
  ): Promise<Order & { items: (OrderItem & { foodName: string })[] }> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.customerId !== customerId) {
      throw new ForbiddenException('This order does not belong to you');
    }
    const items = await this.orderItemsRepository.find({
      where: { orderId },
    });
    const foods = await this.foodsService.findByIds(
      items.map((item) => item.foodId),
    );
    const items_ = items.map((item) => ({
      ...item,
      foodName:
        foods.find((food) => food.id === item.foodId)?.name ?? 'Unknown item',
    }));
    return { ...order, items: items_ };
  }

  // -------------------------------------------------------------- invoices

  async getInvoice(
    customerId: number,
    orderId: number,
  ): Promise<{ order: Order; payments: OrderPayment[] }> {
    const order = await this.getOrder(customerId, orderId);
    const payments = await this.orderPaymentsRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
    return { order, payments };
  }

  // --------------------------------------------------------------- loyalty

  async getLoyalty(customerId: number): Promise<LoyaltyAccount> {
    await this.requireCustomer(customerId);
    return this.loyaltyService.getAccountByCustomer(customerId);
  }

  async getLoyaltyHistory(
    customerId: number,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<LoyaltyTransaction>> {
    await this.requireCustomer(customerId);
    return this.loyaltyService.findTransactions({
      ...query,
      customerId,
    });
  }
}
