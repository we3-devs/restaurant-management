import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { IngredientWastageItem } from '../src/modules/ingredient-wastages/entities/ingredient-wastage-item.entity';
import { IngredientWastage } from '../src/modules/ingredient-wastages/entities/ingredient-wastage.entity';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';
import { Warehouse } from '../src/modules/warehouses/entities/warehouse.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface DocResponseBody {
  id: number;
  status: string;
}

describe('Ingredient Wastages (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let warehouseRepo: Repository<Warehouse>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let wastageRepo: Repository<IngredientWastage>;
  let itemRepo: Repository<IngredientWastageItem>;
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
    wastageRepo = moduleFixture.get(getRepositoryToken(IngredientWastage));
    itemRepo = moduleFixture.get(getRepositoryToken(IngredientWastageItem));

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
      outletRepo.create({ name: `E2E Wastages Fixture Outlet ${suffix}` }),
    );

    const warehouse = await warehouseRepo.save(
      warehouseRepo.create({
        outletId: outlet.id,
        name: 'E2E Wastages Warehouse',
        code: `E2E-WST-WH-${suffix}`,
      }),
    );
    warehouseId = warehouse.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Wastages Kg',
        shortName: `e2e-wst-kg-${shortSuffix}`,
        type: 'weight',
      }),
    );

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Wastages Tomato',
        slug: `e2e-wastages-tomato-${suffix}`,
        code: `E2E-WST-ING-${suffix}`,
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
      .send({ ingredientId, quantity: 50, unitCost: 15 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/stock-ins/${(stockIn.body as DocResponseBody).id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await itemRepo.delete({ ingredientWastageId: In(createdIds) });
      await wastageRepo.delete(createdIds);
    }
    await app.close();
  });

  it('records a wastage and posts to the ledger', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/ingredient-wastages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ warehouseId, wastageDate: '2026-07-29', reason: 'spoiled' })
      .expect(201);
    const id = (create.body as DocResponseBody).id;
    createdIds.push(id);

    await request(app.getHttpServer())
      .post(`/api/ingredient-wastages/${id}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, quantity: 5 })
      .expect(201);

    const approve = await request(app.getHttpServer())
      .post(`/api/ingredient-wastages/${id}/approve`)
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
    ).toBeCloseTo(45, 4);
  });
});
