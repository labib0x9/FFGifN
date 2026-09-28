import { getTokenHash } from './token_util.js';
import { PasswordHasher } from './password_hasher.js';
import { ResetTokenFetchFailedError, UserNotFoundError } from '../../domain/auth/errors.js';
import type { ReseterRepository } from '../../domain/auth/repository.js';
import type { UnitOfWork } from '../ports/unit_of_work.js';
import type { EmailPublisher } from '../ports/email_publisher.js';

export class ResetPasswordService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly reseterRepo: ReseterRepository,
    private readonly emailPublisher: EmailPublisher,
    private readonly hasher: PasswordHasher
  ) {}

  async getResetToken(token: string): Promise<string> {
    const tokenHash = getTokenHash(token);
    const reseter = await this.reseterRepo.getByToken(tokenHash);
    if (!reseter) {
      throw new ResetTokenFetchFailedError();
    }
    return token;
  }

  async resetPassword(token: string, pass: string, confirmPass: string): Promise<void> {
    if (pass !== confirmPass) {
      throw new Error('password and confirm_password do not match');
    }

    const tokenHash = getTokenHash(token);
    const passHash = await this.hasher.hash(pass);

    let userEmail = '';

    await this.unitOfWork.run(async (tx) => {
      const oldToken = await tx.reseterRepo.getByToken(tokenHash);
      if (!oldToken) {
        throw new ResetTokenFetchFailedError();
      }

      const user = await tx.authRepo.getById(oldToken.userId);
      if (!user) {
        throw new UserNotFoundError();
      }

      userEmail = user.email;

      await tx.authRepo.updatePassword(user.id, passHash);
      await tx.reseterRepo.deleteById(oldToken.id);
    });

    try {
      await this.emailPublisher.publishEmail({
        to: userEmail,
        name: 'reset-password',
        token: '',
      });
    } catch (err) {
      console.error('[ResetPasswordService] Failed to publish reset confirmation email:', err);
    }
  }
}
