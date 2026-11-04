import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module.js';
import { CacheModule } from '../../infrastructure/cache/cache.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
