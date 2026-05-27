import { and, eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { buildAuthCookie, clearAuthCookie } from "../auth/cookies";
import { signToken } from "../auth/jwt";
import type { DB } from "../db/client";
import { matches, teams, users } from "../db/schema";

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
  },
};
