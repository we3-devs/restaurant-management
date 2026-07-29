import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DiningArea } from '../src/modules/dining-areas/entities/dining-area.entity';
import { DiningTable } from '../src/modules/dining-tables/entities/dining-table.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { TableSession } from '../src/modules/table-sessions/entities/table-session.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface TableSessionResponseBody {
  id: number;
  outletId: number;
  diningTableId: number;
  status: string;
}

interface DiningTableResponseBody {
  id: number;
  status: string;
}

describe('Table Sessions (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let diningAreaRepo: Repository<DiningArea>;
  let diningTableRepo: Repository<DiningTable>;
  let tableSessionRepo: Repository<TableSession>;
  let adminToken: string;
  let outletId: number;
  let tableId: number;

  const createdSessionIds: number[] = [];

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
    diningAreaRepo = moduleFixture.get(getRepositoryToken(DiningArea));
    diningTableRepo = moduleFixture.get(getRepositoryToken(DiningTable));
    tableSessionRepo = moduleFixture.get(getRepositoryToken(TableSession));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Table Sessions Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Table Sessions Fixture Outlet' }),
      );
    }
    outletId = outlet.id;

    let area = await diningAreaRepo.findOne({
      where: { outletId, name: 'E2E Table Sessions Fixture Area' },
    });
    if (!area) {
      area = await diningAreaRepo.save(
        diningAreaRepo.create({
          outletId,
          name: 'E2E Table Sessions Fixture Area',
        }),
      );
    }

    let table = await diningTableRepo.findOne({
      where: {
        outletId,
        diningAreaId: area.id,
        name: 'E2E Table Sessions Fixture Table',
      },
    });
    if (!table) {
      table = await diningTableRepo.save(
        diningTableRepo.create({
          outletId,
          diningAreaId: area.id,
          name: 'E2E Table Sessions Fixture Table',
        }),
      );
    }
    tableId = table.id;
    // Reset in case a previous failed run left it occupied.
    await diningTableRepo.update({ id: tableId }, { status: 'available' });
  });

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await tableSessionRepo.delete(createdSessionIds);
    }
    await diningTableRepo.update({ id: tableId }, { status: 'available' });
    await app.close();
  });

  it('POST /api/table-sessions starts a session and flips the table to occupied', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/table-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId, diningTableId: tableId, guestCount: 2 })
      .expect(201);

    const body = response.body as TableSessionResponseBody;
    expect(body.status).toBe('active');
    createdSessionIds.push(body.id);

    const table = await request(app.getHttpServer())
      .get(`/api/dining-tables/${tableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((table.body as DiningTableResponseBody).status).toBe('occupied');
  });

  it('POST /api/table-sessions/:id/end ends the session and reverts the table to available', async () => {
    const sessionId = createdSessionIds[0];
    const response = await request(app.getHttpServer())
      .post(`/api/table-sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect((response.body as TableSessionResponseBody).status).toBe(
      'completed',
    );

    const table = await request(app.getHttpServer())
      .get(`/api/dining-tables/${tableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((table.body as DiningTableResponseBody).status).toBe('available');
  });
});
