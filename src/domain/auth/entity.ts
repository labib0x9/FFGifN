export type Role = 'user' | 'admin' | 'anon';

export interface User {
  id: string;
  username: string;
  fullname: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  role: Role | string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface Verifier {
  id: number;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expireAt: Date;
}

export interface Reseter {
  id: number;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expireAt: Date;
}
