import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { IngredientCategory } from '../src/modules/ingredient-categories/entities/ingredient-category.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface CategoryResponseBody {
  id: number;
  slug: string;
  parentId: number | null;
}

describe('Ingredient Categories (e2e)', () => {
  let app: INestApplication;
  let categoryRepo: Repository<IngredientCategory>;
  let adminToken: string;

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

    categoryRepo = moduleFixture.get(getRepositoryToken(IngredientCategory));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await categoryRepo.delete(createdIds);
    }
    await app.close();
  });

  it('POST /api/ingredient-categories creates a category', async () => {
    const slug = `e2e-produce-${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post('/api/ingredient-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Produce', slug })
      .expect(201);

    const body = response.body as CategoryResponseBody;
    expect(body.slug).toBe(slug);
    createdIds.push(body.id);
  });

  it('creates a child category and rejects self-parenting', async () => {
    const parentId = createdIds[0];
    const child = await request(app.getHttpServer())
      .post('/api/ingredient-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Vegetables',
        slug: `e2e-vegetables-${Date.now()}`,
        parentId,
      })
      .expect(201);
    const childId = (child.body as CategoryResponseBody).id;
    createdIds.push(childId);
    expect((child.body as CategoryResponseBody).parentId).toBe(parentId);

    await request(app.getHttpServer())
      .patch(`/api/ingredient-categories/${childId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentId: childId })
      .expect(400);
  });

  it('DELETE /api/ingredient-categories/:id soft-deletes', async () => {
    const id = createdIds[0];

    await request(app.getHttpServer())
      .delete(`/api/ingredient-categories/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/ingredient-categories/${id}`)
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
