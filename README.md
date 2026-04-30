# Anonymous Chat API

A production-ready real-time group chat backend. Users identify with a username only — no passwords, no registration. Create rooms, join them, and exchange messages instantly.

**Live API:** https://anonymouschatbackend-wjtv.onrender.com/api/v1  
**GitHub:** https://github.com/raselShikderDev/anonymousChatBackend

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle ORM |
| Cache / Pub-Sub | Redis (Upstash) |
| Real-time | Socket.io |
| Hosting | Render |

---

## Features

- Anonymous login — username only, no password or registration
- Create and delete chat rooms
- Real-time messaging via WebSocket (Socket.io)
- Message persistence in PostgreSQL
- Live active-user counts per room, sourced from Redis
- Session tokens stored in Redis with 24-hour TTL
- WebSocket scaling across multiple server instances via Redis pub/sub adapter
- Cursor-based message pagination

---

## Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL instance (or [Neon](https://neon.tech) connection string)
- Redis instance (or [Upstash](https://upstash.com) connection string)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/raselShikderDev/anonymousChatBackend
cd anonymousChatBackend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Start the server (migrations run automatically on boot)
npm run start:dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
REDIS_URL=redis://default:password@host:port
PORT=3000
```

### Docker (alternative)

```bash
docker compose up --build
```

---

## API Reference

**Base path:** `/api/v1`  
**Content-Type:** `application/json`  
**Auth:** `Authorization: Bearer <sessionToken>` — required on all routes except `/login`

### Response Envelope

All responses follow this shape:

```json
// Success
{ "success": true, "data": {} }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "description" } }
```

---

### Authentication

#### `POST /api/v1/login`

Get or create a user and receive a session token. Idempotent by username — calling again with the same username returns the same user with a fresh token.

**Request**
```json
{ "username": "ali_123" }
```
> 2–24 characters, alphanumeric and underscores only.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "sessionToken": "<opaque token>",
    "user": {
      "id": "usr_a1b2c3",
      "username": "ali_123",
      "createdAt": "2024-03-01T10:00:00Z"
    }
  }
}
```

---

### Rooms

#### `GET /api/v1/rooms`

List all rooms. `activeUsers` is a live count pulled from Redis.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "id": "room_x9y8z7",
        "name": "general",
        "createdBy": "ali_123",
        "activeUsers": 4,
        "createdAt": "2024-03-01T10:00:00Z"
      }
    ]
  }
}
```

#### `POST /api/v1/rooms`

Create a new room.

**Request**
```json
{ "name": "general" }
```
> 3–32 characters, alphanumeric and hyphens only. Must be unique.

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "room_x9y8z7",
    "name": "general",
    "createdBy": "ali_123",
    "createdAt": "2024-03-01T10:00:00Z"
  }
}
```

**Errors:** `409 ROOM_NAME_TAKEN`

#### `GET /api/v1/rooms/:id`

Get room details including live `activeUsers` count.

**Response `200`** — same shape as a single room object above.  
**Errors:** `404 ROOM_NOT_FOUND`

#### `DELETE /api/v1/rooms/:id`

Delete a room and all its messages. Only the room creator can do this. Emits `room:deleted` to all connected clients before deletion.

**Response `200`**
```json
{ "success": true, "data": { "deleted": true } }
```

**Errors:** `403 FORBIDDEN` · `404 ROOM_NOT_FOUND`

---

### Messages

#### `GET /api/v1/rooms/:id/messages`

Paginated message history, ordered newest-first.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 50 | Max 100 |
| `before` | string | — | Message ID cursor — returns messages older than this |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_ab12cd",
        "roomId": "room_x9y8z7",
        "username": "ali_123",
        "content": "hello everyone",
        "createdAt": "2024-03-01T10:05:22Z"
      }
    ],
    "hasMore": true,
    "nextCursor": "msg_zz9900"
  }
}
```
> `nextCursor` is `null` when there are no more pages.

**Errors:** `404 ROOM_NOT_FOUND`

#### `POST /api/v1/rooms/:id/messages`

Send a message. Persists to PostgreSQL then publishes to Redis. The WebSocket gateway broadcasts to all connected clients — the REST controller never emits directly.

**Request**
```json
{ "content": "hello everyone" }
```
> 1–1000 characters, trimmed server-side.

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "msg_ab12cd",
    "roomId": "room_x9y8z7",
    "username": "ali_123",
    "content": "hello everyone",
    "createdAt": "2024-03-01T10:05:22Z"
  }
}
```

**Errors:** `404 ROOM_NOT_FOUND` · `422 MESSAGE_TOO_LONG`

---

### Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid request body (e.g. username format) |
| 401 | `UNAUTHORIZED` | Missing or expired session token |
| 403 | `FORBIDDEN` | Action not permitted (e.g. deleting another user's room) |
| 404 | `ROOM_NOT_FOUND` | Room does not exist |
| 409 | `ROOM_NAME_TAKEN` | Room name already in use |
| 422 | `MESSAGE_TOO_LONG` | Content exceeds 1000 characters |

---

## WebSocket

### Connection

```
ws://anonymouschatbackend-wjtv.onrender.com/chat?token=<sessionToken>&roomId=<roomId>
```

The server validates the token and room on every connection. Invalid tokens disconnect immediately with code `401`; unknown rooms with code `404`.

---

### Server → Client Events

| Event | Recipient | Payload |
|---|---|---|
| `room:joined` | Connecting client only | `{ "activeUsers": ["ali_123", "sara_x"] }` |
| `room:user_joined` | All other clients in room | `{ "username": "sara_x", "activeUsers": [...] }` |
| `message:new` | All clients in room | `{ "id", "username", "content", "createdAt" }` |
| `room:user_left` | All clients in room | `{ "username": "sara_x", "activeUsers": [...] }` |
| `room:deleted` | All clients in room | `{ "roomId": "room_x9y8z7" }` |

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `room:leave` | none | Graceful disconnect. Server cleans up Redis state and broadcasts `room:user_left`. |

### Example (JavaScript)

```js
const socket = io('https://anonymouschatbackend-wjtv.onrender.com/chat', {
  query: { token: '<sessionToken>', roomId: 'room_x9y8z7' }
});

socket.on('room:joined',      ({ activeUsers }) => console.log('Online:', activeUsers));
socket.on('room:user_joined', ({ username, activeUsers }) => { /* ... */ });
socket.on('message:new',      ({ id, username, content, createdAt }) => { /* ... */ });
socket.on('room:user_left',   ({ username, activeUsers }) => { /* ... */ });
socket.on('room:deleted',     ({ roomId }) => socket.disconnect());

// Graceful leave
socket.emit('room:leave');
```

---

## Project Structure

```
src/
├── main.ts
├── app.module.ts
├── config/          # Environment configuration
├── common/
│   ├── filters/     # Global exception filter → consistent error envelope
│   ├── interceptors/# Response interceptor → wraps data in success envelope
│   ├── guards/      # AuthGuard → validates Bearer token via Redis
│   └── decorators/  # @CurrentUser()
├── database/        # Drizzle setup, schema (users/rooms/messages), migrations
├── redis/           # RedisService — sessions, active users, socket state, pub/sub
├── auth/            # POST /login
├── rooms/           # GET/POST/DELETE /rooms
├── messages/        # GET/POST /rooms/:id/messages
└── gateway/         # Socket.io /chat namespace
drizzle/             # SQL migration files (applied automatically on boot)
```