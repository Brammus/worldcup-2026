import { boolean, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  groupLetter: text("group_letter").notNull(),
});

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  round: text("round").notNull(), // group | r32 | r16 | qf | sf | final | third_place
  matchday: integer("matchday"), // 1/2/3 for group stage, null for knockout
  groupLetter: text("group_letter"), // A–L for group stage, null for knockout
  homeTeamId: uuid("home_team_id").references(() => teams.id),
  awayTeamId: uuid("away_team_id").references(() => teams.id),
  homeTeamLabel: text("home_team_label").notNull(),
  awayTeamLabel: text("away_team_label").notNull(),
  venue: text("venue").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const picks = pgTable(
  "picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id),
    pickedTeamId: uuid("picked_team_id")
      .notNull()
      .references(() => teams.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("picks_user_match_unique").on(t.userId, t.matchId)],
);

export const matchResults = pgTable("match_results", {
  matchId: uuid("match_id")
    .primaryKey()
    .references(() => matches.id),
  winnerTeamId: uuid("winner_team_id").references(() => teams.id), // null = draw
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type User = typeof users.$inferSelect;
export type Pick = typeof picks.$inferSelect;
export type MatchResult = typeof matchResults.$inferSelect;
