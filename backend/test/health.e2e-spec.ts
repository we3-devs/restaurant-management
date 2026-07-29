import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok status for db and redis', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    const body = response.body as {
      status: string;
      db: { status: string };
      redis: { status: string };
    };
    expect(body.status).toBe('ok');
    expect(body.db.status).toBe('ok');
    expect(body.redis.status).toBe('ok');
  });
});
