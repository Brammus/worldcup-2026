import { eq } from "drizzle-orm";
import type { DB } from "../db/client";
import { teams } from "../db/schema";

export type GraphQLContext = {
  db: DB;
};

export const resolvers = {
  Query: {
    teams: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      return ctx.db.select().from(teams);
    },
    team: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, id));
      return team ?? null;
    },
  },
};
