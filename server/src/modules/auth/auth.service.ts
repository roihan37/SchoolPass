import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { identitySelect } from '../../common/auth/auth.identity.js';
import {
  hashPassword,
  verifyPassword,
} from '../../common/security/password.js';
import type { LoginDto } from './dto/login.dto.js';
import { LoginAttemptLimiterService } from './login-attempt-limiter.service.js';

@Injectable()
export class AuthService {
  // Unknown accounts still perform a password derivation; never return account existence.
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(LoginAttemptLimiterService)
    private readonly loginAttemptLimiter: LoginAttemptLimiterService,
  ) {}

  async login(credentials: LoginDto, clientIp: string) {
    await this.loginAttemptLimiter.consume(clientIp, credentials.email);
    const user = await this.prisma.user.findUnique({
      where: { email: credentials.email },
      select: { ...identitySelect, passwordHash: true },
    });
    const valid = await verifyPassword(
      credentials.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid)
      throw new UnauthorizedException('Invalid email or password');
    await this.loginAttemptLimiter.reset(clientIp, credentials.email);
    const { passwordHash: _passwordHash, ...identity } = user;
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: identity,
    };
  }
}
