import { describe, it, expect, vi } from 'vitest';
import { newServer } from '../src/transport/http/server.js';
import type { Container } from '../src/container.js';
import { InvalidCredentialError } from '../src/domain/auth/errors.js';

describe('Fastify Server Integration', () => {
  const mockConfig: any = {
    version: '1.0.0',
    service: 'ffgif',
    addr: '127.0.0.1',
    port: 8080,
    appBaseUrl: 'http://127.0.0.1:8080',
    jwtSecret: 'test_jwt_secret_at_least_32_characters_long_12345',
    hashPepper: 'test_hash_pepper_at_least_32_characters_long_12345',
    bcryptCost: 10,
    corsOrigins: ['http://127.0.0.1:8080'],
    postgres: { databaseUrl: 'postgresql://localhost:5432/db' },
    redis: { addr: 'localhost:6379' },
    rabbitmq: { url: 'amqp://localhost:5672' },
    smtp: { host: 'localhost', port: 587, user: 'test', pass: 'test' },
    minio: { allowedOrigins: ['http://127.0.0.1:8080'] },
    email: 'test@example.com',
    environment: 'test',
  };

  const createTestContainer = (): Container => {
    return {
      config: mockConfig,
      prisma: {} as any,
      redis: {} as any,
      rabbitmq: {} as any,
      mailer: {} as any,
      cacheRepo: {} as any,
      authRepo: {} as any,
      verifierRepo: {} as any,
      reseterRepo: {} as any,
      profileRepo: {} as any,
      quotaRepo: {} as any,
      unitOfWork: {} as any,
      hasher: {} as any,

      signupService: {
        execute: vi.fn().mockResolvedValue({ id: 'created-user-id' }),
      } as any,
      loginService: {
        execute: vi.fn().mockRejectedValue(new InvalidCredentialError()),
      } as any,
      verifyService: {
        execute: vi.fn().mockResolvedValue(undefined),
      } as any,
      resendVerifyService: {
        execute: vi.fn().mockResolvedValue(undefined),
      } as any,
      forgotPasswordService: {
        execute: vi.fn().mockResolvedValue(undefined),
      } as any,
      resetPasswordService: {
        getResetToken: vi.fn().mockResolvedValue('valid-token'),
        resetPassword: vi.fn().mockResolvedValue(undefined),
      } as any,
      logoutService: {
        execute: vi.fn().mockResolvedValue(undefined),
      } as any,

      dispose: vi.fn().mockResolvedValue(undefined),
    };
  };

  it('responds to GET /health with 200 ok', async () => {
    const container = createTestContainer();
    const app = newServer(container);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('serves static HTML on /auth/verify when Accept: text/html is provided (staticRoutes before authRoutes)', async () => {
    const container = createTestContainer();
    const app = newServer(container);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/verify',
      headers: {
        accept: 'text/html,application/xhtml+xml',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });

  it('executes API verification on /auth/verify?token=... when Accept is application/json', async () => {
    const container = createTestContainer();
    const app = newServer(container);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/verify?token=some-token-value',
      headers: {
        accept: 'application/json',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('account verified');
    expect(container.verifyService.execute).toHaveBeenCalledWith('some-token-value');
  });

  it('returns 422 for invalid login payload', async () => {
    const container = createTestContainer();
    const app = newServer(container);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'not-an-email',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error_code).toBe('VALIDATION_FAILED');
  });

  it('returns 401 with WWW-Authenticate header when login credentials fail', async () => {
    const container = createTestContainer();
    const app = newServer(container);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'user@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toContain('Bearer realm="ffgif"');
    expect(response.json().error_code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});
