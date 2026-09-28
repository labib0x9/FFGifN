import { DomainError } from '../shared/errors.js';

export { DomainError };

export class UserNotFoundError extends DomainError {
  constructor(message = 'user not found') {
    super(message, 'AUTH_USER_NOT_FOUND');
  }
}

export class InvalidCredentialError extends DomainError {
  constructor(message = 'invalid credential') {
    super(message, 'AUTH_INVALID_CREDENTIALS');
  }
}

export class UserNotVerifiedError extends DomainError {
  constructor(message = 'user not verified') {
    super(message, 'AUTH_USER_NOT_VERIFIED');
  }
}

export class UserAlreadyVerifiedError extends DomainError {
  constructor(message = 'user already verified') {
    super(message, 'AUTH_USER_ALREADY_VERIFIED');
  }
}

export class UserExistsError extends DomainError {
  constructor(message = 'user already exists') {
    super(message, 'AUTH_USER_EXISTS');
  }
}

export class InvalidTokenError extends DomainError {
  constructor(message = 'invalid token') {
    super(message, 'AUTH_VERIFY_TOKEN_INVALID');
  }
}

export class ResetTokenFetchFailedError extends DomainError {
  constructor(message = 'reset token fetch failed') {
    super(message, 'AUTH_RESET_TOKEN_INVALID');
  }
}
