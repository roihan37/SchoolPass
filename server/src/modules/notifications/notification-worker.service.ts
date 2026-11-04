import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { redisConnectionOptions } from '../../infrastructure/redis/redis-connection.js';
import {
  LEAVE_DECIDED_JOB,
  notificationQueueName,
  type LeaveDecidedJob,
} from '../../infrastructure/queue/queue.constants.js';
import { NotificationProcessor } from './notification.processor.js';

@Injectable()
export class NotificationWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationWorkerService.name);
  private worker?: Worker<LeaveDecidedJob, void, typeof LEAVE_DECIDED_JOB>;

  constructor(
    @Inject(NotificationProcessor)
    private readonly processor: NotificationProcessor,
  ) {}

  async onModuleInit() {
    const connection = redisConnectionOptions();
    const worker = new Worker<
      LeaveDecidedJob,
      void,
      typeof LEAVE_DECIDED_JOB
    >(
      notificationQueueName(),
      // Worker mengambil job Redis dan menyerahkan pembuatan notifikasi ke processor.
      async (job) => {
        await this.processor.process(job.data);
      },
      { connection: { ...connection, maxRetriesPerRequest: null } },
    );
    this.worker = worker;
    worker.on('error', (error) =>
      this.logger.error(`Notification worker error: ${error.message}`),
    );
    await worker.waitUntilReady();
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
