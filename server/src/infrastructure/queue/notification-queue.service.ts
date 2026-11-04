import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../redis/redis-connection.js';
import {
  LEAVE_DECIDED_JOB,
  NOTIFICATION_JOB_OPTIONS,
  notificationQueueName,
  type LeaveDecidedJob,
} from './queue.constants.js';

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queue = new Queue<
    LeaveDecidedJob,
    void,
    typeof LEAVE_DECIDED_JOB
  >(notificationQueueName(), {
    connection: redisConnectionOptions(),
    defaultJobOptions: NOTIFICATION_JOB_OPTIONS,
  });

  async onModuleInit() {
    await this.queue.waitUntilReady();
  }

  async enqueue(data: LeaveDecidedJob) {
    // BullMQ menyimpan job di Redis untuk diambil worker yang berjalan terpisah.
    await this.queue.add(LEAVE_DECIDED_JOB, data, {
      jobId: data.leaveRequestId,
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
