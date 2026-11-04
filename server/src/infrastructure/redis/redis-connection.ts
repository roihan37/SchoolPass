import type { RedisOptions } from 'bullmq';

export function redisConnectionOptions(): RedisOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:56379');
  if (!['redis:', 'rediss:'].includes(url.protocol)) {
    throw new Error('REDIS_URL must use redis:// or rediss://');
  }
  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === 'rediss:' ? 6380 : 6379)),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: 1,
  };
}
