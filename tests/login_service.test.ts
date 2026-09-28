import { describe, it, expect, vi } from 'vitest';
import { LoginService } from '../src/app/auth/login_service.js';
import { PasswordHasher } from '../src/app/auth/password_hasher.js';
import { InvalidCredentialError, UserNotVerifiedError } from '../src/domain/auth/errors.js';
import type { AuthRepository } from '../src/domain/auth/repository.js';
import type { User } from '../src/domain/auth/entity.js';

describe('LoginService', () => {
  const pepper = 'test_pepper_at_least_32_characters_long_12345';
  const hasher = new PasswordHasher(pepper, 10);

  const createMockAuthRepo = (user: User | null): AuthRepository => ({
    getByEmail: vi.fn().mockResolvedValue(user),
    getById: vi.fn().mockResolvedValue(user),
    create: vi.fn(),
    deleteById: vi.fn(),
    deleteByEmail: vi.fn(),
    updatePassword: vi.fn(),
    setVerified: vi.fn(),
    upgrade: vi.fn(),
  });

  it('performs dummy compare and throws InvalidCredentialError when email is not found', async () => {
    const authRepo = createMockAuthRepo(null);
    const dummySpy = vi.spyOn(hasher, 'dummyCompare');
    const service = new LoginService(authRepo, hasher);

    await expect(
      service.execute({ email: 'nonexistent@example.com', password: 'password123!' })
    ).rejects.toThrow(InvalidCredentialError);

    expect(dummySpy).toHaveBeenCalledWith('password123!');
  });

  it('checks password before checking verification status', async () => {
    const pass = 'correctPassword!123';
    const hash = await hasher.hash(pass);

    const unverifiedUser: User = {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'testuser',
      fullname: 'Test User',
      email: 'unverified@example.com',
      passwordHash: hash,
      isVerified: false,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const authRepo = createMockAuthRepo(unverifiedUser);
    const service = new LoginService(authRepo, hasher);

    // Wrong password with unverified user should throw InvalidCredentialError, NOT UserNotVerifiedError!
    await expect(
      service.execute({ email: 'unverified@example.com', password: 'wrongPassword!123' })
    ).rejects.toThrow(InvalidCredentialError);

    // Correct password with unverified user should throw UserNotVerifiedError
    await expect(
      service.execute({ email: 'unverified@example.com', password: pass })
    ).rejects.toThrow(UserNotVerifiedError);
  });

  it('rejects soft-deleted users with InvalidCredentialError even if password matches', async () => {
    const pass = 'correctPassword!123';
    const hash = await hasher.hash(pass);

    const deletedUser: User = {
      id: '22222222-2222-2222-2222-222222222222',
      username: 'deleteduser',
      fullname: 'Deleted User',
      email: 'deleted@example.com',
      passwordHash: hash,
      isVerified: true,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date(),
    };

    const authRepo = createMockAuthRepo(deletedUser);
    const service = new LoginService(authRepo, hasher);

    await expect(
      service.execute({ email: 'deleted@example.com', password: pass })
    ).rejects.toThrow(InvalidCredentialError);
  });

  it('successfully logs in verified user with correct credentials', async () => {
    const pass = 'correctPassword!123';
    const hash = await hasher.hash(pass);

    const validUser: User = {
      id: '33333333-3333-3333-3333-333333333333',
      username: 'validuser',
      fullname: 'Valid User',
      email: 'valid@example.com',
      passwordHash: hash,
      isVerified: true,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const authRepo = createMockAuthRepo(validUser);
    const service = new LoginService(authRepo, hasher);

    const result = await service.execute({ email: 'valid@example.com', password: pass });
    expect(result.user.id).toBe(validUser.id);
  });
});
