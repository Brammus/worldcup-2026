// DB schema — add tables here as features are built
// Example placeholder to validate Drizzle setup:

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  group: text("group").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
