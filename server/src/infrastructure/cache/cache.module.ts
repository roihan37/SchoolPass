import { Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { redisConnectionOptions } from '../redis/redis-connection.js';
import { REDIS_CACHE } from './cache.tokens.js';
import { RedisCacheService } from './redis-cache.service.js';

@Module({
  providers: [
    {
      provide: REDIS_CACHE,
      useFactory: () => new Redis(redisConnectionOptions()),
    },
    RedisCacheService,
  ],
  exports: [RedisCacheService],
})
export class CacheModule {}
