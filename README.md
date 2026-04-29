# Anonymous Chat API

Real-time anonymous group chat service built with NestJS, PostgreSQL,
Drizzle ORM, Redis, and Socket.io.

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

Or just Docker + Docker Compose (recommended).

---

## Running with Docker Compose (recommended)

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.
Postgres and Redis health checks ensure the app only starts once both
are ready. Drizzle migrations run automatically on startup.

---

## Running Locally (without Docker)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

DATABASE_URL=postgresql://postgres:password@localhost:5432/anonymous_chat
REDIS_URL=redis://localhost:6379
PORT=3000


### 3. Start PostgreSQL and Redis

Make sure both are running locally on their default ports.

### 4. Start the server

```bash
npm run start:dev
```

Drizzle migrations run automatically when the app boots via
`drizzle-orm/node-postgres/migrator`. No manual migration step needed.

---

## API Base URL



http://localhost:3000/api/v1



All responses follow the envelope:

```json
{ "success": true, "data": {} }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

---

## REST Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/login | No | Get or create user, receive session token |
| GET | /api/v1/rooms | Yes | List all rooms with live active user counts |
| POST | /api/v1/rooms | Yes | Create a room |
| GET | /api/v1/rooms/:id | Yes | Get room details |
| DELETE | /api/v1/rooms/:id | Yes | Delete room (creator only) |
| GET | /api/v1/rooms/:id/messages | Yes | Paginated message history |
| POST | /api/v1/rooms/:id/messages | Yes | Send a message |

Auth header: `Authorization: Bearer <sessionToken>`

---

## WebSocket

Connect to the `/chat` namespace:


ws://localhost:3000/chat?token=<sessionToken>&roomId=<roomId>


### Server → Client Events

| Event | Recipient | Payload |
|-------|-----------|---------|
| `room:joined` | Connecting client only | `{ activeUsers: string[] }` |
| `room:user_joined` | All other clients | `{ username, activeUsers }` |
| `message:new` | All clients in room | `{ id, username, content, createdAt }` |
| `room:user_left` | All clients in room | `{ username, activeUsers }` |
| `room:deleted` | All clients in room | `{ roomId }` |

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:leave` | none | Graceful disconnect |

---

## Project Structure
src/
├── main.ts
├── app.module.ts
├── config/          # ConfigService (env vars)
├── common/          # Guards, interceptors, filters, decorators
├── database/        # Drizzle setup, schema, migrations
├── redis/           # RedisService (session, active users, pub/sub)
├── auth/            # POST /login
├── rooms/           # Room CRUD
├── messages/        # Message history + send
└── gateway/         # Socket.io /chat gateway
drizzle/             # SQL migration files (applied automatically)