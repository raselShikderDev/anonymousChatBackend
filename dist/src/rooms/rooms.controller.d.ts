import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { SessionData } from '../redis/redis.service';
export declare class RoomsController {
    private readonly roomsService;
    constructor(roomsService: RoomsService);
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
    create(createRoomDto: CreateRoomDto, user: SessionData): Promise<{
        id: string;
        name: string;
        createdBy: string;
        createdAt: Date;
    }>;
    remove(id: string, user: SessionData): Promise<{
        deleted: boolean;
    }>;
}
