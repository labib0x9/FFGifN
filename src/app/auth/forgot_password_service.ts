import type { AuthRepository, ReseterRepository } from '../../domain/auth/repository.js';
import { generateToken } from './token_util.js';
import type { EmailPublisher } from '../ports/email_publisher.js';

export class ForgotPasswordService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly reseterRepo: ReseterRepository,
    private readonly emailPublisher: EmailPublisher
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.authRepo.getByEmail(email);
    // Silently return for unknown, deleted, or unverified emails to prevent user enumeration
    if (!user || !user.isVerified || user.deletedAt) {
      return;
    }

    const { token, tokenHash } = generateToken();

    await this.reseterRepo.create({
      userId: user.id,
      tokenHash,
      expireAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    try {
      await this.emailPublisher.publishEmail({
        to: user.email,
        name: 'forgot-password',
        token,
      });
    } catch (err) {
      console.error('[ForgotPasswordService] Failed to publish email:', err);
    }
  }
}
