import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AddonGroup } from '../src/modules/addon-groups/entities/addon-group.entity';
import { Addon } from '../src/modules/addons/entities/addon.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface AddonResponseBody {
  id: number;
  addonGroupId: number | null;
  name: string;
  price: number;
}

describe('Addons (e2e)', () => {
  let app: INestApplication;
  let addonGroupRepo: Repository<AddonGroup>;
  let addonRepo: Repository<Addon>;
  let adminToken: string;
  let addonGroupId: number;

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

    addonGroupRepo = moduleFixture.get(getRepositoryToken(AddonGroup));
    addonRepo = moduleFixture.get(getRepositoryToken(Addon));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let addonGroup = await addonGroupRepo.findOne({
      where: { name: 'E2E Addons Fixture Group' },
    });
    if (!addonGroup) {
      addonGroup = await addonGroupRepo.save(
        addonGroupRepo.create({ name: 'E2E Addons Fixture Group' }),
      );
    }
    addonGroupId = addonGroup.id;
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await addonRepo.delete(createdIds);
    }
    await app.close();
  });

  it('POST /api/addons creates an ungrouped addon', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/addons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Extra cheese', price: 1.5 })
      .expect(201);

    const body = response.body as AddonResponseBody;
    expect(body.addonGroupId).toBeNull();
    expect(body.price).toBe(1.5);
    createdIds.push(body.id);
  });

  it('PATCH /api/addons/:id assigns the addon to a group', async () => {
    const id = createdIds[0];
    const response = await request(app.getHttpServer())
      .patch(`/api/addons/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ addonGroupId })
      .expect(200);

    expect((response.body as AddonResponseBody).addonGroupId).toBe(
      addonGroupId,
    );
  });

  it('GET /api/addons?addonGroupId= filters by group', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/addons?addonGroupId=${addonGroupId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const addons = (response.body as { data: AddonResponseBody[] }).data;
    expect(addons.some((a) => a.id === createdIds[0])).toBe(true);
    expect(addons.every((a) => a.addonGroupId === addonGroupId)).toBe(true);
  });

  it('DELETE /api/addons/:id soft-deletes: 404 via API, row still present with deletedAt set', async () => {
    const id = createdIds[0];

    await request(app.getHttpServer())
      .delete(`/api/addons/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/addons/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await addonRepo.findOne({ where: { id }, withDeleted: true });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
