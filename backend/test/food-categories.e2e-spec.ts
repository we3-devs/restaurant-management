import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { FoodCategory } from '../src/modules/food-categories/entities/food-category.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface FoodCategoryResponseBody {
  id: number;
  name: string;
  parentId: number | null;
}

describe('Food Categories (e2e)', () => {
  let app: INestApplication;
  let categoryRepo: Repository<FoodCategory>;
  let adminToken: string;

  const createdCategoryIds: number[] = [];

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

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);
  });

  afterAll(async () => {
    if (createdCategoryIds.length > 0) {
      await categoryRepo.delete(createdCategoryIds);
    }
    await app.close();
  });

  it('POST /api/food-categories creates a category', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/food-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Starters', slug: `e2e-starters-${Date.now()}` })
      .expect(201);

    const body = response.body as FoodCategoryResponseBody;
    expect(body.name).toBe('E2E Starters');
    expect(body.parentId).toBeNull();
    createdCategoryIds.push(body.id);
  });

  it('POST /api/food-categories creates a child category', async () => {
    const parentId = createdCategoryIds[0];
    const response = await request(app.getHttpServer())
      .post('/api/food-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Soups',
        slug: `e2e-soups-${Date.now()}`,
        parentId,
      })
      .expect(201);

    const body = response.body as FoodCategoryResponseBody;
    expect(body.parentId).toBe(parentId);
    createdCategoryIds.push(body.id);
  });

  it('PATCH /api/food-categories/:id rejects self-parenting', async () => {
    const id = createdCategoryIds[0];
    await request(app.getHttpServer())
      .patch(`/api/food-categories/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentId: id })
      .expect(400);
  });

  it('PATCH /api/food-categories/:id re-parents a category', async () => {
    const childId = createdCategoryIds[1];
    const response = await request(app.getHttpServer())
      .patch(`/api/food-categories/${childId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentId: null })
      .expect(200);

    expect((response.body as FoodCategoryResponseBody).parentId).toBeNull();
  });

  it('DELETE /api/food-categories/:id soft-deletes: 404 via API, row still present with deletedAt set', async () => {
    const id = createdCategoryIds[1];

    await request(app.getHttpServer())
      .delete(`/api/food-categories/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/food-categories/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await categoryRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
