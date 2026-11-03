import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { randomBytes } from 'node:crypto';

describe('API composition (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('GET /api/v1/health', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('rejects an unknown route', () =>
    request(app.getHttpServer()).get('/api/v1/missing').expect(404));

  it('requires the API prefix', () =>
    request(app.getHttpServer()).get('/health').expect(404));

  it('protects students without a token', () =>
    request(app.getHttpServer()).get('/api/v1/students/mine').expect(401));

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
});
