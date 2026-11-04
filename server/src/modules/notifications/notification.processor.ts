import { Inject, Injectable } from '@nestjs/common';
import type { LeaveDecidedJob } from '../../infrastructure/queue/queue.constants.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class NotificationProcessor {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async process(data: LeaveDecidedJob) {
    const decision = data.status === 'APPROVED' ? 'disetujui' : 'ditolak';
    // Upsert aman untuk retry: unique key di PostgreSQL mencegah baris duplikat.
    await this.prisma.notification.upsert({
      where: {
        userId_leaveRequestId_type: {
          userId: data.userId,
          leaveRequestId: data.leaveRequestId,
          type: 'LEAVE_DECIDED',
        },
      },
      update: {},
      create: {
        userId: data.userId,
        leaveRequestId: data.leaveRequestId,
        type: 'LEAVE_DECIDED',
        message: `Permintaan izin Anda ${decision}.`,
      },
    });
  }
}
