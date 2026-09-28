import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/jwt';
import {
  signupSchema,
  loginSchema,
  resendVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth_schema.js';
import type { SignupService } from '../../../app/auth/signup_service.js';
import type { LoginService } from '../../../app/auth/login_service.js';
import type { VerifyService } from '../../../app/auth/verify_service.js';
import type { ResendVerifyService } from '../../../app/auth/resend_verify_service.js';
import type { ForgotPasswordService } from '../../../app/auth/forgot_password_service.js';
import type { ResetPasswordService } from '../../../app/auth/reset_password_service.js';
import type { LogoutService } from '../../../app/auth/logout_service.js';

export interface AuthControllerServices {
  signupService: SignupService;
  loginService: LoginService;
  verifyService: VerifyService;
  resendVerifyService: ResendVerifyService;
  forgotPasswordService: ForgotPasswordService;
  resetPasswordService: ResetPasswordService;
  logoutService: LogoutService;
}

export class AuthController {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly services: AuthControllerServices
  ) {}

  signup = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = signupSchema.parse(request.body);
    const res = await this.services.signupService.execute(data);
    reply.header('Location', `/users/${res.id}`);
    return reply.status(201).send('user created');
  };

  verify = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { token?: string };
    if (!query.token) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'token is required',
        status: 400,
      });
    }

    await this.services.verifyService.execute(query.token);
    return reply.status(200).send('account verified');
  };

  resendVerify = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = resendVerifySchema.parse(request.body);
    await this.services.resendVerifyService.execute(data.email);
    return reply.status(202).send({ msg: 'check mail' });
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = loginSchema.parse(request.body);
    const { user } = await this.services.loginService.execute(data);

    const claims = {
      full_name: user.fullname,
      email: user.role === 'anon' ? undefined : user.email,
      role: user.role,
      sub: user.id,
      iss: 'ffgif',
    };

    const token = this.fastify.jwt.sign(claims);
    return reply.status(200).send({
      token,
      id: user.id,
    });
  };

  forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = forgotPasswordSchema.parse(request.body);
    await this.services.forgotPasswordService.execute(data.email);
    return reply.status(202).send({ msg: 'check mail' });
  };

  getResetToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { token?: string };
    if (!query.token) {
      return reply.status(400).send({
        error_code: 'BAD_REQUEST',
        message: 'token is required',
        status: 400,
      });
    }

    const token = await this.services.resetPasswordService.getResetToken(query.token);
    return reply.status(200).send({ token });
  };

  resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = resetPasswordSchema.parse(request.body);
    await this.services.resetPasswordService.resetPassword(
      data.token,
      data.password,
      data.confirm_password
    );
    return reply.status(200).send('ok');
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.services.logoutService.execute(request.rawToken, request.authUser?.exp);
    return reply.status(200).send('logout');
  };
}
