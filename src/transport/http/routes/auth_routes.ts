import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthController, AuthControllerServices } from '../controllers/auth_controller.js';
import { authGuard } from '../plugins/auth_guard.js';

export interface AuthRoutesOptions {
  services: AuthControllerServices;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AuthRoutesOptions
) => {
  const controller = new AuthController(fastify, opts.services);

  // Public auth routes with rate limits for sensitive operations
  fastify.post('/auth/signup', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    handler: controller.signup,
  });

  fastify.get('/auth/verify', controller.verify);

  fastify.post('/auth/verify/resend', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    handler: controller.resendVerify,
  });

  fastify.post('/auth/login', {
    config: {
      rateLimit: {
        max: 15,
        timeWindow: '1 minute',
      },
    },
    handler: controller.login,
  });

  fastify.post('/auth/forgot-password', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    handler: controller.forgotPassword,
  });

  fastify.get('/auth/reset', controller.getResetToken);

  fastify.post('/auth/reset', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    handler: controller.resetPassword,
  });

  // Protected auth routes
  fastify.register(async (protectedScope) => {
    protectedScope.register(authGuard);
    protectedScope.post('/auth/logout', controller.logout);
  });
};
