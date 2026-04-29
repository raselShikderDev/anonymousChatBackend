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
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const config_service_1 = require("../config/config.service");
let RedisService = class RedisService {
    constructor(configService) {
        this.configService = configService;
    }
    async onModuleInit() {
        const url = this.configService.redisUrl;
        const options = url.startsWith('rediss://')
            ? { tls: {} }
            : {};
        this.client = new ioredis_1.default(url, options);
        this.pubClient = new ioredis_1.default(url, options);
        this.subClient = new ioredis_1.default(url, options);
        const logError = (err) => {
            console.error('❌ Redis Error:', err);
        };
        this.client.on('error', logError);
        this.pubClient.on('error', logError);
        this.subClient.on('error', logError);
        await Promise.all([
            new Promise((res) => this.client.once('ready', res)),
            new Promise((res) => this.pubClient.once('ready', res)),
            new Promise((res) => this.subClient.once('ready', res)),
        ]);
        console.log('✅ Redis connected');
        await this.client.set('health', 'ok');
        const val = await this.client.get('health');
        console.log('Redis test:', val);
    }
    async onModuleDestroy() {
        await this.client.quit();
        await this.pubClient.quit();
        await this.subClient.quit();
    }
    async setSession(token, data) {
        await this.client.set(`session:${token}`, JSON.stringify(data), 'EX', 86400);
    }
    async getSession(token) {
        const raw = await this.client.get(`session:${token}`);
        return raw ? JSON.parse(raw) : null;
    }
    async deleteSession(token) {
        await this.client.del(`session:${token}`);
    }
    async addActiveUser(roomId, username, socketId) {
        await this.client.hset(`room:${roomId}:users`, username, socketId);
    }
    async removeActiveUser(roomId, username) {
        await this.client.hdel(`room:${roomId}:users`, username);
    }
    async getActiveUsers(roomId) {
        const data = await this.client.hgetall(`room:${roomId}:users`);
        return Object.keys(data);
    }
    async getActiveUserCount(roomId) {
        return this.client.hlen(`room:${roomId}:users`);
    }
    async setSocketState(socketId, data) {
        await this.client.set(`socket:${socketId}`, JSON.stringify(data), 'EX', 86400);
    }
    async getSocketState(socketId) {
        const raw = await this.client.get(`socket:${socketId}`);
        return raw ? JSON.parse(raw) : null;
    }
    async deleteSocketState(socketId) {
        await this.client.del(`socket:${socketId}`);
    }
    async publish(channel, message) {
        await this.pubClient.publish(channel, message);
    }
    async subscribe(pattern, handler) {
        await this.subClient.psubscribe(pattern);
        this.subClient.on('pmessage', (_, channel, message) => {
            handler(channel, message);
        });
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map