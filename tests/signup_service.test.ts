import { describe, it, expect, vi } from 'vitest';
import { SignupService } from '../src/app/auth/signup_service.js';
import { PasswordHasher } from '../src/app/auth/password_hasher.js';
import { UserExistsError } from '../src/domain/auth/errors.js';
import type { UnitOfWork, TransactionContext } from '../src/app/ports/unit_of_work.js';
import type { EmailPublisher } from '../src/app/ports/email_publisher.js';
import type { AuthRepository, VerifierRepository, ReseterRepository } from '../src/domain/auth/repository.js';
import type { ProfileRepository, QuotaRepository } from '../src/domain/user/repository.js';

describe('SignupService', () => {
  const pepper = 'test_pepper_at_least_32_characters_long_12345';
  const hasher = new PasswordHasher(pepper, 10);

  it('successfully executes signup transaction and publishes email', async () => {
    const authRepo: Partial<AuthRepository> = {
      getByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'new-user-id',
        username: 'testuser',
        fullname: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hash',
        isVerified: false,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const verifierRepo: Partial<VerifierRepository> = {
      create: vi.fn().mockResolvedValue({
        id: 1,
        userId: 'new-user-id',
        tokenHash: 'tokenHash',
        createdAt: new Date(),
        expireAt: new Date(),
      }),
    };

    const profileRepo: Partial<ProfileRepository> = {
      setProfile: vi.fn().mockResolvedValue({
        id: 1,
        userId: 'new-user-id',
        profilePic: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const quotaRepo: Partial<QuotaRepository> = {
      create: vi.fn().mockResolvedValue({
        id: 1,
        userId: 'new-user-id',
        usedBytes: BigInt(0),
        totalBytes: BigInt(1073741824),
        gifCount: 0,
        gifLimit: 100,
      }),
    };

    const reseterRepo: Partial<ReseterRepository> = {};

    const unitOfWork: UnitOfWork = {
      run: vi.fn().mockImplementation(async (fn: (tx: TransactionContext) => Promise<any>) => {
        return fn({
          authRepo: authRepo as AuthRepository,
          verifierRepo: verifierRepo as VerifierRepository,
          reseterRepo: reseterRepo as ReseterRepository,
          profileRepo: profileRepo as ProfileRepository,
          quotaRepo: quotaRepo as QuotaRepository,
        });
      }),
    };

    const emailPublisher: EmailPublisher = {
      publishEmail: vi.fn().mockResolvedValue(undefined),
    };

    const service = new SignupService(unitOfWork, emailPublisher, hasher);

    const result = await service.execute({
      username: 'testuser',
      fullname: 'Test User',
      email: 'test@example.com',
      password: 'StrongPassword!123',
    });

    expect(result.id).toBe('new-user-id');
    expect(authRepo.getByEmail).toHaveBeenCalledWith('test@example.com');
    expect(authRepo.create).toHaveBeenCalled();
    expect(verifierRepo.create).toHaveBeenCalled();
    expect(profileRepo.setProfile).toHaveBeenCalled();
    expect(quotaRepo.create).toHaveBeenCalled();
    expect(emailPublisher.publishEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        name: 'signup',
      })
    );
  });

  it('throws UserExistsError when email already exists', async () => {
    const authRepo: Partial<AuthRepository> = {
      getByEmail: vi.fn().mockResolvedValue({ id: 'existing-id' }),
    };

    const unitOfWork: UnitOfWork = {
      run: vi.fn().mockImplementation(async (fn) => {
        return fn({
          authRepo: authRepo as AuthRepository,
          verifierRepo: {} as any,
          reseterRepo: {} as any,
          profileRepo: {} as any,
          quotaRepo: {} as any,
        });
      }),
    };

    const emailPublisher: EmailPublisher = {
      publishEmail: vi.fn(),
    };

    const service = new SignupService(unitOfWork, emailPublisher, hasher);

    await expect(
      service.execute({
        username: 'testuser',
        fullname: 'Test User',
        email: 'test@example.com',
        password: 'StrongPassword!123',
      })
    ).rejects.toThrow(UserExistsError);
  });
});
