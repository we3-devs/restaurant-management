import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { FoodVariantOutlet } from '../src/modules/food-variants/entities/food-variant-outlet.entity';
import { FoodVariant } from '../src/modules/food-variants/entities/food-variant.entity';
import { Food } from '../src/modules/foods/entities/food.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface FoodVariantResponseBody {
  id: number;
  foodId: number;
  name: string;
  isDefault: boolean;
}

interface FoodResponseBody {
  id: number;
  hasVariants: boolean;
}

describe('Food Variants (e2e)', () => {
  let app: INestApplication;
  let foodRepo: Repository<Food>;
  let outletRepo: Repository<Outlet>;
  let variantRepo: Repository<FoodVariant>;
  let variantOutletRepo: Repository<FoodVariantOutlet>;
  let adminToken: string;
  let foodId: number;
  let outletId: number;

  const createdVariantIds: number[] = [];

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

    foodRepo = moduleFixture.get(getRepositoryToken(Food));
    outletRepo = moduleFixture.get(getRepositoryToken(Outlet));
    variantRepo = moduleFixture.get(getRepositoryToken(FoodVariant));
    variantOutletRepo = moduleFixture.get(
      getRepositoryToken(FoodVariantOutlet),
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let food = await foodRepo.findOne({
      where: { slug: 'e2e-food-variants-fixture' },
    });
    if (!food) {
      food = await foodRepo.save(
        foodRepo.create({
          name: 'E2E Food Variants Fixture',
          slug: 'e2e-food-variants-fixture',
        }),
      );
    }
    foodId = food.id;

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Food Variants Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Food Variants Fixture Outlet' }),
      );
    }
    outletId = outlet.id;
  });

  afterAll(async () => {
    if (createdVariantIds.length > 0) {
      await variantOutletRepo.delete({ foodVariantId: createdVariantIds[0] });
      await variantRepo.delete(createdVariantIds);
    }
    await app.close();
  });

  it('POST /api/food-variants creates a variant and flips the food hasVariants to true', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/food-variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ foodId, name: 'E2E Small', price: 5 })
      .expect(201);

    const body = response.body as FoodVariantResponseBody;
    expect(body.foodId).toBe(foodId);
    createdVariantIds.push(body.id);

    const food = await request(app.getHttpServer())
      .get(`/api/foods/${foodId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((food.body as FoodResponseBody).hasVariants).toBe(true);
  });

  it('only one variant per food can be isDefault at a time', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/food-variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ foodId, name: 'E2E Default A', price: 6, isDefault: true })
      .expect(201);
    const firstId = (first.body as FoodVariantResponseBody).id;
    createdVariantIds.push(firstId);

    const second = await request(app.getHttpServer())
      .post('/api/food-variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ foodId, name: 'E2E Default B', price: 7, isDefault: true })
      .expect(201);
    const secondId = (second.body as FoodVariantResponseBody).id;
    createdVariantIds.push(secondId);

    const firstAfter = await request(app.getHttpServer())
      .get(`/api/food-variants/${firstId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((firstAfter.body as FoodVariantResponseBody).isDefault).toBe(false);

    const secondAfter = await request(app.getHttpServer())
      .get(`/api/food-variants/${secondId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((secondAfter.body as FoodVariantResponseBody).isDefault).toBe(true);
  });

  it('POST /api/food-variants/:id/outlets creates and DELETE removes an outlet override', async () => {
    const variantId = createdVariantIds[0];

    await request(app.getHttpServer())
      .post(`/api/food-variants/${variantId}/outlets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId, price: 5.5 })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/food-variants/${variantId}/outlets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/food-variants/${variantId}/outlets/${outletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const listAfter = await request(app.getHttpServer())
      .get(`/api/food-variants/${variantId}/outlets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listAfter.body).toHaveLength(0);
  });

  it('DELETE /api/food-variants/:id soft-deletes: 404 via API, row still present with deletedAt set', async () => {
    const variantId = createdVariantIds[0];

    await request(app.getHttpServer())
      .delete(`/api/food-variants/${variantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/food-variants/${variantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await variantRepo.findOne({
      where: { id: variantId },
      withDeleted: true,
    });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
