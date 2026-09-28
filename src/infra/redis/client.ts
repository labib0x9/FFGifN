import { Redis, RedisOptions } from 'ioredis';
import { getConfig, Config } from '../../config/env.js';

let redisInstance: Redis | null = null;

export function parseRedisAddr(addr: string): { host: string; port: number } {
  const parts = addr.split(':');
  const host = parts[0] || 'localhost';
  const port = parts[1] ? parseInt(parts[1], 10) : 6379;
  return { host, port };
}

export async function createRedisClient(configOverride?: Config['redis']): Promise<Redis> {
  const redisConfig = configOverride || getConfig().redis;
  const { host, port } = parseRedisAddr(redisConfig.addr);

  const options: RedisOptions = {
    host,
    port,
    username: redisConfig.user || undefined,
    password: redisConfig.pass || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  };

  const client = new Redis(options);

  try {
    await client.connect();
    await client.ping();
    console.log('[Redis] Redis connection complete');
  } catch (err) {
    throw new Error(`[Redis Panic] Failed to connect to Redis at ${redisConfig.addr}: ${(err as Error).message}`);
  }

  return client;
}

export function getRedisClientSync(configOverride?: Config['redis']): Redis {
  if (!redisInstance) {
    const redisConfig = configOverride || getConfig().redis;
    const { host, port } = parseRedisAddr(redisConfig.addr);
    redisInstance = new Redis({
      host,
      port,
      username: redisConfig.user || undefined,
      password: redisConfig.pass || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }
  return redisInstance;
}

export async function getRedisClient(configOverride?: Config['redis']): Promise<Redis> {
  if (!redisInstance) {
    redisInstance = await createRedisClient(configOverride);
  }
  return redisInstance;
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit().catch(() => redisInstance?.disconnect());
    redisInstance = null;
  }
}
