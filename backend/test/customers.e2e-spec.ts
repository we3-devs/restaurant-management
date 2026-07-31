import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CustomerOutlet } from '../src/modules/customers/entities/customer-outlet.entity';
import { Customer } from '../src/modules/customers/entities/customer.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface CustomerResponseBody {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

interface CustomerOutletResponseBody {
  id: number;
  outletId: number;
  visitCount: number;
  isFavoriteOutlet: boolean;
}

describe('Customers (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let customerRepo: Repository<Customer>;
  let customerOutletRepo: Repository<CustomerOutlet>;
  let adminToken: string;
  let outletId: number;

  const createdCustomerIds: number[] = [];

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
    customerRepo = moduleFixture.get(getRepositoryToken(Customer));
    customerOutletRepo = moduleFixture.get(getRepositoryToken(CustomerOutlet));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Customers Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Customers Fixture Outlet' }),
      );
    }
    outletId = outlet.id;
  });

  afterAll(async () => {
    if (createdCustomerIds.length > 0) {
      await customerOutletRepo.delete({ customerId: createdCustomerIds[0] });
      await customerRepo.delete(createdCustomerIds);
    }
    await app.close();
  });

  let customerId: number;

  it('POST /api/customers creates a customer', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Customer',
        phone: '555-0100-e2e',
        email: 'e2e-customer@example.test',
      })
      .expect(201);

    const body = response.body as CustomerResponseBody;
    expect(body.name).toBe('E2E Customer');
    expect(body.isActive).toBe(true);
    customerId = body.id;
    createdCustomerIds.push(customerId);
  });

  it('POST /api/customers rejects a duplicate phone/email with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate Customer', phone: '555-0100-e2e' })
      .expect(409);
  });

  it('GET /api/customers lists and filters by search', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/customers')
      .query({ search: 'E2E Customer' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = response.body as { data: CustomerResponseBody[] };
    expect(body.data.some((customer) => customer.id === customerId)).toBe(true);
  });

  it('PATCH /api/customers/:id updates fields', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ address: '123 Test Street' })
      .expect(200);

    expect((response.body as { address: string }).address).toBe(
      '123 Test Street',
    );
  });

  it("GET /api/customers/:id/outlets lists the customer's visit stats", async () => {
    await customerOutletRepo.save(
      customerOutletRepo.create({
        customerId,
        outletId,
        firstVisitedAt: new Date(),
        lastVisitedAt: new Date(),
        visitCount: 3,
      }),
    );

    const response = await request(app.getHttpServer())
      .get(`/api/customers/${customerId}/outlets`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = response.body as CustomerOutletResponseBody[];
    expect(body).toHaveLength(1);
    expect(body[0].outletId).toBe(outletId);
    expect(body[0].visitCount).toBe(3);
    expect(body[0].isFavoriteOutlet).toBe(false);
  });

  it('PATCH /api/customers/:id/outlets/:outletId toggles the favorite flag', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/customers/${customerId}/outlets/${outletId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isFavoriteOutlet: true })
      .expect(200);

    expect((response.body as CustomerOutletResponseBody).isFavoriteOutlet).toBe(
      true,
    );
  });

  it('GET /api/customers/:id 404s for an unknown id', async () => {
    await request(app.getHttpServer())
      .get('/api/customers/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('DELETE /api/customers/:id soft-deletes the customer', async () => {
    await request(app.getHttpServer())
      .delete(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const stillInDb = await customerRepo.findOne({
      where: { id: customerId },
      withDeleted: true,
    });
    expect(stillInDb?.deletedAt).not.toBeNull();
  });
});
