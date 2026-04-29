import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
export declare class MessagesService {
    private readonly databaseService;
    private readonly redisService;
    private readonly roomsService;
    constructor(databaseService: DatabaseService, redisService: RedisService, roomsService: RoomsService);
    findMessages(roomId: string, limit?: number, before?: string): Promise<{
        messages: {
            id: string;
            roomId: string;
            username: string;
            content: string;
            createdAt: Date;
        }[];
        hasMore: boolean;
        nextCursor: string | null;
    }>;
    createMessage(roomId: string, username: string, content: string): Promise<{
        id: string;
        roomId: string;
        username: string;
        content: string;
        createdAt: Date;
    }>;
}
