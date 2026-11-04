import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { LeaveDecidedJob } from '../../infrastructure/queue/queue.constants.js';
import { NotificationQueueService } from '../../infrastructure/queue/notification-queue.service.js';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationQueueService)
    private readonly queue: NotificationQueueService,
  ) {}

  async enqueueDecision(data: LeaveDecidedJob) {
    await this.queue.enqueue(data);
  }

  async list(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        leaveRequestId: true,
        type: true,
        message: true,
        readAt: true,
        createdAt: true,
        leaveRequest: {
          select: {
            type: true,
            student: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return notifications.map(({ leaveRequest, ...notification }) => ({
      ...notification,
      studentName: leaveRequest.student.name,
      leaveType: leaveRequest.type,
    }));
  }
}
