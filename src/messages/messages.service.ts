import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
import { messages } from '../database/schema';
import { eq, lt, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

@Injectable()
export class MessagesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly roomsService: RoomsService,
  ) {}

  async findMessages(
    roomId: string,
    limit: number = 50,
    before?: string,
  ) {
    const room = await this.roomsService.findOneRaw(roomId);
    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_FOUND',
        message: `Room with id ${roomId} does not exist`,
      });
    }

    const db = this.databaseService.db;
    const clampedLimit = Math.min(Math.max(limit, 1), 100);

    let rows: (typeof messages.$inferSelect)[];

    if (before) {
      // Resolve cursor to a timestamp using Drizzle — no raw SQL
      const cursorRows = await db
        .select()
        .from(messages)
        .where(eq(messages.id, before))
        .limit(1);

      const cursor = cursorRows[0] ?? null;

      if (cursor) {
        rows = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.roomId, roomId),
              lt(messages.createdAt, cursor.createdAt),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(clampedLimit + 1);
      } else {
        // Unknown cursor — fall back to first page
        rows = await db
          .select()
          .from(messages)
          .where(eq(messages.roomId, roomId))
          .orderBy(desc(messages.createdAt))
          .limit(clampedLimit + 1);
      }
    } else {
      rows = await db
        .select()
        .from(messages)
        .where(eq(messages.roomId, roomId))
        .orderBy(desc(messages.createdAt))
        .limit(clampedLimit + 1);
    }

    const hasMore = rows.length > clampedLimit;
    const sliced = hasMore ? rows.slice(0, clampedLimit) : rows;

    return {
      messages: sliced.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        username: m.username,
        content: m.content,
        createdAt: m.createdAt,
      })),
      hasMore,
      nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
    };
  }

  async createMessage(
    roomId: string,
    username: string,
    content: string,
  ) {
    const room = await this.roomsService.findOneRaw(roomId);
    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_FOUND',
        message: `Room with id ${roomId} does not exist`,
      });
    }

    const trimmed = content.trim();

    if (!trimmed) {
      // Empty content: spec says 422, code matches VALIDATION_ERROR pattern
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Message content cannot be empty',
      });
    }

    if (trimmed.length > 1000) {
      throw new UnprocessableEntityException({
        code: 'MESSAGE_TOO_LONG',
        message: 'Message content must not exceed 1000 characters',
      });
    }

    const db = this.databaseService.db;
    const newMessage = {
      id: `msg_${nanoid(8)}`,
      roomId,
      username,
      content: trimmed,
      createdAt: new Date(),
    };

    await db.insert(messages).values(newMessage);

    // Publish to Redis — the gateway subscribes and broadcasts message:new
    // Contract: do NOT emit directly from the REST layer
    await this.redisService.publish(
      `room:${roomId}:message:new`,
      JSON.stringify({
        id: newMessage.id,
        username: newMessage.username,
        content: newMessage.content,
        createdAt: newMessage.createdAt,
      }),
    );

    return {
      id: newMessage.id,
      roomId: newMessage.roomId,
      username: newMessage.username,
      content: newMessage.content,
      createdAt: newMessage.createdAt,
    };
  }
}