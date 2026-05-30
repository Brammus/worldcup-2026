import { eq } from "drizzle-orm";
import { teams } from "../../db/schema";
import type { GraphQLContext } from "./context";

export const teamsResolvers = {
  Query: {
    teams: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.db.select().from(teams),

    team: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, id));
      return team ?? null;
    },
  },

  Team: {
    group: (team: { groupLetter: string }) => team.groupLetter,
  },
};
