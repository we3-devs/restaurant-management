import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { IngredientStockInItem } from '../src/modules/stock-ins/entities/ingredient-stock-in-item.entity';
import { IngredientStockIn } from '../src/modules/stock-ins/entities/ingredient-stock-in.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { Warehouse } from '../src/modules/warehouses/entities/warehouse.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface StockInResponseBody {
  id: number;
  status: string;
}

interface StockResponseBody {
  data: { quantity: string | number; averageCost: string | number }[];
}

describe('Stock-Ins (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let warehouseRepo: Repository<Warehouse>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let stockInRepo: Repository<IngredientStockIn>;
  let itemRepo: Repository<IngredientStockInItem>;
  let adminToken: string;
  let warehouseId: number;
  let ingredientId: number;

  const createdStockInIds: number[] = [];

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
    stockInRepo = moduleFixture.get(getRepositoryToken(IngredientStockIn));
    itemRepo = moduleFixture.get(getRepositoryToken(IngredientStockInItem));

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
      outletRepo.create({ name: `E2E Stock-Ins Fixture Outlet ${suffix}` }),
    );

    const warehouse = await warehouseRepo.save(
      warehouseRepo.create({
        outletId: outlet.id,
        name: 'E2E Stock-Ins Warehouse',
        code: `E2E-STIN-WH-${suffix}`,
      }),
    );
    warehouseId = warehouse.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Stock-Ins Kg',
        shortName: `e2e-stin-kg-${shortSuffix}`,
        type: 'weight',
      }),
    );

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Stock-Ins Rice',
        slug: `e2e-stock-ins-rice-${suffix}`,
        code: `E2E-STIN-ING-${suffix}`,
        baseUnitId: unit.id,
      }),
    );
    ingredientId = ingredient.id;
  });

  afterAll(async () => {
    if (createdStockInIds.length > 0) {
      await itemRepo.delete({ ingredientStockInId: In(createdStockInIds) });
      await stockInRepo.delete(createdStockInIds);
    }
    await app.close();
  });

  it('creates a draft, adds an item, approves it, and posts to stock + ledger', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/stock-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, stockInDate: '2026-07-29', source: 'purchase' })
      .expect(201);
    const stockInId = (create.body as StockInResponseBody).id;
    createdStockInIds.push(stockInId);

    await request(app.getHttpServer())
      .post(`/api/stock-ins/${stockInId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 100, unitCost: 50 })
      .expect(201);

    const approve = await request(app.getHttpServer())
      .post(`/api/stock-ins/${stockInId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((approve.body as StockInResponseBody).status).toBe('approved');

    const stock = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const stockBody = stock.body as StockResponseBody;
    expect(Number(stockBody.data[0].quantity)).toBeCloseTo(100, 4);
    expect(Number(stockBody.data[0].averageCost)).toBeCloseTo(50, 4);

    const ledger = await request(app.getHttpServer())
      .get(
        `/api/inventory-transactions?warehouseId=${warehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((ledger.body as { data: unknown[] }).data.length).toBeGreaterThan(0);
  });

  it('cannot edit or add items to an approved stock-in', async () => {
    const stockInId = createdStockInIds[0];
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${stockInId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 1, unitCost: 1 })
      .expect(400);
  });

  it('rejects approving a stock-in with no items', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/stock-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, stockInDate: '2026-07-29' })
      .expect(201);
    const stockInId = (create.body as StockInResponseBody).id;
    createdStockInIds.push(stockInId);

    await request(app.getHttpServer())
      .post(`/api/stock-ins/${stockInId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
