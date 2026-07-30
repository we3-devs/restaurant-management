import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Addon } from '../src/modules/addons/entities/addon.entity';
import { AddonRecipe } from '../src/modules/addons/entities/addon-recipe.entity';
import { OutletDepartment } from '../src/modules/outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { Food } from '../src/modules/foods/entities/food.entity';
import { FoodRecipe } from '../src/modules/foods/entities/food-recipe.entity';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { Warehouse } from '../src/modules/warehouses/entities/warehouse.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface OrderResponseBody {
  id: number;
  status: string;
}

interface OrderItemResponseBody {
  id: number;
}

interface DocResponseBody {
  id: number;
}

interface StockResponseBody {
  data: { quantity: string | number; reservedQuantity: string | number }[];
}

interface ReservationResponseBody {
  ingredientId: number;
  reservedQuantity: string | number;
  consumedQuantity: string | number;
  status: string;
}

describe('Order ingredient reservations (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let departmentRepo: Repository<OutletDepartment>;
  let warehouseRepo: Repository<Warehouse>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let foodRepo: Repository<Food>;
  let foodRecipeRepo: Repository<FoodRecipe>;
  let addonRepo: Repository<Addon>;
  let addonRecipeRepo: Repository<AddonRecipe>;
  let adminToken: string;

  let outletId: number;
  let departmentId: number;
  let warehouseId: number;
  let ingredientId: number;
  let addonIngredientId: number;
  let foodId: number;
  let addonId: number;

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
    warehouseRepo = moduleFixture.get(getRepositoryToken(Warehouse));
    unitRepo = moduleFixture.get(getRepositoryToken(Unit));
    ingredientRepo = moduleFixture.get(getRepositoryToken(Ingredient));
    foodRepo = moduleFixture.get(getRepositoryToken(Food));
    foodRecipeRepo = moduleFixture.get(getRepositoryToken(FoodRecipe));
    addonRepo = moduleFixture.get(getRepositoryToken(Addon));
    addonRecipeRepo = moduleFixture.get(getRepositoryToken(AddonRecipe));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    const suffix = Date.now();
    const shortSuffix = suffix.toString(36).slice(-6);

    const outlet = await outletRepo.save(
      outletRepo.create({ name: `E2E Reservation Fixture Outlet ${suffix}` }),
    );
    outletId = outlet.id;

    const department = await departmentRepo.save(
      departmentRepo.create({ outletId, name: 'E2E Reservation Kitchen' }),
    );
    departmentId = department.id;

    const warehouse = await warehouseRepo.save(
      warehouseRepo.create({
        outletId,
        name: 'E2E Reservation Warehouse',
        code: `E2E-RES-WH-${suffix}`,
        isDefault: true,
      }),
    );
    warehouseId = warehouse.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Reservation Gram',
        shortName: `e2e-res-g-${shortSuffix}`,
        type: 'weight',
      }),
    );

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Reservation Ingredient',
        slug: `e2e-reservation-ingredient-${suffix}`,
        code: `E2E-RES-ING-${suffix}`,
        baseUnitId: unit.id,
      }),
    );
    ingredientId = ingredient.id;

    const addonIngredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Reservation Addon Ingredient',
        slug: `e2e-reservation-addon-ingredient-${suffix}`,
        code: `E2E-RES-AING-${suffix}`,
        baseUnitId: unit.id,
      }),
    );
    addonIngredientId = addonIngredient.id;

    const food = await foodRepo.save(
      foodRepo.create({
        name: 'E2E Reservation Food',
        slug: `e2e-reservation-food-${suffix}`,
        isRecipeEnabled: true,
      }),
    );
    foodId = food.id;
    await foodRecipeRepo.save(
      foodRecipeRepo.create({
        foodId,
        foodVariantId: null,
        ingredientId,
        unitId: unit.id,
        quantity: 200,
      }),
    );

    const addon = await addonRepo.save(
      addonRepo.create({
        name: 'E2E Reservation Addon',
        isRecipeEnabled: true,
      }),
    );
    addonId = addon.id;
    await addonRecipeRepo.save(
      addonRecipeRepo.create({
        addonId,
        ingredientId: addonIngredientId,
        unitId: unit.id,
        quantity: 50,
      }),
    );

    // Stock-in 5000g of the food ingredient and 1000g of the addon ingredient.
    const stockIn = await request(app.getHttpServer())
      .post('/api/stock-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, stockInDate: '2026-07-29' })
      .expect(201);
    const stockInId = (stockIn.body as DocResponseBody).id;
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${stockInId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 5000, unitCost: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${stockInId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId: addonIngredientId, quantity: 1000, unitCost: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${stockInId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reserves, recomputes on quantity change, reserves for addons, and blocks insufficient stock', async () => {
    const order = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId })
      .expect(201);
    const orderId = (order.body as OrderResponseBody).id;

    const item = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ foodId, preparationDepartmentId: departmentId, quantity: 2 })
      .expect(201);
    const itemId = (item.body as OrderItemResponseBody).id;

    const stockAfterAdd = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number(
        (stockAfterAdd.body as StockResponseBody).data[0].reservedQuantity,
      ),
    ).toBeCloseTo(400, 4);

    const reservationsAfterAdd = await request(app.getHttpServer())
      .get(`/api/order-items/${itemId}/reservations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (reservationsAfterAdd.body as ReservationResponseBody[])[0].status,
    ).toBe('reserved');

    // Recompute on quantity change — 3x200 = 600, not 400+600.
    await request(app.getHttpServer())
      .patch(`/api/order-items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 3 })
      .expect(200);
    const stockAfterQtyChange = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number(
        (stockAfterQtyChange.body as StockResponseBody).data[0]
          .reservedQuantity,
      ),
    ).toBeCloseTo(600, 4);

    // Add a recipe-enabled addon — its ingredient gets reserved too.
    await request(app.getHttpServer())
      .post(`/api/order-items/${itemId}/addons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ addonId, quantity: 2 })
      .expect(201);
    const addonStock = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${addonIngredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number((addonStock.body as StockResponseBody).data[0].reservedQuantity),
    ).toBeCloseTo(100, 4);

    // Remove the addon — its reservation releases back to zero.
    await request(app.getHttpServer())
      .delete(`/api/order-items/${itemId}/addons/${addonId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    const addonStockAfterRemove = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${addonIngredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number(
        (addonStockAfterRemove.body as StockResponseBody).data[0]
          .reservedQuantity,
      ),
    ).toBeCloseTo(0, 4);

    // Attempt to add way more quantity than available stock allows.
    await request(app.getHttpServer())
      .patch(`/api/order-items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 99999 })
      .expect(400);

    // Complete the order — reservation consumes into the ledger.
    await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' })
      .expect(200);

    const stockAfterComplete = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number(
        (stockAfterComplete.body as StockResponseBody).data[0].reservedQuantity,
      ),
    ).toBeCloseTo(0, 4);
    expect(
      Number((stockAfterComplete.body as StockResponseBody).data[0].quantity),
    ).toBeCloseTo(5000 - 600, 4);

    const ledger = await request(app.getHttpServer())
      .get(
        `/api/inventory-transactions?warehouseId=${warehouseId}&ingredientId=${ingredientId}&transactionType=sale_consume`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((ledger.body as { data: unknown[] }).data.length).toBeGreaterThan(0);

    const reservationsAfterComplete = await request(app.getHttpServer())
      .get(`/api/order-items/${itemId}/reservations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (reservationsAfterComplete.body as ReservationResponseBody[]).every(
        (r) => r.status === 'consumed',
      ),
    ).toBe(true);
  });

  it('releases a reservation with no ledger effect when the order is cancelled', async () => {
    const order = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId })
      .expect(201);
    const orderId = (order.body as OrderResponseBody).id;

    const item = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ foodId, preparationDepartmentId: departmentId, quantity: 1 })
      .expect(201);
    const itemId = (item.body as OrderItemResponseBody).id;

    await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
      .expect(200);

    const reservations = await request(app.getHttpServer())
      .get(`/api/order-items/${itemId}/reservations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (reservations.body as ReservationResponseBody[]).every(
        (r) => r.status === 'released',
      ),
    ).toBe(true);
  });
});
