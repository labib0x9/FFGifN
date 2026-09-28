import { z } from 'zod';

const required = (name: string) => z.string().min(1, `${name} is required`);
const port = (fallback: number) => z.coerce.number().int().min(1).max(65535).default(fallback);

const envSchema = z.object({
  VERSION: required('VERSION'),
  SERVICE_NAME: required('SERVICE_NAME'),
  ADDR: z.string().default('0.0.0.0'),
  PORT: port(8080),
  APP_BASE_URL: z.string().default('http://127.0.0.1:8080'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  HASH_PEPPER: z.string().min(32, 'HASH_PEPPER must be at least 32 chars'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(31).default(12),

  PG_USER: required('PG_USER'),
  PG_PASSWORD: required('PG_PASSWORD'),
  PG_PORT: port(5432),
  PG_ADDRESS: required('PG_ADDRESS'),
  PG_NAME: required('PG_NAME'),
  PG_SSLMODE: z.string().default('disable'),
  PG_SUPERUSER: z.string().optional(),
  PG_SUPERDB: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  REDIS_ADDR: required('REDIS_ADDR'),
  REDIS_USER: z.string().default(''),
  REDIS_PASSWORD: z.string().default(''),

  EMAIL: required('EMAIL'),

  MINIO_ADDR: required('MINIO_ADDR'),
  MINIO_PUBLIC_ENDPOINT: required('MINIO_PUBLIC_ENDPOINT'),
  MINIO_ROOT_USER: required('MINIO_ROOT_USER'),
  MINIO_ROOT_PASSWORD: required('MINIO_ROOT_PASSWORD'),
  MINIO_PRESIGNED_USER: z.string().optional(),
  MINIO_PRESIGNED_PASSWORD: z.string().optional(),
  MINIO_TEMP_BUCKET: required('MINIO_TEMP_BUCKET'),
  MINIO_PERSIST_BUCKET: required('MINIO_PERSIST_BUCKET'),
  MINIO_TEMP_BUCKET_TTL_DAYS: z.coerce.number().int().min(1).default(1),
  MINIO_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1).default(104_857_600), // 100MB
  MINIO_USE_TLS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MINIO_NOTIFY_EXCHANGE: required('MINIO_NOTIFY_EXCHANGE'),
  MINIO_API_CORS_ALLOW_ORIGIN: required('MINIO_API_CORS_ALLOW_ORIGIN'),
  CORS_ORIGINS: z.string().default('http://0.0.0.0:8080,http://localhost:8080,http://127.0.0.1:8080'),

  RMQ_ADDR: required('RMQ_ADDR'),
  RMQ_USER: required('RMQ_USER'),
  RMQ_PASS: required('RMQ_PASS'),

  SMTP_HOST: required('SMTP_HOST'),
  SMTP_PORT: port(587),
  SMTP_USER: required('SMTP_USER'),
  SMTP_PASS: required('SMTP_PASS'),

  ENVIRONMENT: z.string().default('development'),
});

export function loadEnv(env: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`[Config Panic] Environment validation failed:\n${details}`);
  }

  const raw = result.data;
  const enc = encodeURIComponent;

  const databaseUrl =
    raw.DATABASE_URL ||
    `postgresql://${enc(raw.PG_USER)}:${enc(raw.PG_PASSWORD)}@${raw.PG_ADDRESS}:${raw.PG_PORT}/${raw.PG_NAME}?sslmode=${raw.PG_SSLMODE}`;

  const corsOrigins = raw.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const minioAllowedOrigins = raw.MINIO_API_CORS_ALLOW_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    version: raw.VERSION,
    service: raw.SERVICE_NAME,
    addr: raw.ADDR,
    port: raw.PORT,
    appBaseUrl: raw.APP_BASE_URL,
    jwtSecret: raw.JWT_SECRET,
    hashPepper: raw.HASH_PEPPER,
    bcryptCost: raw.BCRYPT_COST,
    corsOrigins,
    postgres: {
      user: raw.PG_USER,
      pass: raw.PG_PASSWORD,
      port: raw.PG_PORT,
      addr: raw.PG_ADDRESS,
      databaseName: raw.PG_NAME,
      sslMode: raw.PG_SSLMODE,
      superUser: raw.PG_SUPERUSER,
      superDatabase: raw.PG_SUPERDB,
      databaseUrl,
    },
    redis: {
      addr: raw.REDIS_ADDR,
      user: raw.REDIS_USER,
      pass: raw.REDIS_PASSWORD,
    },
    email: raw.EMAIL,
    minio: {
      endpoint: raw.MINIO_ADDR,
      publicEndpoint: raw.MINIO_PUBLIC_ENDPOINT,
      rootUser: raw.MINIO_ROOT_USER,
      rootPass: raw.MINIO_ROOT_PASSWORD,
      presignedUser: raw.MINIO_PRESIGNED_USER || raw.MINIO_ROOT_USER,
      presignedPass: raw.MINIO_PRESIGNED_PASSWORD || raw.MINIO_ROOT_PASSWORD,
      tempBucket: raw.MINIO_TEMP_BUCKET,
      storageBucket: raw.MINIO_PERSIST_BUCKET,
      ttlDays: raw.MINIO_TEMP_BUCKET_TTL_DAYS,
      maxUploadBytes: raw.MINIO_MAX_UPLOAD_BYTES,
      secure: raw.MINIO_USE_TLS,
      exchangeQueue: raw.MINIO_NOTIFY_EXCHANGE,
      allowedOrigins: minioAllowedOrigins,
    },
    rabbitmq: {
      addr: raw.RMQ_ADDR,
      user: raw.RMQ_USER,
      pass: raw.RMQ_PASS,
      url: `amqp://${enc(raw.RMQ_USER)}:${enc(raw.RMQ_PASS)}@${raw.RMQ_ADDR}/`,
    },
    smtp: {
      host: raw.SMTP_HOST,
      port: raw.SMTP_PORT,
      user: raw.SMTP_USER,
      pass: raw.SMTP_PASS,
    },
    environment: raw.ENVIRONMENT,
  };
}

export type Config = ReturnType<typeof loadEnv>;

let cachedConfig: Config | null = null;

export function getConfig(overrideEnv?: NodeJS.ProcessEnv): Config {
  if (overrideEnv) {
    return loadEnv(overrideEnv);
  }
  if (!cachedConfig) {
    cachedConfig = loadEnv();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}