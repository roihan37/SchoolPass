import { Module } from '@nestjs/common';
import { NotificationQueueService } from './notification-queue.service.js';

@Module({
  providers: [NotificationQueueService],
  exports: [NotificationQueueService],
})
export class QueueModule {}
