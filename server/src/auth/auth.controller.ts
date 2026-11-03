import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import {
  CurrentUser,
  Public,
  type CurrentIdentity,
} from './auth.decorators.js';
import { LoginDto } from './login.dto.js';

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
  ) {
    return this.auth.login(body);
  }

  @Get('me')
  me(@CurrentUser() user: CurrentIdentity) {
    return user;
  }
}
