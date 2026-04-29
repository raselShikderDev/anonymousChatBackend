CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "username" varchar(24) NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rooms" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "name" varchar(32) NOT NULL UNIQUE,
  "created_by" varchar(24) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "room_id" varchar(50) NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "username" varchar(24) NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_messages_room_id" ON "messages"("room_id");
CREATE INDEX IF NOT EXISTS "idx_messages_created_at" ON "messages"("created_at");