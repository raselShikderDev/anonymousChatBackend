import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
import { OnModuleInit } from '@nestjs/common';
export declare class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
    private readonly redisService;
    private readonly roomsService;
    server: Server;
    constructor(redisService: RedisService, roomsService: RoomsService);
    onModuleInit(): void;
    afterInit(): Promise<void>;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleLeave(client: Socket): Promise<void>;
    private cleanupClient;
}
