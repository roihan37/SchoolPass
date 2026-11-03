import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module.js';

@Module({
  imports: [AuthModule, HealthModule, StudentsModule, LeaveRequestsModule],
})
export class AppModule {}
