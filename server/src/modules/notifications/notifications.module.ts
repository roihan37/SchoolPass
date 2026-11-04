import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module.js';
import { QueueModule } from '../../infrastructure/queue/queue.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
