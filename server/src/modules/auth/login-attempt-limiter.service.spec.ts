import { HttpException } from '@nestjs/common';
import { LoginAttemptLimiterService } from './login-attempt-limiter.service.js';

describe('LoginAttemptLimiterService', () => {
  it('allows the first 10 attempts and rejects the 11th for the same IP and email', async () => {
    let count = 0;
    const cache = {
      incrementWithExpiry: vi.fn(async (_key: string, _ttlSeconds: number) => ({
        count: ++count,
        ttlSeconds: 900,
      })),
      delete: vi.fn(async () => undefined),
    };
    const limiter = new LoginAttemptLimiterService(cache as never);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await expect(
        limiter.consume('127.0.0.1', 'parent@example.test'),
      ).resolves.toBeUndefined();
    }
    await expect(
      limiter.consume('127.0.0.1', 'parent@example.test'),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof HttpException &&
        error.getStatus() === 429 &&
        (error.getResponse() as { retryAfterSeconds: number })
          .retryAfterSeconds === 900,
    );
  });

  it('keys limits by IP and case-insensitive email, without exposing email in Redis keys', async () => {
    const cache = {
      incrementWithExpiry: vi.fn(async (_key: string, _ttlSeconds: number) => ({
        count: 1,
        ttlSeconds: 900,
      })),
      delete: vi.fn(async () => undefined),
    };
    const limiter = new LoginAttemptLimiterService(cache as never);

    await limiter.consume('127.0.0.1', ' Parent@Example.test ');
    await limiter.consume('127.0.0.1', 'parent@example.test');

    const firstKey = cache.incrementWithExpiry.mock.calls[0][0];
    const secondKey = cache.incrementWithExpiry.mock.calls[1][0];
    expect(firstKey).toBe(secondKey);
    expect(firstKey).toMatch(/^schoolpass:auth:login:[a-f0-9]{64}$/);
    expect(firstKey).not.toContain('parent@example.test');
  });

  it('resets the attempt counter after a valid login', async () => {
    const cache = {
      incrementWithExpiry: vi.fn(async (_key: string, _ttlSeconds: number) => ({
        count: 1,
        ttlSeconds: 900,
      })),
      delete: vi.fn(async (_key: string) => undefined),
    };
    const limiter = new LoginAttemptLimiterService(cache as never);

    await limiter.reset('127.0.0.1', 'parent@example.test');

    expect(cache.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^schoolpass:auth:login:[a-f0-9]{64}$/),
    );
    expect(cache.delete).not.toHaveBeenCalledWith(
      expect.stringContaining('parent@example.test'),
    );
  });

  it('fails closed with 503 when Redis cannot record an attempt', async () => {
    const limiter = new LoginAttemptLimiterService({
      incrementWithExpiry: vi.fn(async () => {
        throw new Error('Redis connection details must not leak');
      }),
      delete: vi.fn(async () => undefined),
    } as never);

    await expect(limiter.consume('127.0.0.1', 'parent@example.test')).rejects.toSatisfy(
      (error) =>
        error instanceof HttpException &&
        error.getStatus() === 503 &&
        (error.getResponse() as { message: string }).message ===
          'Login is temporarily unavailable',
    );
  });
});
