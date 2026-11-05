import { Body, Controller, Get, Inject, Post, ValidationPipe } from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js';
import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import { ClassesService } from './classes.service.js';
import { CreateClassDto } from './dto/create-class.dto.js';
import { EnrollStudentDto } from './dto/enroll-student.dto.js';

@Controller('classes')
export class ClassesController {
  constructor(@Inject(ClassesService) private readonly classes: ClassesService) {}

  @Roles('PARENT', 'TEACHER')
  @Get('mine')
  mine(@CurrentUser() user: CurrentIdentity) { return this.classes.mine(user); }

  @Roles('TEACHER')
  @Post()
  create(@CurrentUser() user: CurrentIdentity, @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) body: CreateClassDto) {
    return this.classes.create(user, body.name);
  }

  @Roles('PARENT')
  @Post('enroll')
  enroll(@CurrentUser() user: CurrentIdentity, @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) body: EnrollStudentDto) {
    return this.classes.enrollParent(user, body.classCode, body.studentName);
  }
}
