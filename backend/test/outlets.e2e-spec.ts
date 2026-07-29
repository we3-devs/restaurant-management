import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { OutletDepartment } from '../src/modules/outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface OutletResponseBody {
  id: number;
  name: string;
}

describe('Outlets (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let departmentRepo: Repository<OutletDepartment>;
  let adminToken: string;

  const createdOutletIds: number[] = [];

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
    departmentRepo = moduleFixture.get(getRepositoryToken(OutletDepartment));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);
  });

  afterAll(async () => {
    if (createdOutletIds.length > 0) {
      await departmentRepo.delete({ outletId: createdOutletIds[0] });
      await outletRepo.delete(createdOutletIds);
    }
    await app.close();
  });

  it('POST /api/outlets creates an outlet', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/outlets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Downtown Branch' })
      .expect(201);

    const body = response.body as OutletResponseBody;
    expect(body.name).toBe('E2E Downtown Branch');
    createdOutletIds.push(body.id);
  });

  it('PATCH /api/outlets/:id updates the outlet name', async () => {
    const outletId = createdOutletIds[0];
    const response = await request(app.getHttpServer())
      .patch(`/api/outlets/${outletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Downtown Branch (Renamed)' })
      .expect(200);

    expect((response.body as OutletResponseBody).name).toBe(
      'E2E Downtown Branch (Renamed)',
    );
  });

  it('DELETE /api/outlets/:id cascades: dependent department is hard-deleted along with it', async () => {
    // outlet_departments.outlet_id is ON DELETE CASCADE at the DB level, so
    // deleting the outlet sweeps away its departments even though the
    // department entity itself supports soft-delete — the DB cascade
    // bypasses TypeORM's soft-delete entirely. This is the intended
    // (if slightly sharp-edged) behavior; the service's 23503 catch exists
    // for the still-unmodeled RESTRICT-FK domains (orders, reservations,
    // etc.) that will 409 correctly once those get entities.
    const outletId = createdOutletIds.pop()!;
    const department = await departmentRepo.save(
      departmentRepo.create({ outletId, name: 'E2E Dept for cascade test' }),
    );

    await request(app.getHttpServer())
      .delete(`/api/outlets/${outletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/outlets/${outletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await departmentRepo.findOne({
      where: { id: department.id },
      withDeleted: true,
    });
    expect(raw).toBeNull();
  });
});
