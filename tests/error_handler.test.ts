import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../src/transport/http/error_handler.js';
import {
  UserExistsError,
  InvalidCredentialError,
  UserNotVerifiedError,
  UserAlreadyVerifiedError,
  InvalidTokenError,
} from '../src/domain/auth/errors.js';
import { PreconditionFailedError, QuotaExceededError } from '../src/domain/user/errors.js';

describe('errorHandler', () => {
  const createMockReply = () => {
    const reply: any = {};
    reply.status = vi.fn().mockReturnValue(reply);
    reply.header = vi.fn().mockReturnValue(reply);
    reply.send = vi.fn().mockReturnValue(reply);
    return reply;
  };

  const createMockRequest = () => ({
    log: {
      error: vi.fn(),
    },
  } as any);

  it('maps AUTH_USER_EXISTS to 409', () => {
    const reply = createMockReply();
    const req = createMockRequest();
    errorHandler(new UserExistsError(), req, reply);

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_USER_EXISTS', status: 409 })
    );
  });

  it('maps AUTH_INVALID_CREDENTIALS to 401 with WWW-Authenticate header', () => {
    const reply = createMockReply();
    const req = createMockRequest();
    errorHandler(new InvalidCredentialError(), req, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.header).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('Bearer realm="ffgif"')
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_INVALID_CREDENTIALS', status: 401 })
    );
  });

  it('maps AUTH_USER_NOT_VERIFIED to 403', () => {
    const reply = createMockReply();
    const req = createMockRequest();
    errorHandler(new UserNotVerifiedError(), req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_USER_NOT_VERIFIED', status: 403 })
    );
  });

  it('maps AUTH_USER_ALREADY_VERIFIED to 409', () => {
    const reply = createMockReply();
    const req = createMockRequest();
    errorHandler(new UserAlreadyVerifiedError(), req, reply);

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_USER_ALREADY_VERIFIED', status: 409 })
    );
  });

  it('maps AUTH_VERIFY_TOKEN_INVALID to 410', () => {
    const reply = createMockReply();
    const req = createMockRequest();
    errorHandler(new InvalidTokenError(), req, reply);

    expect(reply.status).toHaveBeenCalledWith(410);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'AUTH_VERIFY_TOKEN_INVALID', status: 410 })
    );
  });

  it('maps PRECONDITION_FAILED to 412', () => {
    const reply = createMockReply();
    const req = createMockRequest();
    errorHandler(new PreconditionFailedError(), req, reply);

    expect(reply.status).toHaveBeenCalledWith(412);
  });

  it('maps QUOTA_EXCEEDED to 403', () => {
    const reply = createMockReply();
    const req = createMockRequest();
    errorHandler(new QuotaExceededError(), req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it('maps generic error to 500 INTERNAL_ERROR', () => {
    const reply = createMockReply();
    const req = createMockRequest();
    errorHandler(new Error('something broke'), req, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error_code: 'INTERNAL_ERROR', status: 500 })
    );
  });
});
