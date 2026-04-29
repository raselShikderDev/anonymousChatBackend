import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { rooms } from '../database/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

@Injectable()
export class RoomsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  async findAll() {
    const db = this.databaseService.db;
    const allRooms = await db.select().from(rooms);
console.log({
      "All Rooms got": allRooms
    });
    const roomsWithActiveUsers = await Promise.all(
      allRooms.map(async (room) => ({
        id: room.id,
        name: room.name,
        createdBy: room.createdBy,
        activeUsers: await this.redisService.getActiveUserCount(room.id),
        createdAt: room.createdAt,
      })),
    );

    return { rooms: roomsWithActiveUsers };
  }

  async findOne(id: string) {
    const room = await this.findOneRaw(id);

    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_FOUND',
        message: `Room with id ${id} does not exist`,
      });
    }

    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      activeUsers: await this.redisService.getActiveUserCount(room.id),
      createdAt: room.createdAt,
    };
  }

  async create(name: string, username: string) {
    const db = this.databaseService.db;

    const existing = await db
      .select()
      .from(rooms)
      .where(eq(rooms.name, name))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existing) {
      throw new ConflictException({
        code: 'ROOM_NAME_TAKEN',
        message: 'A room with this name already exists',
      });
    }

    const newRoom = {
      id: `room_${nanoid(8)}`,
      name,
      createdBy: username,
      createdAt: new Date(),
    };

    await db.insert(rooms).values(newRoom);

    return {
      id: newRoom.id,
      name: newRoom.name,
      createdBy: newRoom.createdBy,
      createdAt: newRoom.createdAt,
    };
  }

  async remove(id: string, username: string) {
    const room = await this.findOneRaw(id);

    if (!room) {
      throw new NotFoundException({
        code: 'ROOM_NOT_FOUND',
        message: `Room with id ${id} does not exist`,
      });
    }

    if (room.createdBy !== username) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the room creator can delete this room',
      });
    }

    // Publish room:deleted BEFORE deleting so gateway can fan-out
    // to clients still connected to the room
    await this.redisService.publish(
      `room:${id}:deleted`,
      JSON.stringify({ roomId: id }),
    );

    const db = this.databaseService.db;
    await db.delete(rooms).where(eq(rooms.id, id));

    return { deleted: true };
  }

  // Returns null instead of throwing — used by MessagesService and ChatGateway
  async findOneRaw(id: string) {
    const db = this.databaseService.db;
    return db
      .select()
      .from(rooms)
      .where(eq(rooms.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }
}