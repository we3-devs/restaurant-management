import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Unit } from '../src/modules/units/entities/unit.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface UnitResponseBody {
  id: number;
  shortName: string;
  isActive: boolean;
}

describe('Units (e2e)', () => {
  let app: INestApplication;
  let unitRepo: Repository<Unit>;
  let adminToken: string;

  const createdUnitIds: number[] = [];

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

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);
  });

  afterAll(async () => {
    if (createdUnitIds.length > 0) {
      await unitRepo.delete(createdUnitIds);
    }
    await app.close();
  });

  it('POST /api/units creates a unit', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Kilogram',
        shortName: `kg-${Date.now()}`,
        type: 'weight',
      })
      .expect(201);

    const body = response.body as UnitResponseBody;
    expect(body.shortName).toContain('kg-');
    createdUnitIds.push(body.id);
  });

  it('POST /api/units rejects a duplicate shortName+type', async () => {
    const shortName = `dup-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/api/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Dup', shortName, type: 'custom' })
      .expect(201);
    createdUnitIds.push((first.body as UnitResponseBody).id);

    await request(app.getHttpServer())
      .post('/api/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Dup 2', shortName, type: 'custom' })
      .expect(409);
  });

  it('adds and lists a conversion between two units', async () => {
    const from = await request(app.getHttpServer())
      .post('/api/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Gram', shortName: `g-${Date.now()}`, type: 'weight' })
      .expect(201);
    const to = await request(app.getHttpServer())
      .post('/api/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Kilogram 2',
        shortName: `kg2-${Date.now()}`,
        type: 'weight',
      })
      .expect(201);
    const fromId = (from.body as UnitResponseBody).id;
    const toId = (to.body as UnitResponseBody).id;
    createdUnitIds.push(fromId, toId);

    await request(app.getHttpServer())
      .post(`/api/units/${fromId}/conversions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ toUnitId: toId, multiplier: 0.001 })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/units/${fromId}/conversions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect((list.body as unknown[]).length).toBeGreaterThan(0);
  });

  it('DELETE /api/units/:id soft-deletes: 404 via API, row still present with deletedAt set', async () => {
    const id = createdUnitIds[0];

    await request(app.getHttpServer())
      .delete(`/api/units/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/units/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await unitRepo.findOne({ where: { id }, withDeleted: true });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
