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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const redis_service_1 = require("../redis/redis.service");
const rooms_service_1 = require("../rooms/rooms.service");
const schema_1 = require("../database/schema");
const drizzle_orm_1 = require("drizzle-orm");
const nanoid_1 = require("nanoid");
let MessagesService = class MessagesService {
    constructor(databaseService, redisService, roomsService) {
        this.databaseService = databaseService;
        this.redisService = redisService;
        this.roomsService = roomsService;
    }
    async findMessages(roomId, limit = 50, before) {
        const room = await this.roomsService.findOneRaw(roomId);
        if (!room) {
            throw new common_1.NotFoundException({
                code: 'ROOM_NOT_FOUND',
                message: `Room with id ${roomId} does not exist`,
            });
        }
        const db = this.databaseService.db;
        const clampedLimit = Math.min(Math.max(limit, 1), 100);
        let rows;
        if (before) {
            const cursorRows = await db
                .select()
                .from(schema_1.messages)
                .where((0, drizzle_orm_1.eq)(schema_1.messages.id, before))
                .limit(1);
            const cursor = cursorRows[0] ?? null;
            if (cursor) {
                rows = await db
                    .select()
                    .from(schema_1.messages)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.messages.roomId, roomId), (0, drizzle_orm_1.lt)(schema_1.messages.createdAt, cursor.createdAt)))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt))
                    .limit(clampedLimit + 1);
            }
            else {
                rows = await db
                    .select()
                    .from(schema_1.messages)
                    .where((0, drizzle_orm_1.eq)(schema_1.messages.roomId, roomId))
                    .orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt))
                    .limit(clampedLimit + 1);
            }
        }
        else {
            rows = await db
                .select()
                .from(schema_1.messages)
                .where((0, drizzle_orm_1.eq)(schema_1.messages.roomId, roomId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt))
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
    async createMessage(roomId, username, content) {
        const room = await this.roomsService.findOneRaw(roomId);
        if (!room) {
            throw new common_1.NotFoundException({
                code: 'ROOM_NOT_FOUND',
                message: `Room with id ${roomId} does not exist`,
            });
        }
        const trimmed = content.trim();
        if (!trimmed) {
            throw new common_1.UnprocessableEntityException({
                code: 'VALIDATION_ERROR',
                message: 'Message content cannot be empty',
            });
        }
        if (trimmed.length > 1000) {
            throw new common_1.UnprocessableEntityException({
                code: 'MESSAGE_TOO_LONG',
                message: 'Message content must not exceed 1000 characters',
            });
        }
        const db = this.databaseService.db;
        const newMessage = {
            id: `msg_${(0, nanoid_1.nanoid)(8)}`,
            roomId,
            username,
            content: trimmed,
            createdAt: new Date(),
        };
        await db.insert(schema_1.messages).values(newMessage);
        await this.redisService.publish(`room:${roomId}:message:new`, JSON.stringify({
            id: newMessage.id,
            username: newMessage.username,
            content: newMessage.content,
            createdAt: newMessage.createdAt,
        }));
        return {
            id: newMessage.id,
            roomId: newMessage.roomId,
            username: newMessage.username,
            content: newMessage.content,
            createdAt: newMessage.createdAt,
        };
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        redis_service_1.RedisService,
        rooms_service_1.RoomsService])
], MessagesService);
//# sourceMappingURL=messages.service.js.map