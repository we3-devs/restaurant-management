import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
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
  email: string;
  isActive: boolean;
}

interface RoleResponseBody {
  id: number;
  slug: string;
}

interface RoleAssignmentResponseBody {
  id: number;
  roleId: number;
  isActive: boolean;
}

interface MeResponseBody {
  permissions: string[];
}

describe('Users (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let permissionRepo: Repository<Permission>;
  let rolePermissionRepo: Repository<RolePermission>;
  let assignmentRepo: Repository<UserRoleAssignment>;
  let adminToken: string;

  const testUser = { email: 'e2e-staff@test.local', password: 'Password@123' };
  const createdUserIds: number[] = [];
  const createdRoleIds: number[] = [];
  const createdPermissionIds: number[] = [];

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

    userRepo = moduleFixture.get(getRepositoryToken(User));
    roleRepo = moduleFixture.get(getRepositoryToken(Role));
    permissionRepo = moduleFixture.get(getRepositoryToken(Permission));
    rolePermissionRepo = moduleFixture.get(getRepositoryToken(RolePermission));
    assignmentRepo = moduleFixture.get(getRepositoryToken(UserRoleAssignment));

    // Defensively remove a stale fixture user left by a previously-aborted run.
    const stale = await userRepo.findOne({ where: { email: testUser.email } });
    if (stale) {
      await assignmentRepo.delete({ userId: stale.id });
      await userRepo.delete(stale.id);
    }

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    // Reuse 'users.view' if it already exists (it does, via seed) rather than
    // blind-inserting — same fix as the auth suite's slug-collision bug.
    let permission = await permissionRepo.findOne({
      where: { slug: 'users.view' },
    });
    if (!permission) {
      permission = await permissionRepo.save(
        permissionRepo.create({
          name: 'View Users',
          slug: 'users.view',
          module: 'users',
          action: 'view',
          level: 'global',
        }),
      );
      createdPermissionIds.push(permission.id);
    }

    let role = await roleRepo.findOne({ where: { slug: 'e2e-staff-role' } });
    if (!role) {
      role = await roleRepo.save(
        roleRepo.create({
          name: 'E2E Staff',
          slug: 'e2e-staff-role',
          level: 'global',
          rank: 50,
        }),
      );
      createdRoleIds.push(role.id);
    }

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
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await assignmentRepo.delete({ userId: createdUserIds[0] });
      await userRepo.delete(createdUserIds);
    }
    if (createdRoleIds.length > 0) {
      await rolePermissionRepo.delete({ roleId: createdRoleIds[0] });
      await roleRepo.delete(createdRoleIds);
    }
    if (createdPermissionIds.length > 0) {
      await permissionRepo.delete(createdPermissionIds);
    }
    await app.close();
  });

  it('POST /api/users creates a staff user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Staff',
        email: testUser.email,
        password: testUser.password,
      })
      .expect(201);

    const body = response.body as UserResponseBody;
    expect(body.email).toBe(testUser.email);
    expect(body.isActive).toBe(false); // no role assignment yet
    createdUserIds.push(body.id);
  });

  it('GET /api/roles finds the e2e-staff-role id for assignment', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/roles?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const roles = (response.body as { data: RoleResponseBody[] }).data;
    const staffRole = roles.find((r) => r.slug === 'e2e-staff-role');
    expect(staffRole).toBeDefined();
  });

  it('POST /api/users/:id/role-assignments assigns a role, and re-assigning reactivates rather than duplicates', async () => {
    const userId = createdUserIds[0];
    const roleId = createdRoleIds[0];

    await request(app.getHttpServer())
      .post(`/api/users/${userId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/users/${userId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/users/${userId}/role-assignments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body as RoleAssignmentResponseBody[]).toHaveLength(1);
  });

  it('the new user can log in and has exactly the assigned permission', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(testUser)
      .expect(200);
    const { accessToken } = loginResponse.body as AuthResponseBody;

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((me.body as MeResponseBody).permissions).toEqual(['users.view']);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Has users.view but not users.manage.
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Nope',
        email: 'nope@test.local',
        password: 'Password@123',
      })
      .expect(403);
  });

  it('PATCH /api/users/:id/deactivate revokes access but not login', async () => {
    const userId = createdUserIds[0];

    await request(app.getHttpServer())
      .patch(`/api/users/${userId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(testUser)
      .expect(200);
    const { accessToken } = loginResponse.body as AuthResponseBody;

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((me.body as MeResponseBody).permissions).toEqual([]);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    const adminView = await request(app.getHttpServer())
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((adminView.body as UserResponseBody).isActive).toBe(false);
  });
});
