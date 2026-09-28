import { describe, it, expect, vi } from 'vitest';
import { ResendVerifyService } from '../src/app/auth/resend_verify_service.js';
import type { AuthRepository, VerifierRepository } from '../src/domain/auth/repository.js';
import type { EmailPublisher } from '../src/app/ports/email_publisher.js';

describe('ResendVerifyService', () => {
  it('silently succeeds for unknown email to prevent enumeration', async () => {
    const authRepo: Partial<AuthRepository> = {
      getByEmail: vi.fn().mockResolvedValue(null),
    };
    const verifierRepo: Partial<VerifierRepository> = {
      upsert: vi.fn(),
    };
    const emailPublisher: EmailPublisher = {
      publishEmail: vi.fn(),
    };

    const service = new ResendVerifyService(
      authRepo as AuthRepository,
      verifierRepo as VerifierRepository,
      emailPublisher
    );

    await expect(service.execute('unknown@example.com')).resolves.toBeUndefined();
    expect(verifierRepo.upsert).not.toHaveBeenCalled();
    expect(emailPublisher.publishEmail).not.toHaveBeenCalled();
  });

  it('silently succeeds for already-verified email to prevent enumeration', async () => {
    const authRepo: Partial<AuthRepository> = {
      getByEmail: vi.fn().mockResolvedValue({
        id: 'verified-id',
        email: 'verified@example.com',
        isVerified: true,
      }),
    };
    const verifierRepo: Partial<VerifierRepository> = {
      upsert: vi.fn(),
    };
    const emailPublisher: EmailPublisher = {
      publishEmail: vi.fn(),
    };

    const service = new ResendVerifyService(
      authRepo as AuthRepository,
      verifierRepo as VerifierRepository,
      emailPublisher
    );

    await expect(service.execute('verified@example.com')).resolves.toBeUndefined();
    expect(verifierRepo.upsert).not.toHaveBeenCalled();
    expect(emailPublisher.publishEmail).not.toHaveBeenCalled();
  });

  it('performs atomic upsert and publishes email for unverified user', async () => {
    const authRepo: Partial<AuthRepository> = {
      getByEmail: vi.fn().mockResolvedValue({
        id: 'unverified-id',
        email: 'unverified@example.com',
        isVerified: false,
      }),
    };
    const verifierRepo: Partial<VerifierRepository> = {
      upsert: vi.fn().mockResolvedValue({
        id: 1,
        userId: 'unverified-id',
        tokenHash: 'tokenHash',
        createdAt: new Date(),
        expireAt: new Date(),
      }),
    };
    const emailPublisher: EmailPublisher = {
      publishEmail: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ResendVerifyService(
      authRepo as AuthRepository,
      verifierRepo as VerifierRepository,
      emailPublisher
    );

    await service.execute('unverified@example.com');
    expect(verifierRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'unverified-id',
      })
    );
    expect(emailPublisher.publishEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'unverified@example.com',
        name: 'resend-verify',
      })
    );
  });
});
