# Architecture

## Component Overview

┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│              (HTTP REST  +  WebSocket)                  │
└────────────────────┬────────────────────────────────────┘
│
┌──────────▼──────────┐
│    NestJS App        │
│                     │
│  ┌───────────────┐  │
│  │ REST Controllers│  │
│  │ /api/v1        │  │
│  └──────┬────────┘  │
│         │           │
│  ┌──────▼────────┐  │
│  │  Services      │  │
│  └──────┬────────┘  │
│         │           │
│  ┌──────▼────────┐  │
│  │ ChatGateway    │  │
│  │ /chat (WS)     │  │
│  └───────────────┘  │
└──────┬──────────────┘
│
┌────────┴────────┐
│                 │
┌───────▼──────┐  ┌───────▼──────┐
│  PostgreSQL  │  │    Redis      │
│  (Drizzle)   │  │               │
│              │  │ session:*     │
│  users       │  │ room::users  │
│  rooms       │  │ socket:      │
│  messages    │  │ pub/sub       │
└──────────────┘  └───────────────┘



When multiple app instances are deployed behind a load balancer,
the Socket.io Redis adapter coordinates room membership across all
instances so that pub/sub fan-out reaches every connected client
regardless of which instance they are on.

---

## Session Strategy

1. `POST /login` receives a username (2–24 chars, alphanumeric + underscores).
2. The user row is upserted in PostgreSQL via Drizzle.
3. A 32-character opaque token is generated with `nanoid`.
4. The token is stored in Redis as:


session:<token>  →  { userId, username }   TTL: 86400s (24h)


5. Every authenticated REST request reads the `Authorization: Bearer <token>`
   header and calls `redis.get(session:<token>)`. A missing or expired key
   returns 401 immediately — no database round trip.
6. WebSocket connections validate the token the same way during `handleConnection`.
7. Tokens are not refreshed on use; they expire exactly 24 hours after issuance.
   Re-calling `POST /login` with the same username issues a fresh token.

---

## Redis Key Design

| Key pattern | Type | Purpose |
|---|---|---|
| `session:<token>` | String (JSON) | Session data, 24h TTL |
| `room:<roomId>:users` | Hash | `username → socketId` for active users |
| `socket:<socketId>` | String (JSON) | `{ userId, username, roomId }`, 24h TTL |

---

## Redis Pub/Sub and WebSocket Fan-out

### Message flow for `POST /rooms/:id/messages`

REST Controller
│
▼
MessagesService.createMessage()
│
├─► INSERT into PostgreSQL (Drizzle)
│
└─► redis.publish("room:<roomId>:message:new", payload)
│
▼
Redis pub/sub broker
│
┌─────┴─────┐
▼           ▼
Instance A   Instance B   (all app instances)
│           │
└─────┬─────┘
▼
subClient.on("pmessage")
│
▼
server.to(roomId).emit("message:new", payload)
(Socket.io adapter delivers to all sockets in room
across all instances via its own Redis channel)


### Room deletion flow for `DELETE /rooms/:id`

RoomsService.remove()
│
├─► redis.publish("room:<roomId>:deleted", { roomId })
│         └─► gateway emits room:deleted to all room clients
│
└─► db.delete(rooms) via Drizzle




The REST controller never emits WebSocket events directly.
All real-time delivery goes through Redis pub/sub → gateway.

### Why two separate pub/sub connections?

`subClient` is dedicated to `psubscribe` for app-level channels
(`room:*:message:new`, `room:*:deleted`).

`afterInit` duplicates `pubClient` twice to create a separate
pub+sub pair exclusively for the Socket.io Redis adapter's internal
coordination channel. Mixing them would cause the adapter's
subscribe calls to block or corrupt the app's pmessage listener.

---

## Active User Tracking

Redis hash `room:<roomId>:users` maps `username → socketId`.

- **Join**: `HSET room:<roomId>:users <username> <socketId>`
- **Leave / disconnect**: `HDEL room:<roomId>:users <username>`
- **Count** (`activeUsers` field in REST responses): `HLEN room:<roomId>:users`
- **List** (WebSocket event payloads): `HGETALL` → `Object.keys()`

No in-memory JavaScript maps or objects are used anywhere. All
connection state survives a single-instance restart as long as Redis
is running (sockets reconnect and re-register).

---

## Estimated Concurrent Capacity (Single Instance)

| Resource | Estimate |
|---|---|
| WebSocket connections | ~10,000–50,000 |
| Redis ops per message | 2 (publish + hgetall) |
| DB writes per message | 1 insert |
| DB reads (auth) | 0 (Redis session cache) |

**Conservative safe estimate: 5,000–10,000 concurrent users** on a
single 2-CPU / 4 GB RAM instance, assuming moderate message
frequency (~1 msg/sec per active user).

The bottleneck at this scale is likely the PostgreSQL write throughput
for messages, not Node.js or Redis.

---

## Scaling to 10×

| Change | Rationale |
|---|---|
| Horizontal NestJS instances behind ALB | Stateless; Redis adapter handles WS fan-out |
| Redis Cluster | Distribute pub/sub and key storage |
| PostgreSQL read replica | Offload message history queries |
| Message write buffer / batch insert | Reduce per-message DB round trips |
| Per-user / per-room rate limiting | Protect against message floods |
| Sticky sessions on load balancer | Optional; adapter makes it unnecessary |
| CDN / edge termination for WS | Reduce latency for geographically distributed users |

---

## Known Limitations and Trade-offs

**Single active socket per username per room.**
The Redis hash uses `username` as the key. If the same user opens two
browser tabs in the same room, the second connection overwrites the
first's `socketId`. On disconnect the user is removed from the active
set even if the other tab is still connected. A production fix would
use `username:socketId` as the hash field and count unique usernames
across all fields.

**No token refresh.**
Tokens expire hard at 24 hours. Any in-progress WebSocket connection
will not be kicked out mid-session (the token is only checked on
connect), but REST calls after expiry will receive 401.

**No rate limiting.**
A single user can flood a room with messages. Add a Redis-backed
sliding-window rate limiter (e.g. `rate-limiter-flexible`) per user
per room at the REST layer.

**No message ordering guarantee across restarts.**
Messages are ordered by `created_at` (DESC). If two messages are
inserted within the same millisecond they may appear in
non-deterministic order. A sequence column or ULID-based ID would fix
this.

**Drizzle migration folder path.**
`database.service.ts` uses `path.join(__dirname, '../../drizzle')`.
When compiled to `dist/src/database/database.service.js` this resolves
to `dist/drizzle`, which does not exist. The `Dockerfile` copies the
`drizzle/` folder to the image root so the path resolves correctly in
production. For local `ts-node` runs, `__dirname` points to
`src/database/` so `../../drizzle` resolves to the project root —
both cases are covered.