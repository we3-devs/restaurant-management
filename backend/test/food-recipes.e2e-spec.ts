import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Food } from '../src/modules/foods/entities/food.entity';
import { FoodRecipe } from '../src/modules/foods/entities/food-recipe.entity';
import { FoodVariant } from '../src/modules/food-variants/entities/food-variant.entity';
import { Ingredient } from '../src/modules/ingredients/entities/ingredient.entity';
import { Unit } from '../src/modules/units/entities/unit.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface RecipeResponseBody {
  id: number;
  ingredientId: number;
  foodVariantId: number | null;
  quantity: number;
}

describe('Food Recipes (e2e)', () => {
  let app: INestApplication;
  let foodRepo: Repository<Food>;
  let variantRepo: Repository<FoodVariant>;
  let unitRepo: Repository<Unit>;
  let ingredientRepo: Repository<Ingredient>;
  let recipeRepo: Repository<FoodRecipe>;
  let adminToken: string;
  let foodId: number;
  let variantId: number;
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

    foodRepo = moduleFixture.get(getRepositoryToken(Food));
    variantRepo = moduleFixture.get(getRepositoryToken(FoodVariant));
    unitRepo = moduleFixture.get(getRepositoryToken(Unit));
    ingredientRepo = moduleFixture.get(getRepositoryToken(Ingredient));
    recipeRepo = moduleFixture.get(getRepositoryToken(FoodRecipe));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    const suffix = Date.now();

    const food = await foodRepo.save(
      foodRepo.create({
        name: 'E2E Recipe Food',
        slug: `e2e-recipe-food-${suffix}`,
      }),
    );
    foodId = food.id;

    const variant = await variantRepo.save(
      variantRepo.create({ foodId, name: 'Large', sku: null }),
    );
    variantId = variant.id;

    const unit = await unitRepo.save(
      unitRepo.create({
        name: 'E2E Recipe Gram',
        shortName: `e2e-rcp-g-${suffix.toString(36).slice(-6)}`,
        type: 'weight',
      }),
    );
    unitId = unit.id;

    const ingredient = await ingredientRepo.save(
      ingredientRepo.create({
        name: 'E2E Recipe Ingredient',
        slug: `e2e-recipe-ingredient-${suffix}`,
        code: `E2E-RCP-ING-${suffix}`,
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

  it('adds a food-level recipe row and a variant-override row for the same ingredient', async () => {
    const foodLevel = await request(app.getHttpServer())
      .post(`/api/foods/${foodId}/recipes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredientId, unitId, quantity: 100 })
      .expect(201);
    createdRecipeIds.push((foodLevel.body as RecipeResponseBody).id);
    expect((foodLevel.body as RecipeResponseBody).foodVariantId).toBeNull();

    const variantLevel = await request(app.getHttpServer())
      .post(`/api/foods/${foodId}/recipes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ foodVariantId: variantId, ingredientId, unitId, quantity: 200 })
      .expect(201);
    createdRecipeIds.push((variantLevel.body as RecipeResponseBody).id);

    const list = await request(app.getHttpServer())
      .get(`/api/foods/${foodId}/recipes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((list.body as RecipeResponseBody[]).length).toBe(2);
  });

  it("updates a recipe row's quantity", async () => {
    const recipeId = createdRecipeIds[0];
    const update = await request(app.getHttpServer())
      .patch(`/api/foods/${foodId}/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 150 })
      .expect(200);
    expect((update.body as RecipeResponseBody).quantity).toBeCloseTo(150, 4);
  });

  it('removes a recipe row', async () => {
    const recipeId = createdRecipeIds.pop()!;
    await request(app.getHttpServer())
      .delete(`/api/foods/${foodId}/recipes/${recipeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});
