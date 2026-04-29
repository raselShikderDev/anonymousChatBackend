"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = exports.rooms = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.varchar)('id', { length: 50 }).primaryKey(),
    username: (0, pg_core_1.varchar)('username', { length: 24 }).notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.rooms = (0, pg_core_1.pgTable)('rooms', {
    id: (0, pg_core_1.varchar)('id', { length: 50 }).primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 32 }).notNull().unique(),
    createdBy: (0, pg_core_1.varchar)('created_by', { length: 24 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
});
exports.messages = (0, pg_core_1.pgTable)('messages', {
    id: (0, pg_core_1.varchar)('id', { length: 50 }).primaryKey(),
    roomId: (0, pg_core_1.varchar)('room_id', { length: 50 })
        .notNull()
        .references(() => exports.rooms.id, { onDelete: 'cascade' }),
    username: (0, pg_core_1.varchar)('username', { length: 24 }).notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    roomIdIdx: (0, pg_core_1.index)('idx_messages_room_id').on(table.roomId),
    createdAtIdx: (0, pg_core_1.index)('idx_messages_created_at').on(table.createdAt),
}));
//# sourceMappingURL=schema.js.map