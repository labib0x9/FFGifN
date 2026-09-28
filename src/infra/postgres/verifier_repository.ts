import { PrismaClient, Prisma } from '@prisma/client';
import type { VerifierRepository } from '../../domain/auth/repository.js';
import type { Verifier } from '../../domain/auth/entity.js';

export class PostgresVerifierRepository implements VerifierRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async create(verifier: { userId: string; tokenHash: string; expireAt?: Date }): Promise<Verifier> {
    const expireAt = verifier.expireAt || new Date(Date.now() + 30 * 60 * 1000);
    const record = await this.prisma.verifier.create({
      data: {
        userId: verifier.userId,
        tokenHash: verifier.tokenHash,
        expireAt,
      },
    });
    return record;
  }

  async upsert(verifier: { userId: string; tokenHash: string; expireAt?: Date }): Promise<Verifier> {
    const expireAt = verifier.expireAt || new Date(Date.now() + 30 * 60 * 1000);
    const record = await this.prisma.verifier.upsert({
      where: { userId: verifier.userId },
      update: {
        tokenHash: verifier.tokenHash,
        expireAt,
      },
      create: {
        userId: verifier.userId,
        tokenHash: verifier.tokenHash,
        expireAt,
      },
    });
    return record;
  }

  async getByHash(tokenHash: string): Promise<Verifier | null> {
    const record = await this.prisma.verifier.findFirst({
      where: {
        tokenHash,
        expireAt: {
          gt: new Date(),
        },
      },
    });
    return record;
  }

  async getByUserId(userId: string): Promise<Verifier | null> {
    const record = await this.prisma.verifier.findUnique({
      where: { userId },
    });
    return record;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.verifier.delete({
      where: { id },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.verifier.deleteMany({
      where: { userId },
    });
  }
}
