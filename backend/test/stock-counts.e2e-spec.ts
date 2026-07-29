import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { IngredientStockCountItem } from '../src/modules/stock-counts/entities/ingredient-stock-count-item.entity';
import { IngredientStockCount } from '../src/modules/stock-counts/entities/ingredient-stock-count.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { Warehouse } from '../src/modules/warehouses/entities/warehouse.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface DocResponseBody {
  id: number;
  status: string;
}

interface ItemResponseBody {
  systemQuantity: string | number;
  differenceQuantity: string | number;
}

describe('Stock Counts (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let warehouseRepo: Repository<Warehouse>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let countRepo: Repository<IngredientStockCount>;
  let itemRepo: Repository<IngredientStockCountItem>;
  let adminToken: string;
  let warehouseId: number;
  let ingredientId: number;

  const createdIds: number[] = [];

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
    warehouseRepo = moduleFixture.get(getRepositoryToken(Warehouse));
    unitRepo = moduleFixture.get(getRepositoryToken(Unit));
    ingredientRepo = moduleFixture.get(getRepositoryToken(Ingredient));
    countRepo = moduleFixture.get(getRepositoryToken(IngredientStockCount));
    itemRepo = moduleFixture.get(getRepositoryToken(IngredientStockCountItem));

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
      outletRepo.create({ name: `E2E Stock Counts Fixture Outlet ${suffix}` }),
    );

    const warehouse = await warehouseRepo.save(
      warehouseRepo.create({
        outletId: outlet.id,
        name: 'E2E Stock Counts Warehouse',
        code: `E2E-CNT-WH-${suffix}`,
      }),
    );
    warehouseId = warehouse.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Stock Counts Kg',
        shortName: `e2e-cnt-kg-${shortSuffix}`,
        type: 'weight',
      }),
    );

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Stock Counts Pepper',
        slug: `e2e-stock-counts-pepper-${suffix}`,
        code: `E2E-CNT-ING-${suffix}`,
        baseUnitId: unit.id,
      }),
    );
    ingredientId = ingredient.id;

    const stockIn = await request(app.getHttpServer())
      .post('/api/stock-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, stockInDate: '2026-07-29' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${(stockIn.body as DocResponseBody).id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 60, unitCost: 8 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${(stockIn.body as DocResponseBody).id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await itemRepo.delete({ ingredientStockCountId: In(createdIds) });
      await countRepo.delete(createdIds);
    }
    await app.close();
  });

  it('completes a count (snapshot+diff, no ledger effect) then posts the adjustment', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/stock-counts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, countDate: '2026-07-29' })
      .expect(201);
    const id = (create.body as DocResponseBody).id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .post(`/api/stock-counts/${id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, countedQuantity: 65 })
      .expect(201);

    const complete = await request(app.getHttpServer())
      .post(`/api/stock-counts/${id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((complete.body as DocResponseBody).status).toBe('completed');

    const itemsAfterComplete = await request(app.getHttpServer())
      .get(`/api/stock-counts/${id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const itemBody = (itemsAfterComplete.body as ItemResponseBody[])[0];
    expect(Number(itemBody.systemQuantity)).toBeCloseTo(60, 4);
    expect(Number(itemBody.differenceQuantity)).toBeCloseTo(5, 4);

    // No ledger effect yet — stock unchanged until adjustments are posted.
    const stockBeforeAdjust = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number(
        (stockBeforeAdjust.body as { data: { quantity: string }[] }).data[0]
          .quantity,
      ),
    ).toBeCloseTo(60, 4);

    const adjust = await request(app.getHttpServer())
      .post(`/api/stock-counts/${id}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((adjust.body as DocResponseBody).status).toBe('adjusted');

    const stockAfterAdjust = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number(
        (stockAfterAdjust.body as { data: { quantity: string }[] }).data[0]
          .quantity,
      ),
    ).toBeCloseTo(65, 4);
  });
});
