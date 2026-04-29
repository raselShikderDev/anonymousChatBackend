import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
import { Injectable, OnModuleInit } from '@nestjs/common';

// @WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class ChatGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly redisService: RedisService,
    private readonly roomsService: RoomsService,
  ) {}

  // ── Redis pub/sub fan-out ──
  // onModuleInit wires up the pmessage listener on the dedicated subClient.
  // afterInit wires the Socket.io Redis adapter using duplicate connections
  // so pub/sub channels never collide with the adapter's internal channels.

  onModuleInit() {
    this.redisService.subClient.psubscribe(
      'room:*:message:new',
      'room:*:deleted',
      (err) => {
        if (err) console.error('[Gateway] psubscribe error:', err);
      },
    );

    this.redisService.subClient.on(
      'pmessage',
      (_pattern: string, channel: string, message: string) => {
        try {
          const payload = JSON.parse(message);

          if (channel.endsWith(':message:new')) {
            // channel = room:<roomId>:message:new
            const roomId = channel.slice(
              'room:'.length,
              channel.lastIndexOf(':message:new'),
            );
            // Contract event: message:new
            this.server.to(roomId).emit('message:new', payload);
          } else if (channel.endsWith(':deleted')) {
            // channel = room:<roomId>:deleted
            const roomId = channel.slice(
              'room:'.length,
              channel.lastIndexOf(':deleted'),
            );
            // Contract event: room:deleted
            this.server.to(roomId).emit('room:deleted', payload);
          }
        } catch (e) {
          console.error('[Gateway] pmessage parse error:', e);
        }
      },
    );
  }
  
async afterInit() {
  while (!this.redisService.isReady) {
    await new Promise((res) => setTimeout(res, 50));
  }

  console.log("In line 82 at chat.gateway", this.redisService.pubClient.duplicate());
  const pubClient = this.redisService.pubClient.duplicate();
  
  const subClient = this.redisService.subClient.duplicate();

  this.server.adapter(createAdapter(pubClient, subClient)); // ✅ FIX

  console.log('✅ Redis adapter connected');
}
  // afterInit(server: Server) {
  //   // Duplicate connections so the adapter's internal sub channel
  //   // does not interfere with our pmessage listener on subClient
  //   const pubClient = this.redisService.pubClient.duplicate();
  //   const subClient = this.redisService.pubClient.duplicate();
  //   server.adapter(createAdapter(pubClient, subClient));
  // }

  // ── Connection ──

  async handleConnection(client: Socket) {
    const token = client.handshake.query.token as string;
    const roomId = client.handshake.query.roomId as string;

    // Validate token
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

    // Validate roomId
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

    // Persist socket state to Redis — no in-memory maps anywhere
    await this.redisService.setSocketState(client.id, {
      userId: session.userId,
      username,
      roomId,
    });

    // Track active user in Redis hash for this room
    await this.redisService.addActiveUser(roomId, username, client.id);

    // Join the Socket.io room (coordinated across instances via adapter)
    await client.join(roomId);

    // room:joined → connecting client ONLY
    const activeUsers = await this.redisService.getActiveUsers(roomId);
    client.emit('room:joined', { activeUsers });

    // room:user_joined → all OTHER clients already in the room
    client.to(roomId).emit('room:user_joined', {
      username,
      activeUsers,
    });
  }

  // ── Disconnection ─────

  async handleDisconnect(client: Socket) {
    await this.cleanupClient(client);
  }

  // ── Client → Server events ───

  // Contract: room:leave — no payload, graceful disconnect
  @SubscribeMessage('room:leave')
  async handleLeave(@ConnectedSocket() client: Socket) {
    await this.cleanupClient(client);
    client.disconnect(true);
  }

  // ── Helpers ─────

  private async cleanupClient(client: Socket) {
    const state = await this.redisService.getSocketState(client.id);
    if (!state) return;

    const { username, roomId } = state;

    await this.redisService.removeActiveUser(roomId, username);
    await this.redisService.deleteSocketState(client.id);

    const activeUsers = await this.redisService.getActiveUsers(roomId);

    // room:user_left → all remaining clients in the room
    this.server.to(roomId).emit('room:user_left', { username, activeUsers });
  }
}