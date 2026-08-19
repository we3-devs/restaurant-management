import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Addon } from '../src/modules/addons/entities/addon.entity';
import { AddonGroup } from '../src/modules/addon-groups/entities/addon-group.entity';
import { DiningArea } from '../src/modules/dining-areas/entities/dining-area.entity';
import { DiningTable } from '../src/modules/dining-tables/entities/dining-table.entity';
import { OutletDepartment } from '../src/modules/outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { Permission } from '../src/modules/roles/entities/permission.entity';
import { RolePermission } from '../src/modules/roles/entities/role-permission.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { UserRoleAssignment } from '../src/modules/roles/entities/user-role-assignment.entity';
import { User } from '../src/modules/users/entities/user.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface UserResponseBody {
  id: number;
}

interface WaiterPosBootstrapResponseBody {
  outlet: Record<string, unknown>;
  departments: Record<string, unknown>[];
  tables: Record<string, unknown>[];
  foodCategories: Record<string, unknown>[];
  addons: Record<string, unknown>[];
}

describe('Bootstrap — waiter POS (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let departmentRepo: Repository<OutletDepartment>;
  let diningAreaRepo: Repository<DiningArea>;
  let diningTableRepo: Repository<DiningTable>;
  let addonGroupRepo: Repository<AddonGroup>;
  let addonRepo: Repository<Addon>;
  let permissionRepo: Repository<Permission>;
  let rolePermissionRepo: Repository<RolePermission>;
  let roleRepo: Repository<Role>;
  let assignmentRepo: Repository<UserRoleAssignment>;
  let userRepo: Repository<User>;

  let adminToken: string;
  let scopedWaiterToken: string;
  let waiterUserId: number;
  let waiterRoleId: number;

  let outletId: number;
  let otherOutletId: number;
  let departmentId: number;
  let tableId: number;
  let addonId: number;

  const waiterUser = {
    email: 'e2e-bootstrap-waiter@test.local',
    password: 'Password@123',
  };

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
    diningAreaRepo = moduleFixture.get(getRepositoryToken(DiningArea));
    diningTableRepo = moduleFixture.get(getRepositoryToken(DiningTable));
    addonGroupRepo = moduleFixture.get(getRepositoryToken(AddonGroup));
    addonRepo = moduleFixture.get(getRepositoryToken(Addon));
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

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Bootstrap Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Bootstrap Fixture Outlet' }),
      );
    }
    outletId = outlet.id;

    // A second outlet the scoped waiter is never assigned to — the IDOR
    // this suite guards against.
    let otherOutlet = await outletRepo.findOne({
      where: { name: 'E2E Bootstrap Fixture Outlet (Other)' },
    });
    if (!otherOutlet) {
      otherOutlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Bootstrap Fixture Outlet (Other)' }),
      );
    }
    otherOutletId = otherOutlet.id;

    let department = await departmentRepo.findOne({
      where: { outletId, name: 'E2E Bootstrap Fixture Kitchen' },
    });
    if (!department) {
      department = await departmentRepo.save(
        departmentRepo.create({
          outletId,
          name: 'E2E Bootstrap Fixture Kitchen',
          canPrepareOrder: true,
        }),
      );
    }
    departmentId = department.id;

    let area = await diningAreaRepo.findOne({
      where: { outletId, name: 'E2E Bootstrap Fixture Area' },
    });
    if (!area) {
      area = await diningAreaRepo.save(
        diningAreaRepo.create({ outletId, name: 'E2E Bootstrap Fixture Area' }),
      );
    }

    let table = await diningTableRepo.findOne({
      where: { outletId, diningAreaId: area.id, name: 'E2E Bootstrap Fixture Table' },
    });
    if (!table) {
      table = await diningTableRepo.save(
        diningTableRepo.create({
          outletId,
          diningAreaId: area.id,
          name: 'E2E Bootstrap Fixture Table',
        }),
      );
    }
    // Occupy it directly at the repo level so the response-shape assertion
    // below can confirm the real column value comes through unmasked.
    table.status = 'occupied';
    await diningTableRepo.save(table);
    tableId = table.id;

    let addonGroup = await addonGroupRepo.findOne({
      where: { name: 'E2E Bootstrap Fixture Addon Group' },
    });
    if (!addonGroup) {
      addonGroup = await addonGroupRepo.save(
        addonGroupRepo.create({ name: 'E2E Bootstrap Fixture Addon Group' }),
      );
    }

    let addon = await addonRepo.findOne({
      where: { name: 'E2E Bootstrap Fixture Addon' },
    });
    if (!addon) {
      addon = await addonRepo.save(
        addonRepo.create({
          addonGroupId: addonGroup.id,
          name: 'E2E Bootstrap Fixture Addon',
          price: 1.5,
        }),
      );
    }
    addonId = addon.id;

    // Reuse orders.manage if seeded — /pos/bootstrap is gated on it.
    let permission = await permissionRepo.findOne({
      where: { slug: 'orders.manage' },
    });
    if (!permission) {
      permission = await permissionRepo.save(
        permissionRepo.create({
          name: 'Manage Orders',
          slug: 'orders.manage',
          module: 'orders',
          action: 'manage',
          level: 'global',
        }),
      );
    }

    let role = await roleRepo.findOne({
      where: { slug: 'e2e-bootstrap-waiter-role' },
    });
    if (!role) {
      role = await roleRepo.save(
        roleRepo.create({
          name: 'E2E Bootstrap Waiter',
          slug: 'e2e-bootstrap-waiter-role',
          level: 'global',
          rank: 50,
        }),
      );
    }
    waiterRoleId = role.id;

    const existingLink = await rolePermissionRepo.findOne({
      where: { roleId: role.id, permissionId: permission.id },
    });
    if (!existingLink) {
      await rolePermissionRepo.save(
        rolePermissionRepo.create({
          roleId: role.id,
          permissionId: permission.id,
        }),
      );
    }

    // Defensively clear a stale fixture user from a previously-aborted run.
    const stale = await userRepo.findOne({ where: { email: waiterUser.email } });
    if (stale) {
      await assignmentRepo.delete({ userId: stale.id });
      await userRepo.delete(stale.id);
    }

    const created = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Bootstrap Waiter',
        email: waiterUser.email,
        password: waiterUser.password,
      })
      .expect(201);
    waiterUserId = (created.body as UserResponseBody).id;

    await request(app.getHttpServer())
      .post(`/api/users/${waiterUserId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: role.id })
      .expect(201);

    // The role-assignments endpoint only ever creates 'global' scope — scope
    // this one down to outletId directly so OutletAccessService actually has
    // an outlet-restricted assignment to enforce against.
    await assignmentRepo.update(
      { userId: waiterUserId },
      { scopeType: 'outlet', outletId },
    );

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(waiterUser)
      .expect(200);
    ({ accessToken: scopedWaiterToken } = login.body as AuthResponseBody);
  });

  afterAll(async () => {
    if (waiterUserId) {
      await assignmentRepo.delete({ userId: waiterUserId });
      await userRepo.delete(waiterUserId);
    }
    if (waiterRoleId) {
      await rolePermissionRepo.delete({ roleId: waiterRoleId });
      await roleRepo.delete(waiterRoleId);
    }
    await app.close();
  });

  it("rejects bootstrapping another outlet the waiter isn't assigned to (IDOR)", async () => {
    await request(app.getHttpServer())
      .get(`/api/pos/bootstrap?outletId=${otherOutletId}`)
      .set('Authorization', `Bearer ${scopedWaiterToken}`)
      .expect(403);
  });

  it("allows bootstrapping the waiter's own assigned outlet", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/pos/bootstrap?outletId=${outletId}`)
      .set('Authorization', `Bearer ${scopedWaiterToken}`)
      .expect(200);

    const body = response.body as WaiterPosBootstrapResponseBody;
    expect(body.outlet.id).toBe(outletId);
    expect(body.departments.some((d) => d.id === departmentId)).toBe(true);
    expect(body.tables.some((t) => t.id === tableId)).toBe(true);
  });

  it('a superadmin can still bootstrap any outlet', async () => {
    await request(app.getHttpServer())
      .get(`/api/pos/bootstrap?outletId=${otherOutletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('reports the real, unmasked table status (occupied)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/pos/bootstrap?outletId=${outletId}`)
      .set('Authorization', `Bearer ${scopedWaiterToken}`)
      .expect(200);

    const body = response.body as WaiterPosBootstrapResponseBody;
    const table = body.tables.find((t) => t.id === tableId);
    expect(table).toBeDefined();
    expect(table?.status).toBe('occupied');
  });

  it('never exposes internal-only fields (timestamps, floor-plan editor fields, soft-delete markers)', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/pos/bootstrap?outletId=${outletId}`)
      .set('Authorization', `Bearer ${scopedWaiterToken}`)
      .expect(200);

    const body = response.body as WaiterPosBootstrapResponseBody;

    for (const record of [
      body.outlet,
      ...body.departments,
      ...body.tables,
      ...body.foodCategories,
      ...body.addons,
    ]) {
      for (const field of [
        'createdAt',
        'updatedAt',
        'deletedAt',
        'positionX',
        'positionY',
        'width',
        'height',
        'rotation',
        'shape',
        'description',
        'slug',
        'image',
        'isRecipeEnabled',
      ]) {
        expect(record).not.toHaveProperty(field);
      }
    }

    const table = body.tables.find((t) => t.id === tableId)!;
    for (const field of [
      'id',
      'outletId',
      'diningAreaId',
      'name',
      'code',
      'capacity',
      'status',
      'isActive',
    ]) {
      expect(table).toHaveProperty(field);
    }

    const department = body.departments.find((d) => d.id === departmentId)!;
    for (const field of ['id', 'outletId', 'name', 'type', 'canPrepareOrder']) {
      expect(department).toHaveProperty(field);
    }

    const addon = body.addons.find((a) => a.id === addonId)!;
    for (const field of ['id', 'addonGroupId', 'name', 'price']) {
      expect(addon).toHaveProperty(field);
    }
  });
});
