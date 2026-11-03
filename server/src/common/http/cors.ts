import type { INestApplication } from '@nestjs/common';

const frontendOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'];

export function configureCors(app: INestApplication) {
  app.enableCors({
    origin: frontendOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
}
