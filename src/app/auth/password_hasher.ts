import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { getConfig } from '../../config/env.js';

export class PasswordHasher {
  private readonly pepper: string;
  private readonly cost: number;
  private dummyHash: string | null = null;

  constructor(pepper?: string, cost?: number) {
    if (pepper !== undefined && cost !== undefined) {
      this.pepper = pepper;
      this.cost = cost;
    } else {
      const cnf = getConfig();
      this.pepper = pepper ?? cnf.hashPepper;
      this.cost = cost ?? cnf.bcryptCost;
    }
  }

  private getHmac(password: string): string {
    return crypto.createHmac('sha256', this.pepper).update(password).digest('hex');
  }

  async hash(password: string): Promise<string> {
    const hmac = this.getHmac(password);
    return bcrypt.hash(hmac, this.cost);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    const hmac = this.getHmac(password);
    return bcrypt.compare(hmac, hash);
  }

  async dummyCompare(password: string): Promise<boolean> {
    if (!this.dummyHash) {
      const dummyHmac = this.getHmac('__dummy_timing_attack_prevention_password__');
      this.dummyHash = await bcrypt.hash(dummyHmac, this.cost);
    }
    const hmac = this.getHmac(password);
    await bcrypt.compare(hmac, this.dummyHash);
    return false;
  }
}
