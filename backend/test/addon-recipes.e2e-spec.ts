import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Addon } from '../src/modules/addons/entities/addon.entity';
import { AddonRecipe } from '../src/modules/addons/entities/addon-recipe.entity';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface RecipeResponseBody {
  id: number;
  ingredientId: number;
  quantity: number;
}

describe('Addon Recipes (e2e)', () => {
  let app: INestApplication;
  let addonRepo: Repository<Addon>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let recipeRepo: Repository<AddonRecipe>;
  let adminToken: string;
  let addonId: number;
  let unitId: number;
  let ingredientId: number;

  const createdRecipeIds: number[] = [];

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

    addonRepo = moduleFixture.get(getRepositoryToken(Addon));
    unitRepo = moduleFixture.get(getRepositoryToken(Unit));
    ingredientRepo = moduleFixture.get(getRepositoryToken(Ingredient));
    recipeRepo = moduleFixture.get(getRepositoryToken(AddonRecipe));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    const suffix = Date.now();

    const addon = await addonRepo.save(
      addonRepo.create({ name: 'E2E Recipe Addon' }),
    );
    addonId = addon.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Addon Recipe Gram',
        shortName: `e2e-arcp-g-${suffix.toString(36).slice(-6)}`,
        type: 'weight',
      }),
    );
    unitId = unit.id;

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Addon Recipe Ingredient',
        slug: `e2e-addon-recipe-ingredient-${suffix}`,
        code: `E2E-ARCP-ING-${suffix}`,
        baseUnitId: unitId,
      }),
    );
    ingredientId = ingredient.id;
  });

  afterAll(async () => {
    if (createdRecipeIds.length > 0) {
      await recipeRepo.delete(createdRecipeIds);
    }
    await app.close();
  });

  it('adds, updates, and removes a recipe row for an addon', async () => {
    const create = await request(app.getHttpServer())
      .post(`/api/addons/${addonId}/recipes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, unitId, quantity: 10 })
      .expect(201);
    const recipeId = (create.body as RecipeResponseBody).id;
    createdRecipeIds.push(recipeId);

    const list = await request(app.getHttpServer())
      .get(`/api/addons/${addonId}/recipes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((list.body as RecipeResponseBody[]).length).toBe(1);

    const update = await request(app.getHttpServer())
      .patch(`/api/addons/${addonId}/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 15 })
      .expect(200);
    expect((update.body as RecipeResponseBody).quantity).toBeCloseTo(15, 4);

    await request(app.getHttpServer())
      .delete(`/api/addons/${addonId}/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    createdRecipeIds.pop();
  });
});
