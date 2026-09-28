import { describe, it, expect } from 'vitest';
import { PasswordHasher } from '../src/app/auth/password_hasher.js';

describe('PasswordHasher', () => {
  const pepper = 'test_pepper_at_least_32_characters_long_12345';
  const hasher = new PasswordHasher(pepper, 10);

  it('hashes and compares passwords correctly', async () => {
    const password = 'CorrectPassword!123';
    const hash = await hasher.hash(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);

    const isMatch = await hasher.compare(password, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await hasher.compare('WrongPassword!123', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('handles passwords longer than 72 bytes without truncating pepper (HMAC-SHA256)', async () => {
    // 80 character password
    const longPassword1 = 'a'.repeat(71) + '1';
    const longPassword2 = 'a'.repeat(71) + '2';

    const hash1 = await hasher.hash(longPassword1);
    const hash2 = await hasher.hash(longPassword2);

    expect(hash1).not.toBe(hash2);
    expect(await hasher.compare(longPassword1, hash1)).toBe(true);
    expect(await hasher.compare(longPassword2, hash1)).toBe(false);
  });

  it('performs dummy comparison for unknown emails', async () => {
    const result = await hasher.dummyCompare('some-unknown-password');
    expect(result).toBe(false);
  });
});
