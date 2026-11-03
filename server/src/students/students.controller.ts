import { Controller, Get, Inject } from '@nestjs/common';
import {
  CurrentUser,
  Roles,
  type CurrentIdentity,
} from '../auth/auth.decorators.js';
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
}
