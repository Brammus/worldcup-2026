import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { buildAuthCookie, clearAuthCookie } from "../../auth/cookies";
import { signToken } from "../../auth/jwt";
import { checkLoginRateLimit } from "../../auth/rateLimiter";
import { users } from "../../db/schema";
import type { GraphQLContext } from "./context";

export const authResolvers = {
  Query: {
    me: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.currentUser ?? null,
  },

  Mutation: {
    register: async (
      _: unknown,
      { username, password }: { username: string; password: string },
      ctx: GraphQLContext,
    ) => {
      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 2 || trimmedUsername.length > 32) {
        throw new GraphQLError("Username must be between 2 and 32 characters");
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
        throw new GraphQLError(
          "Username may only contain letters, numbers, underscores, and hyphens",
        );
      }
      if (password.length < 8) {
        throw new GraphQLError("Password must be at least 8 characters");
      }

      const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });

      try {
        const inserted = await ctx.db
          .insert(users)
          .values({ username: trimmedUsername, passwordHash })
          .returning({ id: users.id, username: users.username });
        const user = inserted[0];
        if (!user) throw new GraphQLError("Failed to create user");

        const token = await signToken(user.id);
        ctx.responseHeaders.set("Set-Cookie", buildAuthCookie(token));
        return { user };
      } catch (err) {
        if (err instanceof GraphQLError) throw err;
        if (err instanceof Error && err.message.toLowerCase().includes("unique")) {
          throw new GraphQLError("Username already taken");
        }
        throw new GraphQLError("Registration failed. Please try again.");
      }
    },

    login: async (
      _: unknown,
      { username, password }: { username: string; password: string },
      ctx: GraphQLContext,
    ) => {
      if (!checkLoginRateLimit(ctx.ip)) {
        throw new GraphQLError("Too many login attempts. Please try again later.");
      }

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

  User: {
    isAdmin: (user: { isAdmin: boolean }) => user.isAdmin,
  },
};
