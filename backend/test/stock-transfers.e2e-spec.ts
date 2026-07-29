import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { IngredientStockTransferItem } from '../src/modules/stock-transfers/entities/ingredient-stock-transfer-item.entity';
import { IngredientStockTransfer } from '../src/modules/stock-transfers/entities/ingredient-stock-transfer.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { Warehouse } from '../src/modules/warehouses/entities/warehouse.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface DocResponseBody {
  id: number;
  status: string;
}

describe('Stock Transfers (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let warehouseRepo: Repository<Warehouse>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let transferRepo: Repository<IngredientStockTransfer>;
  let itemRepo: Repository<IngredientStockTransferItem>;
  let adminToken: string;
  let fromWarehouseId: number;
  let toWarehouseId: number;
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
    transferRepo = moduleFixture.get(
      getRepositoryToken(IngredientStockTransfer),
    );
    itemRepo = moduleFixture.get(
      getRepositoryToken(IngredientStockTransferItem),
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
      outletRepo.create({ name: `E2E Transfers Fixture Outlet ${suffix}` }),
    );

    const fromWarehouse = await warehouseRepo.save(
      warehouseRepo.create({
        outletId: outlet.id,
        name: 'E2E Transfer Source',
        code: `E2E-TRF-FROM-${suffix}`,
      }),
    );
    fromWarehouseId = fromWarehouse.id;

    const toWarehouse = await warehouseRepo.save(
      warehouseRepo.create({
        outletId: outlet.id,
        name: 'E2E Transfer Destination',
        code: `E2E-TRF-TO-${suffix}`,
      }),
    );
    toWarehouseId = toWarehouse.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Transfers Kg',
        shortName: `e2e-trf-kg-${shortSuffix}`,
        type: 'weight',
      }),
    );

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Transfers Sugar',
        slug: `e2e-transfers-sugar-${suffix}`,
        code: `E2E-TRF-ING-${suffix}`,
        baseUnitId: unit.id,
      }),
    );
    ingredientId = ingredient.id;

    const stockIn = await request(app.getHttpServer())
      .post('/api/stock-ins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId: fromWarehouseId, stockInDate: '2026-07-29' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${(stockIn.body as DocResponseBody).id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 100, unitCost: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${(stockIn.body as DocResponseBody).id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await itemRepo.delete({ ingredientStockTransferId: In(createdIds) });
      await transferRepo.delete(createdIds);
    }
    await app.close();
  });

  it('transfers quantity from one warehouse to another atomically', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/stock-transfers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fromWarehouseId, toWarehouseId, transferDate: '2026-07-29' })
      .expect(201);
    const id = (create.body as DocResponseBody).id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .post(`/api/stock-transfers/${id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 20 })
      .expect(201);

    const approve = await request(app.getHttpServer())
      .post(`/api/stock-transfers/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((approve.body as DocResponseBody).status).toBe('approved');

    const fromStock = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${fromWarehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number(
        (fromStock.body as { data: { quantity: string }[] }).data[0].quantity,
      ),
    ).toBeCloseTo(80, 4);

    const toStock = await request(app.getHttpServer())
      .get(
        `/api/warehouse-ingredient-stocks?warehouseId=${toWarehouseId}&ingredientId=${ingredientId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      Number(
        (toStock.body as { data: { quantity: string }[] }).data[0].quantity,
      ),
    ).toBeCloseTo(20, 4);
  });

  it('rejects fromWarehouseId equal to toWarehouseId', async () => {
    await request(app.getHttpServer())
      .post('/api/stock-transfers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fromWarehouseId,
        toWarehouseId: fromWarehouseId,
        transferDate: '2026-07-29',
      })
      .expect(400);
  });
});
