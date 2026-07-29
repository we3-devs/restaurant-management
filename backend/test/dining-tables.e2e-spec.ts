import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DiningArea } from '../src/modules/dining-areas/entities/dining-area.entity';
import { DiningTable } from '../src/modules/dining-tables/entities/dining-table.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface DiningTableResponseBody {
  id: number;
  outletId: number;
  diningAreaId: number;
  status: string;
}

describe('Dining Tables (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let diningAreaRepo: Repository<DiningArea>;
  let diningTableRepo: Repository<DiningTable>;
  let adminToken: string;
  let outletId: number;
  let otherOutletId: number;
  let areaId: number;

  const createdTableIds: number[] = [];

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
    diningTableRepo = moduleFixture.get(getRepositoryToken(DiningTable));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Dining Tables Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Dining Tables Fixture Outlet' }),
      );
    }
    outletId = outlet.id;

    let otherOutlet = await outletRepo.findOne({
      where: { name: 'E2E Dining Tables Fixture Outlet (Other)' },
    });
    if (!otherOutlet) {
      otherOutlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Dining Tables Fixture Outlet (Other)' }),
      );
    }
    otherOutletId = otherOutlet.id;

    let area = await diningAreaRepo.findOne({
      where: { outletId, name: 'E2E Dining Tables Fixture Area' },
    });
    if (!area) {
      area = await diningAreaRepo.save(
        diningAreaRepo.create({
          outletId,
          name: 'E2E Dining Tables Fixture Area',
        }),
      );
    }
    areaId = area.id;
  });

  afterAll(async () => {
    if (createdTableIds.length > 0) {
      await diningTableRepo.delete(createdTableIds);
    }
    await app.close();
  });

  it('POST /api/dining-tables creates a table under the area', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/dining-tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId, diningAreaId: areaId, name: 'E2E T1', capacity: 4 })
      .expect(201);

    const body = response.body as DiningTableResponseBody;
    expect(body.diningAreaId).toBe(areaId);
    expect(body.status).toBe('available');
    createdTableIds.push(body.id);
  });

  it('POST /api/dining-tables rejects an area belonging to a different outlet', async () => {
    await request(app.getHttpServer())
      .post('/api/dining-tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        outletId: otherOutletId,
        diningAreaId: areaId,
        name: 'E2E Mismatched',
      })
      .expect(400);
  });

  it('PATCH /api/dining-tables/:id updates status', async () => {
    const id = createdTableIds[0];
    const response = await request(app.getHttpServer())
      .patch(`/api/dining-tables/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cleaning' })
      .expect(200);

    expect((response.body as DiningTableResponseBody).status).toBe('cleaning');
  });

  it('DELETE /api/dining-tables/:id hard-deletes (no soft delete)', async () => {
    const id = createdTableIds.pop()!;
    await request(app.getHttpServer())
      .delete(`/api/dining-tables/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const raw = await diningTableRepo.findOne({ where: { id } });
    expect(raw).toBeNull();
  });
});
