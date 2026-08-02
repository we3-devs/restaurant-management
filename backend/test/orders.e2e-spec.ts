import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AddonGroup } from '../src/modules/addon-groups/entities/addon-group.entity';
import { Addon } from '../src/modules/addons/entities/addon.entity';
import { DiningArea } from '../src/modules/dining-areas/entities/dining-area.entity';
import { DiningTable } from '../src/modules/dining-tables/entities/dining-table.entity';
import { FoodOutlet } from '../src/modules/foods/entities/food-outlet.entity';
import { Food } from '../src/modules/foods/entities/food.entity';
import { OrderItemAddon } from '../src/modules/orders/entities/order-item-addon.entity';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import { OrderStatusHistory } from '../src/modules/orders/entities/order-status-history.entity';
import { OrderTable } from '../src/modules/orders/entities/order-table.entity';
import { Order } from '../src/modules/orders/entities/order.entity';
import { OutletDepartment } from '../src/modules/outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface OrderResponseBody {
  id: number;
  outletId: number;
  status: string;
  subtotal: number;
  grandTotal: number;
}

interface OrderItemResponseBody {
  id: number;
  unitPrice: number;
  totalAmount: number;
}

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let departmentRepo: Repository<OutletDepartment>;
  let foodRepo: Repository<Food>;
  let foodOutletRepo: Repository<FoodOutlet>;
  let addonGroupRepo: Repository<AddonGroup>;
  let addonRepo: Repository<Addon>;
  let diningAreaRepo: Repository<DiningArea>;
  let diningTableRepo: Repository<DiningTable>;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;
  let orderItemAddonRepo: Repository<OrderItemAddon>;
  let orderTableRepo: Repository<OrderTable>;
  let orderStatusHistoryRepo: Repository<OrderStatusHistory>;

  let adminToken: string;
  let outletId: number;
  let departmentId: number;
  let foodId: number;
  let addonId: number;
  let tableId: number;
  const overridePrice = 15.5;
  const basePrice = 9.99;
  const addonPrice = 2.25;

  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    outletRepo = moduleFixture.get(getRepositoryToken(Outlet));
    departmentRepo = moduleFixture.get(getRepositoryToken(OutletDepartment));
    foodRepo = moduleFixture.get(getRepositoryToken(Food));
    foodOutletRepo = moduleFixture.get(getRepositoryToken(FoodOutlet));
    addonGroupRepo = moduleFixture.get(getRepositoryToken(AddonGroup));
    addonRepo = moduleFixture.get(getRepositoryToken(Addon));
    diningAreaRepo = moduleFixture.get(getRepositoryToken(DiningArea));
    diningTableRepo = moduleFixture.get(getRepositoryToken(DiningTable));
    orderRepo = moduleFixture.get(getRepositoryToken(Order));
    orderItemRepo = moduleFixture.get(getRepositoryToken(OrderItem));
    orderItemAddonRepo = moduleFixture.get(getRepositoryToken(OrderItemAddon));
    orderTableRepo = moduleFixture.get(getRepositoryToken(OrderTable));
    orderStatusHistoryRepo = moduleFixture.get(
      getRepositoryToken(OrderStatusHistory),
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Orders Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Orders Fixture Outlet' }),
      );
    }
    outletId = outlet.id;

    let department = await departmentRepo.findOne({
      where: { outletId, name: 'E2E Orders Fixture Kitchen' },
    });
    if (!department) {
      department = await departmentRepo.save(
        departmentRepo.create({ outletId, name: 'E2E Orders Fixture Kitchen' }),
      );
    }
    departmentId = department.id;

    let food = await foodRepo.findOne({
      where: { slug: 'e2e-orders-fixture-food' },
    });
    if (!food) {
      food = await foodRepo.save(
        foodRepo.create({
          name: 'E2E Orders Fixture Food',
          slug: 'e2e-orders-fixture-food',
          basePrice,
        }),
      );
    }
    foodId = food.id;

    let override = await foodOutletRepo.findOne({
      where: { foodId, outletId },
    });
    if (!override) {
      override = await foodOutletRepo.save(
        foodOutletRepo.create({ foodId, outletId, price: overridePrice }),
      );
    } else {
      override.price = overridePrice;
      override.isAvailable = true;
      await foodOutletRepo.save(override);
    }

    let addonGroup = await addonGroupRepo.findOne({
      where: { name: 'E2E Orders Fixture Addon Group' },
    });
    if (!addonGroup) {
      addonGroup = await addonGroupRepo.save(
        addonGroupRepo.create({ name: 'E2E Orders Fixture Addon Group' }),
      );
    }

    let addon = await addonRepo.findOne({
      where: { name: 'E2E Orders Fixture Addon' },
    });
    if (!addon) {
      addon = await addonRepo.save(
        addonRepo.create({
          addonGroupId: addonGroup.id,
          name: 'E2E Orders Fixture Addon',
          price: addonPrice,
        }),
      );
    }
    addonId = addon.id;

    let area = await diningAreaRepo.findOne({
      where: { outletId, name: 'E2E Orders Fixture Area' },
    });
    if (!area) {
      area = await diningAreaRepo.save(
        diningAreaRepo.create({ outletId, name: 'E2E Orders Fixture Area' }),
      );
    }

    let table = await diningTableRepo.findOne({
      where: {
        outletId,
        diningAreaId: area.id,
        name: 'E2E Orders Fixture Table',
      },
    });
    if (!table) {
      table = await diningTableRepo.save(
        diningTableRepo.create({
          outletId,
          diningAreaId: area.id,
          name: 'E2E Orders Fixture Table',
        }),
      );
    }
    tableId = table.id;
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      const orderId = createdOrderIds[0];
      const items = await orderItemRepo.find({ where: { orderId } });
      if (items.length > 0) {
        await orderItemAddonRepo.delete({
          orderItemId: items[0].id,
        });
      }
      await orderItemRepo.delete({ orderId });
      await orderTableRepo.delete({ orderId });
      await orderStatusHistoryRepo.delete({ orderId });
      await orderRepo.delete(createdOrderIds);
    }
    await app.close();
  });

  let orderId: number;
  let itemId: number;

  it('POST /api/orders creates an order', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId, orderType: 'table' })
      .expect(201);

    const body = response.body as OrderResponseBody;
    expect(body.outletId).toBe(outletId);
    expect(body.status).toBe('pending');
    expect(body.subtotal).toBe(0);
    orderId = body.id;
    createdOrderIds.push(orderId);
  });

  it('POST /api/orders/:id/items snapshots the outlet-override price, not the base price', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ foodId, preparationDepartmentId: departmentId, quantity: 2 })
      .expect(201);

    const body = response.body as OrderItemResponseBody;
    expect(body.unitPrice).toBe(overridePrice);
    expect(body.unitPrice).not.toBe(basePrice);
    expect(body.totalAmount).toBe(overridePrice * 2);
    itemId = body.id;

    const order = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((order.body as OrderResponseBody).subtotal).toBe(overridePrice * 2);
    expect((order.body as OrderResponseBody).grandTotal).toBe(
      overridePrice * 2,
    );
  });

  it('POST /api/order-items/:id/addons adds an addon and rolls it into order totals', async () => {
    await request(app.getHttpServer())
      .post(`/api/order-items/${itemId}/addons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ addonId, quantity: 1 })
      .expect(201);

    const expectedSubtotal = overridePrice * 2 + addonPrice;

    const order = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((order.body as OrderResponseBody).subtotal).toBe(expectedSubtotal);
    expect((order.body as OrderResponseBody).grandTotal).toBe(expectedSubtotal);
  });

  it('POST /api/orders/:id/tables assigns a dining table (idempotent)', async () => {
    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ diningTableId: tableId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ diningTableId: tableId })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('PATCH /api/orders/:id/status transitions status and logs order_status_histories', async () => {
    await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'accepted' })
      .expect(200);

    const history = await orderStatusHistoryRepo.find({ where: { orderId } });
    expect(history).toHaveLength(1);
    expect(history[0].fromStatus).toBe('pending');
    expect(history[0].toStatus).toBe('accepted');
  });

  it('DELETE /api/order-items/:id removes the item and recalculates totals back down', async () => {
    await request(app.getHttpServer())
      .delete(`/api/order-items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const order = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((order.body as OrderResponseBody).subtotal).toBe(0);
    expect((order.body as OrderResponseBody).grandTotal).toBe(0);
  });
});
