import type { AuthRepository, VerifierRepository, ReseterRepository } from '../../domain/auth/repository.js';
import type { ProfileRepository, QuotaRepository } from '../../domain/user/repository.js';

export interface TransactionContext {
  authRepo: AuthRepository;
  verifierRepo: VerifierRepository;
  reseterRepo: ReseterRepository;
  profileRepo: ProfileRepository;
  quotaRepo: QuotaRepository;
}

export interface UnitOfWork {
  run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
