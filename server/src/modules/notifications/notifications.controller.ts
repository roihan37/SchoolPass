import { Controller, Get, Inject } from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js';
import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @Roles('PARENT', 'TEACHER')
  list(@CurrentUser() user: CurrentIdentity) {
    return this.notifications.list(user.id);
  }
}
