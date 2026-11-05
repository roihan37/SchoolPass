import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from '../../common/auth/auth.decorators.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body(
      new ValidationPipe({
        expectedType: LoginDto,
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    body: LoginDto,
    @Req() request: Request,
  ) {
    return this.auth.login(
      body,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Public()
  @Post('register')
  register(
    @Body(new ValidationPipe({ expectedType: RegisterDto, whitelist: true, forbidNonWhitelisted: true, transform: true })) body: RegisterDto,
  ) {
    return this.auth.register(body);
  }

  @Get('me')
  me(@CurrentUser() user: CurrentIdentity) {
    return user;
  }
}
