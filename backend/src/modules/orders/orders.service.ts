import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PaginatedResponse } from '../../common/dto/paginated-response.interface';
import { generateDocumentNumber } from '../../common/utils/document-number.util';
import { AddonsService } from '../addons/addons.service';
import { CustomersService } from '../customers/customers.service';
import { DiningTablesService } from '../dining-tables/dining-tables.service';
import { FoodVariantsService } from '../food-variants/food-variants.service';
import { FoodsService } from '../foods/foods.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { WarehouseIngredientStocksService } from '../inventory-stock/warehouse-ingredient-stocks.service';
import { OutletDepartmentsService } from '../outlet-departments/outlet-departments.service';
import { OutletsService } from '../outlets/outlets.service';
import { OrderPayment } from '../order-payments/entities/order-payment.entity';
import { ReservationsService } from '../reservations/reservations.service';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { UnitsService } from '../units/units.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { AssignOrderTableDto } from './dto/assign-order-table.dto';
import { CreateOrderItemAddonDto } from './dto/create-order-item-addon.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrderItemsQueryDto } from './dto/list-order-items-query.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { OrderItemIngredientReservation } from './entities/order-item-ingredient-reservation.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderTable } from './entities/order-table.entity';
import { Order } from './entities/order.entity';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(OrderItemAddon)
    private readonly orderItemAddonsRepository: Repository<OrderItemAddon>,
    @InjectRepository(OrderTable)
    private readonly orderTablesRepository: Repository<OrderTable>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoriesRepository: Repository<OrderStatusHistory>,
    @InjectRepository(OrderPayment)
    private readonly orderPaymentsRepository: Repository<OrderPayment>,
    @InjectRepository(OrderItemIngredientReservation)
    private readonly reservationsRepository: Repository<OrderItemIngredientReservation>,
    private readonly outletsService: OutletsService,
    private readonly tableSessionsService: TableSessionsService,
    private readonly customersService: CustomersService,
    private readonly reservationsService: ReservationsService,
    private readonly diningTablesService: DiningTablesService,
    private readonly foodsService: FoodsService,
    private readonly foodVariantsService: FoodVariantsService,
    private readonly addonsService: AddonsService,
    private readonly outletDepartmentsService: OutletDepartmentsService,
    private readonly ingredientsService: IngredientsService,
    private readonly unitsService: UnitsService,
    private readonly warehousesService: WarehousesService,
    private readonly warehouseIngredientStocksService: WarehouseIngredientStocksService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------- orders

  async findAll(query: ListOrdersQueryDto): Promise<PaginatedResponse<Order>> {
    const { page, limit, search, outletId, status } = query;
    const where: FindOptionsWhere<Order> = {};
    if (outletId !== undefined) {
      where.outletId = outletId;
    }
    if (status !== undefined) {
      where.status = status;
    }
    if (search) {
      where.orderNumber = ILike(`%${search}%`);
    }

    const [orders, total] = await this.ordersRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Internal lookup used by OrderPaymentsService and by this service's own sub-resources. */
  async findOne(id: number): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  async create(dto: CreateOrderDto, createdBy: number): Promise<Order> {
    await this.outletsService.findOne(dto.outletId);
    if (dto.tableSessionId !== undefined) {
      const session = await this.tableSessionsService.findOne(
        dto.tableSessionId,
      );
      if (session.outletId !== dto.outletId) {
        throw new BadRequestException(
          `Table session ${dto.tableSessionId} does not belong to outlet ${dto.outletId}`,
        );
      }
    }
    if (dto.customerId !== undefined) {
      await this.customersService.findOne(dto.customerId);
    }
    if (dto.reservationId !== undefined) {
      const reservation = await this.reservationsService.findOne(
        dto.reservationId,
      );
      if (reservation.outletId !== dto.outletId) {
        throw new BadRequestException(
          `Reservation ${dto.reservationId} does not belong to outlet ${dto.outletId}`,
        );
      }
    }

    const order = this.ordersRepository.create({
      outletId: dto.outletId,
      tableSessionId: dto.tableSessionId ?? null,
      customerId: dto.customerId ?? null,
      reservationId: dto.reservationId ?? null,
      orderType: dto.orderType ?? 'dine_in',
      note: dto.note ?? null,
      orderNumber: this.generateOrderNumber(dto.outletId),
      createdBy,
    });

    return this.ordersRepository.save(order);
  }

  async update(id: number, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);

    Object.assign(order, {
      ...(dto.note !== undefined && { note: dto.note }),
      ...(dto.discountType !== undefined && { discountType: dto.discountType }),
      ...(dto.discountValue !== undefined && {
        discountValue: dto.discountValue,
      }),
      ...(dto.taxAmount !== undefined && { taxAmount: dto.taxAmount }),
      ...(dto.serviceChargeAmount !== undefined && {
        serviceChargeAmount: dto.serviceChargeAmount,
      }),
    });
    await this.ordersRepository.save(order);

    return this.recalculateTotals(id);
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    changedBy: number,
  ): Promise<Order> {
    const order = await this.findOne(id);
    const fromStatus = order.status;

    order.status = dto.status;
    if (dto.status === 'completed') {
      order.completedAt = new Date();
    }
    if (dto.status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancelledBy = changedBy;
      if (dto.cancelReason !== undefined) {
        order.cancelReason = dto.cancelReason;
      }
    }
    const saved = await this.ordersRepository.save(order);

    await this.orderStatusHistoriesRepository.save(
      this.orderStatusHistoriesRepository.create({
        orderId: id,
        changedBy,
        fromStatus,
        toStatus: dto.status,
        note: dto.note ?? null,
      }),
    );

    if (dto.status === 'completed') {
      await this.consumeReservationsForOrder(id, changedBy);
    } else if (dto.status === 'cancelled') {
      await this.releaseReservationsForOrder(id);
    }

    return saved;
  }

  // ------------------------------------------------------------ order items

  async listItems(
    query: ListOrderItemsQueryDto,
  ): Promise<PaginatedResponse<OrderItem>> {
    const { page, limit, orderId } = query;
    const where: FindOptionsWhere<OrderItem> = {};
    if (orderId !== undefined) {
      where.orderId = orderId;
    }

    const [items, total] = await this.orderItemsRepository.findAndCount({
      where,
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findItem(id: number): Promise<OrderItem> {
    const item = await this.orderItemsRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Order item ${id} not found`);
    }
    return item;
  }

  async addItem(orderId: number, dto: CreateOrderItemDto): Promise<OrderItem> {
    const order = await this.findOne(orderId);

    const department = await this.outletDepartmentsService.findOne(
      dto.preparationDepartmentId,
    );
    if (department.outletId !== order.outletId) {
      throw new BadRequestException(
        `Department ${dto.preparationDepartmentId} does not belong to outlet ${order.outletId}`,
      );
    }

    let unitPrice: number;
    if (dto.foodVariantId !== undefined) {
      const { variant, price } =
        await this.foodVariantsService.resolvePriceForOutlet(
          dto.foodVariantId,
          order.outletId,
        );
      if (variant.foodId !== dto.foodId) {
        throw new BadRequestException(
          `Food variant ${dto.foodVariantId} does not belong to food ${dto.foodId}`,
        );
      }
      unitPrice = price;
    } else {
      const { price } = await this.foodsService.resolvePriceForOutlet(
        dto.foodId,
        order.outletId,
      );
      unitPrice = price;
    }

    const quantity = dto.quantity ?? 1;
    const item = this.orderItemsRepository.create({
      orderId,
      foodId: dto.foodId,
      foodVariantId: dto.foodVariantId ?? null,
      preparationDepartmentId: dto.preparationDepartmentId,
      quantity,
      unitPrice,
      totalAmount: round2(quantity * unitPrice),
      note: dto.note ?? null,
    });
    const saved = await this.orderItemsRepository.save(item);

    await this.recalculateTotals(orderId);
    try {
      await this.recalculateReservations(saved.id);
    } catch (error) {
      // Roll back the item — its ingredient requirement couldn't be reserved.
      await this.orderItemsRepository.remove(saved);
      await this.recalculateTotals(orderId);
      throw error;
    }
    return saved;
  }

  async updateItem(id: number, dto: UpdateOrderItemDto): Promise<OrderItem> {
    const item = await this.findItem(id);
    const previousQuantity = item.quantity;

    if (dto.quantity !== undefined) {
      item.quantity = dto.quantity;
      item.totalAmount = round2(dto.quantity * item.unitPrice);
    }
    Object.assign(item, {
      ...(dto.note !== undefined && { note: dto.note }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.cancelReason !== undefined && {
        cancelReason: dto.cancelReason,
      }),
    });
    const saved = await this.orderItemsRepository.save(item);

    await this.recalculateTotals(item.orderId);

    if (dto.quantity !== undefined) {
      try {
        await this.recalculateReservations(id);
      } catch (error) {
        saved.quantity = previousQuantity;
        saved.totalAmount = round2(previousQuantity * saved.unitPrice);
        await this.orderItemsRepository.save(saved);
        await this.recalculateTotals(item.orderId);
        throw error;
      }
    }

    return saved;
  }

  async removeItem(id: number): Promise<void> {
    const item = await this.findItem(id);
    const reservations = await this.reservationsRepository.find({
      where: { orderItemId: id, status: 'reserved' },
    });
    for (const reservation of reservations) {
      await this.warehouseIngredientStocksService.reserve(
        reservation.warehouseId,
        reservation.ingredientId,
        -reservation.reservedQuantity,
      );
    }
    await this.orderItemsRepository.remove(item);
    await this.recalculateTotals(item.orderId);
  }

  // ------------------------------------------------------- order item addons

  async listItemAddons(orderItemId: number): Promise<OrderItemAddon[]> {
    await this.findItem(orderItemId);
    return this.orderItemAddonsRepository.find({ where: { orderItemId } });
  }

  async addItemAddon(
    orderItemId: number,
    dto: CreateOrderItemAddonDto,
  ): Promise<OrderItemAddon> {
    const item = await this.findItem(orderItemId);
    const addon = await this.addonsService.findOne(dto.addonId);

    const quantity = dto.quantity ?? 1;
    const saved = await this.orderItemAddonsRepository.save(
      this.orderItemAddonsRepository.create({
        orderItemId,
        addonId: addon.id,
        quantity,
        unitPrice: addon.price,
        totalAmount: round2(quantity * addon.price),
      }),
    );

    await this.recalculateTotals(item.orderId);
    try {
      await this.recalculateReservations(orderItemId);
    } catch (error) {
      await this.orderItemAddonsRepository.remove(saved);
      await this.recalculateTotals(item.orderId);
      throw error;
    }
    return saved;
  }

  async removeItemAddon(orderItemId: number, addonId: number): Promise<void> {
    const item = await this.findItem(orderItemId);
    await this.orderItemAddonsRepository.delete({ orderItemId, addonId });
    await this.recalculateTotals(item.orderId);
    await this.recalculateReservations(orderItemId);
  }

  // -------------------------------------------------------- ingredient reservations

  /** Read-only visibility into what an order item currently holds/consumed/released. */
  async listItemReservations(
    orderItemId: number,
  ): Promise<OrderItemIngredientReservation[]> {
    await this.findItem(orderItemId);
    return this.reservationsRepository.find({ where: { orderItemId } });
  }

  // ------------------------------------------------------------- order tables

  async listTables(orderId: number): Promise<OrderTable[]> {
    await this.findOne(orderId);
    return this.orderTablesRepository.find({ where: { orderId } });
  }

  async assignTable(
    orderId: number,
    dto: AssignOrderTableDto,
    assignedBy: number,
  ): Promise<OrderTable> {
    const order = await this.findOne(orderId);
    const table = await this.diningTablesService.findOne(dto.diningTableId);
    if (table.outletId !== order.outletId) {
      throw new BadRequestException(
        `Dining table ${dto.diningTableId} does not belong to outlet ${order.outletId}`,
      );
    }

    const existing = await this.orderTablesRepository.findOne({
      where: { orderId, diningTableId: dto.diningTableId },
    });
    if (existing) {
      return existing; // idempotent
    }

    return this.orderTablesRepository.save(
      this.orderTablesRepository.create({
        orderId,
        diningTableId: dto.diningTableId,
        assignmentType: dto.assignmentType ?? 'added_on_arrival',
        assignedBy,
      }),
    );
  }

  async unassignTable(orderId: number, diningTableId: number): Promise<void> {
    await this.findOne(orderId);
    await this.orderTablesRepository.delete({ orderId, diningTableId });
  }

  // --------------------------------------------------------------- payments

  /** Called by OrderPaymentsService after saving a new completed payment/refund row. */
  async recalculatePayments(orderId: number): Promise<void> {
    const order = await this.findOne(orderId);
    const payments = await this.orderPaymentsRepository.find({
      where: { orderId, status: 'completed' },
    });

    const paidAmount = round2(
      payments
        .filter((p) => p.type === 'payment')
        .reduce((sum, p) => sum + p.amount, 0),
    );
    const refundedAmount = round2(
      payments
        .filter((p) => p.type === 'refund')
        .reduce((sum, p) => sum + p.amount, 0),
    );

    order.paidAmount = paidAmount;
    order.refundedAmount = refundedAmount;
    order.dueAmount = Math.max(round2(order.grandTotal - paidAmount), 0);

    if (refundedAmount > 0 && refundedAmount >= paidAmount) {
      order.paymentStatus = 'refunded';
    } else if (paidAmount <= 0) {
      order.paymentStatus = 'unpaid';
    } else if (paidAmount >= order.grandTotal) {
      order.paymentStatus = 'paid';
    } else {
      order.paymentStatus = 'partial';
    }

    await this.ordersRepository.save(order);
  }

  // ---------------------------------------------------------------- private

  private async recalculateTotals(orderId: number): Promise<Order> {
    const order = await this.findOne(orderId);
    const items = await this.orderItemsRepository.find({ where: { orderId } });
    const itemIds = items.map((item) => item.id);

    const itemsTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const addons = itemIds.length
      ? await this.orderItemAddonsRepository.find({
          where: { orderItemId: In(itemIds) },
        })
      : [];
    const addonsTotal = addons.reduce(
      (sum, addon) => sum + addon.totalAmount,
      0,
    );

    const subtotal = round2(itemsTotal + addonsTotal);
    const discountAmount =
      order.discountType === 'flat'
        ? order.discountValue
        : order.discountType === 'percentage'
          ? round2((subtotal * order.discountValue) / 100)
          : 0;
    const grandTotal = round2(
      subtotal - discountAmount + order.taxAmount + order.serviceChargeAmount,
    );

    order.subtotal = subtotal;
    order.discountAmount = discountAmount;
    order.grandTotal = grandTotal;
    order.dueAmount = Math.max(round2(grandTotal - order.paidAmount), 0);

    return this.ordersRepository.save(order);
  }

  private generateOrderNumber(outletId: number): string {
    return generateDocumentNumber('ORD', outletId);
  }

  /**
   * Merges a recipe-enabled food's food_recipes (variant-override rule,
   * scaled by item quantity) with every recipe-enabled addon's addon_recipes
   * (scaled by that addon's own quantity), converting every row into the
   * ingredient's base unit. Foods/addons without isRecipeEnabled contribute
   * nothing — zero behavior change for the vast majority of the menu.
   */
  private async resolveRequiredIngredients(
    item: OrderItem,
  ): Promise<Map<number, number>> {
    const required = new Map<number, number>();

    const food = await this.foodsService.findOne(item.foodId);
    if (food.isRecipeEnabled) {
      const recipes = await this.foodsService.resolveRecipes(
        item.foodId,
        item.foodVariantId,
      );
      for (const recipe of recipes) {
        const ingredient = await this.ingredientsService.findOne(
          recipe.ingredientId,
        );
        const multiplier = await this.unitsService.findConversionMultiplier(
          recipe.unitId,
          ingredient.baseUnitId,
        );
        const qty = round4(
          (recipe.quantity + recipe.wastageQuantity) *
            multiplier *
            item.quantity,
        );
        required.set(
          recipe.ingredientId,
          round4((required.get(recipe.ingredientId) ?? 0) + qty),
        );
      }
    }

    const itemAddons = await this.orderItemAddonsRepository.find({
      where: { orderItemId: item.id },
    });
    for (const itemAddon of itemAddons) {
      const addon = await this.addonsService.findOne(itemAddon.addonId);
      if (!addon.isRecipeEnabled) {
        continue;
      }
      const recipes = await this.addonsService.resolveRecipes(addon.id);
      for (const recipe of recipes) {
        const ingredient = await this.ingredientsService.findOne(
          recipe.ingredientId,
        );
        const multiplier = await this.unitsService.findConversionMultiplier(
          recipe.unitId,
          ingredient.baseUnitId,
        );
        const qty = round4(
          (recipe.quantity + recipe.wastageQuantity) *
            multiplier *
            itemAddon.quantity,
        );
        required.set(
          recipe.ingredientId,
          round4((required.get(recipe.ingredientId) ?? 0) + qty),
        );
      }
    }

    return required;
  }

  /**
   * Full recompute (not an incremental delta) of an order item's ingredient
   * reservations — called after anything that changes what it needs (item
   * add/quantity-update, addon add/remove). Diffs the freshly-resolved
   * requirement against existing `reserved` rows and adjusts
   * `reservedQuantity` by the delta per ingredient; a positive delta can
   * throw (insufficient available stock).
   */
  private async recalculateReservations(orderItemId: number): Promise<void> {
    const item = await this.findItem(orderItemId);
    const required = await this.resolveRequiredIngredients(item);

    const existing = await this.reservationsRepository.find({
      where: { orderItemId, status: 'reserved' },
    });
    if (required.size === 0 && existing.length === 0) {
      // Nothing to reserve and nothing previously reserved — skip entirely,
      // so foods/addons without isRecipeEnabled never require a default
      // warehouse to be configured for the order's outlet.
      return;
    }

    const order = await this.findOne(item.orderId);
    const warehouse = await this.warehousesService.findDefaultForOutlet(
      order.outletId,
    );
    const existingByIngredient = new Map(
      existing.map((reservation) => [reservation.ingredientId, reservation]),
    );

    await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(
        OrderItemIngredientReservation,
      );

      for (const reservation of existing) {
        if (!required.has(reservation.ingredientId)) {
          await this.warehouseIngredientStocksService.reserve(
            reservation.warehouseId,
            reservation.ingredientId,
            -reservation.reservedQuantity,
            manager,
          );
          await reservationRepo.remove(reservation);
        }
      }

      for (const [ingredientId, requiredQty] of required) {
        const existingReservation = existingByIngredient.get(ingredientId);
        const currentReserved = existingReservation?.reservedQuantity ?? 0;
        const delta = round4(requiredQty - currentReserved);

        if (delta !== 0) {
          await this.warehouseIngredientStocksService.reserve(
            warehouse.id,
            ingredientId,
            delta,
            manager,
          );
        }

        if (existingReservation) {
          existingReservation.reservedQuantity = requiredQty;
          await reservationRepo.save(existingReservation);
        } else if (requiredQty > 0) {
          await reservationRepo.save(
            reservationRepo.create({
              orderItemId,
              warehouseId: warehouse.id,
              ingredientId,
              reservedQuantity: requiredQty,
              consumedQuantity: 0,
              wastageQuantity: 0,
              status: 'reserved',
            }),
          );
        }
      }
    });
  }

  /** On order completion: every reserved row posts sale_consume and becomes consumed. */
  private async consumeReservationsForOrder(
    orderId: number,
    changedBy: number,
  ): Promise<void> {
    const items = await this.orderItemsRepository.find({
      where: { orderId },
    });
    for (const item of items) {
      const reservations = await this.reservationsRepository.find({
        where: { orderItemId: item.id, status: 'reserved' },
      });
      for (const reservation of reservations) {
        await this.dataSource.transaction(async (manager) => {
          await this.warehouseIngredientStocksService.reserve(
            reservation.warehouseId,
            reservation.ingredientId,
            -reservation.reservedQuantity,
            manager,
          );
          await this.warehouseIngredientStocksService.applyMovement({
            warehouseId: reservation.warehouseId,
            ingredientId: reservation.ingredientId,
            quantityDelta: -reservation.reservedQuantity,
            transactionType: 'sale_consume',
            referenceType: 'order_item',
            referenceId: reservation.orderItemId,
            createdBy: changedBy,
            manager,
          });
        });
        reservation.consumedQuantity = reservation.reservedQuantity;
        reservation.status = 'consumed';
        await this.reservationsRepository.save(reservation);
      }
    }
  }

  /** On order cancellation: every reserved row releases with no ledger effect. */
  private async releaseReservationsForOrder(orderId: number): Promise<void> {
    const items = await this.orderItemsRepository.find({
      where: { orderId },
    });
    for (const item of items) {
      const reservations = await this.reservationsRepository.find({
        where: { orderItemId: item.id, status: 'reserved' },
      });
      for (const reservation of reservations) {
        await this.warehouseIngredientStocksService.reserve(
          reservation.warehouseId,
          reservation.ingredientId,
          -reservation.reservedQuantity,
        );
        reservation.status = 'released';
        await this.reservationsRepository.save(reservation);
      }
    }
  }
}
