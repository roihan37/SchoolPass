import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/database/prisma.module.js';
import { NotificationProcessor } from './modules/notifications/notification.processor.js';
import { NotificationWorkerService } from './modules/notifications/notification-worker.service.js';

@Module({
  imports: [PrismaModule],
  providers: [NotificationProcessor, NotificationWorkerService],
})
export class WorkerModule {}
