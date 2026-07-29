import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Permission } from '../src/modules/roles/entities/permission.entity';
import { RolePermission } from '../src/modules/roles/entities/role-permission.entity';
import { Role } from '../src/modules/roles/entities/role.entity';
import { UserRoleAssignment } from '../src/modules/roles/entities/user-role-assignment.entity';
import { User } from '../src/modules/users/entities/user.entity';

interface AuthResponseBody {
  accessToken: string;
  refreshToken: string;
  user: { id: number; name: string; email: string; isSuperadmin: boolean };
}

interface MeResponseBody {
  id: number;
  name: string;
  email: string;
  isSuperadmin: boolean;
  permissions: string[];
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let permissionRepo: Repository<Permission>;
  let rolePermissionRepo: Repository<RolePermission>;
  let assignmentRepo: Repository<UserRoleAssignment>;

  const privilegedUser = {
    email: 'e2e-privileged@test.local',
    password: 'Password@123',
  };
  const unprivilegedUser = {
    email: 'e2e-unprivileged@test.local',
    password: 'Password@123',
  };

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

    // Defensively remove any stale fixture users left behind by a
    // previously-aborted run of this suite (e.g. killed before afterAll).
    const staleUsers = await userRepo.find({
      where: [
        { email: privilegedUser.email },
        { email: unprivilegedUser.email },
      ],
    });
    if (staleUsers.length > 0) {
      const staleUserIds = staleUsers.map((u) => u.id);
      await assignmentRepo.delete({ userId: In(staleUserIds) });
      await userRepo.delete(staleUserIds);
    }

    // The 'users.manage' permission this suite needs is the same one the
    // /auth/admin-check endpoint is guarded with, and the seed script may
    // have already created it — find-or-create rather than blind-insert so
    // this suite is safe to run with or without seed data present, and safe
    // to rerun after a previous aborted run.
    let permission = await permissionRepo.findOne({
      where: { slug: 'users.manage' },
    });
    if (!permission) {
      permission = await permissionRepo.save(
        permissionRepo.create({
          name: 'Manage Users',
          slug: 'users.manage',
          module: 'users',
          action: 'manage',
          level: 'global',
        }),
      );
      createdPermissionIds.push(permission.id);
    }

    let role = await roleRepo.findOne({ where: { slug: 'e2e-manager' } });
    if (!role) {
      role = await roleRepo.save(
        roleRepo.create({
          name: 'E2E Manager',
          slug: 'e2e-manager',
          level: 'global',
          rank: 10,
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

    const privilegedPasswordHash = await bcrypt.hash(
      privilegedUser.password,
      4,
    );
    const privileged = await userRepo.save(
      userRepo.create({
        name: 'Privileged',
        email: privilegedUser.email,
        password: privilegedPasswordHash,
      }),
    );
    createdUserIds.push(privileged.id);

    await assignmentRepo.save(
      assignmentRepo.create({
        userId: privileged.id,
        roleId: role.id,
        scopeType: 'global',
        isActive: true,
      }),
    );

    const unprivilegedPasswordHash = await bcrypt.hash(
      unprivilegedUser.password,
      4,
    );
    const unprivileged = await userRepo.save(
      userRepo.create({
        name: 'Unprivileged',
        email: unprivilegedUser.email,
        password: unprivilegedPasswordHash,
      }),
    );
    createdUserIds.push(unprivileged.id);
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

  it('POST /api/auth/login fails with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: privilegedUser.email, password: 'wrong-password' })
      .expect(401);
  });

  it('POST /api/auth/login succeeds and returns a token pair', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(privilegedUser)
      .expect(200);

    const body = response.body as AuthResponseBody;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(body.user.email).toBe(privilegedUser.email);
  });

  it('GET /api/auth/me requires a token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('GET /api/auth/me returns the current user with a valid token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(privilegedUser);
    const { accessToken } = loginResponse.body as AuthResponseBody;

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as MeResponseBody;
    expect(body.email).toBe(privilegedUser.email);
    expect(body.permissions).toContain('users.manage');
  });

  it('GET /api/auth/admin-check returns 200 for a user with the permission', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(privilegedUser);
    const { accessToken } = loginResponse.body as AuthResponseBody;

    await request(app.getHttpServer())
      .get('/api/auth/admin-check')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('GET /api/auth/admin-check returns 403 for a user without the permission', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(unprivilegedUser);
    const { accessToken } = loginResponse.body as AuthResponseBody;

    await request(app.getHttpServer())
      .get('/api/auth/admin-check')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('POST /api/auth/refresh rotates the token and detects reuse of the old one', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(privilegedUser);
    const { refreshToken: originalRefreshToken } =
      loginResponse.body as AuthResponseBody;

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefreshToken })
      .expect(200);
    const { refreshToken: rotatedRefreshToken } =
      refreshResponse.body as AuthResponseBody;

    expect(rotatedRefreshToken).not.toBe(originalRefreshToken);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: originalRefreshToken })
      .expect(401);

    // Reuse detection must have revoked the whole chain, including the new token.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(401);
  });
});
