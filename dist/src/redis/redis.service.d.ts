import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';
export interface SessionData {
    userId: string;
    username: string;
}
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    client: Redis;
    pubClient: Redis;
    subClient: Redis;
    isReady: boolean;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    setSession(token: string, data: SessionData): Promise<void>;
    getSession(token: string): Promise<SessionData | null>;
    deleteSession(token: string): Promise<void>;
    addActiveUser(roomId: string, username: string, socketId: string): Promise<void>;
    removeActiveUser(roomId: string, username: string): Promise<void>;
    getActiveUsers(roomId: string): Promise<string[]>;
    getActiveUserCount(roomId: string): Promise<number>;
    setSocketState(socketId: string, data: {
        userId: string;
        username: string;
        roomId: string;
    }): Promise<void>;
    getSocketState(socketId: string): Promise<any>;
    deleteSocketState(socketId: string): Promise<void>;
    publish(channel: string, message: string): Promise<void>;
    subscribe(pattern: string, handler: (channel: string, message: string) => void): Promise<void>;
}
