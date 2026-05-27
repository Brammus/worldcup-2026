import { and, eq } from "drizzle-orm";
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
  },
};
