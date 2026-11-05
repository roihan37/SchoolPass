import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureCors } from './common/http/cors.js';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
  );
  app.setGlobalPrefix('api/v1');
  configureCors(app);
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.PORT ?? 3000),
    process.env.HOST ?? '127.0.0.1',
  );

  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }
}
await bootstrap();
