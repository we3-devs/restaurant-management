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
import { Order } from '../src/modules/orders/entities/order.entity';
import { OutletDepartment } from '../src/modules/outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { Permission } from '../src/modules/roles/entities/permission.entity';
import { RolePermission } from '../src/modules/roles/entities/role-permission.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { UserRoleAssignment } from '../src/modules/roles/entities/user-role-assignment.entity';
import { User } from '../src/modules/users/entities/user.entity';

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

interface UserResponseBody {
  id: number;
  email: string;
  isActive: boolean;
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
      .send({ foodId, quantity: 2 })
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

  describe('GET /api/order-items — waiter shape and outlet scoping', () => {
    let permissionRepo: Repository<Permission>;
    let rolePermissionRepo: Repository<RolePermission>;
    let roleRepo: Repository<Role>;
    let assignmentRepo: Repository<UserRoleAssignment>;
    let userRepo: Repository<User>;

    let otherOutletId: number;
    let ownOrderId: number;
    let ownItemId: number;
    let otherOrderId: number;
    let scopedWaiterToken: string;
    let waiterUserId: number;
    let waiterRoleId: number;

    const waiterUser = {
      email: 'e2e-order-items-waiter@test.local',
      password: 'Password@123',
    };

    beforeAll(async () => {
      permissionRepo = app.get(getRepositoryToken(Permission));
      rolePermissionRepo = app.get(getRepositoryToken(RolePermission));
      roleRepo = app.get(getRepositoryToken(Role));
      assignmentRepo = app.get(getRepositoryToken(UserRoleAssignment));
      userRepo = app.get(getRepositoryToken(User));

      // A second outlet the scoped waiter is never assigned to — the IDOR
      // this suite is guarding against.
      let otherOutlet = await outletRepo.findOne({
        where: { name: 'E2E Orders Fixture Outlet B' },
      });
      if (!otherOutlet) {
        otherOutlet = await outletRepo.save(
          outletRepo.create({ name: 'E2E Orders Fixture Outlet B' }),
        );
      }
      otherOutletId = otherOutlet.id;

      // Reuse orders.view if seeded, same collision-avoidance as other suites.
      let permission = await permissionRepo.findOne({
        where: { slug: 'orders.view' },
      });
      if (!permission) {
        permission = await permissionRepo.save(
          permissionRepo.create({
            name: 'View Orders',
            slug: 'orders.view',
            module: 'orders',
            action: 'view',
            level: 'global',
          }),
        );
      }

      let role = await roleRepo.findOne({
        where: { slug: 'e2e-order-items-waiter-role' },
      });
      if (!role) {
        role = await roleRepo.save(
          roleRepo.create({
            name: 'E2E Order Items Waiter',
            slug: 'e2e-order-items-waiter-role',
            level: 'global',
            rank: 50,
          }),
        );
      }

      const existingLink = await rolePermissionRepo.findOne({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!existingLink) {
        await rolePermissionRepo.save(
          rolePermissionRepo.create({
            roleId: role.id,
            permissionId: permission.id,
          }),
        );
      }

      // Defensively clear a stale fixture user from a previously-aborted run.
      const stale = await userRepo.findOne({
        where: { email: waiterUser.email },
      });
      if (stale) {
        await assignmentRepo.delete({ userId: stale.id });
        await userRepo.delete(stale.id);
      }

      const created = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Order Items Waiter',
          email: waiterUser.email,
          password: waiterUser.password,
        })
        .expect(201);
      waiterUserId = (created.body as UserResponseBody).id;
      waiterRoleId = role.id;

      await request(app.getHttpServer())
        .post(`/api/users/${waiterUserId}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: role.id })
        .expect(201);

      // The role-assignments endpoint only ever creates 'global' scope
      // (scopeType/outletId aren't client-settable yet — see
      // CreateRoleAssignmentDto). Scope this one down to outletId (the
      // suite's primary fixture outlet, set up in the outer beforeAll) by
      // updating the row directly, so OutletAccessService actually has an
      // outlet-restricted assignment to enforce against.
      await assignmentRepo.update(
        { userId: waiterUserId },
        { scopeType: 'outlet', outletId },
      );

      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(waiterUser)
        .expect(200);
      ({ accessToken: scopedWaiterToken } = login.body as AuthResponseBody);

      // Own-outlet order + item, and an addon on it, so the shape assertions
      // below have something to check for `addonName` on too.
      const ownOrder = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outletId, orderType: 'table' })
        .expect(201);
      ownOrderId = (ownOrder.body as OrderResponseBody).id;
      createdOrderIds.push(ownOrderId);

      const ownItem = await request(app.getHttpServer())
        .post(`/api/orders/${ownOrderId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ foodId, quantity: 1 })
        .expect(201);
      ownItemId = (ownItem.body as OrderItemResponseBody).id;

      await request(app.getHttpServer())
        .post(`/api/order-items/${ownItemId}/addons`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ addonId, quantity: 1 })
        .expect(201);

      // Other-outlet order the scoped waiter must never be able to list.
      const otherOrder = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outletId: otherOutletId, orderType: 'table' })
        .expect(201);
      otherOrderId = (otherOrder.body as OrderResponseBody).id;
      createdOrderIds.push(otherOrderId);
    });

    afterAll(async () => {
      if (waiterUserId) {
        await assignmentRepo.delete({ userId: waiterUserId });
        await userRepo.delete(waiterUserId);
      }
      if (waiterRoleId) {
        await rolePermissionRepo.delete({ roleId: waiterRoleId });
        await roleRepo.delete(waiterRoleId);
      }
    });

    it('rejects listing another outlet\'s order items (IDOR)', async () => {
      await request(app.getHttpServer())
        .get(`/api/order-items?orderId=${otherOrderId}`)
        .set('Authorization', `Bearer ${scopedWaiterToken}`)
        .expect(403);
    });

    it('rejects an unscoped list request (orderId is required)', async () => {
      await request(app.getHttpServer())
        .get('/api/order-items')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it("allows listing the waiter's own outlet order items", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/order-items?orderId=${ownOrderId}`)
        .set('Authorization', `Bearer ${scopedWaiterToken}`)
        .expect(200);

      const body = response.body as {
        data: Record<string, unknown>[];
      };
      expect(body.data).toHaveLength(1);
      const item = body.data[0];
      expect(item.id).toBe(ownItemId);
      expect(item.foodName).toBe('E2E Orders Fixture Food');
      expect(item.addons).toHaveLength(1);
      expect(
        (item.addons as Record<string, unknown>[])[0].addonName,
      ).toBe('E2E Orders Fixture Addon');
    });

    it('never exposes internal-only fields on the waiter shape', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/order-items?orderId=${ownOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const item = (response.body as { data: Record<string, unknown>[] })
        .data[0];
      for (const field of [
        'createdAt',
        'updatedAt',
        'cancelReason',
        'preparationDepartmentId',
      ]) {
        expect(item).not.toHaveProperty(field);
      }
      for (const field of [
        'id',
        'orderId',
        'foodId',
        'foodName',
        'foodVariantId',
        'variantName',
        'quantity',
        'unitPrice',
        'totalAmount',
        'status',
        'isHeld',
        'note',
        'packagingType',
        'addons',
      ]) {
        expect(item).toHaveProperty(field);
      }
    });
  });
});
