import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { staticRoutes } from './routes/static_routes.js';
import { authRoutes } from './routes/auth_routes.js';
import { errorHandler } from './error_handler.js';
import type { Container } from '../../container.js';

export function newServer(container: Container): FastifyInstance {
  const cfg = container.config;

  const app = Fastify({
    logger: {
      serializers: {
        req(request) {
          const url = request.url
            ? request.url.replace(/([?&]token=)[^&]+/gi, '$1[REDACTED]')
            : request.url;
          return {
            method: request.method,
            url,
            hostname: request.hostname,
            remoteAddress: request.ip,
            remotePort: request.socket?.remotePort,
          };
        },
      },
    },
  });

  // Global rate limiter
  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // CORS configuration using separate CORS_ORIGINS
  app.register(cors, {
    origin: cfg.corsOrigins,
    credentials: true,
  });

  // JWT with pinned algorithm and issuer
  app.register(fastifyJwt, {
    secret: cfg.jwtSecret,
    sign: {
      expiresIn: '24h',
      algorithm: 'HS256',
    },
    verify: {
      algorithms: ['HS256'],
      allowedIss: 'ffgif',
    },
  });

  // Global centralized domain error handler
  app.setErrorHandler(errorHandler);

  // Health check endpoint
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  // Register static routes BEFORE API routes so the global onRequest hook applies
  app.register(staticRoutes);

  // Auth routes with injected services
  app.register(authRoutes, {
    services: {
      signupService: container.signupService,
      loginService: container.loginService,
      verifyService: container.verifyService,
      resendVerifyService: container.resendVerifyService,
      forgotPasswordService: container.forgotPasswordService,
      resetPasswordService: container.resetPasswordService,
      logoutService: container.logoutService,
    },
  });

  return app;
}