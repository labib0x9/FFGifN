import type { AuthRepository, VerifierRepository } from '../../domain/auth/repository.js';
import { generateToken } from './token_util.js';
import type { EmailPublisher } from '../ports/email_publisher.js';

export class ResendVerifyService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly verifierRepo: VerifierRepository,
    private readonly emailPublisher: EmailPublisher
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.authRepo.getByEmail(email);
    // Return silently if user not found or already verified to prevent enumeration
    if (!user || user.isVerified || user.deletedAt) {
      return;
    }

    const { token, tokenHash } = generateToken();

    await this.verifierRepo.upsert({
      userId: user.id,
      tokenHash,
      expireAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    try {
      await this.emailPublisher.publishEmail({
        to: user.email,
        name: 'resend-verify',
        token,
      });
    } catch (err) {
      console.error('[ResendVerifyService] Failed to publish email:', err);
    }
  }
}
