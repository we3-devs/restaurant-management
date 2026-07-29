import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DiningArea } from '../src/modules/dining-areas/entities/dining-area.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface DiningAreaResponseBody {
  id: number;
  outletId: number;
  name: string;
}

describe('Dining Areas (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let diningAreaRepo: Repository<DiningArea>;
  let adminToken: string;
  let outletId: number;

  const createdAreaIds: number[] = [];

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
    diningAreaRepo = moduleFixture.get(getRepositoryToken(DiningArea));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Dining Areas Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Dining Areas Fixture Outlet' }),
      );
    }
    outletId = outlet.id;
  });

  afterAll(async () => {
    if (createdAreaIds.length > 0) {
      await diningAreaRepo.delete(createdAreaIds);
    }
    await app.close();
  });

  it('POST /api/dining-areas creates a dining area', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/dining-areas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId, name: 'E2E Main Hall', code: `MAIN-${Date.now()}` })
      .expect(201);

    const body = response.body as DiningAreaResponseBody;
    expect(body.outletId).toBe(outletId);
    createdAreaIds.push(body.id);
  });

  it('PATCH /api/dining-areas/:id updates the area', async () => {
    const id = createdAreaIds[0];
    const response = await request(app.getHttpServer())
      .patch(`/api/dining-areas/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Main Hall (Renamed)' })
      .expect(200);

    expect((response.body as DiningAreaResponseBody).name).toBe(
      'E2E Main Hall (Renamed)',
    );
  });

  it('DELETE /api/dining-areas/:id hard-deletes (no soft delete)', async () => {
    const id = createdAreaIds.pop()!;
    await request(app.getHttpServer())
      .delete(`/api/dining-areas/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/dining-areas/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await diningAreaRepo.findOne({ where: { id } });
    expect(raw).toBeNull();
  });
});
