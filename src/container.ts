import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Config, getConfig } from './config/env.js';
import { getPrismaClient, disconnectPrisma } from './infra/postgres/prisma.js';
import { PostgresAuthRepository } from './infra/postgres/auth_repository.js';
import { PostgresVerifierRepository } from './infra/postgres/verifier_repository.js';
import { PostgresReseterRepository } from './infra/postgres/reseter_repository.js';
import { PostgresProfileRepository } from './infra/postgres/profile_repository.js';
import { PostgresQuotaRepository } from './infra/postgres/quota_repository.js';
import { PrismaUnitOfWork } from './infra/postgres/unit_of_work.js';
import { getRedisClientSync, disconnectRedis } from './infra/redis/client.js';
import { RedisCacheRepository, CacheRepository } from './infra/redis/cache.js';
import { RabbitMQClient, getRabbitMQClient, disconnectRabbitMQ } from './infra/rabbitmq/client.js';
import { SmtpMailer, EmailSender } from './infra/mailer/smtp.js';
import { PasswordHasher } from './app/auth/password_hasher.js';
import { SignupService } from './app/auth/signup_service.js';
import { LoginService } from './app/auth/login_service.js';
import { VerifyService } from './app/auth/verify_service.js';
import { ResendVerifyService } from './app/auth/resend_verify_service.js';
import { ForgotPasswordService } from './app/auth/forgot_password_service.js';
import { ResetPasswordService } from './app/auth/reset_password_service.js';
import { LogoutService } from './app/auth/logout_service.js';
import type { AuthRepository, VerifierRepository, ReseterRepository } from './domain/auth/repository.js';
import type { ProfileRepository, QuotaRepository } from './domain/user/repository.js';
import type { UnitOfWork } from './app/ports/unit_of_work.js';

export interface Container {
  config: Config;
  prisma: PrismaClient;
  redis: Redis;
  rabbitmq: RabbitMQClient;
  mailer: EmailSender;
  cacheRepo: CacheRepository;
  authRepo: AuthRepository;
  verifierRepo: VerifierRepository;
  reseterRepo: ReseterRepository;
  profileRepo: ProfileRepository;
  quotaRepo: QuotaRepository;
  unitOfWork: UnitOfWork;
  hasher: PasswordHasher;

  // Services
  signupService: SignupService;
  loginService: LoginService;
  verifyService: VerifyService;
  resendVerifyService: ResendVerifyService;
  forgotPasswordService: ForgotPasswordService;
  resetPasswordService: ResetPasswordService;
  logoutService: LogoutService;

  dispose(): Promise<void>;
}

export function createContainer(configOverride?: Config): Container {
  const config = configOverride || getConfig();

  const prisma = getPrismaClient(config);
  const redis = getRedisClientSync(config.redis);
  const rabbitmq = getRabbitMQClient(config.rabbitmq, config.minio);
  const mailer = new SmtpMailer({ smtp: config.smtp, appBaseUrl: config.appBaseUrl });

  const cacheRepo = new RedisCacheRepository(redis);
  const authRepo = new PostgresAuthRepository(prisma);
  const verifierRepo = new PostgresVerifierRepository(prisma);
  const reseterRepo = new PostgresReseterRepository(prisma);
  const profileRepo = new PostgresProfileRepository(prisma);
  const quotaRepo = new PostgresQuotaRepository(prisma);
  const unitOfWork = new PrismaUnitOfWork(prisma);
  const hasher = new PasswordHasher(config.hashPepper, config.bcryptCost);

  const signupService = new SignupService(unitOfWork, rabbitmq, hasher);
  const loginService = new LoginService(authRepo, hasher);
  const verifyService = new VerifyService(unitOfWork);
  const resendVerifyService = new ResendVerifyService(authRepo, verifierRepo, rabbitmq);
  const forgotPasswordService = new ForgotPasswordService(authRepo, reseterRepo, rabbitmq);
  const resetPasswordService = new ResetPasswordService(unitOfWork, reseterRepo, rabbitmq, hasher);
  const logoutService = new LogoutService(cacheRepo);

  return {
    config,
    prisma,
    redis,
    rabbitmq,
    mailer,
    cacheRepo,
    authRepo,
    verifierRepo,
    reseterRepo,
    profileRepo,
    quotaRepo,
    unitOfWork,
    hasher,

    signupService,
    loginService,
    verifyService,
    resendVerifyService,
    forgotPasswordService,
    resetPasswordService,
    logoutService,

    async dispose(): Promise<void> {
      await Promise.allSettled([
        disconnectPrisma(),
        disconnectRedis(),
        disconnectRabbitMQ(),
      ]);
    },
  };
}
