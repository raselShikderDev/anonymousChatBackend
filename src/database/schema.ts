import { pgTable, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: varchar('id', { length: 50 }).primaryKey(),
  username: varchar('username', { length: 24 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable('rooms', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 32 }).notNull().unique(),
  createdBy: varchar('created_by', { length: 24 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: varchar('id', { length: 50 }).primaryKey(),
    roomId: varchar('room_id', { length: 50 })
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    username: varchar('username', { length: 24 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roomIdIdx: index('idx_messages_room_id').on(table.roomId),
    createdAtIdx: index('idx_messages_created_at').on(table.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;