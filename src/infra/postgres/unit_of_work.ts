import { PrismaClient, Prisma } from '@prisma/client';
import type { UnitOfWork, TransactionContext } from '../../app/ports/unit_of_work.js';
import { PostgresAuthRepository } from './auth_repository.js';
import { PostgresVerifierRepository } from './verifier_repository.js';
import { PostgresReseterRepository } from './reseter_repository.js';
import { PostgresProfileRepository } from './profile_repository.js';
import { PostgresQuotaRepository } from './quota_repository.js';

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const authRepo = new PostgresAuthRepository(tx);
      const verifierRepo = new PostgresVerifierRepository(tx);
      const reseterRepo = new PostgresReseterRepository(tx);
      const profileRepo = new PostgresProfileRepository(tx);
      const quotaRepo = new PostgresQuotaRepository(tx);

      return fn({
        authRepo,
        verifierRepo,
        reseterRepo,
        profileRepo,
        quotaRepo,
      });
    });
  }
}
