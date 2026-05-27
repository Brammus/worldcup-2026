import { and, asc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { buildAuthCookie, clearAuthCookie } from "../auth/cookies";
import { signToken } from "../auth/jwt";
import type { DB } from "../db/client";
import { matchResults, matches, picks, teams, users } from "../db/schema";

export type CurrentUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export type GraphQLContext = {
  db: DB;
  currentUser: CurrentUser | null;
  responseHeaders: Headers;
};

export const resolvers = {
  Query: {
    me: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.currentUser ?? null,

    teams: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      return ctx.db.select().from(teams);
    },

    team: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, id));
      return team ?? null;
    },

    matches: async (
      _: unknown,
      { round, group }: { round?: string; group?: string },
      ctx: GraphQLContext,
    ) => {
      const conditions = [];
      if (round) conditions.push(eq(matches.round, round));
      if (group) conditions.push(eq(matches.groupLetter, group));

      return conditions.length > 0
        ? ctx.db
            .select()
            .from(matches)
            .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : ctx.db.select().from(matches);
    },

    myPicks: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.currentUser) throw new GraphQLError("Not authenticated");
      return ctx.db.select().from(picks).where(eq(picks.userId, ctx.currentUser.id));
    },
  },

  Mutation: {
    register: async (
      _: unknown,
      { username, password }: { username: string; password: string },
      ctx: GraphQLContext,
    ) => {
      const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });

      try {
        const inserted = await ctx.db
          .insert(users)
          .values({ username, passwordHash })
          .returning({ id: users.id, username: users.username });
        const user = inserted[0];
        if (!user) throw new GraphQLError("Failed to create user");

        const token = await signToken(user.id);
        ctx.responseHeaders.set("Set-Cookie", buildAuthCookie(token));
        return { user };
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes("unique")) {
          throw new GraphQLError("Username already taken");
        }
        throw err;
      }
    },

    login: async (
      _: unknown,
      { username, password }: { username: string; password: string },
      ctx: GraphQLContext,
    ) => {
      const [user] = await ctx.db.select().from(users).where(eq(users.username, username));

      if (!user) throw new GraphQLError("Invalid credentials");

      const valid = await Bun.password.verify(password, user.passwordHash);
      if (!valid) throw new GraphQLError("Invalid credentials");

      const token = await signToken(user.id);
      ctx.responseHeaders.set("Set-Cookie", buildAuthCookie(token));
      return { user: { id: user.id, username: user.username } };
    },

    logout: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      ctx.responseHeaders.set("Set-Cookie", clearAuthCookie());
      return true;
    },

    setPick: async (
      _: unknown,
      { matchId, teamId }: { matchId: string; teamId: string },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.currentUser) throw new GraphQLError("Not authenticated");

      const [match] = await ctx.db.select().from(matches).where(eq(matches.id, matchId));
      if (!match) throw new GraphQLError("Match not found");
      if (match.startsAt <= new Date()) throw new GraphQLError("Match is locked");

      const [pick] = await ctx.db
        .insert(picks)
        .values({ userId: ctx.currentUser.id, matchId, pickedTeamId: teamId })
        .onConflictDoUpdate({
          target: [picks.userId, picks.matchId],
          set: { pickedTeamId: teamId },
        })
        .returning();
      return pick;
    },

    setResult: async (
      _: unknown,
      {
        matchId,
        winnerId,
        homeScore,
        awayScore,
      }: { matchId: string; winnerId?: string | null; homeScore: number; awayScore: number },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.currentUser?.isAdmin) throw new GraphQLError("Forbidden");

      await ctx.db
        .insert(matchResults)
        .values({ matchId, winnerTeamId: winnerId ?? null, homeScore, awayScore })
        .onConflictDoUpdate({
          target: [matchResults.matchId],
          set: { winnerTeamId: winnerId ?? null, homeScore, awayScore },
        });

      const [match] = await ctx.db.select().from(matches).where(eq(matches.id, matchId));
      if (!match) throw new GraphQLError("Match not found");

      // Bracket propagation
      await propagateBracket(ctx.db, match, winnerId ?? null);

      return match;
    },
  },

  Team: {
    group: (team: { groupLetter: string }) => team.groupLetter,
  },

  Match: {
    group: (match: { groupLetter: string | null }) => match.groupLetter,

    homeTeam: async (match: { homeTeamId: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!match.homeTeamId) return null;
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, match.homeTeamId));
      return team ?? null;
    },

    awayTeam: async (match: { awayTeamId: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!match.awayTeamId) return null;
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, match.awayTeamId));
      return team ?? null;
    },

    startsAt: (match: { startsAt: Date }) => match.startsAt.toISOString(),

    isLocked: (match: { startsAt: Date }) => match.startsAt <= new Date(),

    myPick: async (match: { id: string }, _: unknown, ctx: GraphQLContext) => {
      if (!ctx.currentUser) return null;
      const [pick] = await ctx.db
        .select()
        .from(picks)
        .where(and(eq(picks.matchId, match.id), eq(picks.userId, ctx.currentUser.id)));
      return pick ?? null;
    },

    result: async (match: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const [result] = await ctx.db
        .select()
        .from(matchResults)
        .where(eq(matchResults.matchId, match.id));
      return result ?? null;
    },
  },

  Pick: {
    match: async (pick: { matchId: string }, _: unknown, ctx: GraphQLContext) => {
      const [match] = await ctx.db.select().from(matches).where(eq(matches.id, pick.matchId));
      return match;
    },

    pickedTeam: async (pick: { pickedTeamId: string }, _: unknown, ctx: GraphQLContext) => {
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, pick.pickedTeamId));
      return team;
    },

    points: async (
      pick: { matchId: string; pickedTeamId: string },
      _: unknown,
      ctx: GraphQLContext,
    ) => {
      const [result] = await ctx.db
        .select()
        .from(matchResults)
        .where(eq(matchResults.matchId, pick.matchId));
      if (!result) return null;

      if (result.winnerTeamId !== pick.pickedTeamId) return 0;

      const [match] = await ctx.db.select().from(matches).where(eq(matches.id, pick.matchId));
      if (!match) return 0;

      const isKnockout = match.round !== "group";
      return isKnockout ? 3 : 2;
    },
  },

  User: {
    isAdmin: (user: { isAdmin: boolean }) => user.isAdmin,
  },

  MatchResult: {
    winner: async (result: { winnerTeamId: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!result.winnerTeamId) return null;
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, result.winnerTeamId));
      return team ?? null;
    },
  },
};

// ── Bracket propagation ───────────────────────────────────────────────────────

const NEXT_ROUND: Record<string, string> = {
  r32: "r16",
  r16: "qf",
  qf: "sf",
  sf: "final",
};

async function propagateBracket(
  db: DB,
  match: {
    id: string;
    round: string;
    groupLetter: string | null;
    homeTeamId: string | null;
    awayTeamId: string | null;
  },
  winnerId: string | null,
) {
  if (match.round === "group") {
    await propagateGroupToR32(db, match.groupLetter);
  } else if (NEXT_ROUND[match.round]) {
    await propagateKnockout(db, match, winnerId);
  }
}

async function propagateGroupToR32(db: DB, groupLetter: string | null) {
  if (!groupLetter) return;

  // Check if all 3 group matches for this group have results
  const groupMatches = await db
    .select()
    .from(matches)
    .where(and(eq(matches.round, "group"), eq(matches.groupLetter, groupLetter)));

  if (groupMatches.length < 3) return;

  const results = await Promise.all(
    groupMatches.map(async (m) => {
      const [r] = await db.select().from(matchResults).where(eq(matchResults.matchId, m.id));
      return r ?? null;
    }),
  );

  if (results.some((r) => r === null)) return; // not all results recorded yet

  // Build standings: wins and total goals per team
  const teamStats: Record<string, { wins: number; goals: number; name: string }> = {};

  // Collect all team IDs in this group
  for (const m of groupMatches) {
    if (m.homeTeamId && !teamStats[m.homeTeamId]) {
      const [t] = await db.select().from(teams).where(eq(teams.id, m.homeTeamId));
      teamStats[m.homeTeamId] = { wins: 0, goals: 0, name: t?.name ?? "" };
    }
    if (m.awayTeamId && !teamStats[m.awayTeamId]) {
      const [t] = await db.select().from(teams).where(eq(teams.id, m.awayTeamId));
      teamStats[m.awayTeamId] = { wins: 0, goals: 0, name: t?.name ?? "" };
    }
  }

  for (let i = 0; i < groupMatches.length; i++) {
    const m = groupMatches[i];
    const r = results[i];
    if (!r || !m) continue;

    const homeStat = m.homeTeamId ? teamStats[m.homeTeamId] : undefined;
    if (homeStat) homeStat.goals += r.homeScore;

    const awayStat = m.awayTeamId ? teamStats[m.awayTeamId] : undefined;
    if (awayStat) awayStat.goals += r.awayScore;

    const winnerStat = r.winnerTeamId ? teamStats[r.winnerTeamId] : undefined;
    if (winnerStat) winnerStat.wins += 1;
  }

  // Sort: most wins, then most goals, then alphabetical by name
  const sorted = Object.entries(teamStats).sort(([, a], [, b]) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.goals !== a.goals) return b.goals - a.goals;
    return a.name.localeCompare(b.name);
  });

  const firstId = sorted[0]?.[0];
  const secondId = sorted[1]?.[0];

  // Find R32 matches with labels referencing this group and update teamIds
  const r32Matches = await db.select().from(matches).where(eq(matches.round, "r32"));

  for (const r32 of r32Matches) {
    const homeLabel = `1st Group ${groupLetter}`;
    const awayLabel = `1st Group ${groupLetter}`;
    const homeLabel2nd = `2nd Group ${groupLetter}`;
    const awayLabel2nd = `2nd Group ${groupLetter}`;

    if (r32.homeTeamLabel === homeLabel && firstId) {
      await db.update(matches).set({ homeTeamId: firstId }).where(eq(matches.id, r32.id));
    } else if (r32.awayTeamLabel === awayLabel && firstId) {
      await db.update(matches).set({ awayTeamId: firstId }).where(eq(matches.id, r32.id));
    }

    if (r32.homeTeamLabel === homeLabel2nd && secondId) {
      await db.update(matches).set({ homeTeamId: secondId }).where(eq(matches.id, r32.id));
    } else if (r32.awayTeamLabel === awayLabel2nd && secondId) {
      await db.update(matches).set({ awayTeamId: secondId }).where(eq(matches.id, r32.id));
    }
  }
}

async function propagateKnockout(
  db: DB,
  match: { id: string; round: string },
  winnerId: string | null,
) {
  if (!winnerId) return;

  const nextRound = NEXT_ROUND[match.round];
  if (!nextRound) return;

  // Get all matches for this round ordered by startsAt
  const roundMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.round, match.round))
    .orderBy(asc(matches.startsAt));

  const pos = roundMatches.findIndex((m) => m.id === match.id);
  if (pos === -1) return;

  const nextPos = Math.floor(pos / 2);
  const isHome = pos % 2 === 0;

  const nextRoundMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.round, nextRound))
    .orderBy(asc(matches.startsAt));

  const nextMatch = nextRoundMatches[nextPos];
  if (!nextMatch) return;

  if (isHome) {
    await db.update(matches).set({ homeTeamId: winnerId }).where(eq(matches.id, nextMatch.id));
  } else {
    await db.update(matches).set({ awayTeamId: winnerId }).where(eq(matches.id, nextMatch.id));
  }

  // For SF: also set loser into third_place match
  if (match.round === "sf") {
    const sfMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.round, "sf"))
      .orderBy(asc(matches.startsAt));

    const sfMatch = sfMatches[pos];
    if (!sfMatch) return;

    // Determine loser
    const currentMatch = roundMatches[pos];
    if (!currentMatch) return;
    const loser =
      currentMatch.homeTeamId === winnerId ? currentMatch.awayTeamId : currentMatch.homeTeamId;
    if (!loser) return;

    const [thirdPlace] = await db.select().from(matches).where(eq(matches.round, "third_place"));
    if (!thirdPlace) return;

    // sf[0] loser → third_place home, sf[1] loser → third_place away
    if (pos === 0) {
      await db.update(matches).set({ homeTeamId: loser }).where(eq(matches.id, thirdPlace.id));
    } else {
      await db.update(matches).set({ awayTeamId: loser }).where(eq(matches.id, thirdPlace.id));
    }
  }
}
