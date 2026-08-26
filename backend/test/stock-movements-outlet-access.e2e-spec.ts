import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { Permission } from '../src/modules/roles/entities/permission.entity';
import { RolePermission } from '../src/modules/roles/entities/role-permission.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { UserRoleAssignment } from '../src/modules/roles/entities/user-role-assignment.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { Warehouse } from '../src/modules/warehouses/entities/warehouse.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface UserResponseBody {
  id: number;
}

interface WithId {
  id: number;
}

/**
 * Regression coverage for a systemic gap found across the entire
 * stock-movement family: stock-ins/outs/adjustments/counts/transfers had
 * zero OutletAccessService enforcement (unlike warehouses/goods-receiving/
 * dining-tables, which already checked outlet ownership per request).
 * Also covers two related fixes found alongside it: foods' per-outlet price
 * override endpoints, and employees.update() allowing a caller to move an
 * employee (and their synced role assignment) into an outlet they don't
 * control by changing dto.outletId.
 */
describe('Stock-movement outlet-access (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let warehouseRepo: Repository<Warehouse>;
  let permissionRepo: Repository<Permission>;
  let rolePermissionRepo: Repository<RolePermission>;
  let roleRepo: Repository<Role>;
  let assignmentRepo: Repository<UserRoleAssignment>;
  let userRepo: Repository<User>;

  let adminToken: string;
  let scopedToken: string;
  let scopedUserId: number;
  let scopedRoleId: number;

  let outletAId: number;
  let outletBId: number;
  let warehouseAId: number;
  let warehouseBId: number;

  const scopedUser = {
    email: 'e2e-stock-movements-scoped@test.local',
    password: 'Password@123',
  };

  const MANAGE_SLUGS = [
    'stock-ins.manage',
    'stock-ins.view',
    'stock-outs.manage',
    'stock-outs.view',
    'stock-adjustments.manage',
    'stock-adjustments.view',
    'stock-counts.manage',
    'stock-counts.view',
    'stock-transfers.manage',
    'stock-transfers.view',
    'employees.manage',
    'employees.view',
    'foods.manage',
    'foods.view',
  ];

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
    warehouseRepo = moduleFixture.get(getRepositoryToken(Warehouse));
    permissionRepo = moduleFixture.get(getRepositoryToken(Permission));
    rolePermissionRepo = moduleFixture.get(getRepositoryToken(RolePermission));
    roleRepo = moduleFixture.get(getRepositoryToken(Role));
    assignmentRepo = moduleFixture.get(getRepositoryToken(UserRoleAssignment));
    userRepo = moduleFixture.get(getRepositoryToken(User));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outletA = await outletRepo.findOne({
      where: { name: 'E2E Stock-Movements Fixture A' },
    });
    if (!outletA) {
      outletA = await outletRepo.save(
        outletRepo.create({ name: 'E2E Stock-Movements Fixture A' }),
      );
    }
    outletAId = outletA.id;

    let outletB = await outletRepo.findOne({
      where: { name: 'E2E Stock-Movements Fixture B' },
    });
    if (!outletB) {
      outletB = await outletRepo.save(
        outletRepo.create({ name: 'E2E Stock-Movements Fixture B' }),
      );
    }
    outletBId = outletB.id;

    let warehouseA = await warehouseRepo.findOne({
      where: { outletId: outletAId, code: 'E2E-SM-WH-A' },
    });
    if (!warehouseA) {
      warehouseA = await warehouseRepo.save(
        warehouseRepo.create({
          outletId: outletAId,
          name: 'E2E Stock-Movements Warehouse A',
          code: 'E2E-SM-WH-A',
        }),
      );
    }
    warehouseAId = warehouseA.id;

    let warehouseB = await warehouseRepo.findOne({
      where: { outletId: outletBId, code: 'E2E-SM-WH-B' },
    });
    if (!warehouseB) {
      warehouseB = await warehouseRepo.save(
        warehouseRepo.create({
          outletId: outletBId,
          name: 'E2E Stock-Movements Warehouse B',
          code: 'E2E-SM-WH-B',
        }),
      );
    }
    warehouseBId = warehouseB.id;

    for (const slug of MANAGE_SLUGS) {
      const exists = await permissionRepo.findOne({ where: { slug } });
      if (!exists) {
        const [module, action] = slug.split('.');
        await permissionRepo.save(
          permissionRepo.create({ name: slug, slug, module, action, level: 'global' }),
        );
      }
    }

    let role = await roleRepo.findOne({
      where: { slug: 'e2e-stock-movements-role' },
    });
    if (!role) {
      role = await roleRepo.save(
        roleRepo.create({
          name: 'E2E Stock-Movements Role',
          slug: 'e2e-stock-movements-role',
          level: 'global',
          rank: 50,
        }),
      );
    }
    scopedRoleId = role.id;

    for (const slug of MANAGE_SLUGS) {
      const permission = await permissionRepo.findOne({ where: { slug } });
      const existingLink = await rolePermissionRepo.findOne({
        where: { roleId: role.id, permissionId: permission!.id },
      });
      if (!existingLink) {
        await rolePermissionRepo.save(
          rolePermissionRepo.create({ roleId: role.id, permissionId: permission!.id }),
        );
      }
    }

    const stale = await userRepo.findOne({ where: { email: scopedUser.email } });
    if (stale) {
      await assignmentRepo.delete({ userId: stale.id });
      await userRepo.delete(stale.id);
    }

    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Stock-Movements Scoped User',
        email: scopedUser.email,
        password: scopedUser.password,
      })
      .expect(201);
    scopedUserId = (created.body as UserResponseBody).id;

    await request(app.getHttpServer())
      .post(`/api/users/${scopedUserId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: role.id })
      .expect(201);

    // role-assignments only ever creates 'global' scope — narrow it to
    // outletAId directly so OutletAccessService has something to enforce.
    await assignmentRepo.update(
      { userId: scopedUserId },
      { scopeType: 'outlet', outletId: outletAId },
    );

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(scopedUser)
      .expect(200);
    ({ accessToken: scopedToken } = login.body as AuthResponseBody);
  });

  afterAll(async () => {
    if (scopedUserId) {
      await assignmentRepo.delete({ userId: scopedUserId });
      await userRepo.delete(scopedUserId);
    }
    if (scopedRoleId) {
      await rolePermissionRepo.delete({ roleId: scopedRoleId });
      await roleRepo.delete(scopedRoleId);
    }
    await app.close();
  });

  describe.each([
    {
      resource: 'stock-ins',
      dateField: 'stockInDate',
      updateField: 'remarks',
      terminalActions: ['approve', 'cancel'],
    },
    {
      resource: 'stock-outs',
      dateField: 'stockOutDate',
      updateField: 'remarks',
      terminalActions: ['approve', 'cancel'],
    },
    {
      resource: 'stock-adjustments',
      dateField: 'adjustmentDate',
      updateField: 'reason',
      terminalActions: ['approve', 'cancel'],
    },
    {
      resource: 'stock-counts',
      dateField: 'countDate',
      updateField: 'remarks',
      terminalActions: ['complete', 'adjust', 'cancel'],
    },
  ])('$resource', ({ resource, dateField, updateField, terminalActions }) => {
    it('rejects creating under a warehouse outside the caller\'s access (IDOR)', async () => {
      await request(app.getHttpServer())
        .post(`/api/${resource}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ warehouseId: warehouseBId, [dateField]: '2026-01-01' })
        .expect(403);
    });

    it("allows creating under the caller's own warehouse", async () => {
      await request(app.getHttpServer())
        .post(`/api/${resource}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ warehouseId: warehouseAId, [dateField]: '2026-01-01' })
        .expect(201);
    });

    it('rejects reading/mutating a record that belongs to another outlet (IDOR)', async () => {
      const created = await request(app.getHttpServer())
        .post(`/api/${resource}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ warehouseId: warehouseBId, [dateField]: '2026-01-01' })
        .expect(201);
      const id = (created.body as WithId).id;

      await request(app.getHttpServer())
        .get(`/api/${resource}/${id}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/${resource}/${id}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ [updateField]: 'hijacked' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/${resource}/${id}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .expect(403);

      for (const action of terminalActions) {
        await request(app.getHttpServer())
          .post(`/api/${resource}/${id}/${action}`)
          .set('Authorization', `Bearer ${scopedToken}`)
          .expect(403);
      }
    });
  });

  describe('stock-transfers', () => {
    it('rejects creating a transfer with either leg outside access (IDOR)', async () => {
      await request(app.getHttpServer())
        .post('/api/stock-transfers')
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({
          fromWarehouseId: warehouseAId,
          toWarehouseId: warehouseBId,
          transferDate: '2026-01-01',
        })
        .expect(403);
    });

    it('rejects reading a transfer between two warehouses outside access, even one the caller could otherwise dispatch from', async () => {
      // Both legs in outlet B — the scoped user has no access to either.
      const created = await request(app.getHttpServer())
        .post('/api/stock-transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fromWarehouseId: warehouseBId,
          toWarehouseId: warehouseAId,
          transferDate: '2026-01-01',
        })
        .expect(201);
      const id = (created.body as WithId).id;

      // Scoped user has access to warehouseA (the destination) but not
      // warehouseB (the source) — must still be denied since a transfer
      // exposes both legs.
      await request(app.getHttpServer())
        .get(`/api/stock-transfers/${id}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/stock-transfers/${id}/approve`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .expect(403);
    });
  });

  describe('employees outletId transfer', () => {
    it("rejects moving an employee into an outlet the caller can't access (IDOR)", async () => {
      const employee = await request(app.getHttpServer())
        .post('/api/employees')
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ name: 'E2E Transfer Target', outletId: outletAId })
        .expect(201);
      const employeeId = (employee.body as WithId).id;

      await request(app.getHttpServer())
        .patch(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${scopedToken}`)
        .send({ outletId: outletBId })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });
  });
});
