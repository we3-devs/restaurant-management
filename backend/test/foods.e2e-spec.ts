import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AddonGroup } from '../src/modules/addon-groups/entities/addon-group.entity';
import { AppModule } from '../src/app.module';
import { FoodCategory } from '../src/modules/food-categories/entities/food-category.entity';
import { FoodAddonGroup } from '../src/modules/foods/entities/food-addon-group.entity';
import { FoodOutlet } from '../src/modules/foods/entities/food-outlet.entity';
import { Food } from '../src/modules/foods/entities/food.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface FoodResponseBody {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  hasAddons: boolean;
  foodCategoryId: number | null;
}

interface FoodOutletResponseBody {
  id: number;
  foodId: number;
  outletId: number;
  price: number | null;
  isAvailable: boolean;
}

describe('Foods (e2e)', () => {
  let app: INestApplication;
  let categoryRepo: Repository<FoodCategory>;
  let outletRepo: Repository<Outlet>;
  let addonGroupRepo: Repository<AddonGroup>;
  let foodRepo: Repository<Food>;
  let foodOutletRepo: Repository<FoodOutlet>;
  let foodAddonGroupRepo: Repository<FoodAddonGroup>;
  let adminToken: string;
  let categoryId: number;
  let outletId: number;
  let addonGroupId: number;

  const createdFoodIds: number[] = [];
  const uniqueSuffix = Date.now();

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

    categoryRepo = moduleFixture.get(getRepositoryToken(FoodCategory));
    outletRepo = moduleFixture.get(getRepositoryToken(Outlet));
    addonGroupRepo = moduleFixture.get(getRepositoryToken(AddonGroup));
    foodRepo = moduleFixture.get(getRepositoryToken(Food));
    foodOutletRepo = moduleFixture.get(getRepositoryToken(FoodOutlet));
    foodAddonGroupRepo = moduleFixture.get(getRepositoryToken(FoodAddonGroup));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let category = await categoryRepo.findOne({
      where: { name: 'E2E Foods Fixture Category' },
    });
    if (!category) {
      category = await categoryRepo.save(
        categoryRepo.create({
          name: 'E2E Foods Fixture Category',
          slug: 'e2e-foods-fixture-category',
        }),
      );
    }
    categoryId = category.id;

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Foods Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Foods Fixture Outlet' }),
      );
    }
    outletId = outlet.id;

    let addonGroup = await addonGroupRepo.findOne({
      where: { name: 'E2E Foods Fixture Addon Group' },
    });
    if (!addonGroup) {
      addonGroup = await addonGroupRepo.save(
        addonGroupRepo.create({ name: 'E2E Foods Fixture Addon Group' }),
      );
    }
    addonGroupId = addonGroup.id;
  });

  afterAll(async () => {
    if (createdFoodIds.length > 0) {
      await foodOutletRepo.delete({ foodId: createdFoodIds[0] });
      await foodAddonGroupRepo.delete({ foodId: createdFoodIds[0] });
      await foodRepo.delete(createdFoodIds);
    }
    await app.close();
  });

  it('POST /api/foods creates a food under a category', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/foods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        foodCategoryId: categoryId,
        name: 'E2E Margherita Pizza',
        slug: `e2e-margherita-${uniqueSuffix}`,
        sku: `E2E-SKU-${uniqueSuffix}`,
        basePrice: 9.99,
      })
      .expect(201);

    const body = response.body as FoodResponseBody;
    expect(body.foodCategoryId).toBe(categoryId);
    expect(body.hasAddons).toBe(false);
    createdFoodIds.push(body.id);
  });

  it('POST /api/foods rejects a duplicate slug', async () => {
    await request(app.getHttpServer())
      .post('/api/foods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Duplicate Slug',
        slug: `e2e-margherita-${uniqueSuffix}`,
      })
      .expect(409);
  });

  it('GET /api/foods?foodCategoryId= filters by category', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/foods?foodCategoryId=${categoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const foods = (response.body as { data: FoodResponseBody[] }).data;
    expect(foods.some((f) => f.id === createdFoodIds[0])).toBe(true);
  });

  it('POST /api/foods/:id/outlets creates an outlet price/availability override', async () => {
    const foodId = createdFoodIds[0];
    const response = await request(app.getHttpServer())
      .post(`/api/foods/${foodId}/outlets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId, price: 12.5, isAvailable: false })
      .expect(201);

    const body = response.body as FoodOutletResponseBody;
    expect(body.price).toBe(12.5);
    expect(body.isAvailable).toBe(false);

    const list = await request(app.getHttpServer())
      .get(`/api/foods/${foodId}/outlets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body as FoodOutletResponseBody[]).toHaveLength(1);
  });

  it('DELETE /api/foods/:id/outlets/:outletId removes the override', async () => {
    const foodId = createdFoodIds[0];
    await request(app.getHttpServer())
      .delete(`/api/foods/${foodId}/outlets/${outletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get(`/api/foods/${foodId}/outlets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body as FoodOutletResponseBody[]).toHaveLength(0);
  });

  it('POST /api/foods/:id/addon-groups assigns a group and flips hasAddons to true', async () => {
    const foodId = createdFoodIds[0];
    await request(app.getHttpServer())
      .post(`/api/foods/${foodId}/addon-groups`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ addonGroupId })
      .expect(201);

    // idempotent re-assign
    await request(app.getHttpServer())
      .post(`/api/foods/${foodId}/addon-groups`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ addonGroupId })
      .expect(201);

    const food = await request(app.getHttpServer())
      .get(`/api/foods/${foodId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((food.body as FoodResponseBody).hasAddons).toBe(true);

    const list = await request(app.getHttpServer())
      .get(`/api/foods/${foodId}/addon-groups`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('DELETE /api/foods/:id/addon-groups/:addonGroupId unassigns the group', async () => {
    const foodId = createdFoodIds[0];
    await request(app.getHttpServer())
      .delete(`/api/foods/${foodId}/addon-groups/${addonGroupId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get(`/api/foods/${foodId}/addon-groups`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it('DELETE /api/foods/:id soft-deletes: 404 via API, row still present with deletedAt set', async () => {
    const foodId = createdFoodIds[0];

    await request(app.getHttpServer())
      .delete(`/api/foods/${foodId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/foods/${foodId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await foodRepo.findOne({
      where: { id: foodId },
      withDeleted: true,
    });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
