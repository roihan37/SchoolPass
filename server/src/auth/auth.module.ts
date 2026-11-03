import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || secret.trim().length < 32) {
    throw new Error(
      'JWT_SECRET must contain at least 32 bytes of random secret material. Set it in the local environment.',
    );
  }
  return secret;
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: jwtSecret(),
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: 900,
          issuer: 'schoolpass',
          audience: 'schoolpass-api',
        },
        verifyOptions: {
          algorithms: ['HS256' as const],
          issuer: 'schoolpass',
          audience: 'schoolpass-api',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
