import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  async login(username: string) {
    const db = this.databaseService.db;

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    let user = existing;

    if (!user) {
      const newUser = {
        id: `usr_${nanoid(8)}`,
        username,
        createdAt: new Date(),
      };
      await db.insert(users).values(newUser);
      user = newUser as any;
    }

    const sessionToken = nanoid(32);
    await this.redisService.setSession(sessionToken, {
      userId: user.id,
      username: user.username,
    });

    return {
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }
}