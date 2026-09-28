import { PrismaClient, Prisma } from '@prisma/client';
import type { ProfileRepository } from '../../domain/user/repository.js';
import type { Profile } from '../../domain/user/entity.js';
import { PreconditionFailedError } from '../../domain/user/errors.js';

export class PostgresProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  async getProfile(userId: string): Promise<Profile | null> {
    const record = await this.prisma.profile.findUnique({
      where: { userId },
    });
    return record;
  }

  async setProfile(profile: { userId: string; profilePic?: string }): Promise<Profile> {
    const record = await this.prisma.profile.create({
      data: {
        userId: profile.userId,
        profilePic: profile.profilePic || '',
      },
    });
    return record;
  }

  async updateProfile(userId: string, profilePic: string, expectedUpdatedAt?: Date): Promise<Profile> {
    if (expectedUpdatedAt) {
      const result = await this.prisma.profile.updateMany({
        where: {
          userId,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          profilePic,
        },
      });

      if (result.count === 0) {
        throw new PreconditionFailedError();
      }

      const updated = await this.prisma.profile.findUnique({
        where: { userId },
      });
      return updated!;
    }

    const record = await this.prisma.profile.upsert({
      where: { userId },
      update: { profilePic },
      create: {
        userId,
        profilePic,
      },
    });
    return record;
  }
}
