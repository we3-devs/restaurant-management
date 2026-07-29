import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface IngredientResponseBody {
  id: number;
  code: string;
  baseUnitId: number;
}

describe('Ingredients (e2e)', () => {
  let app: INestApplication;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let adminToken: string;
  let baseUnitId: number;

  const createdIngredientIds: number[] = [];

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

    unitRepo = moduleFixture.get(getRepositoryToken(Unit));
    ingredientRepo = moduleFixture.get(getRepositoryToken(Ingredient));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let unit = await unitRepo.findOne({
      where: { shortName: 'e2e-ing-kg', type: 'weight' },
    });
    if (!unit) {
      unit = await unitRepo.save(
        unitRepo.create({
          name: 'E2E Ingredients Kg',
          shortName: 'e2e-ing-kg',
          type: 'weight',
        }),
      );
    }
    baseUnitId = unit.id;
  });

  afterAll(async () => {
    if (createdIngredientIds.length > 0) {
      await ingredientRepo.delete(createdIngredientIds);
    }
    await app.close();
  });

  it('POST /api/ingredients creates an ingredient', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ingredients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Chicken Breast',
        slug: `e2e-chicken-${Date.now()}`,
        code: `E2E-ING-${Date.now()}`,
        baseUnitId,
      })
      .expect(201);

    const body = response.body as IngredientResponseBody;
    expect(body.baseUnitId).toBe(baseUnitId);
    createdIngredientIds.push(body.id);
  });

  it('PATCH /api/ingredients/:id rejects baseUnitId (immutable, not whitelisted)', async () => {
    const id = createdIngredientIds[0];
    await request(app.getHttpServer())
      .patch(`/api/ingredients/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ baseUnitId: baseUnitId + 999 })
      .expect(400);
  });

  it('DELETE /api/ingredients/:id soft-deletes', async () => {
    const id = createdIngredientIds[0];

    await request(app.getHttpServer())
      .delete(`/api/ingredients/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/ingredients/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await ingredientRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
