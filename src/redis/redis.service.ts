import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

export interface SessionData {
  userId: string;
  username: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client!: Redis;
public pubClient!: Redis;
public subClient!: Redis;

 public isReady = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.redisUrl;

    const options = url.startsWith('rediss://')
      ? { tls: {} }
      : {};

    this.client = new Redis(url, options);
    this.pubClient = new Redis(url, options);
    this.subClient = new Redis(url, options);

    const logError = (err: any) => {
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

     this.isReady = true; 

    console.log('✅ Redis connected');

    // Health check
    await this.client.set('health', 'ok');
    const val = await this.client.get('health');
    console.log('Redis test:', val);
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
  }

  // ── Session ─────────────────────────────────────────

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
    return raw ? JSON.parse(raw) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.client.del(`session:${token}`);
  }

  // ── Active users ───────────────────────────────────

  async addActiveUser(
    roomId: string,
    username: string,
    socketId: string,
  ) {
    await this.client.hset(`room:${roomId}:users`, username, socketId);
  }

  async removeActiveUser(roomId: string, username: string) {
    await this.client.hdel(`room:${roomId}:users`, username);
  }

  async getActiveUsers(roomId: string): Promise<string[]> {
    const data = await this.client.hgetall(`room:${roomId}:users`);
    return Object.keys(data);
  }

  async getActiveUserCount(roomId: string): Promise<number> {
    return this.client.hlen(`room:${roomId}:users`);
  }

  // ── Socket state ───────────────────────────────────

  async setSocketState(
    socketId: string,
    data: { userId: string; username: string; roomId: string },
  ) {
    await this.client.set(
      `socket:${socketId}`,
      JSON.stringify(data),
      'EX',
      86400,
    );
  }

  async getSocketState(socketId: string) {
    const raw = await this.client.get(`socket:${socketId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async deleteSocketState(socketId: string) {
    await this.client.del(`socket:${socketId}`);
  }

  // ── Pub/Sub ────────────────────────────────────────

  async publish(channel: string, message: string) {
    await this.pubClient.publish(channel, message);
  }

  async subscribe(pattern: string, handler: (channel: string, message: string) => void) {
    await this.subClient.psubscribe(pattern);

    this.subClient.on('pmessage', (_, channel, message) => {
      handler(channel, message);
    });
  }
}