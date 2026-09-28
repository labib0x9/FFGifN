import { PrismaClient, Prisma } from '@prisma/client';
import type { QuotaRepository } from '../../domain/user/repository.js';
import type { Quota } from '../../domain/user/entity.js';
import { QuotaExceededError } from '../../domain/user/errors.js';

export class PostgresQuotaRepository implements QuotaRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(quota: {
    userId: string;
    usedBytes?: bigint;
    totalBytes?: bigint;
    gifCount?: number;
    gifLimit?: number;
  }): Promise<Quota> {
    const record = await this.prisma.quota.create({
      data: {
        userId: quota.userId,
        usedBytes: quota.usedBytes ?? BigInt(0),
        totalBytes: quota.totalBytes ?? BigInt(1073741824),
        gifCount: quota.gifCount ?? 0,
        gifLimit: quota.gifLimit ?? 100,
      },
    });
    return record;
  }

  async getQuota(userId: string): Promise<Quota | null> {
    const record = await this.prisma.quota.findUnique({
      where: { userId },
    });
    return record;
  }

  async incrementGifCount(userId: string, addedBytes: bigint): Promise<void> {
    const affected = await this.prisma.$executeRaw`
      UPDATE quota
      SET used_bytes = used_bytes + ${addedBytes}, gif_count = gif_count + 1
      WHERE user_id = ${userId}::uuid
        AND (used_bytes + ${addedBytes} <= total_bytes)
        AND (gif_count + 1 <= gif_limit)
    `;

    if (affected === 0) {
      throw new QuotaExceededError();
    }
  }

  async decrementGifCount(userId: string, freedBytes: bigint): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE quota
      SET used_bytes = CASE WHEN used_bytes >= ${freedBytes} THEN used_bytes - ${freedBytes} ELSE 0 END,
          gif_count = CASE WHEN gif_count > 0 THEN gif_count - 1 ELSE 0 END
      WHERE user_id = ${userId}::uuid
    `;
  }
}
