# Architecture

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Session Strategy](#session-strategy)
3. [Redis Pub/Sub and WebSocket Fan-out](#redis-pubsub-and-websocket-fan-out)
4. [Estimated Concurrent User Capacity](#estimated-concurrent-user-capacity)
5. [Scaling to 10× Load](#scaling-to-10-load)
6. [Known Limitations and Trade-offs](#known-limitations-and-trade-offs)

---

## Architecture Overview

The system is a stateless NestJS application with two transport layers: a REST API (HTTP) and a real-time gateway (WebSocket via Socket.io). All shared state — sessions, active users, socket metadata — lives in Redis. All persistent data lives in PostgreSQL, accessed exclusively through Drizzle ORM.

```
┌────────────────────────────────────────────────────────────────┐
│                          Clients                               │
│                  HTTP REST  +  WebSocket                       │
└──────────────────────────┬─────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │       NestJS App         │
              │   (Render — stateless)   │
              │                         │
              │  ┌─────────────────┐    │
              │  │ REST Controllers │    │
              │  │  /api/v1        │    │
              │  └────────┬────────┘    │
              │           │             │
              │  ┌────────▼────────┐    │
              │  │   Services       │    │
              │  └────────┬────────┘    │
              │           │             │
              │  ┌────────▼────────┐    │
              │  │  ChatGateway    │    │
              │  │  /chat  (WS)    │    │
              │  └─────────────────┘    │
              └──────────┬──────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
  ┌───────────▼──────┐  ┌───────────▼──────────┐
  │   PostgreSQL      │  │        Redis          │
  │   (Neon)          │  │       (Upstash)        │
  │                   │  │                       │
  │  users            │  │  session:<token>       │
  │  rooms            │  │  room:<id>:users       │
  │  messages         │  │  socket:<id>           │
  │                   │  │  pub/sub channels      │
  └───────────────────┘  └───────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| **REST Controllers** | Validate input, delegate to services, return shaped responses |
| **Services** | Business logic, Drizzle queries, Redis reads/writes, pub/sub publish |
| **ChatGateway** | WebSocket lifecycle, Redis pub/sub subscribe, broadcast to Socket.io rooms |
| **AuthGuard** | Extract Bearer token, validate against Redis session, inject user into request |
| **HttpExceptionFilter** | Normalise all errors into `{ success: false, error: { code, message } }` |
| **ResponseInterceptor** | Wrap all success responses into `{ success: true, data }` |
| **DatabaseService** | Drizzle instance, auto-run migrations on boot |
| **RedisService** | Three dedicated connections: general client, pub-only client, sub-only client |

### Data Flow — Sending a Message

```
POST /api/v1/rooms/:id/messages
         │
         ▼
  MessagesService
         │
         ├─► INSERT INTO messages (Drizzle)
         │
         └─► redis.publish("room:<roomId>:message:new", payload)
                      │
                      ▼
              Redis pub/sub broker
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
       Instance A            Instance B   (all app instances)
           │                     │
           └──────────┬──────────┘
                      ▼
         subClient.on("pmessage")
                      │
                      ▼
         server.to(roomId).emit("message:new", payload)
         (Socket.io adapter delivers to every socket
          in that room across all instances)
```

The REST controller never emits WebSocket events directly. All real-time delivery is decoupled through Redis.

---

## Session Strategy

### Token Generation

On `POST /api/v1/login`, a 32-character cryptographically random opaque token is generated using `nanoid`. The token has no embedded claims — it is a pure lookup key.

### Storage

```
Redis key:   session:<token>
Redis value: { "userId": "usr_...", "username": "ali_123" }   (JSON string)
Redis TTL:   86400 seconds (24 hours)
```

### Validation

Every authenticated REST request and every WebSocket connection reads the `Authorization: Bearer <token>` header (or `token` query parameter for WebSocket) and performs:

```
redis.get("session:<token>") → SessionData | null
```

- If `null` or expired → `401 UNAUTHORIZED`
- If found → user context is injected into the request via `@CurrentUser()` decorator

No database round-trip is made during authentication. The session cache is the source of truth for active tokens.

### Expiry and Refresh

Tokens expire hard at 24 hours from issuance. Re-calling `POST /login` with the same username issues a fresh token with a new 24-hour TTL. WebSocket connections are only validated on connect — an in-progress connection is not interrupted when its token expires.

---

## Redis Pub/Sub and WebSocket Fan-out

### Why Pub/Sub Is Needed

Socket.io rooms are local to each process. Without a shared coordination layer, a message sent via the REST API on Instance A would only reach WebSocket clients connected to Instance A. Clients on Instance B would never receive it.

### Three Dedicated Redis Connections

`RedisService` maintains three separate connections to avoid command conflicts:

| Connection | Purpose |
|---|---|
| `client` | General key-value operations (sessions, active users, socket state) |
| `pubClient` | `PUBLISH` only — used by services to emit events |
| `subClient` | `PSUBSCRIBE` only — used by ChatGateway to receive events |

The Socket.io Redis adapter gets its own pair of duplicated connections (duplicated from `pubClient`) so its internal channel never interferes with the application's `pmessage` listener.

### Channel Design

| Channel | Trigger | Gateway action |
|---|---|---|
| `room:<roomId>:message:new` | `POST /rooms/:id/messages` | `server.to(roomId).emit('message:new', payload)` |
| `room:<roomId>:deleted` | `DELETE /rooms/:id` | `server.to(roomId).emit('room:deleted', payload)` |

The gateway uses `psubscribe` with glob patterns (`room:*:message:new`, `room:*:deleted`) so a single subscription covers all rooms without requiring per-room subscribe/unsubscribe management.

### Socket.io Redis Adapter

In addition to the application-level pub/sub above, `@socket.io/redis-adapter` is wired in `afterInit`. This adapter coordinates Socket.io room membership across all instances, ensuring that `server.to(roomId).emit(...)` reaches clients on every instance — not just the one that received the Redis message.

### End-to-End Fan-out Guarantee

Every message sent through `POST /rooms/:id/messages` is guaranteed to reach every WebSocket client in the room regardless of which server instance they are connected to, because:

1. The REST layer publishes to Redis (not to Socket.io directly).
2. Every instance's `subClient` receives the Redis message.
3. Each instance calls `server.to(roomId).emit(...)`.
4. The Socket.io adapter ensures the emit is delivered to the correct local sockets.

---

## Estimated Concurrent User Capacity

### Single Instance Estimates (2 vCPU / 512 MB RAM — Render free tier)

| Resource | Estimate | Reasoning |
|---|---|---|
| WebSocket connections | ~3,000–5,000 | Node.js handles ~50k sockets at full resources; free tier memory caps this lower |
| Redis ops per message | 2 | `PUBLISH` + `HGETALL` (active user list) |
| DB writes per message | 1 | Single `INSERT INTO messages` |
| DB reads per auth | 0 | Session resolved from Redis, no DB round-trip |
| Auth latency | ~1–3 ms | Redis GET only |

**Conservative safe estimate: 2,000–4,000 concurrent users** on a single Render free instance (512 MB RAM), assuming moderate message frequency (~1 message/sec per active room, not per user).

### Bottleneck Analysis

At this scale the likely bottlenecks in order are:

1. **Memory** — each Socket.io connection holds ~10–50 KB of state.
2. **PostgreSQL write throughput** — Neon free tier limits concurrent connections and IOPS.
3. **Redis connection limits** — Upstash free tier limits concurrent connections.

CPU is unlikely to be the bottleneck given Node.js's async I/O model and the lightweight nature of this workload.

---

## Scaling to 10× Load

Reaching ~20,000–40,000 concurrent users requires changes at every layer:

| Change | Layer | Rationale |
|---|---|---|
| Horizontal NestJS instances (3–5 replicas) | App | The app is stateless; Redis adapter handles WS fan-out across instances |
| Load balancer with connection-aware routing | Infra | ALB or Nginx; sticky sessions optional since the Redis adapter removes the need |
| Upgrade to Render paid tier (2 vCPU / 2 GB+) | Infra | Removes the memory ceiling on WebSocket connections |
| Redis Cluster or Upstash paid plan | Redis | Higher throughput, more concurrent connections, no free-tier rate limits |
| PostgreSQL connection pooling (PgBouncer) | Database | Neon supports pooling; prevents connection exhaustion under load |
| PostgreSQL read replica | Database | Offload message history (`GET /rooms/:id/messages`) to replica |
| Message write buffer / batch inserts | App | Accumulate inserts in Redis and flush in batches to reduce per-message DB round trips |
| Per-user rate limiting | App | Redis sliding-window counter (e.g. `rate-limiter-flexible`) per user per room |
| CDN / edge TLS termination | Infra | Reduce latency and offload TLS handshakes from app servers |

The most impactful single change is **horizontal scaling + Redis adapter**, which is already architecturally supported with no code changes required.

---

## Known Limitations and Trade-offs

### Single active socket per username per room

The Redis hash `room:<roomId>:users` maps `username → socketId`. If the same user opens two browser tabs in the same room, the second connection overwrites the first's `socketId`. When either tab disconnects, the user is removed from the active set even though the other tab is still connected.

**Fix:** Use `username:socketId` as the hash field. Count unique usernames by iterating fields. Remove only the specific `socketId` on disconnect.

### No token refresh on use

Tokens expire exactly 24 hours after issuance and are not refreshed on activity. A user who stays connected past the 24-hour mark will find their REST calls rejected with `401`, but their WebSocket connection (validated only on connect) remains live.

**Fix:** Sliding TTL — call `EXPIRE session:<token> 86400` on each successful REST auth to extend the token's life on activity.

### No message ordering guarantee for same-millisecond inserts

Messages are sorted by `created_at DESC`. Two messages inserted within the same millisecond may appear in non-deterministic order on different queries.

**Fix:** Use a ULID or a `BIGSERIAL` sequence column as a secondary sort key to guarantee strict ordering.

### No rate limiting

A single authenticated user can flood a room with unlimited messages. At scale this can exhaust PostgreSQL write capacity and Redis pub/sub throughput.

**Fix:** Implement a Redis-backed sliding-window rate limiter per `userId + roomId` at the `MessagesService` layer.

### No input sanitization beyond validation

Content is stored and broadcast as-is after length and empty checks. XSS sanitization is the responsibility of the client, which is acceptable for an API, but should be documented explicitly for frontend consumers.

### Drizzle migration path resolution

`DatabaseService` resolves the migrations folder at runtime using `path.join(__dirname, '../../drizzle')`. In the compiled `dist/` output, `__dirname` points to `dist/src/database/`, so `../../drizzle` correctly resolves to the project root's `drizzle/` folder — provided the `drizzle/` directory is included in the Docker image or deployment bundle. If it is excluded, migrations will fail silently or throw at boot.