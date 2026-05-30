import { eq, inArray } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { matchResults, matches, picks, teams, users } from "../../db/schema";
import type { GraphQLContext } from "./context";

export const picksResolvers = {
  Query: {
    myPicks: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.currentUser) throw new GraphQLError("Not authenticated");
      return ctx.db.select().from(picks).where(eq(picks.userId, ctx.currentUser.id));
    },

    userPicks: async (_: unknown, { userId }: { userId: string }, ctx: GraphQLContext) => {
      return ctx.db.select().from(picks).where(eq(picks.userId, userId));
    },

    matchPicks: async (_: unknown, { matchId }: { matchId: string }, ctx: GraphQLContext) => {
      const [match] = await ctx.db.select().from(matches).where(eq(matches.id, matchId));
      if (!match) throw new GraphQLError("Match not found");
      if (match.startsAt > new Date()) {
        throw new GraphQLError("Match picks are not available until the match is locked");
      }

      const matchPickRows = await ctx.db.select().from(picks).where(eq(picks.matchId, matchId));
      if (matchPickRows.length === 0) return [];

      const userIds = [...new Set(matchPickRows.map((p) => p.userId))];
      const teamIds = [
        ...new Set(matchPickRows.flatMap((p) => (p.pickedTeamId ? [p.pickedTeamId] : []))),
      ];

      const [usersRows, teamsRows] = await Promise.all([
        ctx.db.select().from(users).where(inArray(users.id, userIds)),
        teamIds.length > 0
          ? ctx.db.select().from(teams).where(inArray(teams.id, teamIds))
          : Promise.resolve([]),
      ]);

      const userMap = new Map(usersRows.map((u) => [u.id, u]));
      const teamMap = new Map(teamsRows.map((t) => [t.id, t]));

      const result = [];
      for (const pick of matchPickRows) {
        const user = userMap.get(pick.userId);
        const team = pick.pickedTeamId ? (teamMap.get(pick.pickedTeamId) ?? null) : null;
        if (user) {
          result.push({
            user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
            pickedTeam: team,
          });
        }
      }
      return result;
    },
  },

  Mutation: {
    setPick: async (
      _: unknown,
      { matchId, teamId }: { matchId: string; teamId?: string | null },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.currentUser) throw new GraphQLError("Not authenticated");

      const [match] = await ctx.db.select().from(matches).where(eq(matches.id, matchId));
      if (!match) throw new GraphQLError("Match not found");
      if (match.startsAt <= new Date()) throw new GraphQLError("Match is locked");

      if (teamId == null) {
        if (match.round !== "group") {
          throw new GraphQLError("Draw picks are only allowed in group stage matches");
        }
      } else if (teamId !== match.homeTeamId && teamId !== match.awayTeamId) {
        throw new GraphQLError("Team is not part of this match");
      }

      const resolvedTeamId = teamId ?? null;
      const [pick] = await ctx.db
        .insert(picks)
        .values({ userId: ctx.currentUser.id, matchId, pickedTeamId: resolvedTeamId })
        .onConflictDoUpdate({
          target: [picks.userId, picks.matchId],
          set: { pickedTeamId: resolvedTeamId },
        })
        .returning();
      return pick;
    },
  },

  Pick: {
    match: async (pick: { matchId: string }, _: unknown, ctx: GraphQLContext) => {
      const [match] = await ctx.db.select().from(matches).where(eq(matches.id, pick.matchId));
      return match;
    },

    pickedTeam: async (pick: { pickedTeamId: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!pick.pickedTeamId) return null;
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, pick.pickedTeamId));
      return team ?? null;
    },

    points: async (
      pick: { matchId: string; pickedTeamId: string | null },
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
};
