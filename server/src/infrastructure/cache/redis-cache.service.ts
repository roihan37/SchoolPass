import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { REDIS_CACHE } from './cache.tokens.js';

type RedisCacheClient = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
  ): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>;
  quit(): Promise<string>;
};

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CACHE) private readonly redis: RedisCacheClient) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value === null ? null : (JSON.parse(value) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async incrementWithExpiry(
    key: string,
    ttlSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    const result = (await this.redis.eval(
      "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return { count, redis.call('TTL', KEYS[1]) }",
      1,
      key,
      String(ttlSeconds),
    )) as [number, number];

    return {
      count: Number(result[0]),
      ttlSeconds: Math.max(1, Number(result[1])),
    };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
