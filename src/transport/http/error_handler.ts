import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from '../../domain/shared/errors.js';

interface ErrorMapping {
  status: number;
  message?: string;
}

const DOMAIN_ERROR_STATUS_MAP: Record<string, ErrorMapping> = {
  AUTH_USER_EXISTS: { status: 409, message: 'email exists' },
  AUTH_INVALID_CREDENTIALS: { status: 401, message: 'invalid credentials' },
  AUTH_USER_NOT_VERIFIED: { status: 403, message: 'not verified' },
  AUTH_USER_ALREADY_VERIFIED: { status: 409, message: 'user already verified' },
  AUTH_USER_NOT_FOUND: { status: 404, message: 'user not found' },
  AUTH_VERIFY_TOKEN_INVALID: { status: 410, message: 'token expired or invalid' },
  AUTH_RESET_TOKEN_INVALID: { status: 410, message: 'invalid or expired token' },
  QUOTA_EXCEEDED: { status: 403, message: 'storage quota exceeded' },
  PRECONDITION_FAILED: { status: 412, message: 'precondition failed' },
};

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  // 1. Zod Validation Errors
  if (error instanceof ZodError) {
    return reply.status(422).send({
      error_code: 'VALIDATION_FAILED',
      message: 'field required or invalid format',
      details: error.issues,
      status: 422,
    });
  }

  // 2. Domain Errors
  if (error instanceof DomainError && error.code) {
    const mapping = DOMAIN_ERROR_STATUS_MAP[error.code];
    const status = mapping?.status || 400;
    const message = mapping?.message || error.message;

    if (error.code === 'AUTH_INVALID_CREDENTIALS') {
      reply.header(
        'WWW-Authenticate',
        'Bearer realm="ffgif", error="invalid_token", error_description="invalid credentials"'
      );
    }

    return reply.status(status).send({
      error_code: error.code,
      message,
      status,
    });
  }

  // 3. Fastify Validation Errors
  if ((error as FastifyError).validation) {
    return reply.status(422).send({
      error_code: 'VALIDATION_FAILED',
      message: error.message,
      status: 422,
    });
  }

  // 4. Rate Limiting Errors (429)
  if ((error as FastifyError).statusCode === 429) {
    return reply.status(429).send({
      error_code: 'RATE_LIMIT_EXCEEDED',
      message: error.message || 'Too many requests, please try again later',
      status: 429,
    });
  }

  // 5. Prisma Unique Constraint P2002
  if ((error as any).code === 'P2002') {
    return reply.status(409).send({
      error_code: 'AUTH_USER_EXISTS',
      message: 'email or unique field exists',
      status: 409,
    });
  }

  // 6. Unknown Internal Server Error
  request.log.error(error);
  return reply.status(500).send({
    error_code: 'INTERNAL_ERROR',
    message: 'internal server error',
    status: 500,
  });
}
