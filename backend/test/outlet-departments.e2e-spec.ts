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

interface DepartmentResponseBody {
  id: number;
  outletId: number;
  name: string;
  type: string;
}

describe('Outlet Departments (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let departmentRepo: Repository<OutletDepartment>;
  let adminToken: string;
  let outletId: number;

  const createdDepartmentIds: number[] = [];

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

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Outlet Departments Fixture' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Outlet Departments Fixture' }),
      );
    }
    outletId = outlet.id;
  });

  afterAll(async () => {
    if (createdDepartmentIds.length > 0) {
      await departmentRepo.delete(createdDepartmentIds);
    }
    await app.close();
  });

  it('POST /api/outlet-departments creates a department under the outlet', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/outlet-departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId, name: 'E2E Main Kitchen', type: 'kitchen' })
      .expect(201);

    const body = response.body as DepartmentResponseBody;
    expect(body.outletId).toBe(outletId);
    expect(body.type).toBe('kitchen');
    createdDepartmentIds.push(body.id);
  });

  it('GET /api/outlet-departments?outletId= filters by outlet', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/outlet-departments?outletId=${outletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const departments = (response.body as { data: DepartmentResponseBody[] })
      .data;
    expect(departments.every((d) => d.outletId === outletId)).toBe(true);
    expect(departments.some((d) => d.id === createdDepartmentIds[0])).toBe(
      true,
    );
  });

  it('PATCH /api/outlet-departments/:id updates the department', async () => {
    const id = createdDepartmentIds[0];
    const response = await request(app.getHttpServer())
      .patch(`/api/outlet-departments/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ canPrepareOrder: true })
      .expect(200);

    expect(
      (response.body as DepartmentResponseBody & { canPrepareOrder: boolean })
        .canPrepareOrder,
    ).toBe(true);
  });

  it('DELETE /api/outlet-departments/:id soft-deletes: 404 via API, row still present with deletedAt set', async () => {
    const id = createdDepartmentIds[0];

    await request(app.getHttpServer())
      .delete(`/api/outlet-departments/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/outlet-departments/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await departmentRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
