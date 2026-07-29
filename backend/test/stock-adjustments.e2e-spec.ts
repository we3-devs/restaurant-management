import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { IngredientStockAdjustmentItem } from '../src/modules/stock-adjustments/entities/ingredient-stock-adjustment-item.entity';
import { IngredientStockAdjustment } from '../src/modules/stock-adjustments/entities/ingredient-stock-adjustment.entity';
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

describe('Stock Adjustments (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let warehouseRepo: Repository<Warehouse>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let adjustmentRepo: Repository<IngredientStockAdjustment>;
  let itemRepo: Repository<IngredientStockAdjustmentItem>;
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
    adjustmentRepo = moduleFixture.get(
      getRepositoryToken(IngredientStockAdjustment),
    );
    itemRepo = moduleFixture.get(
      getRepositoryToken(IngredientStockAdjustmentItem),
    );

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
      outletRepo.create({ name: `E2E Adjustments Fixture Outlet ${suffix}` }),
    );

    const warehouse = await warehouseRepo.save(
      warehouseRepo.create({
        outletId: outlet.id,
        name: 'E2E Adjustments Warehouse',
        code: `E2E-ADJ-WH-${suffix}`,
      }),
    );
    warehouseId = warehouse.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Adjustments Kg',
        shortName: `e2e-adj-kg-${shortSuffix}`,
        type: 'weight',
      }),
    );

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Adjustments Salt',
        slug: `e2e-adjustments-salt-${suffix}`,
        code: `E2E-ADJ-ING-${suffix}`,
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
      .send({ ingredientId, quantity: 40, unitCost: 5 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${(stockIn.body as DocResponseBody).id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await itemRepo.delete({ ingredientStockAdjustmentId: In(createdIds) });
      await adjustmentRepo.delete(createdIds);
    }
    await app.close();
  });

  it('snapshots systemQuantity at add-item time and posts the difference on approve', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/stock-adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId,
        adjustmentDate: '2026-07-29',
        reason: 'Physical recount',
      })
      .expect(201);
    const id = (create.body as DocResponseBody).id;
    createdIds.push(id);

    const item = await request(app.getHttpServer())
      .post(`/api/stock-adjustments/${id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, actualQuantity: 35 })
      .expect(201);
    const itemBody = item.body as ItemResponseBody;
    expect(Number(itemBody.systemQuantity)).toBeCloseTo(40, 4);
    expect(Number(itemBody.differenceQuantity)).toBeCloseTo(-5, 4);

    const approve = await request(app.getHttpServer())
      .post(`/api/stock-adjustments/${id}/approve`)
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
    ).toBeCloseTo(35, 4);
  });
});
