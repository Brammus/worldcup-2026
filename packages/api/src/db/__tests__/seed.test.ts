import { beforeAll, describe, expect, it } from "bun:test";
import { count, eq } from "drizzle-orm";
import { resolvers } from "../../schema/resolvers";
import type { GraphQLContext } from "../../schema/resolvers";
import { db } from "../client";
import { runMigrations } from "../migrate";
import {
  matchResults,
  matches,
  osrsPlayers,
  osrsTeamPicks,
  osrsTeams,
  picks,
  teams,
  users,
} from "../schema";
import { seed } from "../seed";

const ctx: GraphQLContext = {
  db,
  currentUser: null,
  responseHeaders: new Headers(),
  ip: "127.0.0.1",
};

beforeAll(async () => {
  await runMigrations();
  // Clear in FK-safe order
  await db.delete(picks);
  await db.delete(matchResults);
  await db.delete(matches);
  await db.delete(osrsTeamPicks);
  await db.delete(osrsPlayers);
  await db.delete(osrsTeams);
  await db.delete(users);
  await db.delete(teams);
  await seed(db);
});

describe("seed data integrity", () => {
  it("seeds 48 teams", async () => {
    const [row] = await db.select({ value: count() }).from(teams);
    expect(Number(row?.value)).toBe(48);
  });

  it("seeds 104 total matches", async () => {
    const [row] = await db.select({ value: count() }).from(matches);
    expect(Number(row?.value)).toBe(104);
  });

  it("seeds 72 group stage matches", async () => {
    const [row] = await db
      .select({ value: count() })
      .from(matches)
      .where(eq(matches.round, "group"));
    expect(Number(row?.value)).toBe(72);
  });

  it("seeds 32 knockout matches", async () => {
    const all = await db.select({ value: count() }).from(matches);
    const group = await db
      .select({ value: count() })
      .from(matches)
      .where(eq(matches.round, "group"));
    expect(Number(all[0]?.value) - Number(group[0]?.value)).toBe(32);
  });

  it("has exactly 12 groups", async () => {
    const rows = await db.selectDistinct({ groupLetter: teams.groupLetter }).from(teams);
    expect(rows).toHaveLength(12);
  });

  it("has exactly 4 teams per group", async () => {
    const rows = await db
      .select({ groupLetter: teams.groupLetter, total: count() })
      .from(teams)
      .groupBy(teams.groupLetter);
    for (const row of rows) {
      expect(Number(row.total)).toBe(4);
    }
  });

  it("all group stage matches have both team IDs populated", async () => {
    const groupMatches = await db.select().from(matches).where(eq(matches.round, "group"));
    for (const match of groupMatches) {
      expect(match.homeTeamId).not.toBeNull();
      expect(match.awayTeamId).not.toBeNull();
    }
  });

  it("each group has exactly 6 group stage matches", async () => {
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    for (const g of groups) {
      const [row] = await db
        .select({ value: count() })
        .from(matches)
        .where(eq(matches.groupLetter, g));
      expect(Number(row?.value)).toBe(6);
    }
  });
});

describe("Query.teams", () => {
  it("returns all 48 teams", async () => {
    const result = await resolvers.Query.teams(undefined, undefined, ctx);
    expect(result).toHaveLength(48);
  });
});

describe("Query.matches", () => {
  it("returns all 104 matches", async () => {
    const result = await resolvers.Query.matches(undefined, {}, ctx);
    expect(result).toHaveLength(104);
  });

  it("filters to 72 group stage matches", async () => {
    const result = await resolvers.Query.matches(undefined, { round: "group" }, ctx);
    expect(result).toHaveLength(72);
  });

  it("filters to 6 matches for a specific group", async () => {
    const result = await resolvers.Query.matches(undefined, { group: "A" }, ctx);
    expect(result).toHaveLength(6);
  });
});
