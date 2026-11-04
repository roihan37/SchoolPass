import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { testDatabaseUrl } from '../src/infrastructure/database/database-env.js';
import { redisConnectionOptions } from '../src/infrastructure/redis/redis-connection.js';
import {
  LEAVE_DECIDED_JOB,
  NOTIFICATION_JOB_OPTIONS,
  type LeaveDecidedJob,
  notificationQueueName,
} from '../src/infrastructure/queue/queue.constants.js';
import { NotificationProcessor } from '../src/modules/notifications/notification.processor.js';

describe('notification worker retry (PostgreSQL + Redis)', () => {
  let context: INestApplicationContext;
  let queue: Queue<LeaveDecidedJob, void, typeof LEAVE_DECIDED_JOB>;
  let processAttemptCount = 0;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', testDatabaseUrl());
    vi.stubEnv(
      'NOTIFICATION_QUEUE_NAME',
      `leave-notifications-test-${randomUUID()}`,
    );
    const { WorkerModule } = await import('../src/worker.module.js');
    const process = vi.fn(async () => {
      processAttemptCount += 1;
      if (processAttemptCount < 3)
        throw new Error('transient database failure');
    });
    const module = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(NotificationProcessor)
      .useValue({ process })
      .compile();
    context = module;
    await module.init();
    queue = new Queue<LeaveDecidedJob, void, typeof LEAVE_DECIDED_JOB>(
      notificationQueueName(),
      {
        connection: redisConnectionOptions(),
        defaultJobOptions: NOTIFICATION_JOB_OPTIONS,
      },
    );
    await queue.waitUntilReady();
  });

  afterAll(async () => {
    await queue?.close();
    await context?.close();
    vi.unstubAllEnvs();
  });

  it('retries a failed processing attempt and completes the same job once', async () => {
    const jobId = randomUUID();
    const job = await queue.add(
      LEAVE_DECIDED_JOB,
      {
        userId: randomUUID(),
        leaveRequestId: randomUUID(),
        status: 'APPROVED',
      },
      { jobId },
    );
    const deadline = Date.now() + 12_000;
    let state = await job.getState();
    while (
      state !== 'completed' &&
      state !== 'failed' &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      state = await job.getState();
    }

    expect(state).toBe('completed');
    const completedJob = await queue.getJob(jobId);
    expect(completedJob?.attemptsMade).toBe(3);
    expect(completedJob).toBeDefined();
    expect(processAttemptCount).toBe(3);
    await job.remove();
  }, 15_000);
});
