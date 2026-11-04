import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import { Controller, Get, Inject } from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js';
import { StudentsService } from './students.service.js';

@Controller('students')
export class StudentsController {
  constructor(
    @Inject(StudentsService) private readonly students: StudentsService,
  ) {}

  @Roles('PARENT')
  @Get('mine')
  mine(@CurrentUser() user: CurrentIdentity) {
    return this.students.mine(user);
  }

  @Roles('TEACHER')
  @Get('assigned')
  assigned(@CurrentUser() user: CurrentIdentity) {
    return this.students.assigned(user);
  }
}
