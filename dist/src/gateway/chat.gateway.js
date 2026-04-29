"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_service_1 = require("../redis/redis.service");
const rooms_service_1 = require("../rooms/rooms.service");
const common_1 = require("@nestjs/common");
let ChatGateway = class ChatGateway {
    constructor(redisService, roomsService) {
        this.redisService = redisService;
        this.roomsService = roomsService;
    }
    onModuleInit() {
        this.redisService.subClient.psubscribe('room:*:message:new', 'room:*:deleted', (err) => {
            if (err)
                console.error('[Gateway] psubscribe error:', err);
        });
        this.redisService.subClient.on('pmessage', (_pattern, channel, message) => {
            try {
                const payload = JSON.parse(message);
                if (channel.endsWith(':message:new')) {
                    const roomId = channel.slice('room:'.length, channel.lastIndexOf(':message:new'));
                    this.server.to(roomId).emit('message:new', payload);
                }
                else if (channel.endsWith(':deleted')) {
                    const roomId = channel.slice('room:'.length, channel.lastIndexOf(':deleted'));
                    this.server.to(roomId).emit('room:deleted', payload);
                }
            }
            catch (e) {
                console.error('[Gateway] pmessage parse error:', e);
            }
        });
    }
    afterInit(server) {
        const pubClient = this.redisService.pubClient.duplicate();
        const subClient = this.redisService.pubClient.duplicate();
        server.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
    }
    async handleConnection(client) {
        const token = client.handshake.query.token;
        const roomId = client.handshake.query.roomId;
        if (!token) {
            client.emit('error', {
                code: 401,
                message: 'Missing or expired session token',
            });
            client.disconnect(true);
            return;
        }
        const session = await this.redisService.getSession(token);
        if (!session) {
            client.emit('error', {
                code: 401,
                message: 'Missing or expired session token',
            });
            client.disconnect(true);
            return;
        }
        if (!roomId) {
            client.emit('error', { code: 404, message: 'Room not found' });
            client.disconnect(true);
            return;
        }
        const room = await this.roomsService.findOneRaw(roomId);
        if (!room) {
            client.emit('error', { code: 404, message: 'Room not found' });
            client.disconnect(true);
            return;
        }
        const { username } = session;
        await this.redisService.setSocketState(client.id, {
            userId: session.userId,
            username,
            roomId,
        });
        await this.redisService.addActiveUser(roomId, username, client.id);
        await client.join(roomId);
        const activeUsers = await this.redisService.getActiveUsers(roomId);
        client.emit('room:joined', { activeUsers });
        client.to(roomId).emit('room:user_joined', {
            username,
            activeUsers,
        });
    }
    async handleDisconnect(client) {
        await this.cleanupClient(client);
    }
    async handleLeave(client) {
        await this.cleanupClient(client);
        client.disconnect(true);
    }
    async cleanupClient(client) {
        const state = await this.redisService.getSocketState(client.id);
        if (!state)
            return;
        const { username, roomId } = state;
        await this.redisService.removeActiveUser(roomId, username);
        await this.redisService.deleteSocketState(client.id);
        const activeUsers = await this.redisService.getActiveUsers(roomId);
        this.server.to(roomId).emit('room:user_left', { username, activeUsers });
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleLeave", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/chat', cors: { origin: '*' } }),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        rooms_service_1.RoomsService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map