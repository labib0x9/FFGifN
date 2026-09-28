import { PrismaClient } from '@prisma/client';
import { getConfig, Config } from '../../config/env.js';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(configOverride?: Config): PrismaClient {
  if (!prismaInstance) {
    const config = configOverride || getConfig();
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: config.postgres.databaseUrl,
        },
      },
      log: config.environment === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
