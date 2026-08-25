import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  ALL_OUTLETS,
  OutletAccessService,
} from '../src/modules/auth/outlet-access.service';
import { Employee } from '../src/modules/employees/entities/employee.entity';
import { Position } from '../src/modules/employees/entities/position.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { UserRoleAssignment } from '../src/modules/roles/entities/user-role-assignment.entity';
import { User } from '../src/modules/users/entities/user.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface IdResponseBody {
  id: number;
}

/**
 * Regression test for the syncRoleFromPosition bug: an employee staffed into
 * a position whose default role is level='global' (e.g. an outlet-wide
 * admin) used to always get an outlet-scoped assignment, which silently
 * narrowed PermissionsService.getAccessibleOutletIds() to just that one
 * outlet instead of granting access to all outlets.
 */
describe('Employees — global role sync (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let roleRepo: Repository<Role>;
  let positionRepo: Repository<Position>;
  let employeeRepo: Repository<Employee>;
  let userRepo: Repository<User>;
  let assignmentRepo: Repository<UserRoleAssignment>;
  let outletAccess: OutletAccessService;
  let adminToken: string;

  const createdOutletIds: number[] = [];
  const createdRoleIds: number[] = [];
  const createdPositionIds: number[] = [];
  const createdEmployeeIds: number[] = [];
  const createdUserIds: number[] = [];

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
    roleRepo = moduleFixture.get(getRepositoryToken(Role));
    positionRepo = moduleFixture.get(getRepositoryToken(Position));
    employeeRepo = moduleFixture.get(getRepositoryToken(Employee));
    userRepo = moduleFixture.get(getRepositoryToken(User));
    assignmentRepo = moduleFixture.get(getRepositoryToken(UserRoleAssignment));
    outletAccess = moduleFixture.get(OutletAccessService);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);
  }, 30000);

  afterAll(async () => {
    if (createdEmployeeIds.length > 0) {
      await employeeRepo.delete(createdEmployeeIds);
    }
    if (createdUserIds.length > 0) {
      await assignmentRepo.delete({ userId: createdUserIds[0] });
      await userRepo.delete(createdUserIds);
    }
    if (createdPositionIds.length > 0) {
      await positionRepo.delete(createdPositionIds);
    }
    if (createdRoleIds.length > 0) {
      await roleRepo.delete(createdRoleIds);
    }
    if (createdOutletIds.length > 0) {
      await outletRepo.delete(createdOutletIds);
    }
    await app.close();
  });

  it('grants an unscoped assignment (not outlet-scoped) for a global-level position role, so accessible outlets is ALL', async () => {
    // Two outlets, so a wrongly outlet-scoped grant would be observably
    // narrower than "all outlets" (with only one outlet in the DB, a buggy
    // single-outlet scope and the correct all-outlets result would look
    // identical from getAccessibleOutletIds' point of view).
    const outletA = (
      await request(app.getHttpServer())
        .post('/api/outlets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Global Role Outlet A' })
        .expect(201)
    ).body as IdResponseBody;
    createdOutletIds.push(outletA.id);

    const outletB = (
      await request(app.getHttpServer())
        .post('/api/outlets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Global Role Outlet B' })
        .expect(201)
    ).body as IdResponseBody;
    createdOutletIds.push(outletB.id);

    const globalRole = (
      await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Global Admin',
          slug: 'e2e-global-admin',
          level: 'global',
        })
        .expect(201)
    ).body as IdResponseBody;
    createdRoleIds.push(globalRole.id);

    const position = (
      await request(app.getHttpServer())
        .post('/api/positions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Global Admin Position',
          slug: 'e2e-global-admin-position',
          defaultRoleId: globalRole.id,
        })
        .expect(201)
    ).body as IdResponseBody;
    createdPositionIds.push(position.id);

    const user = (
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Global Admin User',
          email: `e2e-global-admin-${Date.now()}@rms.local`,
          password: 'Password@123',
        })
        .expect(201)
    ).body as IdResponseBody;
    createdUserIds.push(user.id);

    // Creating the employee, staffed into the global-role position at
    // outlet A, is what triggers syncRoleFromPosition.
    const employee = (
      await request(app.getHttpServer())
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Global Admin Employee',
          userId: user.id,
          positionId: position.id,
          outletId: outletA.id,
        })
        .expect(201)
    ).body as IdResponseBody;
    createdEmployeeIds.push(employee.id);

    const assignment = await assignmentRepo.findOne({
      where: { userId: user.id, roleId: globalRole.id },
    });
    expect(assignment).not.toBeNull();
    expect(assignment!.scopeType).toBe('global');
    expect(assignment!.outletId).toBeNull();

    const accessible = await outletAccess.getAccessibleOutletIds(
      user.id,
      false,
    );
    expect(accessible).toBe(ALL_OUTLETS);
  });

  it('does not silently narrow access if a pre-fix outlet-scoped row for the same global role still exists', async () => {
    // Simulates data written by the old buggy implementation, before this
    // fix shipped: an outlet-scoped assignment of a role whose level is
    // 'global'. Changing the sync code does not retroactively repair rows
    // already sitting in the database — only a data migration does that
    // (see FixGlobalRoleAssignmentScope migration). This test documents
    // that residual risk rather than asserting it away.
    const outlet = (
      await request(app.getHttpServer())
        .post('/api/outlets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Stale Row Outlet' })
        .expect(201)
    ).body as IdResponseBody;
    createdOutletIds.push(outlet.id);

    const globalRole = (
      await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Global Admin Stale',
          slug: 'e2e-global-admin-stale',
          level: 'global',
        })
        .expect(201)
    ).body as IdResponseBody;
    createdRoleIds.push(globalRole.id);

    const user = (
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Stale Row User',
          email: `e2e-stale-row-${Date.now()}@rms.local`,
          password: 'Password@123',
        })
        .expect(201)
    ).body as IdResponseBody;
    createdUserIds.push(user.id);

    // Written directly via the repository, bypassing syncRoleFromPosition,
    // to stand in for a row created before this fix existed.
    const staleRow = await assignmentRepo.save(
      assignmentRepo.create({
        userId: user.id,
        roleId: globalRole.id,
        scopeType: 'outlet',
        outletId: outlet.id,
      }),
    );

    const accessible = await outletAccess.getAccessibleOutletIds(
      user.id,
      false,
    );
    // This is the bug's footprint on unrepaired data: a stale outlet-scoped
    // row for a global role still narrows access instead of granting ALL.
    expect(accessible).not.toBe(ALL_OUTLETS);
    expect(accessible).toEqual([outlet.id]);

    await assignmentRepo.delete(staleRow.id);
  });
});
