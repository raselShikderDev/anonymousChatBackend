import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class ConfigService {
  get databaseUrl(): string {
    return (
      process.env.DATABASE_URL ||
      'postgresql://postgres:password@localhost:5432/anonymous_chat'
    );
  }

  get redisUrl(): string {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  }

  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }
}