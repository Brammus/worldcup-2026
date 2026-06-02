import { beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import { matchResults, matches, osrsTeamPicks, picks, teams, users } from "../../db/schema";
import type { GraphQLContext } from "../resolvers";
import { resolvers } from "../resolvers";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<GraphQLContext> = {}): GraphQLContext {
  return { db, currentUser: null, responseHeaders: new Headers(), ip: "127.0.0.1", ...overrides };
}

const PAST = new Date(Date.now() - 60_000);
const FUTURE = new Date(Date.now() + 3_600_000);

// ── setup ─────────────────────────────────────────────────────────────────────

let homeTeamId: string;
let awayTeamId: string;
let openMatchId: string;
let lockedMatchId: string;
let knockoutMatchId: string;
let userId: string;
let otherUserId: string;

beforeAll(async () => {
  await runMigrations();

  await db.delete(picks);
  await db.delete(matchResults);
  await db.delete(matches);
  await db.delete(osrsTeamPicks);
  await db.delete(users);
  await db.delete(teams);

  // teams
  const [home] = await db
    .insert(teams)
    .values({ name: "France", groupLetter: "A" })
    .returning({ id: teams.id });
  const [away] = await db
    .insert(teams)
    .values({ name: "Germany", groupLetter: "A" })
    .returning({ id: teams.id });
  homeTeamId = home?.id ?? "";
  awayTeamId = away?.id ?? "";

  // matches
  const [open] = await db
    .insert(matches)
    .values({
      round: "group",
      matchday: 1,
      groupLetter: "A",
      homeTeamId,
      awayTeamId,
      homeTeamLabel: "France",
      awayTeamLabel: "Germany",
      venue: "MetLife Stadium",
      startsAt: FUTURE,
    })
    .returning({ id: matches.id });
  openMatchId = open?.id ?? "";

  const [locked] = await db
    .insert(matches)
    .values({
      round: "group",
      matchday: 2,
      groupLetter: "A",
      homeTeamId,
      awayTeamId,
      homeTeamLabel: "France",
      awayTeamLabel: "Germany",
      venue: "MetLife Stadium",
      startsAt: PAST,
    })
    .returning({ id: matches.id });
  lockedMatchId = locked?.id ?? "";

  const [knockout] = await db
    .insert(matches)
    .values({
      round: "r16",
      homeTeamId,
      awayTeamId,
      homeTeamLabel: "France",
      awayTeamLabel: "Germany",
      venue: "MetLife Stadium",
      startsAt: FUTURE,
    })
    .returning({ id: matches.id });
  knockoutMatchId = knockout?.id ?? "";

  // users
  const [u1] = await db
    .insert(users)
    .values({ username: "alice", passwordHash: "x" })
    .returning({ id: users.id });
  const [u2] = await db
    .insert(users)
    .values({ username: "bob", passwordHash: "x" })
    .returning({ id: users.id });
  userId = u1?.id ?? "";
  otherUserId = u2?.id ?? "";
});

// ── Mutation.setPick ──────────────────────────────────────────────────────────

describe("Mutation.setPick", () => {
  it("stores a pick for the current user", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    const result = await resolvers.Mutation.setPick(
      undefined,
      { matchId: openMatchId, teamId: homeTeamId },
      ctx,
    );
    expect(result?.pickedTeamId).toBe(homeTeamId);
    expect(result?.matchId).toBe(openMatchId);
    expect(result?.userId).toBe(userId);
  });

  it("upserts — calling twice replaces the first pick", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    await resolvers.Mutation.setPick(undefined, { matchId: openMatchId, teamId: homeTeamId }, ctx);
    const result = await resolvers.Mutation.setPick(
      undefined,
      { matchId: openMatchId, teamId: awayTeamId },
      ctx,
    );
    expect(result?.pickedTeamId).toBe(awayTeamId);

    const allPicks = await db.select().from(picks).where(eq(picks.matchId, openMatchId));
    const userPicks = allPicks.filter((p) => p.userId === userId);
    expect(userPicks.length).toBe(1);
  });

  it("throws when match is locked", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    await expect(
      resolvers.Mutation.setPick(undefined, { matchId: lockedMatchId, teamId: homeTeamId }, ctx),
    ).rejects.toThrow("Match is locked");
  });

  it("throws when unauthenticated", async () => {
    const ctx = makeCtx({ currentUser: null });
    await expect(
      resolvers.Mutation.setPick(undefined, { matchId: openMatchId, teamId: homeTeamId }, ctx),
    ).rejects.toThrow("Not authenticated");
  });

  it("throws when teamId does not belong to the match", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    const foreignTeamId = "00000000-0000-0000-0000-000000000000";
    await expect(
      resolvers.Mutation.setPick(undefined, { matchId: openMatchId, teamId: foreignTeamId }, ctx),
    ).rejects.toThrow("Team is not part of this match");
  });

  it("stores a draw pick (null teamId) for a group stage match", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    const result = await resolvers.Mutation.setPick(
      undefined,
      { matchId: openMatchId, teamId: null },
      ctx,
    );
    expect(result?.pickedTeamId).toBeNull();
    expect(result?.matchId).toBe(openMatchId);
  });

  it("upserts draw pick — replaces a previous team pick with draw", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    await resolvers.Mutation.setPick(undefined, { matchId: openMatchId, teamId: homeTeamId }, ctx);
    const result = await resolvers.Mutation.setPick(
      undefined,
      { matchId: openMatchId, teamId: null },
      ctx,
    );
    expect(result?.pickedTeamId).toBeNull();

    const allPicks = await db.select().from(picks).where(eq(picks.matchId, openMatchId));
    const userPicks = allPicks.filter((p) => p.userId === userId);
    expect(userPicks.length).toBe(1);
  });

  it("throws when picking draw on a knockout match", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    await expect(
      resolvers.Mutation.setPick(undefined, { matchId: knockoutMatchId, teamId: null }, ctx),
    ).rejects.toThrow("Draw picks are only allowed in group stage matches");
  });
});

// ── Query.myPicks ─────────────────────────────────────────────────────────────

describe("Query.myPicks", () => {
  it("returns only the current user's picks", async () => {
    // give otherUser a pick too
    await db
      .insert(picks)
      .values({ userId: otherUserId, matchId: openMatchId, pickedTeamId: awayTeamId })
      .onConflictDoUpdate({
        target: [picks.userId, picks.matchId],
        set: { pickedTeamId: awayTeamId },
      });

    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    const result = await resolvers.Query.myPicks(undefined, undefined, ctx);
    expect(result.every((p: { userId: string }) => p.userId === userId)).toBe(true);
  });

  it("throws when unauthenticated", async () => {
    await expect(
      resolvers.Query.myPicks(undefined, undefined, makeCtx({ currentUser: null })),
    ).rejects.toThrow("Not authenticated");
  });
});

// ── Match field resolvers ─────────────────────────────────────────────────────

describe("Match.isLocked", () => {
  it("is true when startsAt is in the past", () => {
    const result = resolvers.Match.isLocked({ startsAt: PAST });
    expect(result).toBe(true);
  });

  it("is false when startsAt is in the future", () => {
    const result = resolvers.Match.isLocked({ startsAt: FUTURE });
    expect(result).toBe(false);
  });
});

describe("Match.myPick", () => {
  it("returns the pick for the current user", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    const result = await resolvers.Match.myPick({ id: openMatchId }, undefined, ctx);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(userId);
  });

  it("returns null when user has no pick for this match", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });
    const result = await resolvers.Match.myPick({ id: lockedMatchId }, undefined, ctx);
    expect(result).toBeNull();
  });

  it("returns null when unauthenticated", async () => {
    const result = await resolvers.Match.myPick(
      { id: openMatchId },
      undefined,
      makeCtx({ currentUser: null }),
    );
    expect(result).toBeNull();
  });
});

// ── Pick.points with draw picks ───────────────────────────────────────────────

describe("Pick.points — draw picks", () => {
  it("awards 2 points when a draw pick matches a draw result", async () => {
    const ctx = makeCtx({ currentUser: { id: userId, username: "alice", isAdmin: false } });

    // Record a draw result on the open match
    await db
      .insert(matchResults)
      .values({ matchId: openMatchId, winnerTeamId: null, homeScore: 1, awayScore: 1 })
      .onConflictDoUpdate({
        target: [matchResults.matchId],
        set: { winnerTeamId: null, homeScore: 1, awayScore: 1 },
      });

    // Store a draw pick
    await resolvers.Mutation.setPick(undefined, { matchId: openMatchId, teamId: null }, ctx);

    const points = await resolvers.Pick.points(
      { matchId: openMatchId, pickedTeamId: null },
      undefined,
      makeCtx(),
    );
    expect(points).toBe(2);
  });

  it("awards 0 points when a draw pick does not match a winning result", async () => {
    // Result has a winner (not a draw)
    await db
      .insert(matchResults)
      .values({ matchId: openMatchId, winnerTeamId: homeTeamId, homeScore: 2, awayScore: 0 })
      .onConflictDoUpdate({
        target: [matchResults.matchId],
        set: { winnerTeamId: homeTeamId, homeScore: 2, awayScore: 0 },
      });

    const points = await resolvers.Pick.points(
      { matchId: openMatchId, pickedTeamId: null },
      undefined,
      makeCtx(),
    );
    expect(points).toBe(0);
  });

  it("awards 0 points when a team pick does not match a draw result", async () => {
    // Result is a draw
    await db
      .insert(matchResults)
      .values({ matchId: openMatchId, winnerTeamId: null, homeScore: 0, awayScore: 0 })
      .onConflictDoUpdate({
        target: [matchResults.matchId],
        set: { winnerTeamId: null, homeScore: 0, awayScore: 0 },
      });

    const points = await resolvers.Pick.points(
      { matchId: openMatchId, pickedTeamId: homeTeamId },
      undefined,
      makeCtx(),
    );
    expect(points).toBe(0);
  });
});
