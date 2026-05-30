import { and, asc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { DB } from "../../db/client";
import { matchResults, matches, picks, teams } from "../../db/schema";
import type { GraphQLContext } from "./context";

export const matchesResolvers = {
  Query: {
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
  },

  Mutation: {
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

      if (homeScore < 0 || awayScore < 0) {
        throw new GraphQLError("Scores must be non-negative");
      }

      await ctx.db
        .insert(matchResults)
        .values({ matchId, winnerTeamId: winnerId ?? null, homeScore, awayScore })
        .onConflictDoUpdate({
          target: [matchResults.matchId],
          set: { winnerTeamId: winnerId ?? null, homeScore, awayScore },
        });

      const [match] = await ctx.db.select().from(matches).where(eq(matches.id, matchId));
      if (!match) throw new GraphQLError("Match not found");

      await propagateBracket(ctx.db, match, winnerId ?? null);

      return match;
    },
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

  if (results.some((r) => r === null)) return;

  const teamStats: Record<string, { wins: number; goals: number; name: string }> = {};

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

  const sorted = Object.entries(teamStats).sort(([, a], [, b]) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.goals !== a.goals) return b.goals - a.goals;
    return a.name.localeCompare(b.name);
  });

  const firstId = sorted[0]?.[0];
  const secondId = sorted[1]?.[0];

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

  if (match.round === "sf") {
    const currentMatch = roundMatches[pos];
    if (!currentMatch) return;
    const loser =
      currentMatch.homeTeamId === winnerId ? currentMatch.awayTeamId : currentMatch.homeTeamId;
    if (!loser) return;

    const [thirdPlace] = await db.select().from(matches).where(eq(matches.round, "third_place"));
    if (!thirdPlace) return;

    if (pos === 0) {
      await db.update(matches).set({ homeTeamId: loser }).where(eq(matches.id, thirdPlace.id));
    } else {
      await db.update(matches).set({ awayTeamId: loser }).where(eq(matches.id, thirdPlace.id));
    }
  }
}
