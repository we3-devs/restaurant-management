import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AddonGroup } from '../src/modules/addon-groups/entities/addon-group.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface AddonGroupResponseBody {
  id: number;
  name: string;
  isRequired: boolean;
  minSelect: number;
}

describe('Addon Groups (e2e)', () => {
  let app: INestApplication;
  let addonGroupRepo: Repository<AddonGroup>;
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

    addonGroupRepo = moduleFixture.get(getRepositoryToken(AddonGroup));

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
      await addonGroupRepo.delete(createdIds);
    }
    await app.close();
  });

  it('POST /api/addon-groups creates an addon group', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/addon-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Choose your sauce', isRequired: true, minSelect: 1 })
      .expect(201);

    const body = response.body as AddonGroupResponseBody;
    expect(body.isRequired).toBe(true);
    expect(body.minSelect).toBe(1);
    createdIds.push(body.id);
  });

  it('PATCH /api/addon-groups/:id updates the addon group', async () => {
    const id = createdIds[0];
    const response = await request(app.getHttpServer())
      .patch(`/api/addon-groups/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ maxSelect: 3 })
      .expect(200);

    expect(
      (response.body as AddonGroupResponseBody & { maxSelect: number })
        .maxSelect,
    ).toBe(3);
  });

  it('DELETE /api/addon-groups/:id soft-deletes: 404 via API, row still present with deletedAt set', async () => {
    const id = createdIds[0];

    await request(app.getHttpServer())
      .delete(`/api/addon-groups/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/addon-groups/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await addonGroupRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
