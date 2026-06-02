import { beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import { osrsPlayers, osrsTeamPicks, osrsTeams, users } from "../../db/schema";
import type { GraphQLContext } from "../resolvers";
import { resolvers } from "../resolvers";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<GraphQLContext> = {}): GraphQLContext {
  return { db, currentUser: null, responseHeaders: new Headers(), ip: "127.0.0.1", ...overrides };
}

// ── setup ─────────────────────────────────────────────────────────────────────

let teamIds: string[] = [];
let teamDinoId: string;
let teamWesthamId: string;
let userId: string;
let otherUserId: string;

beforeAll(async () => {
  await runMigrations();

  // Clean up OSRS tables first (respects FK order)
  await db.delete(osrsTeamPicks);
  await db.delete(osrsPlayers);
  await db.delete(osrsTeams);
  await db.delete(users);

  // Insert users
  const [u1] = await db
    .insert(users)
    .values({ username: "alice_osrs", passwordHash: "x" })
    .returning({ id: users.id });
  const [u2] = await db
    .insert(users)
    .values({ username: "bob_osrs", passwordHash: "x" })
    .returning({ id: users.id });
  userId = u1?.id ?? "";
  otherUserId = u2?.id ?? "";

  // Insert 6 OSRS teams (required by rankOsrsTeams mutation)
  const teamValues = [
    { name: "DINO", color: "#2c2c3e" },
    { name: "WESTHAM", color: "#2d7a2d" },
    { name: "WOOX", color: "#c0392b" },
    { name: "PURESPAM", color: "#8e44ad" },
    { name: "SETTLED", color: "#2980b9" },
    { name: "TORVESTA", color: "#e67e22" },
  ];
  const insertedTeams = await db
    .insert(osrsTeams)
    .values(teamValues)
    .returning({ id: osrsTeams.id });
  teamIds = insertedTeams.map((t) => t.id);
  teamDinoId = teamIds[0] ?? "";
  teamWesthamId = teamIds[1] ?? "";

  // Insert players for DINO
  await db.insert(osrsPlayers).values([
    { teamId: teamDinoId, name: "DINO", isCaptain: true },
    { teamId: teamDinoId, name: "GNOMONKEY", isCaptain: false },
  ]);

  // Insert players for WESTHAM
  await db.insert(osrsPlayers).values([
    { teamId: teamWesthamId, name: "WESTHAM", isCaptain: true },
    { teamId: teamWesthamId, name: "BOATY", isCaptain: false },
  ]);
});

// ── Query.osrsTeams ───────────────────────────────────────────────────────────

describe("Query.osrsTeams", () => {
  it("returns all teams ordered by name", async () => {
    const ctx = makeCtx();
    const result = await resolvers.Query.osrsTeams(undefined, undefined, ctx);
    expect(result.length).toBeGreaterThanOrEqual(6);
    // Ordered by name alphabetically: DINO before WESTHAM
    const names = result.map((t: { name: string }) => t.name);
    expect(names.indexOf("DINO")).toBeLessThan(names.indexOf("WESTHAM"));
  });

  it("returns teams with id, name, color fields", async () => {
    const ctx = makeCtx();
    const [team] = await resolvers.Query.osrsTeams(undefined, undefined, ctx);
    expect(team).toHaveProperty("id");
    expect(team).toHaveProperty("name");
    expect(team).toHaveProperty("color");
  });
});

// ── Query.myOsrsRanking ───────────────────────────────────────────────────────

describe("Query.myOsrsRanking", () => {
  it("returns empty array when unauthenticated", async () => {
    const ctx = makeCtx({ currentUser: null });
    const result = await resolvers.Query.myOsrsRanking(undefined, undefined, ctx);
    expect(result).toEqual([]);
  });

  it("returns empty array when user has no picks", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    // Ensure no picks for this user
    await db.delete(osrsTeamPicks).where(eq(osrsTeamPicks.userId, userId));
    const result = await resolvers.Query.myOsrsRanking(undefined, undefined, ctx);
    expect(result).toEqual([]);
  });

  it("returns picks sorted by rank after ranking", async () => {
    // Clean and set up a full ranking for userId
    await db.delete(osrsTeamPicks).where(eq(osrsTeamPicks.userId, userId));
    const rankings = teamIds.map((id, i) => ({ teamId: id, rank: i + 1 }));
    await db
      .insert(osrsTeamPicks)
      .values(rankings.map((r) => ({ userId, teamId: r.teamId, rank: r.rank })));

    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    const result = await resolvers.Query.myOsrsRanking(undefined, undefined, ctx);
    expect(result.length).toBe(6);
    // Verify sorted by rank
    const ranks = result.map((r: { rank: number }) => r.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6]);
    // Verify first entry points to the first team
    expect(result[0]?.team.id).toBe(teamIds[0] ?? "");
    await db.delete(osrsTeamPicks).where(eq(osrsTeamPicks.userId, userId));
  });
});

// ── Mutation.rankOsrsTeams ────────────────────────────────────────────────────

describe("Mutation.rankOsrsTeams", () => {
  it("throws when unauthenticated", async () => {
    const ctx = makeCtx({ currentUser: null });
    const rankings = teamIds.map((id, i) => ({ teamId: id, rank: i + 1 }));
    await expect(resolvers.Mutation.rankOsrsTeams(undefined, { rankings }, ctx)).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("throws when not exactly 6 rankings", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    const rankings = [{ teamId: teamDinoId, rank: 1 }];
    await expect(resolvers.Mutation.rankOsrsTeams(undefined, { rankings }, ctx)).rejects.toThrow(
      "Must rank all 6 teams",
    );
  });

  it("throws when duplicate ranks", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    // 6 entries but rank 1 is duplicated
    const rankings = teamIds.map((id, i) => ({ teamId: id, rank: i === 5 ? 1 : i + 1 }));
    await expect(resolvers.Mutation.rankOsrsTeams(undefined, { rankings }, ctx)).rejects.toThrow(
      "Rankings must be ranks 1-6 with no duplicates",
    );
  });

  it("throws when duplicate teamIds", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    // Repeat the first team ID, cover 6 entries with ranks 1-6
    const rankings = [
      { teamId: teamDinoId, rank: 1 },
      { teamId: teamDinoId, rank: 2 },
      { teamId: teamIds[2] ?? "", rank: 3 },
      { teamId: teamIds[3] ?? "", rank: 4 },
      { teamId: teamIds[4] ?? "", rank: 5 },
      { teamId: teamIds[5] ?? "", rank: 6 },
    ];
    await expect(resolvers.Mutation.rankOsrsTeams(undefined, { rankings }, ctx)).rejects.toThrow(
      "Each team must appear once",
    );
  });

  it("stores ranking and returns sorted result", async () => {
    await db.delete(osrsTeamPicks).where(eq(osrsTeamPicks.userId, userId));
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    // Submit in reverse order to verify sort
    const rankings = teamIds.map((id, i) => ({ teamId: id, rank: 6 - i }));
    const result = await resolvers.Mutation.rankOsrsTeams(undefined, { rankings }, ctx);

    expect(result.length).toBe(6);
    // Result should be sorted by rank ascending
    const resultRanks = result.map((r: { rank: number }) => r.rank);
    expect(resultRanks).toEqual([1, 2, 3, 4, 5, 6]);

    // Verify persisted in DB
    const dbPicks = await db.select().from(osrsTeamPicks).where(eq(osrsTeamPicks.userId, userId));
    expect(dbPicks.length).toBe(6);
  });

  it("replaces previous ranking on second call", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    // First ranking
    const rankings1 = teamIds.map((id, i) => ({ teamId: id, rank: i + 1 }));
    await resolvers.Mutation.rankOsrsTeams(undefined, { rankings: rankings1 }, ctx);

    // Second ranking — reversed
    const rankings2 = teamIds.map((id, i) => ({ teamId: id, rank: 6 - i }));
    const result = await resolvers.Mutation.rankOsrsTeams(undefined, { rankings: rankings2 }, ctx);

    // Only 6 rows in DB (not 12)
    const dbPicks = await db.select().from(osrsTeamPicks).where(eq(osrsTeamPicks.userId, userId));
    expect(dbPicks.length).toBe(6);

    // Result reflects new ranking
    expect(result.length).toBe(6);
    const resultRanks = result.map((r: { rank: number }) => r.rank);
    expect(resultRanks).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ── OsrsTeam.players ─────────────────────────────────────────────────────────

describe("OsrsTeam.players", () => {
  it("returns players with captain first", async () => {
    const ctx = makeCtx();
    const players = await resolvers.OsrsTeam.players({ id: teamDinoId }, undefined, ctx);
    expect(players.length).toBe(2);
    // Captain should be first (ordered by isCaptain desc)
    expect(players[0]?.isCaptain).toBe(true);
    expect(players[0]?.name).toBe("DINO");
  });

  it("returns all player fields", async () => {
    const ctx = makeCtx();
    const [captain] = await resolvers.OsrsTeam.players({ id: teamDinoId }, undefined, ctx);
    expect(captain).toHaveProperty("id");
    expect(captain).toHaveProperty("name");
    expect(captain).toHaveProperty("isCaptain");
  });
});

// ── OsrsTeam.pickCount ────────────────────────────────────────────────────────

describe("OsrsTeam.pickCount", () => {
  it("returns 0 for a team with no picks", async () => {
    await db.delete(osrsTeamPicks);

    const ctx = makeCtx();
    const count = await resolvers.OsrsTeam.pickCount({ id: teamWesthamId }, undefined, ctx);
    expect(count).toBe(0);
  });

  it("counts only rank-1 picks for a team", async () => {
    await db.delete(osrsTeamPicks);

    // userId ranks DINO first
    const rankingsUser1 = teamIds.map((id, i) => ({ userId, teamId: id, rank: i + 1 }));
    await db.insert(osrsTeamPicks).values(rankingsUser1);

    // otherUserId also ranks DINO first
    const rankingsUser2 = teamIds.map((id, i) => ({
      userId: otherUserId,
      teamId: id,
      rank: i + 1,
    }));
    await db.insert(osrsTeamPicks).values(rankingsUser2);

    const ctx = makeCtx();
    const dinoPicks = await resolvers.OsrsTeam.pickCount({ id: teamDinoId }, undefined, ctx);
    expect(dinoPicks).toBe(2);

    // WESTHAM is ranked 2nd by both — pickCount should be 0
    const westhamPicks = await resolvers.OsrsTeam.pickCount({ id: teamWesthamId }, undefined, ctx);
    expect(westhamPicks).toBe(0);
  });
});
