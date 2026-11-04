import { createHash } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisCacheService } from '../../infrastructure/cache/redis-cache.service.js';

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class LoginAttemptLimiterService {
  constructor(
    @Inject(RedisCacheService) private readonly cache: RedisCacheService,
  ) {}

  async consume(clientIp: string, email: string): Promise<void> {
    const key = this.keyFor(clientIp, email);
    let attempt: { count: number; ttlSeconds: number };
    try {
      attempt = await this.cache.incrementWithExpiry(
        key,
        LOGIN_ATTEMPT_WINDOW_SECONDS,
      );
    } catch {
      throw new ServiceUnavailableException('Login is temporarily unavailable');
    }

    if (attempt.count > LOGIN_ATTEMPT_LIMIT) {
      throw new HttpException(
        {
          message: 'Too many login attempts. Try again later.',
          retryAfterSeconds: attempt.ttlSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async reset(clientIp: string, email: string): Promise<void> {
    try {
      await this.cache.delete(this.keyFor(clientIp, email));
    } catch {
      throw new ServiceUnavailableException('Login is temporarily unavailable');
    }
  }

  private keyFor(clientIp: string, email: string): string {
    const digest = createHash('sha256')
      .update(`${clientIp}\0${email.trim().toLowerCase()}`)
      .digest('hex');
    return `schoolpass:auth:login:${digest}`;
  }
}
