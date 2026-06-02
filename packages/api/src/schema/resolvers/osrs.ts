import { eq, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { osrsPlayers, osrsTeamPicks, osrsTeams } from "../../db/schema";
import type { GraphQLContext } from "./context";

export const osrsResolvers = {
  Query: {
    osrsTeams: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      return ctx.db.select().from(osrsTeams).orderBy(osrsTeams.name);
    },
    myOsrsTeamPick: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.currentUser) return null;
      const [pick] = await ctx.db
        .select({ team: osrsTeams })
        .from(osrsTeamPicks)
        .innerJoin(osrsTeams, eq(osrsTeamPicks.teamId, osrsTeams.id))
        .where(eq(osrsTeamPicks.userId, ctx.currentUser.id));
      return pick?.team ?? null;
    },
  },
  Mutation: {
    pickOsrsTeam: async (_: unknown, { teamId }: { teamId: string }, ctx: GraphQLContext) => {
      if (!ctx.currentUser) throw new GraphQLError("Not authenticated");
      const [team] = await ctx.db.select().from(osrsTeams).where(eq(osrsTeams.id, teamId));
      if (!team) throw new GraphQLError("Team not found");
      await ctx.db
        .insert(osrsTeamPicks)
        .values({ userId: ctx.currentUser.id, teamId })
        .onConflictDoUpdate({
          target: [osrsTeamPicks.userId],
          set: { teamId },
        });
      return team;
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
      const [row] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(osrsTeamPicks)
        .where(eq(osrsTeamPicks.teamId, team.id));
      return row?.count ?? 0;
    },
  },
};
