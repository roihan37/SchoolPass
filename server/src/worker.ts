import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

const context = await NestFactory.createApplicationContext(WorkerModule);
context.enableShutdownHooks();
