import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { Public } from '../../common/auth/auth.decorators.js';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  getHealth(): { status: 'ok' } {
    return this.healthService.getHealth();
  }
}
