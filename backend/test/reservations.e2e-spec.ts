import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CustomerOutlet } from '../src/modules/customers/entities/customer-outlet.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { DiningArea } from '../src/modules/dining-areas/entities/dining-area.entity';
import { DiningTable } from '../src/modules/dining-tables/entities/dining-table.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';
import { ReservationTable } from '../src/modules/reservations/entities/reservation-table.entity';
import { Reservation } from '../src/modules/reservations/entities/reservation.entity';
import { TableSession } from '../src/modules/table-sessions/entities/table-session.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface ReservationResponseBody {
  id: number;
  status: string;
  confirmedAt: string | null;
  seatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
}

interface DiningTableResponseBody {
  id: number;
  status: string;
}

describe('Reservations (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let diningAreaRepo: Repository<DiningArea>;
  let diningTableRepo: Repository<DiningTable>;
  let customerRepo: Repository<Customer>;
  let customerOutletRepo: Repository<CustomerOutlet>;
  let reservationRepo: Repository<Reservation>;
  let reservationTableRepo: Repository<ReservationTable>;
  let tableSessionRepo: Repository<TableSession>;

  let adminToken: string;
  let outletId: number;
  let tableId: number;
  let otherOutletTableId: number;
  let customerId: number;

  const createdReservationIds: number[] = [];
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
    customerRepo = moduleFixture.get(getRepositoryToken(Customer));
    customerOutletRepo = moduleFixture.get(getRepositoryToken(CustomerOutlet));
    reservationRepo = moduleFixture.get(getRepositoryToken(Reservation));
    reservationTableRepo = moduleFixture.get(
      getRepositoryToken(ReservationTable),
    );
    tableSessionRepo = moduleFixture.get(getRepositoryToken(TableSession));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Reservations Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Reservations Fixture Outlet' }),
      );
    }
    outletId = outlet.id;

    let area = await diningAreaRepo.findOne({
      where: { outletId, name: 'E2E Reservations Fixture Area' },
    });
    if (!area) {
      area = await diningAreaRepo.save(
        diningAreaRepo.create({
          outletId,
          name: 'E2E Reservations Fixture Area',
        }),
      );
    }

    let table = await diningTableRepo.findOne({
      where: {
        outletId,
        diningAreaId: area.id,
        name: 'E2E Reservations Fixture Table',
      },
    });
    if (!table) {
      table = await diningTableRepo.save(
        diningTableRepo.create({
          outletId,
          diningAreaId: area.id,
          name: 'E2E Reservations Fixture Table',
        }),
      );
    }
    tableId = table.id;
    await diningTableRepo.update({ id: tableId }, { status: 'available' });

    let otherOutlet = await outletRepo.findOne({
      where: { name: 'E2E Reservations Fixture Outlet 2' },
    });
    if (!otherOutlet) {
      otherOutlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Reservations Fixture Outlet 2' }),
      );
    }

    let otherArea = await diningAreaRepo.findOne({
      where: {
        outletId: otherOutlet.id,
        name: 'E2E Reservations Fixture Area 2',
      },
    });
    if (!otherArea) {
      otherArea = await diningAreaRepo.save(
        diningAreaRepo.create({
          outletId: otherOutlet.id,
          name: 'E2E Reservations Fixture Area 2',
        }),
      );
    }

    let otherTable = await diningTableRepo.findOne({
      where: {
        outletId: otherOutlet.id,
        diningAreaId: otherArea.id,
        name: 'E2E Reservations Fixture Table 2',
      },
    });
    if (!otherTable) {
      otherTable = await diningTableRepo.save(
        diningTableRepo.create({
          outletId: otherOutlet.id,
          diningAreaId: otherArea.id,
          name: 'E2E Reservations Fixture Table 2',
        }),
      );
    }
    otherOutletTableId = otherTable.id;

    let customer = await customerRepo.findOne({
      where: { name: 'E2E Reservations Fixture Customer' },
    });
    if (!customer) {
      customer = await customerRepo.save(
        customerRepo.create({ name: 'E2E Reservations Fixture Customer' }),
      );
    }
    customerId = customer.id;
    await customerOutletRepo.delete({ customerId, outletId });
  });

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await tableSessionRepo.delete(createdSessionIds);
    }
    if (createdReservationIds.length > 0) {
      await reservationTableRepo.delete({
        reservationId: In(createdReservationIds),
      });
      await reservationRepo.delete(createdReservationIds);
    }
    await customerOutletRepo.delete({ customerId, outletId });
    await customerRepo.delete({ id: customerId });
    await diningTableRepo.update({ id: tableId }, { status: 'available' });
    await app.close();
  });

  let reservationAId: number;
  let reservationBId: number;

  it('POST /api/reservations creates a reservation and upserts customer_outlets visitCount=1', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        outletId,
        customerId,
        reservedAt: new Date(Date.now() + 3600_000).toISOString(),
        guestCount: 2,
      })
      .expect(201);

    const body = response.body as ReservationResponseBody;
    expect(body.status).toBe('pending');
    reservationAId = body.id;
    createdReservationIds.push(reservationAId);

    const visit = await customerOutletRepo.findOne({
      where: { customerId, outletId },
    });
    expect(visit?.visitCount).toBe(1);
  });

  it('a second reservation for the same customer/outlet bumps visitCount to 2', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        outletId,
        customerId,
        reservedAt: new Date(Date.now() + 7200_000).toISOString(),
      })
      .expect(201);

    reservationBId = (response.body as ReservationResponseBody).id;
    createdReservationIds.push(reservationBId);

    const visit = await customerOutletRepo.findOne({
      where: { customerId, outletId },
    });
    expect(visit?.visitCount).toBe(2);
  });

  it('POST /api/reservations/:id/tables assigns a table (idempotent)', async () => {
    await request(app.getHttpServer())
      .post(`/api/reservations/${reservationAId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ diningTableId: tableId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/reservations/${reservationAId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ diningTableId: tableId })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/reservations/${reservationAId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('POST /api/reservations/:id/tables rejects a table from a different outlet', async () => {
    await request(app.getHttpServer())
      .post(`/api/reservations/${reservationAId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ diningTableId: otherOutletTableId })
      .expect(400);
  });

  it('PATCH /api/reservations/:id/status seating without an assigned table returns 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/reservations/${reservationBId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/reservations/${reservationBId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'seated' })
      .expect(400);
  });

  it('PATCH /api/reservations/:id/status confirms then seats, auto-starting a table session', async () => {
    await request(app.getHttpServer())
      .patch(`/api/reservations/${reservationAId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' })
      .expect(200)
      .then((response) => {
        expect(
          (response.body as ReservationResponseBody).confirmedAt,
        ).not.toBeNull();
      });

    const response = await request(app.getHttpServer())
      .patch(`/api/reservations/${reservationAId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'seated' })
      .expect(200);
    expect((response.body as ReservationResponseBody).seatedAt).not.toBeNull();

    const session = await tableSessionRepo.findOne({
      where: { reservationId: reservationAId },
    });
    expect(session).not.toBeNull();
    expect(session?.customerId).toBe(customerId);
    expect(session?.diningTableId).toBe(tableId);
    expect(session?.status).toBe('active');
    if (session) {
      createdSessionIds.push(session.id);
    }

    const table = await request(app.getHttpServer())
      .get(`/api/dining-tables/${tableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((table.body as DiningTableResponseBody).status).toBe('occupied');
  });

  it('PATCH /api/reservations/:id/status completes the reservation', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/reservations/${reservationAId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' })
      .expect(200);
    expect(
      (response.body as ReservationResponseBody).completedAt,
    ).not.toBeNull();
  });

  it('PATCH /api/reservations/:id/status cancels reservation B', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/reservations/${reservationBId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
      .expect(200);
    expect(
      (response.body as ReservationResponseBody).cancelledAt,
    ).not.toBeNull();
  });

  it('PATCH /api/reservations/:id/status marks a fresh reservation no_show', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        outletId,
        customerId,
        reservedAt: new Date(Date.now() + 10800_000).toISOString(),
      })
      .expect(201);
    const reservationCId = (createResponse.body as ReservationResponseBody).id;
    createdReservationIds.push(reservationCId);

    const response = await request(app.getHttpServer())
      .patch(`/api/reservations/${reservationCId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'no_show' })
      .expect(200);
    expect((response.body as ReservationResponseBody).noShowAt).not.toBeNull();
  });

  it('DELETE /api/reservations/:id/tables/:diningTableId unassigns a table', async () => {
    await request(app.getHttpServer())
      .delete(`/api/reservations/${reservationAId}/tables/${tableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get(`/api/reservations/${reservationAId}/tables`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it('GET /api/reservations/:id 404s for an unknown id', async () => {
    await request(app.getHttpServer())
      .get('/api/reservations/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
