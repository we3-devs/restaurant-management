import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { OutletDepartment } from '../src/modules/outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { Warehouse } from '../src/modules/warehouses/entities/warehouse.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface WarehouseResponseBody {
  id: number;
  outletId: number;
  outletDepartmentId: number | null;
  code: string;
  isDefault: boolean;
}

describe('Warehouses (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let departmentRepo: Repository<OutletDepartment>;
  let warehouseRepo: Repository<Warehouse>;
  let adminToken: string;
  let outletId: number;
  let otherOutletId: number;
  let departmentId: number;

  const createdWarehouseIds: number[] = [];

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
    warehouseRepo = moduleFixture.get(getRepositoryToken(Warehouse));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Warehouses Fixture' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Warehouses Fixture' }),
      );
    }
    outletId = outlet.id;

    let otherOutlet = await outletRepo.findOne({
      where: { name: 'E2E Warehouses Fixture (Other)' },
    });
    if (!otherOutlet) {
      otherOutlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Warehouses Fixture (Other)' }),
      );
    }
    otherOutletId = otherOutlet.id;

    let department = await departmentRepo.findOne({
      where: { outletId, name: 'E2E Warehouses Fixture Dept' },
    });
    if (!department) {
      department = await departmentRepo.save(
        departmentRepo.create({
          outletId,
          name: 'E2E Warehouses Fixture Dept',
        }),
      );
    }
    departmentId = department.id;
  });

  afterAll(async () => {
    if (createdWarehouseIds.length > 0) {
      await warehouseRepo.delete(createdWarehouseIds);
    }
    await app.close();
  });

  it('POST /api/warehouses creates a warehouse under an outlet + department', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        outletId,
        outletDepartmentId: departmentId,
        name: 'E2E Main Store',
        code: `E2E-WH-${Date.now()}`,
      })
      .expect(201);

    const body = response.body as WarehouseResponseBody;
    expect(body.outletId).toBe(outletId);
    expect(body.outletDepartmentId).toBe(departmentId);
    createdWarehouseIds.push(body.id);
  });

  it('POST /api/warehouses rejects a department that belongs to a different outlet', async () => {
    await request(app.getHttpServer())
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        outletId: otherOutletId,
        outletDepartmentId: departmentId,
        name: 'E2E Mismatched Store',
        code: `E2E-WH-MISMATCH-${Date.now()}`,
      })
      .expect(400);
  });

  it('only one warehouse per outlet can be isDefault at a time', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        outletId,
        name: 'E2E Default A',
        code: `E2E-WH-DEFAULT-A-${Date.now()}`,
        isDefault: true,
      })
      .expect(201);
    const firstId = (first.body as WarehouseResponseBody).id;
    createdWarehouseIds.push(firstId);

    const second = await request(app.getHttpServer())
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        outletId,
        name: 'E2E Default B',
        code: `E2E-WH-DEFAULT-B-${Date.now()}`,
        isDefault: true,
      })
      .expect(201);
    const secondId = (second.body as WarehouseResponseBody).id;
    createdWarehouseIds.push(secondId);

    const firstAfter = await request(app.getHttpServer())
      .get(`/api/warehouses/${firstId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((firstAfter.body as WarehouseResponseBody).isDefault).toBe(false);

    const secondAfter = await request(app.getHttpServer())
      .get(`/api/warehouses/${secondId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((secondAfter.body as WarehouseResponseBody).isDefault).toBe(true);
  });

  it('DELETE /api/warehouses/:id soft-deletes: 404 via API, row still present with deletedAt set', async () => {
    const id = createdWarehouseIds[0];

    await request(app.getHttpServer())
      .delete(`/api/warehouses/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/warehouses/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const raw = await warehouseRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    expect(raw).not.toBeNull();
    expect(raw!.deletedAt).not.toBeNull();
  });
});
