import { and, eq, inArray, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { osrsPlayers, osrsTeamPicks, osrsTeams } from "../../db/schema";
import type { GraphQLContext } from "./context";

type OsrsRankingInput = { teamId: string; rank: number };

export const osrsResolvers = {
  Query: {
    osrsTeams: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      return ctx.db.select().from(osrsTeams).orderBy(osrsTeams.name);
    },
    myOsrsRanking: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.currentUser) return [];
      const rows = await ctx.db
        .select({ rank: osrsTeamPicks.rank, team: osrsTeams })
        .from(osrsTeamPicks)
        .innerJoin(osrsTeams, eq(osrsTeamPicks.teamId, osrsTeams.id))
        .where(eq(osrsTeamPicks.userId, ctx.currentUser.id))
        .orderBy(osrsTeamPicks.rank);
      return rows;
    },
  },
  Mutation: {
    rankOsrsTeams: async (
      _: unknown,
      { rankings }: { rankings: OsrsRankingInput[] },
      ctx: GraphQLContext,
    ) => {
      if (!ctx.currentUser) throw new GraphQLError("Not authenticated");
      if (rankings.length !== 6) throw new GraphQLError("Must rank all 6 teams");
      const ranks = rankings.map((r) => r.rank);
      if (new Set(ranks).size !== 6 || ranks.some((r) => r < 1 || r > 6)) {
        throw new GraphQLError("Rankings must be ranks 1-6 with no duplicates");
      }
      const teamIds = rankings.map((r) => r.teamId);
      if (new Set(teamIds).size !== 6) throw new GraphQLError("Each team must appear once");
      // Validate all team IDs exist
      const teams = await ctx.db.select().from(osrsTeams).where(inArray(osrsTeams.id, teamIds));
      if (teams.length !== 6) throw new GraphQLError("One or more teams not found");
      // Delete existing picks, insert new ones
      await ctx.db.delete(osrsTeamPicks).where(eq(osrsTeamPicks.userId, ctx.currentUser.id));
      await ctx.db
        .insert(osrsTeamPicks)
        .values(
          rankings.map((r) => ({ userId: ctx.currentUser!.id, teamId: r.teamId, rank: r.rank })),
        );
      // Return sorted result
      const teamMap = new Map(teams.map((t) => [t.id, t]));
      return rankings
        .sort((a, b) => a.rank - b.rank)
        .map((r) => ({ rank: r.rank, team: teamMap.get(r.teamId)! }));
    },
  },
  OsrsTeam: {
    players: async (team: { id: string }, _: unknown, ctx: GraphQLContext) => {
      return ctx.db
        .select()
        .from(osrsPlayers)
        .where(eq(osrsPlayers.teamId, team.id))
        .orderBy(sql`${osrsPlayers.isCaptain} desc`, osrsPlayers.name);
    },
    pickCount: async (team: { id: string }, _: unknown, ctx: GraphQLContext) => {
      // Count users who ranked this team first (rank = 1)
      const [row] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(osrsTeamPicks)
        .where(and(eq(osrsTeamPicks.teamId, team.id), eq(osrsTeamPicks.rank, 1)));
      return row?.count ?? 0;
    },
  },
};
