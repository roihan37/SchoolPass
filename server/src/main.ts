import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureCors } from './common/http/cors.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  configureCors(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000, '127.0.0.1');
}
await bootstrap();
