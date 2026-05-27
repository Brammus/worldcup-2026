import { beforeAll, describe, expect, it } from "bun:test";
import { db } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import { matchResults, matches, picks, teams, users } from "../../db/schema";
import type { GraphQLContext } from "../resolvers";
import { resolvers } from "../resolvers";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<GraphQLContext> = {}): GraphQLContext {
  return { db, currentUser: null, responseHeaders: new Headers(), ...overrides };
}

const PAST = new Date(Date.now() - 60_000);

// ── setup ─────────────────────────────────────────────────────────────────────

let homeTeamId: string;
let awayTeamId: string;
let groupMatchId: string;
let knockoutMatchId: string;
let aliceId: string;
let bobId: string;
let charlieId: string;

beforeAll(async () => {
  await runMigrations();

  await db.delete(picks);
  await db.delete(matchResults);
  await db.delete(matches);
  await db.delete(users);
  await db.delete(teams);

  // teams
  const [home] = await db
    .insert(teams)
    .values({ name: "TeamHome", groupLetter: "A" })
    .returning({ id: teams.id });
  const [away] = await db
    .insert(teams)
    .values({ name: "TeamAway", groupLetter: "A" })
    .returning({ id: teams.id });
  homeTeamId = home?.id ?? "";
  awayTeamId = away?.id ?? "";

  // matches: groupMatch (round "group"), knockoutMatch (round "r32"), unpickedMatch (round "group")
  const [gm] = await db
    .insert(matches)
    .values({
      round: "group",
      matchday: 1,
      groupLetter: "A",
      homeTeamId,
      awayTeamId,
      homeTeamLabel: "TeamHome",
      awayTeamLabel: "TeamAway",
      venue: "Stadium",
      startsAt: PAST,
    })
    .returning({ id: matches.id });
  groupMatchId = gm?.id ?? "";

  const [km] = await db
    .insert(matches)
    .values({
      round: "r32",
      homeTeamId,
      awayTeamId,
      homeTeamLabel: "TeamHome",
      awayTeamLabel: "TeamAway",
      venue: "Stadium",
      startsAt: PAST,
    })
    .returning({ id: matches.id });
  knockoutMatchId = km?.id ?? "";

  // unpickedMatch — just insert, nobody picks it
  await db.insert(matches).values({
    round: "group",
    matchday: 2,
    groupLetter: "A",
    homeTeamId,
    awayTeamId,
    homeTeamLabel: "TeamHome",
    awayTeamLabel: "TeamAway",
    venue: "Stadium",
    startsAt: PAST,
  });

  // users
  const [a] = await db
    .insert(users)
    .values({ username: "alice", passwordHash: "x" })
    .returning({ id: users.id });
  const [b] = await db
    .insert(users)
    .values({ username: "bob", passwordHash: "x" })
    .returning({ id: users.id });
  const [c] = await db
    .insert(users)
    .values({ username: "charlie", passwordHash: "x" })
    .returning({ id: users.id });
  aliceId = a?.id ?? "";
  bobId = b?.id ?? "";
  charlieId = c?.id ?? "";

  // results: winner = homeTeamId for both matches
  await db.insert(matchResults).values({
    matchId: groupMatchId,
    winnerTeamId: homeTeamId,
    homeScore: 2,
    awayScore: 0,
  });
  await db.insert(matchResults).values({
    matchId: knockoutMatchId,
    winnerTeamId: homeTeamId,
    homeScore: 1,
    awayScore: 0,
  });

  // picks:
  // alice: correct pick on groupMatch (homeTeamId) → 2pts; correct pick on knockoutMatch (homeTeamId) → 3pts
  await db
    .insert(picks)
    .values({ userId: aliceId, matchId: groupMatchId, pickedTeamId: homeTeamId });
  await db
    .insert(picks)
    .values({ userId: aliceId, matchId: knockoutMatchId, pickedTeamId: homeTeamId });
  // bob: wrong pick on groupMatch (awayTeamId) → 0pts
  await db.insert(picks).values({ userId: bobId, matchId: groupMatchId, pickedTeamId: awayTeamId });
  // charlie: no picks
});

// ── Query.leaderboard ─────────────────────────────────────────────────────────

describe("Query.leaderboard", () => {
  it("returns entries sorted by totalPoints DESC then username ASC", async () => {
    const ctx = makeCtx();
    const entries = await resolvers.Query.leaderboard(undefined, undefined, ctx);

    expect(entries.length).toBe(3);
    expect(entries[0]?.user.username).toBe("alice");
    expect(entries[0]?.totalPoints).toBe(5);
    // bob and charlie both 0pts, sorted by username asc → bob before charlie
    expect(entries[1]?.user.username).toBe("bob");
    expect(entries[2]?.user.username).toBe("charlie");
  });

  it("uses dense ranking — tied users get same rank", async () => {
    const ctx = makeCtx();
    const entries = await resolvers.Query.leaderboard(undefined, undefined, ctx);

    expect(entries[0]?.rank).toBe(1); // alice
    expect(entries[1]?.rank).toBe(2); // bob — tied with charlie at 0pts
    expect(entries[2]?.rank).toBe(2); // charlie — same rank as bob
  });

  it("returns correct correctPicks per user", async () => {
    const ctx = makeCtx();
    const entries = await resolvers.Query.leaderboard(undefined, undefined, ctx);

    const alice = entries.find((e: { user: { username: string } }) => e.user.username === "alice");
    const bob = entries.find((e: { user: { username: string } }) => e.user.username === "bob");
    expect(alice?.correctPicks).toBe(2);
    expect(bob?.correctPicks).toBe(0);
  });

  it("returns correct totalPicks per user", async () => {
    const ctx = makeCtx();
    const entries = await resolvers.Query.leaderboard(undefined, undefined, ctx);

    const alice = entries.find((e: { user: { username: string } }) => e.user.username === "alice");
    const bob = entries.find((e: { user: { username: string } }) => e.user.username === "bob");
    const charlie = entries.find(
      (e: { user: { username: string } }) => e.user.username === "charlie",
    );
    expect(alice?.totalPicks).toBe(2);
    expect(bob?.totalPicks).toBe(1);
    expect(charlie?.totalPicks).toBe(0);
  });
});

// ── Query.userPicks ───────────────────────────────────────────────────────────

describe("Query.userPicks", () => {
  it("returns all picks for the specified userId", async () => {
    const ctx = makeCtx();
    const result = await resolvers.Query.userPicks(undefined, { userId: aliceId }, ctx);
    expect(result.length).toBe(2);
    expect(result.every((p: { userId: string }) => p.userId === aliceId)).toBe(true);
  });

  it("is accessible without authentication (currentUser: null)", async () => {
    const ctx = makeCtx({ currentUser: null });
    const result = await resolvers.Query.userPicks(undefined, { userId: bobId }, ctx);
    expect(result.length).toBe(1);
    expect(result[0]?.userId).toBe(bobId);
  });

  it("returns empty array for user with no picks", async () => {
    const ctx = makeCtx();
    const result = await resolvers.Query.userPicks(undefined, { userId: charlieId }, ctx);
    expect(result.length).toBe(0);
  });
});
