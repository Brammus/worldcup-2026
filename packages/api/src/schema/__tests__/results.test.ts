import { beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import { matchResults, matches, picks, teams, users } from "../../db/schema";
import type { GraphQLContext } from "../resolvers";
import { resolvers } from "../resolvers";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<GraphQLContext> = {}): GraphQLContext {
  return { db, currentUser: null, responseHeaders: new Headers(), ip: "127.0.0.1", ...overrides };
}

const FUTURE = new Date(Date.now() + 3_600_000);

// ── setup ─────────────────────────────────────────────────────────────────────

let homeTeamId: string;
let awayTeamId: string;
let groupMatchId: string;
let adminUserId: string;
let regularUserId: string;

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
    .values({ name: "France", groupLetter: "A" })
    .returning({ id: teams.id });
  const [away] = await db
    .insert(teams)
    .values({ name: "Germany", groupLetter: "A" })
    .returning({ id: teams.id });
  homeTeamId = home?.id ?? "";
  awayTeamId = away?.id ?? "";

  // group match
  const [gm] = await db
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
  groupMatchId = gm?.id ?? "";

  // users
  const [admin] = await db
    .insert(users)
    .values({ username: "admin", passwordHash: "x", isAdmin: true })
    .returning({ id: users.id });
  const [regular] = await db
    .insert(users)
    .values({ username: "regular", passwordHash: "x", isAdmin: false })
    .returning({ id: users.id });
  adminUserId = admin?.id ?? "";
  regularUserId = regular?.id ?? "";
});

// ── Mutation.setResult ────────────────────────────────────────────────────────

describe("Mutation.setResult", () => {
  it("records result and returns the match", async () => {
    const ctx = makeCtx({
      currentUser: { id: adminUserId, username: "admin", isAdmin: true },
    });
    const result = await resolvers.Mutation.setResult(
      undefined,
      { matchId: groupMatchId, winnerId: homeTeamId, homeScore: 2, awayScore: 1 },
      ctx,
    );
    expect(result?.id).toBe(groupMatchId);
    // verify it was stored
    const [stored] = await db
      .select()
      .from(matchResults)
      .where(eq(matchResults.matchId, groupMatchId));
    expect(stored?.homeScore).toBe(2);
    expect(stored?.awayScore).toBe(1);
    expect(stored?.winnerTeamId).toBe(homeTeamId);
  });

  it("throws Forbidden when called by non-admin", async () => {
    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    await expect(
      resolvers.Mutation.setResult(
        undefined,
        { matchId: groupMatchId, winnerId: homeTeamId, homeScore: 1, awayScore: 0 },
        ctx,
      ),
    ).rejects.toThrow("Forbidden");
  });

  it("throws when not authenticated", async () => {
    const ctx = makeCtx({ currentUser: null });
    await expect(
      resolvers.Mutation.setResult(
        undefined,
        { matchId: groupMatchId, winnerId: homeTeamId, homeScore: 1, awayScore: 0 },
        ctx,
      ),
    ).rejects.toThrow("Forbidden");
  });

  it("throws for negative homeScore", async () => {
    const ctx = makeCtx({ currentUser: { id: adminUserId, username: "admin", isAdmin: true } });
    await expect(
      resolvers.Mutation.setResult(
        undefined,
        { matchId: groupMatchId, winnerId: homeTeamId, homeScore: -1, awayScore: 0 },
        ctx,
      ),
    ).rejects.toThrow("Scores must be non-negative");
  });

  it("throws for negative awayScore", async () => {
    const ctx = makeCtx({ currentUser: { id: adminUserId, username: "admin", isAdmin: true } });
    await expect(
      resolvers.Mutation.setResult(
        undefined,
        { matchId: groupMatchId, winnerId: homeTeamId, homeScore: 0, awayScore: -1 },
        ctx,
      ),
    ).rejects.toThrow("Scores must be non-negative");
  });
});

// ── User.isAdmin ──────────────────────────────────────────────────────────────

describe("User.isAdmin", () => {
  it("returns true for admin user", () => {
    const result = resolvers.User.isAdmin({ isAdmin: true });
    expect(result).toBe(true);
  });

  it("returns false for regular user", () => {
    const result = resolvers.User.isAdmin({ isAdmin: false });
    expect(result).toBe(false);
  });
});

// ── Pick.points ───────────────────────────────────────────────────────────────

describe("Pick.points", () => {
  it("returns null when no result", async () => {
    // Insert a fresh match with no result
    const [m] = await db
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
        startsAt: FUTURE,
      })
      .returning({ id: matches.id });
    const noResultMatchId = m?.id ?? "";

    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    const points = await resolvers.Pick.points(
      { matchId: noResultMatchId, pickedTeamId: homeTeamId },
      undefined,
      ctx,
    );
    expect(points).toBeNull();
  });

  it("returns 2 for correct group pick", async () => {
    // Use groupMatchId which now has a result (from setResult test above)
    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    const points = await resolvers.Pick.points(
      { matchId: groupMatchId, pickedTeamId: homeTeamId },
      undefined,
      ctx,
    );
    expect(points).toBe(2);
  });

  it("returns 3 for correct knockout pick", async () => {
    // Create a knockout match with a result
    const [km] = await db
      .insert(matches)
      .values({
        round: "r32",
        homeTeamId,
        awayTeamId,
        homeTeamLabel: "France",
        awayTeamLabel: "Germany",
        venue: "MetLife Stadium",
        startsAt: FUTURE,
      })
      .returning({ id: matches.id });
    const knockoutMatchId = km?.id ?? "";
    await db.insert(matchResults).values({
      matchId: knockoutMatchId,
      winnerTeamId: homeTeamId,
      homeScore: 2,
      awayScore: 1,
    });

    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    const points = await resolvers.Pick.points(
      { matchId: knockoutMatchId, pickedTeamId: homeTeamId },
      undefined,
      ctx,
    );
    expect(points).toBe(3);
  });

  it("returns 0 for wrong pick", async () => {
    // groupMatchId has result with winner = homeTeamId
    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    const points = await resolvers.Pick.points(
      { matchId: groupMatchId, pickedTeamId: awayTeamId },
      undefined,
      ctx,
    );
    expect(points).toBe(0);
  });

  it("returns 0 for draw (winnerId null)", async () => {
    const [dm] = await db
      .insert(matches)
      .values({
        round: "group",
        matchday: 3,
        groupLetter: "A",
        homeTeamId,
        awayTeamId,
        homeTeamLabel: "France",
        awayTeamLabel: "Germany",
        venue: "MetLife Stadium",
        startsAt: FUTURE,
      })
      .returning({ id: matches.id });
    const drawMatchId = dm?.id ?? "";
    await db.insert(matchResults).values({
      matchId: drawMatchId,
      winnerTeamId: null,
      homeScore: 1,
      awayScore: 1,
    });

    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    const points = await resolvers.Pick.points(
      { matchId: drawMatchId, pickedTeamId: homeTeamId },
      undefined,
      ctx,
    );
    expect(points).toBe(0);
  });
});

// ── MatchResult.winner ────────────────────────────────────────────────────────

describe("MatchResult.winner", () => {
  it("resolves the winner team", async () => {
    const ctx = makeCtx({
      currentUser: { id: adminUserId, username: "admin", isAdmin: true },
    });
    const winner = await resolvers.MatchResult.winner({ winnerTeamId: homeTeamId }, undefined, ctx);
    expect(winner?.id).toBe(homeTeamId);
    expect(winner?.name).toBe("France");
  });

  it("returns null for a draw", async () => {
    const ctx = makeCtx({
      currentUser: { id: adminUserId, username: "admin", isAdmin: true },
    });
    const winner = await resolvers.MatchResult.winner({ winnerTeamId: null }, undefined, ctx);
    expect(winner).toBeNull();
  });
});

// ── Bracket propagation: group → R32 ─────────────────────────────────────────

describe("Bracket propagation: group → R32", () => {
  it("sets homeTeamId on R32 match after all 3 group-A matches have results", async () => {
    // Clear previous data
    await db.delete(picks);
    await db.delete(matchResults);
    await db.delete(matches);
    await db.delete(teams);

    // Teams: France wins group A (most goals), Germany 2nd, Morocco last
    const [t1] = await db
      .insert(teams)
      .values({ name: "TeamAlpha", groupLetter: "A" })
      .returning({ id: teams.id });
    const [t2] = await db
      .insert(teams)
      .values({ name: "TeamBeta", groupLetter: "A" })
      .returning({ id: teams.id });
    const [t3] = await db
      .insert(teams)
      .values({ name: "TeamGamma", groupLetter: "A" })
      .returning({ id: teams.id });
    const team1 = t1?.id ?? "";
    const team2 = t2?.id ?? "";
    const team3 = t3?.id ?? "";

    // 3 group-A matches
    const [gm1] = await db
      .insert(matches)
      .values({
        round: "group",
        matchday: 1,
        groupLetter: "A",
        homeTeamId: team1,
        awayTeamId: team2,
        homeTeamLabel: "TeamAlpha",
        awayTeamLabel: "TeamBeta",
        venue: "Stadium",
        startsAt: FUTURE,
      })
      .returning({ id: matches.id });
    const [gm2] = await db
      .insert(matches)
      .values({
        round: "group",
        matchday: 2,
        groupLetter: "A",
        homeTeamId: team1,
        awayTeamId: team3,
        homeTeamLabel: "TeamAlpha",
        awayTeamLabel: "TeamGamma",
        venue: "Stadium",
        startsAt: FUTURE,
      })
      .returning({ id: matches.id });
    const [gm3] = await db
      .insert(matches)
      .values({
        round: "group",
        matchday: 3,
        groupLetter: "A",
        homeTeamId: team2,
        awayTeamId: team3,
        homeTeamLabel: "TeamBeta",
        awayTeamLabel: "TeamGamma",
        venue: "Stadium",
        startsAt: FUTURE,
      })
      .returning({ id: matches.id });
    const groupMatch1 = gm1?.id ?? "";
    const groupMatch2 = gm2?.id ?? "";
    const groupMatch3 = gm3?.id ?? "";

    // R32 match waiting for "1st Group A"
    const [r32m] = await db
      .insert(matches)
      .values({
        round: "r32",
        homeTeamLabel: "1st Group A",
        awayTeamLabel: "2nd Group B",
        venue: "Stadium",
        startsAt: FUTURE,
      })
      .returning({ id: matches.id });
    const r32MatchId = r32m?.id ?? "";

    const adminCtx = makeCtx({
      currentUser: { id: adminUserId, username: "admin", isAdmin: true },
    });

    // Record first 2 results — no propagation yet
    await resolvers.Mutation.setResult(
      undefined,
      { matchId: groupMatch1, winnerId: team1, homeScore: 2, awayScore: 0 },
      adminCtx,
    );
    await resolvers.Mutation.setResult(
      undefined,
      { matchId: groupMatch2, winnerId: team1, homeScore: 1, awayScore: 0 },
      adminCtx,
    );

    // R32 should still have null homeTeamId
    const [r32Before] = await db.select().from(matches).where(eq(matches.id, r32MatchId));
    expect(r32Before?.homeTeamId).toBeNull();

    // Record 3rd result — now propagation should fire
    // team2 beats team3 → standings: team1 (2W), team2 (1W), team3 (0W)
    await resolvers.Mutation.setResult(
      undefined,
      { matchId: groupMatch3, winnerId: team2, homeScore: 1, awayScore: 0 },
      adminCtx,
    );

    // 1st place = team1 → should be set on R32 homeTeamId
    const [r32After] = await db.select().from(matches).where(eq(matches.id, r32MatchId));
    expect(r32After?.homeTeamId).toBe(team1);
  });
});

// ── Bracket propagation: knockout → next round ────────────────────────────────

describe("Bracket propagation: knockout → next round", () => {
  it("sets winner teamId in R16 match after R32 result", async () => {
    // Clear previous data
    await db.delete(picks);
    await db.delete(matchResults);
    await db.delete(matches);
    await db.delete(teams);

    const [ta] = await db
      .insert(teams)
      .values({ name: "TeamA", groupLetter: "A" })
      .returning({ id: teams.id });
    const [tb] = await db
      .insert(teams)
      .values({ name: "TeamB", groupLetter: "B" })
      .returning({ id: teams.id });
    const teamA = ta?.id ?? "";
    const teamB = tb?.id ?? "";

    // Create 2 R32 matches at position 0 and 1
    const base = new Date(Date.now() + 3_600_000);
    const [r32a] = await db
      .insert(matches)
      .values({
        round: "r32",
        homeTeamId: teamA,
        awayTeamId: teamB,
        homeTeamLabel: "TeamA",
        awayTeamLabel: "TeamB",
        venue: "Stadium",
        startsAt: new Date(base.getTime()),
      })
      .returning({ id: matches.id });
    await db.insert(matches).values({
      round: "r32",
      homeTeamId: teamA,
      awayTeamId: teamB,
      homeTeamLabel: "TeamA",
      awayTeamLabel: "TeamB",
      venue: "Stadium",
      startsAt: new Date(base.getTime() + 1000),
    });
    const r32MatchId = r32a?.id ?? "";

    // Create R16 match at position 0 (receives winner of r32[0] and r32[1])
    const [r16m] = await db
      .insert(matches)
      .values({
        round: "r16",
        homeTeamLabel: "TBD",
        awayTeamLabel: "TBD",
        venue: "Stadium",
        startsAt: new Date(base.getTime() + 10_000),
      })
      .returning({ id: matches.id });
    const r16MatchId = r16m?.id ?? "";

    const adminCtx = makeCtx({
      currentUser: { id: adminUserId, username: "admin", isAdmin: true },
    });

    // Record result for R32 match at position 0 — teamA wins
    await resolvers.Mutation.setResult(
      undefined,
      { matchId: r32MatchId, winnerId: teamA, homeScore: 2, awayScore: 0 },
      adminCtx,
    );

    // R16 match at position 0 should have homeTeamId = teamA (pos 0 → nextPos 0, isHome = true)
    const [r16After] = await db.select().from(matches).where(eq(matches.id, r16MatchId));
    expect(r16After?.homeTeamId).toBe(teamA);
  });
});

// ── Bracket propagation: best third-placed teams ─────────────────────────────

describe("Mutation.recomputeBracket (best thirds)", () => {
  async function makeGroup(letter: string, prefix: string) {
    const [a] = await db
      .insert(teams)
      .values({ name: `${prefix}1`, groupLetter: letter })
      .returning({ id: teams.id });
    const [b] = await db
      .insert(teams)
      .values({ name: `${prefix}2`, groupLetter: letter })
      .returning({ id: teams.id });
    const [c] = await db
      .insert(teams)
      .values({ name: `${prefix}3`, groupLetter: letter })
      .returning({ id: teams.id });
    const ids = [a?.id ?? "", b?.id ?? "", c?.id ?? ""] as const;

    // a beats b and c, b beats c → a 1st, b 2nd, c 3rd
    const pairs: [string, string, number, number, string | null][] = [
      [ids[0], ids[1], 1, 0, ids[0]],
      [ids[0], ids[2], 1, 0, ids[0]],
      [ids[1], ids[2], 1, 0, ids[1]],
    ];
    for (const [home, away, hs, as, winner] of pairs) {
      const [m] = await db
        .insert(matches)
        .values({
          round: "group",
          groupLetter: letter,
          homeTeamId: home,
          awayTeamId: away,
          homeTeamLabel: "x",
          awayTeamLabel: "y",
          venue: "Stadium",
          startsAt: FUTURE,
        })
        .returning({ id: matches.id });
      await db
        .insert(matchResults)
        .values({ matchId: m?.id ?? "", winnerTeamId: winner, homeScore: hs, awayScore: as });
    }
    return ids;
  }

  it("fills Best 3rd slots from the qualifying third-placed teams", async () => {
    await db.delete(picks);
    await db.delete(matchResults);
    await db.delete(matches);
    await db.delete(teams);

    const groupA = await makeGroup("A", "Alpha");
    const groupB = await makeGroup("B", "Beta");

    // Two R32 slots, both eligible for the thirds of groups A and B
    const base = new Date(Date.now() + 3_600_000);
    const [s1] = await db
      .insert(matches)
      .values({
        round: "r32",
        homeTeamLabel: "1st Group A",
        awayTeamLabel: "Best 3rd (A/B)",
        venue: "Stadium",
        startsAt: new Date(base.getTime()),
      })
      .returning({ id: matches.id });
    const [s2] = await db
      .insert(matches)
      .values({
        round: "r32",
        homeTeamLabel: "1st Group B",
        awayTeamLabel: "Best 3rd (A/B)",
        venue: "Stadium",
        startsAt: new Date(base.getTime() + 1000),
      })
      .returning({ id: matches.id });

    const adminCtx = makeCtx({
      currentUser: { id: adminUserId, username: "admin", isAdmin: true },
    });
    const filled = await resolvers.Mutation.recomputeBracket(undefined, {}, adminCtx);

    const [slot1] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, s1?.id ?? ""));
    const [slot2] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, s2?.id ?? ""));

    // 1st-place teams propagated as well
    expect(slot1?.homeTeamId).toBe(groupA[0]);
    expect(slot2?.homeTeamId).toBe(groupB[0]);

    // Best-3rd away slots filled with the two groups' third-placed teams, distinct
    const thirdIds = [groupA[2], groupB[2]];
    expect(thirdIds).toContain(slot1?.awayTeamId ?? "");
    expect(thirdIds).toContain(slot2?.awayTeamId ?? "");
    expect(slot1?.awayTeamId).not.toBe(slot2?.awayTeamId);

    // 4 slots filled total (2 home + 2 away)
    expect(filled).toBe(4);
  });

  it("throws Forbidden for non-admins", async () => {
    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    await expect(resolvers.Mutation.recomputeBracket(undefined, {}, ctx)).rejects.toThrow(
      "Forbidden",
    );
  });

  it("previewBracket resolves names without writing to the DB", async () => {
    await db.delete(picks);
    await db.delete(matchResults);
    await db.delete(matches);
    await db.delete(teams);

    const groupA = await makeGroup("A", "Alpha");
    await makeGroup("B", "Beta");

    const [s1] = await db
      .insert(matches)
      .values({
        round: "r32",
        homeTeamLabel: "1st Group A",
        awayTeamLabel: "Best 3rd (A/B)",
        venue: "Stadium",
        startsAt: new Date(Date.now() + 3_600_000),
      })
      .returning({ id: matches.id });

    const adminCtx = makeCtx({
      currentUser: { id: adminUserId, username: "admin", isAdmin: true },
    });
    const preview = await resolvers.Query.previewBracket(undefined, {}, adminCtx);

    const slot = preview.find((p) => p.matchId === s1?.id);
    expect(slot?.homeName).toBe("Alpha1"); // 1st of group A
    expect(slot?.awayName).toBe("Alpha3"); // best third (A before B on name tiebreak)

    // Nothing was written — the slot's team ids are still null
    const [row] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, s1?.id ?? ""));
    expect(row?.homeTeamId).toBeNull();
    expect(row?.awayTeamId).toBeNull();
    expect(groupA[0]).toBeTruthy();
  });

  it("previewBracket throws Forbidden for non-admins", async () => {
    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    await expect(resolvers.Query.previewBracket(undefined, {}, ctx)).rejects.toThrow("Forbidden");
  });
});

describe("Mutation.setMatchTeams", () => {
  it("sets both teams on a knockout match", async () => {
    await db.delete(picks);
    await db.delete(matchResults);
    await db.delete(matches);
    await db.delete(teams);

    const [a] = await db
      .insert(teams)
      .values({ name: "Brazil", groupLetter: "C" })
      .returning({ id: teams.id });
    const [b] = await db
      .insert(teams)
      .values({ name: "Japan", groupLetter: "E" })
      .returning({ id: teams.id });
    const [m] = await db
      .insert(matches)
      .values({
        round: "r32",
        homeTeamLabel: "1st Group C",
        awayTeamLabel: "2nd Group F",
        venue: "Stadium",
        startsAt: FUTURE,
      })
      .returning({ id: matches.id });

    const adminCtx = makeCtx({
      currentUser: { id: adminUserId, username: "admin", isAdmin: true },
    });
    await resolvers.Mutation.setMatchTeams(
      undefined,
      { matchId: m?.id ?? "", homeTeamId: a?.id ?? "", awayTeamId: b?.id ?? "" },
      adminCtx,
    );

    const [row] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, m?.id ?? ""));
    expect(row?.homeTeamId).toBe(a?.id ?? "");
    expect(row?.awayTeamId).toBe(b?.id ?? "");

    // Clearing a side is allowed
    await resolvers.Mutation.setMatchTeams(
      undefined,
      { matchId: m?.id ?? "", homeTeamId: a?.id ?? "", awayTeamId: null },
      adminCtx,
    );
    const [cleared] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, m?.id ?? ""));
    expect(cleared?.awayTeamId).toBeNull();
  });

  it("throws Forbidden for non-admins", async () => {
    const ctx = makeCtx({
      currentUser: { id: regularUserId, username: "regular", isAdmin: false },
    });
    await expect(
      resolvers.Mutation.setMatchTeams(undefined, { matchId: "x" }, ctx),
    ).rejects.toThrow("Forbidden");
  });
});
