import { and, asc, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import type { DB } from "../../db/client";
import { matchResults, matches, picks, teams } from "../../db/schema";
import {
  type Standing,
  type StandingMatch,
  allocateThirds,
  compareStandings,
  computeStandings,
  parseEligibleGroups,
} from "../standings";
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

    // Re-run group → R32 propagation (1st/2nd of each group + best thirds) over
    // results that are already recorded. Idempotent; used to backfill brackets
    // whose results were entered before propagation existed. Returns the number
    // of R32 team slots that ended up filled.
    recomputeBracket: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.currentUser?.isAdmin) throw new GraphQLError("Forbidden");

      const groupMatches = await ctx.db.select().from(matches).where(eq(matches.round, "group"));
      const groupLetters = [...new Set(groupMatches.map((m) => m.groupLetter).filter(Boolean))];

      for (const letter of groupLetters) {
        await propagateGroupToR32(ctx.db, letter);
      }
      await propagateBestThirds(ctx.db);

      const r32 = await ctx.db.select().from(matches).where(eq(matches.round, "r32"));
      return r32.reduce((n, m) => n + (m.homeTeamId ? 1 : 0) + (m.awayTeamId ? 1 : 0), 0);
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
    // Once every group is complete, the eight best third-placed teams can be
    // slotted into their R32 matches.
    await propagateBestThirds(db);
  } else if (NEXT_ROUND[match.round]) {
    await propagateKnockout(db, match, winnerId);
  }
}

// Fetch the final standings for a single group, or null if it isn't finished
// (some match still has no recorded result).
async function groupStandings(db: DB, groupLetter: string): Promise<Standing[] | null> {
  const groupMatches = await db
    .select()
    .from(matches)
    .where(and(eq(matches.round, "group"), eq(matches.groupLetter, groupLetter)));

  if (groupMatches.length === 0) return null;

  const rows: StandingMatch[] = [];
  const names: Record<string, string> = {};

  for (const m of groupMatches) {
    const [r] = await db.select().from(matchResults).where(eq(matchResults.matchId, m.id));
    if (!r) return null; // group not complete
    rows.push({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });
    for (const id of [m.homeTeamId, m.awayTeamId]) {
      if (id && !(id in names)) {
        const [t] = await db.select().from(teams).where(eq(teams.id, id));
        names[id] = t?.name ?? "";
      }
    }
  }

  return computeStandings(rows, names);
}

async function propagateGroupToR32(db: DB, groupLetter: string | null) {
  if (!groupLetter) return;

  const standings = await groupStandings(db, groupLetter);
  if (!standings) return;

  const firstId = standings[0]?.teamId;
  const secondId = standings[1]?.teamId;

  const r32Matches = await db.select().from(matches).where(eq(matches.round, "r32"));
  const firstLabel = `1st Group ${groupLetter}`;
  const secondLabel = `2nd Group ${groupLetter}`;

  for (const r32 of r32Matches) {
    if (firstId) {
      if (r32.homeTeamLabel === firstLabel) {
        await db.update(matches).set({ homeTeamId: firstId }).where(eq(matches.id, r32.id));
      } else if (r32.awayTeamLabel === firstLabel) {
        await db.update(matches).set({ awayTeamId: firstId }).where(eq(matches.id, r32.id));
      }
    }
    if (secondId) {
      if (r32.homeTeamLabel === secondLabel) {
        await db.update(matches).set({ homeTeamId: secondId }).where(eq(matches.id, r32.id));
      } else if (r32.awayTeamLabel === secondLabel) {
        await db.update(matches).set({ awayTeamId: secondId }).where(eq(matches.id, r32.id));
      }
    }
  }
}

// Once all groups are finished, rank the twelve third-placed teams, keep the
// best eight, and slot them into the "Best 3rd (…)" R32 matches respecting each
// slot's eligible-group list.
async function propagateBestThirds(db: DB) {
  const r32Matches = await db
    .select()
    .from(matches)
    .where(eq(matches.round, "r32"))
    .orderBy(asc(matches.startsAt));

  // Slots are identified by a "Best 3rd (…)" label on either side.
  const slots = r32Matches
    .map((m) => {
      const side = m.homeTeamLabel.startsWith("Best 3rd")
        ? ("home" as const)
        : m.awayTeamLabel.startsWith("Best 3rd")
          ? ("away" as const)
          : null;
      if (!side) return null;
      const label = side === "home" ? m.homeTeamLabel : m.awayTeamLabel;
      return { id: m.id, side, eligible: parseEligibleGroups(label) };
    })
    .filter((s): s is { id: string; side: "home" | "away"; eligible: string[] } => s !== null);

  if (slots.length === 0) return;

  // Every group whose letter appears in any slot must be finished before we can
  // rank the thirds against each other.
  const groupLetters = [...new Set(slots.flatMap((s) => s.eligible))].sort();
  const thirds: (Standing & { group: string })[] = [];
  for (const letter of groupLetters) {
    const standings = await groupStandings(db, letter);
    if (!standings) return; // some group not finished yet
    const third = standings[2];
    if (third) thirds.push({ ...third, group: letter });
  }

  // Best eight thirds qualify.
  const qualified = thirds.sort(compareStandings).slice(0, 8);
  const groupToTeam: Record<string, string> = {};
  for (const t of qualified) groupToTeam[t.group] = t.teamId;

  const assignment = allocateThirds(
    slots.map((s) => ({ id: s.id, eligible: s.eligible })),
    qualified.map((t) => t.group),
  );
  if (!assignment) return;

  for (const slot of slots) {
    const group = assignment[slot.id];
    const teamId = group ? groupToTeam[group] : undefined;
    if (!teamId) continue;
    const set = slot.side === "home" ? { homeTeamId: teamId } : { awayTeamId: teamId };
    await db.update(matches).set(set).where(eq(matches.id, slot.id));
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
