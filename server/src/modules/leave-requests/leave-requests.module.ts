import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module.js';
import { MinioModule } from '../../infrastructure/storage/minio.module.js';
import { LeaveRequestsController } from './leave-requests.controller.js';
import { LeaveRequestsService } from './leave-requests.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';

@Module({
  imports: [PrismaModule, MinioModule, NotificationsModule, DashboardModule],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
