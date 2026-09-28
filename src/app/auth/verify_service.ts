import { getTokenHash } from './token_util.js';
import { InvalidTokenError } from '../../domain/auth/errors.js';
import type { UnitOfWork } from '../ports/unit_of_work.js';

export class VerifyService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(token: string): Promise<void> {
    const tokenHash = getTokenHash(token);

    await this.unitOfWork.run(async (tx) => {
      const verifier = await tx.verifierRepo.getByHash(tokenHash);
      if (!verifier) {
        throw new InvalidTokenError();
      }

      await tx.authRepo.setVerified(verifier.userId);
      await tx.verifierRepo.delete(verifier.id);
    });
  }
}
