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
  let secondTableId: number;
  let otherOutletTableId: number;

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

    let secondTable = await diningTableRepo.findOne({
      where: {
        outletId,
        diningAreaId: area.id,
        name: 'E2E Table Sessions Fixture Table 2',
      },
    });
    if (!secondTable) {
      secondTable = await diningTableRepo.save(
        diningTableRepo.create({
          outletId,
          diningAreaId: area.id,
          name: 'E2E Table Sessions Fixture Table 2',
        }),
      );
    }
    secondTableId = secondTable.id;
    await diningTableRepo.update(
      { id: secondTableId },
      { status: 'available' },
    );

    let otherOutlet = await outletRepo.findOne({
      where: { name: 'E2E Table Sessions Fixture Outlet 2' },
    });
    if (!otherOutlet) {
      otherOutlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Table Sessions Fixture Outlet 2' }),
      );
    }

    let otherOutletArea = await diningAreaRepo.findOne({
      where: {
        outletId: otherOutlet.id,
        name: 'E2E Table Sessions Fixture Area 2',
      },
    });
    if (!otherOutletArea) {
      otherOutletArea = await diningAreaRepo.save(
        diningAreaRepo.create({
          outletId: otherOutlet.id,
          name: 'E2E Table Sessions Fixture Area 2',
        }),
      );
    }

    let otherOutletTable = await diningTableRepo.findOne({
      where: {
        outletId: otherOutlet.id,
        diningAreaId: otherOutletArea.id,
        name: 'E2E Table Sessions Fixture Table 3',
      },
    });
    if (!otherOutletTable) {
      otherOutletTable = await diningTableRepo.save(
        diningTableRepo.create({
          outletId: otherOutlet.id,
          diningAreaId: otherOutletArea.id,
          name: 'E2E Table Sessions Fixture Table 3',
        }),
      );
    }
    otherOutletTableId = otherOutletTable.id;
    await diningTableRepo.update(
      { id: otherOutletTableId },
      { status: 'available' },
    );
  });

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await tableSessionRepo.delete(createdSessionIds);
    }
    await diningTableRepo.update({ id: tableId }, { status: 'available' });
    await diningTableRepo.update(
      { id: secondTableId },
      { status: 'available' },
    );
    await diningTableRepo.update(
      { id: otherOutletTableId },
      { status: 'available' },
    );
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

  it('POST /api/table-sessions rejects a second session on a table that already has an open one', async () => {
    await request(app.getHttpServer())
      .post('/api/table-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId, diningTableId: tableId, guestCount: 1 })
      .expect(409);
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

  describe('POST /api/table-sessions/:id/transfer', () => {
    let transferSessionId: number;

    it('starts a fresh session on the second table', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/table-sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outletId, diningTableId: secondTableId, guestCount: 2 })
        .expect(201);

      transferSessionId = (response.body as TableSessionResponseBody).id;
      createdSessionIds.push(transferSessionId);
    });

    it('rejects transferring to a table in a different outlet', async () => {
      await request(app.getHttpServer())
        .post(`/api/table-sessions/${transferSessionId}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newDiningTableId: otherOutletTableId })
        .expect(400);
    });

    it('rejects transferring to the table the session is already on', async () => {
      await request(app.getHttpServer())
        .post(`/api/table-sessions/${transferSessionId}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newDiningTableId: secondTableId })
        .expect(409);
    });

    it('rejects transferring to a table that already has an open session', async () => {
      const blockerResponse = await request(app.getHttpServer())
        .post('/api/table-sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outletId, diningTableId: tableId, guestCount: 1 })
        .expect(201);
      const blockerSessionId = (
        blockerResponse.body as TableSessionResponseBody
      ).id;
      createdSessionIds.push(blockerSessionId);

      await request(app.getHttpServer())
        .post(`/api/table-sessions/${transferSessionId}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newDiningTableId: tableId })
        .expect(409);

      await request(app.getHttpServer())
        .post(`/api/table-sessions/${blockerSessionId}/end`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });

    it('transfers the session to a free table in the same outlet, flipping both table statuses', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/table-sessions/${transferSessionId}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newDiningTableId: tableId })
        .expect(201);

      const body = response.body as TableSessionResponseBody & {
        transferredBy: number | null;
        transferredAt: string | null;
      };
      expect(body.diningTableId).toBe(tableId);
      expect(body.transferredBy).not.toBeNull();
      expect(body.transferredAt).not.toBeNull();

      const oldTable = await request(app.getHttpServer())
        .get(`/api/dining-tables/${secondTableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((oldTable.body as DiningTableResponseBody).status).toBe(
        'available',
      );

      const newTable = await request(app.getHttpServer())
        .get(`/api/dining-tables/${tableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((newTable.body as DiningTableResponseBody).status).toBe(
        'occupied',
      );
    });

    it('rejects transferring a session that is no longer open', async () => {
      await request(app.getHttpServer())
        .post(`/api/table-sessions/${transferSessionId}/end`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/table-sessions/${transferSessionId}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newDiningTableId: secondTableId })
        .expect(409);
    });
  });
});
