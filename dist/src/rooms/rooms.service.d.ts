import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
export declare class RoomsService {
    private readonly databaseService;
    private readonly redisService;
    constructor(databaseService: DatabaseService, redisService: RedisService);
    findAll(): Promise<{
        rooms: {
            id: string;
            name: string;
            createdBy: string;
            activeUsers: number;
            createdAt: Date;
        }[];
    }>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        createdBy: string;
        activeUsers: number;
        createdAt: Date;
    }>;
    create(name: string, username: string): Promise<{
        id: string;
        name: string;
        createdBy: string;
        createdAt: Date;
    }>;
    remove(id: string, username: string): Promise<{
        deleted: boolean;
    }>;
    findOneRaw(id: string): Promise<{
        id: string;
        name: string;
        createdBy: string;
        createdAt: Date;
    }>;
}
