import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

export interface SessionData {
  userId: string;
  username: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  // client    — general purpose (get/set/hset/hlen/del)
  // pubClient — publish only, never subscribe
  // subClient — psubscribe only, never publish
  public client: Redis;
  public pubClient: Redis;
  public subClient: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.redisUrl;
    this.client = new Redis(url);
    this.pubClient = new Redis(url);
    this.subClient = new Redis(url);
  }

  onModuleDestroy() {
    this.client.disconnect();
    this.pubClient.disconnect();
    this.subClient.disconnect();
  }

  // ── Session ──────────────────────────────────────────────────────────────

  async setSession(token: string, data: SessionData): Promise<void> {
    await this.client.set(
      `session:${token}`,
      JSON.stringify(data),
      'EX',
      86400,
    );
  }

  async getSession(token: string): Promise<SessionData | null> {
    const raw = await this.client.get(`session:${token}`);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  }

  async deleteSession(token: string): Promise<void> {
    await this.client.del(`session:${token}`);
  }

  // ── Active users per room (hash: username → socketId) ────────────────────

  async addActiveUser(
    roomId: string,
    username: string,
    socketId: string,
  ): Promise<void> {
    await this.client.hset(`room:${roomId}:users`, username, socketId);
  }

  async removeActiveUser(roomId: string, username: string): Promise<void> {
    await this.client.hdel(`room:${roomId}:users`, username);
  }

  async getActiveUsers(roomId: string): Promise<string[]> {
    const hash = await this.client.hgetall(`room:${roomId}:users`);
    if (!hash) return [];
    return Object.keys(hash);
  }

  async getActiveUserCount(roomId: string): Promise<number> {
    return this.client.hlen(`room:${roomId}:users`);
  }

  // ── Socket connection state ───────────────────────────────────────────────

  async setSocketState(
    socketId: string,
    data: { userId: string; username: string; roomId: string },
  ): Promise<void> {
    await this.client.set(
      `socket:${socketId}`,
      JSON.stringify(data),
      'EX',
      86400,
    );
  }

  async getSocketState(
    socketId: string,
  ): Promise<{ userId: string; username: string; roomId: string } | null> {
    const raw = await this.client.get(`socket:${socketId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async deleteSocketState(socketId: string): Promise<void> {
    await this.client.del(`socket:${socketId}`);
  }

  // ── Pub / Sub ─────────────────────────────────────────────────────────────

  async publish(channel: string, message: string): Promise<void> {
    await this.pubClient.publish(channel, message);
  }
}