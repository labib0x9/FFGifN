import { UserExistsError } from '../../domain/auth/errors.js';
import { PasswordHasher } from './password_hasher.js';
import { generateToken } from './token_util.js';
import type { UnitOfWork } from '../ports/unit_of_work.js';
import type { EmailPublisher } from '../ports/email_publisher.js';

export interface SignupInput {
  email: string;
  username: string;
  fullname: string;
  password: string;
}

export interface SignupResult {
  id: string;
}

export class SignupService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly emailPublisher: EmailPublisher,
    private readonly hasher: PasswordHasher
  ) {}

  async execute(input: SignupInput): Promise<SignupResult> {
    const passwordHash = await this.hasher.hash(input.password);

    const txResult = await this.unitOfWork.run(async (tx) => {
      const existingUser = await tx.authRepo.getByEmail(input.email);
      if (existingUser) {
        throw new UserExistsError();
      }

      let createdUser;
      try {
        createdUser = await tx.authRepo.create({
          username: input.username,
          fullname: input.fullname,
          email: input.email,
          passwordHash,
          role: 'user',
          isVerified: false,
        });
      } catch (err: any) {
        if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
          throw new UserExistsError();
        }
        throw err;
      }

      const { token, tokenHash } = generateToken();

      await tx.verifierRepo.create({
        userId: createdUser.id,
        tokenHash,
      });

      await tx.profileRepo.setProfile({
        userId: createdUser.id,
        profilePic: '',
      });

      await tx.quotaRepo.create({
        userId: createdUser.id,
      });

      return {
        userId: createdUser.id,
        email: createdUser.email,
        token,
      };
    });

    try {
      await this.emailPublisher.publishEmail({
        to: txResult.email,
        name: 'signup',
        token: txResult.token,
      });
    } catch (err) {
      console.error('[SignupService] Failed to publish signup email:', err);
    }

    return { id: txResult.userId };
  }
}
