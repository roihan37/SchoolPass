import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../common/auth/auth.decorators.js';
import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto.js';
import { LeaveRequestsService } from './leave-requests.service.js';

@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(
    @Inject(LeaveRequestsService) private readonly leaves: LeaveRequestsService,
  ) {}

  @Post()
  @Roles('PARENT')
  create(
    @CurrentUser() user: CurrentIdentity,
    @Body(
      new ValidationPipe({
        expectedType: CreateLeaveRequestDto,
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: CreateLeaveRequestDto,
  ) {
    return this.leaves.create(user, dto);
  }

  @Get()
  @Roles('PARENT', 'TEACHER')
  list(@CurrentUser() user: CurrentIdentity) {
    return this.leaves.list(user);
  }

  @Get(':id')
  @Roles('PARENT', 'TEACHER')
  detail(
    @CurrentUser() user: CurrentIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.leaves.detail(user, id);
  }

  @Patch(':id/decision')
  @Roles('TEACHER')
  decide(
    @CurrentUser() user: CurrentIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(
      new ValidationPipe({
        expectedType: DecideLeaveRequestDto,
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: DecideLeaveRequestDto,
  ) {
    return this.leaves.decide(user, id, dto);
  }
}
