import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { SessionData } from '../redis/redis.service';
export declare class MessagesController {
    private readonly messagesService;
    constructor(messagesService: MessagesService);
    findMessages(roomId: string, limit?: string, before?: string): Promise<{
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
    createMessage(roomId: string, createMessageDto: CreateMessageDto, user: SessionData): Promise<{
        id: string;
        roomId: string;
        username: string;
        content: string;
        createdAt: Date;
    }>;
}
