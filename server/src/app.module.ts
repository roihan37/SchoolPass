import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { ClassesModule } from './modules/classes/classes.module.js';

@Module({
  imports: [
    AuthModule,
    HealthModule,
    StudentsModule,
    LeaveRequestsModule,
    NotificationsModule,
    DashboardModule,
    ClassesModule,
  ],
})
export class AppModule {}
