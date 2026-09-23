import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import configuration, { AppConfig } from '../../config/configuration';
import { validate } from '../../config/env.validation';
import { Outlet } from '../../modules/outlets/entities/outlet.entity';
import { Tenant } from '../../modules/tenants/entities/tenant.entity';
import { User } from '../../modules/users/entities/user.entity';

// Deliberately its own tiny module rather than reusing SeedModule: this
// script only needs Tenant/Outlet/User, and SeedModule's EmployeesModule ->
// AuthModule chain pulls in the Attendance entity without its Shift relation
// target registered, which fails metadata build before a connection is even
// attempted.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => {
        const dbConfig = configService.get('database', { infer: true })!;
        return {
          type: 'postgres' as const,
          host: dbConfig.host,
          port: dbConfig.port,
          database: dbConfig.database,
          username: dbConfig.username,
          password: dbConfig.password,
          synchronize: false,
          entities: [Tenant, Outlet, User],
        };
      },
    }),
    TypeOrmModule.forFeature([Tenant, Outlet, User]),
  ],
})
class SeedTestTenantModule {}

const logger = new Logger('SeedTestTenant');

// Local-dev-only fixture: a single tenant/outlet/user so requests can be
// scoped with `X-Tenant-Slug: test` instead of running against the
// unscoped superadmin path.
const TENANT_SLUG = 'test';
const TENANT_NAME = 'Test Tenant';
const OUTLET_SLUG = 'test-outlet';
const OUTLET_NAME = 'Test Outlet';
const USER_EMAIL = 'test@rms.local';
const USER_PASSWORD = 'Password123!';

async function run() {
  const app = await NestFactory.createApplicationContext(SeedTestTenantModule);
  const configService = app.get(ConfigService<AppConfig>);
  const tenants = app.get<Repository<Tenant>>(getRepositoryToken(Tenant));
  const outlets = app.get<Repository<Outlet>>(getRepositoryToken(Outlet));
  const users = app.get<Repository<User>>(getRepositoryToken(User));

  let tenant = await tenants.findOne({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    tenant = await tenants.save(tenants.create({ name: TENANT_NAME, slug: TENANT_SLUG, isActive: true }));
    logger.log(`Created tenant "${TENANT_SLUG}" (id=${tenant.id})`);
  } else {
    logger.log(`Tenant "${TENANT_SLUG}" already exists (id=${tenant.id})`);
  }

  let outlet = await outlets.findOne({ where: { slug: OUTLET_SLUG, tenantId: tenant.id } });
  if (!outlet) {
    outlet = await outlets.save(outlets.create({ name: OUTLET_NAME, slug: OUTLET_SLUG, tenantId: tenant.id }));
    logger.log(`Created outlet "${OUTLET_SLUG}" (id=${outlet.id})`);
  } else {
    logger.log(`Outlet "${OUTLET_SLUG}" already exists (id=${outlet.id})`);
  }

  let user = await users.findOne({ where: { email: USER_EMAIL } });
  if (!user) {
    const saltRounds = configService.get('bcrypt', { infer: true })!.saltRounds;
    user = await users.save(
      users.create({
        name: 'Test User',
        email: USER_EMAIL,
        password: await bcrypt.hash(USER_PASSWORD, saltRounds),
        tenantId: tenant.id,
        isSuperadmin: false,
      }),
    );
    logger.log(`Created user "${USER_EMAIL}" (id=${user.id})`);
  } else {
    logger.log(`User "${USER_EMAIL}" already exists (id=${user.id})`);
  }

  logger.log('Done. For local requests, send header: X-Tenant-Slug: ' + TENANT_SLUG);
  logger.log(`Login with email=${USER_EMAIL} password=${USER_PASSWORD}`);

  await app.close();
}

run().catch((error) => {
  logger.error(error);
  process.exit(1);
});
