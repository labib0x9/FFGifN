import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { staticRoutes } from './routes/static.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { Config } from '../../config/env.js';

export function newServer(cfg: Config): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: cfg.minio.allowedOrigins,
    credentials: true,
  });

  app.register(fastifyJwt, {
    secret: cfg.jwtSecret,
    sign: {
      expiresIn: '24h',
      algorithm: 'HS256',
    },
  });

  // Health check endpoint
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  // Auth routes
  app.register(authRoutes);

  // Static assets and dynamic preview fallback
  app.register(staticRoutes);

  return app;
}