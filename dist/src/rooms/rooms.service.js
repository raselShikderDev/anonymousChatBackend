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
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const redis_service_1 = require("../redis/redis.service");
const schema_1 = require("../database/schema");
const drizzle_orm_1 = require("drizzle-orm");
const nanoid_1 = require("nanoid");
let RoomsService = class RoomsService {
    constructor(databaseService, redisService) {
        this.databaseService = databaseService;
        this.redisService = redisService;
    }
    async findAll() {
        const db = this.databaseService.db;
        const allRooms = await db.select().from(schema_1.rooms);
        const roomsWithActiveUsers = await Promise.all(allRooms.map(async (room) => ({
            id: room.id,
            name: room.name,
            createdBy: room.createdBy,
            activeUsers: await this.redisService.getActiveUserCount(room.id),
            createdAt: room.createdAt,
        })));
        return { rooms: roomsWithActiveUsers };
    }
    async findOne(id) {
        const room = await this.findOneRaw(id);
        if (!room) {
            throw new common_1.NotFoundException({
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
    async create(name, username) {
        const db = this.databaseService.db;
        const existing = await db
            .select()
            .from(schema_1.rooms)
            .where((0, drizzle_orm_1.eq)(schema_1.rooms.name, name))
            .limit(1)
            .then((rows) => rows[0] ?? null);
        if (existing) {
            throw new common_1.ConflictException({
                code: 'ROOM_NAME_TAKEN',
                message: 'A room with this name already exists',
            });
        }
        const newRoom = {
            id: `room_${(0, nanoid_1.nanoid)(8)}`,
            name,
            createdBy: username,
            createdAt: new Date(),
        };
        await db.insert(schema_1.rooms).values(newRoom);
        return {
            id: newRoom.id,
            name: newRoom.name,
            createdBy: newRoom.createdBy,
            createdAt: newRoom.createdAt,
        };
    }
    async remove(id, username) {
        const room = await this.findOneRaw(id);
        if (!room) {
            throw new common_1.NotFoundException({
                code: 'ROOM_NOT_FOUND',
                message: `Room with id ${id} does not exist`,
            });
        }
        if (room.createdBy !== username) {
            throw new common_1.ForbiddenException({
                code: 'FORBIDDEN',
                message: 'Only the room creator can delete this room',
            });
        }
        await this.redisService.publish(`room:${id}:deleted`, JSON.stringify({ roomId: id }));
        const db = this.databaseService.db;
        await db.delete(schema_1.rooms).where((0, drizzle_orm_1.eq)(schema_1.rooms.id, id));
        return { deleted: true };
    }
    async findOneRaw(id) {
        const db = this.databaseService.db;
        return db
            .select()
            .from(schema_1.rooms)
            .where((0, drizzle_orm_1.eq)(schema_1.rooms.id, id))
            .limit(1)
            .then((rows) => rows[0] ?? null);
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        redis_service_1.RedisService])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map