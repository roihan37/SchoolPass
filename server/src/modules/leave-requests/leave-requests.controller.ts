import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
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

  @Post(':id/attachment')
  @Roles('PARENT')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  addAttachment(
    @CurrentUser() user: CurrentIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.leaves.addAttachment(user, id, file);
  }

  @Get(':id/attachment-url')
  @Roles('PARENT', 'TEACHER')
  attachmentUrl(
    @CurrentUser() user: CurrentIdentity,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.leaves.attachmentUrl(user, id);
  }

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
