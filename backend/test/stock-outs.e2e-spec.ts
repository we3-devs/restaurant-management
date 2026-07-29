import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { IngredientStockOutItem } from '../src/modules/stock-outs/entities/ingredient-stock-out-item.entity';
import { IngredientStockOut } from '../src/modules/stock-outs/entities/ingredient-stock-out.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { Warehouse } from '../src/modules/warehouses/entities/warehouse.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface DocResponseBody {
  id: number;
  status: string;
}

describe('Stock-Outs (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let warehouseRepo: Repository<Warehouse>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let stockOutRepo: Repository<IngredientStockOut>;
  let itemRepo: Repository<IngredientStockOutItem>;
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
    stockOutRepo = moduleFixture.get(getRepositoryToken(IngredientStockOut));
    itemRepo = moduleFixture.get(getRepositoryToken(IngredientStockOutItem));

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
      outletRepo.create({ name: `E2E Stock-Outs Fixture Outlet ${suffix}` }),
    );

    const warehouse = await warehouseRepo.save(
      warehouseRepo.create({
        outletId: outlet.id,
        name: 'E2E Stock-Outs Warehouse',
        code: `E2E-STOUT-WH-${suffix}`,
      }),
    );
    warehouseId = warehouse.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Stock-Outs Kg',
        shortName: `e2e-stout-kg-${shortSuffix}`,
        type: 'weight',
      }),
    );

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Stock-Outs Flour',
        slug: `e2e-stock-outs-flour-${suffix}`,
        code: `E2E-STOUT-ING-${suffix}`,
        baseUnitId: unit.id,
      }),
    );
    ingredientId = ingredient.id;

    // Seed 100 units of stock via a stock-in so stock-out has something to consume.
    const stockIn = await request(app.getHttpServer())
      .post('/api/stock-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, stockInDate: '2026-07-29' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${(stockIn.body as DocResponseBody).id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 100, unitCost: 20 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${(stockIn.body as DocResponseBody).id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await itemRepo.delete({ ingredientStockOutId: In(createdIds) });
      await stockOutRepo.delete(createdIds);
    }
    await app.close();
  });

  it('creates a draft, adds an item, approves it, priced at the current average cost', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/stock-outs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, stockOutDate: '2026-07-29', purpose: 'kitchen_use' })
      .expect(201);
    const id = (create.body as DocResponseBody).id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .post(`/api/stock-outs/${id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 30 })
      .expect(201);

    const approve = await request(app.getHttpServer())
      .post(`/api/stock-outs/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((approve.body as DocResponseBody).status).toBe('approved');

    const stock = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${warehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number((stock.body as { data: { quantity: string }[] }).data[0].quantity),
    ).toBeCloseTo(70, 4);
  });

  it('rejects a stock-out larger than current quantity (insufficient stock)', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/stock-outs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, stockOutDate: '2026-07-29' })
      .expect(201);
    const id = (create.body as DocResponseBody).id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .post(`/api/stock-outs/${id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 999999 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/stock-outs/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
