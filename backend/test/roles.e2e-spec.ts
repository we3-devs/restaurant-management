import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Permission } from '../src/modules/roles/entities/permission.entity';
import { RolePermission } from '../src/modules/roles/entities/role-permission.entity';
import { Role } from '../src/modules/roles/entities/role.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface RoleResponseBody {
  id: number;
  slug: string;
  permissions?: string[];
}

interface PermissionResponseBody {
  id: number;
  slug: string;
}

describe('Roles (e2e)', () => {
  let app: INestApplication;
  let roleRepo: Repository<Role>;
  let permissionRepo: Repository<Permission>;
  let rolePermissionRepo: Repository<RolePermission>;
  let adminToken: string;
  let superAdminRoleId: number;

  const createdRoleIds: number[] = [];

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

    roleRepo = moduleFixture.get(getRepositoryToken(Role));
    permissionRepo = moduleFixture.get(getRepositoryToken(Permission));
    rolePermissionRepo = moduleFixture.get(getRepositoryToken(RolePermission));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    const superAdminRole = await roleRepo.findOne({
      where: { slug: 'super-admin' },
    });
    superAdminRoleId = superAdminRole!.id;
  });

  afterAll(async () => {
    if (createdRoleIds.length > 0) {
      await rolePermissionRepo.delete({ roleId: createdRoleIds[0] });
      await roleRepo.delete(createdRoleIds);
    }
    await app.close();
  });

  it('POST /api/roles creates a custom global role', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Shift Manager', slug: 'e2e-shift-manager' })
      .expect(201);

    const body = response.body as RoleResponseBody;
    expect(body.slug).toBe('e2e-shift-manager');
    createdRoleIds.push(body.id);
  });

  it('GET /api/permissions lists all seeded permission slugs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const slugs = (response.body as PermissionResponseBody[]).map(
      (p) => p.slug,
    );
    expect(slugs).toEqual(
      expect.arrayContaining([
        'users.view',
        'users.manage',
        'roles.view',
        'roles.manage',
      ]),
    );
  });

  it('POST /api/roles/:id/permissions assigns a permission (idempotent)', async () => {
    const permission = await permissionRepo.findOne({
      where: { slug: 'users.view' },
    });
    const roleId = createdRoleIds[0];

    await request(app.getHttpServer())
      .post(`/api/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissionId: permission!.id })
      .expect(201);

    // Re-assigning the same permission is a no-op, not a conflict.
    await request(app.getHttpServer())
      .post(`/api/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissionId: permission!.id })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect((detail.body as RoleResponseBody).permissions).toEqual([
      'users.view',
    ]);
  });

  it('is_system roles cannot be updated or deleted', async () => {
    await request(app.getHttpServer())
      .patch(`/api/roles/${superAdminRoleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamed' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/roles/${superAdminRoleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('DELETE /api/roles/:id removes a non-system role', async () => {
    const roleId = createdRoleIds.pop()!;
    await request(app.getHttpServer())
      .delete(`/api/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
