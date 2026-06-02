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

  // Insert OSRS teams
  const [dino] = await db
    .insert(osrsTeams)
    .values({ name: "DINO", color: "#2c2c3e" })
    .returning({ id: osrsTeams.id });
  const [westham] = await db
    .insert(osrsTeams)
    .values({ name: "WESTHAM", color: "#2d7a2d" })
    .returning({ id: osrsTeams.id });
  teamDinoId = dino?.id ?? "";
  teamWesthamId = westham?.id ?? "";

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
    expect(result.length).toBeGreaterThanOrEqual(2);
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

// ── Query.myOsrsTeamPick ──────────────────────────────────────────────────────

describe("Query.myOsrsTeamPick", () => {
  it("returns null when unauthenticated", async () => {
    const ctx = makeCtx({ currentUser: null });
    const result = await resolvers.Query.myOsrsTeamPick(undefined, undefined, ctx);
    expect(result).toBeNull();
  });

  it("returns null when user has no pick", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    const result = await resolvers.Query.myOsrsTeamPick(undefined, undefined, ctx);
    expect(result).toBeNull();
  });

  it("returns the picked team after making a pick", async () => {
    // Make a pick first
    await db.insert(osrsTeamPicks).values({ userId, teamId: teamDinoId });

    const ctx = makeCtx({ currentUser: { id: userId, username: "alice_osrs", isAdmin: false } });
    const result = await resolvers.Query.myOsrsTeamPick(undefined, undefined, ctx);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(teamDinoId);
    expect(result?.name).toBe("DINO");
  });
});

// ── Mutation.pickOsrsTeam ─────────────────────────────────────────────────────

describe("Mutation.pickOsrsTeam", () => {
  it("throws when unauthenticated", async () => {
    const ctx = makeCtx({ currentUser: null });
    await expect(
      resolvers.Mutation.pickOsrsTeam(undefined, { teamId: teamDinoId }, ctx),
    ).rejects.toThrow("Not authenticated");
  });

  it("throws when team does not exist", async () => {
    const ctx = makeCtx({
      currentUser: { id: userId, username: "alice_osrs", isAdmin: false },
    });
    await expect(
      resolvers.Mutation.pickOsrsTeam(
        undefined,
        { teamId: "00000000-0000-0000-0000-000000000000" },
        ctx,
      ),
    ).rejects.toThrow("Team not found");
  });

  it("stores a pick and returns the team", async () => {
    const ctx = makeCtx({
      currentUser: { id: otherUserId, username: "bob_osrs", isAdmin: false },
    });
    const result = await resolvers.Mutation.pickOsrsTeam(undefined, { teamId: teamWesthamId }, ctx);
    expect(result?.id).toBe(teamWesthamId);
    expect(result?.name).toBe("WESTHAM");
  });

  it("upserts — changing pick replaces the previous one", async () => {
    const ctx = makeCtx({
      currentUser: { id: otherUserId, username: "bob_osrs", isAdmin: false },
    });
    // First pick WESTHAM (from previous test or fresh)
    await resolvers.Mutation.pickOsrsTeam(undefined, { teamId: teamWesthamId }, ctx);
    // Now pick DINO
    const result = await resolvers.Mutation.pickOsrsTeam(undefined, { teamId: teamDinoId }, ctx);
    expect(result?.id).toBe(teamDinoId);

    // Verify only one pick for this user
    const userPicks = await db
      .select()
      .from(osrsTeamPicks)
      .where(eq(osrsTeamPicks.userId, otherUserId));
    expect(userPicks.length).toBe(1);
    expect(userPicks[0]?.teamId).toBe(teamDinoId);
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
    // Clean up any existing picks for WESTHAM related test user
    await db.delete(osrsTeamPicks);

    const ctx = makeCtx();
    const count = await resolvers.OsrsTeam.pickCount({ id: teamWesthamId }, undefined, ctx);
    expect(count).toBe(0);
  });

  it("counts picks for a team", async () => {
    // Insert two picks for DINO
    await db.insert(osrsTeamPicks).values([
      { userId, teamId: teamDinoId },
      { userId: otherUserId, teamId: teamDinoId },
    ]);

    const ctx = makeCtx();
    const count = await resolvers.OsrsTeam.pickCount({ id: teamDinoId }, undefined, ctx);
    expect(count).toBe(2);
  });
});
