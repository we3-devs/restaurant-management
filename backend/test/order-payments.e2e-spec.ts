import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Food } from '../src/modules/foods/entities/food.entity';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import { Order } from '../src/modules/orders/entities/order.entity';
import { OrderPayment } from '../src/modules/order-payments/entities/order-payment.entity';
import { OutletDepartment } from '../src/modules/outlet-departments/entities/outlet-department.entity';
import { Outlet } from '../src/modules/outlets/entities/outlet.entity';

interface AuthResponseBody {
  accessToken: string;
}

interface OrderResponseBody {
  id: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  refundedAmount: number;
  paymentStatus: string;
}

describe('Order Payments (e2e)', () => {
  let app: INestApplication;
  let outletRepo: Repository<Outlet>;
  let departmentRepo: Repository<OutletDepartment>;
  let foodRepo: Repository<Food>;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;
  let orderPaymentRepo: Repository<OrderPayment>;
  let adminToken: string;
  let orderId: number;
  let grandTotal: number;

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
    foodRepo = moduleFixture.get(getRepositoryToken(Food));
    orderRepo = moduleFixture.get(getRepositoryToken(Order));
    orderItemRepo = moduleFixture.get(getRepositoryToken(OrderItem));
    orderPaymentRepo = moduleFixture.get(getRepositoryToken(OrderPayment));

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      });
    ({ accessToken: adminToken } = loginResponse.body as AuthResponseBody);

    let outlet = await outletRepo.findOne({
      where: { name: 'E2E Order Payments Fixture Outlet' },
    });
    if (!outlet) {
      outlet = await outletRepo.save(
        outletRepo.create({ name: 'E2E Order Payments Fixture Outlet' }),
      );
    }

    let department = await departmentRepo.findOne({
      where: {
        outletId: outlet.id,
        name: 'E2E Order Payments Fixture Kitchen',
      },
    });
    if (!department) {
      department = await departmentRepo.save(
        departmentRepo.create({
          outletId: outlet.id,
          name: 'E2E Order Payments Fixture Kitchen',
        }),
      );
    }

    let food = await foodRepo.findOne({
      where: { slug: 'e2e-order-payments-fixture-food' },
    });
    if (!food) {
      food = await foodRepo.save(
        foodRepo.create({
          name: 'E2E Order Payments Fixture Food',
          slug: 'e2e-order-payments-fixture-food',
          basePrice: 20,
        }),
      );
    }

    const orderResponse = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ outletId: outlet.id })
      .expect(201);
    orderId = (orderResponse.body as OrderResponseBody).id;

    const itemResponse = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        foodId: food.id,
        preparationDepartmentId: department.id,
        quantity: 1,
      })
      .expect(201);
    void itemResponse;

    const order = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    grandTotal = (order.body as OrderResponseBody).grandTotal;
  });

  afterAll(async () => {
    await orderPaymentRepo.delete({ orderId });
    await orderItemRepo.delete({ orderId });
    await orderRepo.delete(orderId);
    await app.close();
  });

  it('a partial payment flips paymentStatus to partial with the correct dueAmount', async () => {
    const half = Math.round((grandTotal / 2) * 100) / 100;
    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: half })
      .expect(201);

    const order = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = order.body as OrderResponseBody;
    expect(body.paymentStatus).toBe('partial');
    expect(body.paidAmount).toBe(half);
    expect(body.dueAmount).toBe(Math.round((grandTotal - half) * 100) / 100);
  });

  it('a second payment covering the rest flips paymentStatus to paid', async () => {
    const order1 = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const due = (order1.body as OrderResponseBody).dueAmount;

    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: due })
      .expect(201);

    const order2 = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = order2.body as OrderResponseBody;
    expect(body.paymentStatus).toBe('paid');
    expect(body.dueAmount).toBe(0);
  });

  it('a full refund flips paymentStatus to refunded', async () => {
    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'refund', amount: grandTotal })
      .expect(201);

    const order = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = order.body as OrderResponseBody;
    expect(body.paymentStatus).toBe('refunded');
    expect(body.refundedAmount).toBe(grandTotal);
  });
});
