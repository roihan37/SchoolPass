import { Controller, Get, Inject } from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js';
import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get('summary')
  @Roles('TEACHER')
  summary(@CurrentUser() user: CurrentIdentity) {
    return this.dashboard.summary(user);
  }
}
