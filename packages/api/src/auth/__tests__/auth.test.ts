import { beforeAll, describe, expect, it } from "bun:test";
import { db } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import { osrsTeamPicks, picks, users } from "../../db/schema";
import { resolvers } from "../../schema/resolvers";
import type { GraphQLContext } from "../../schema/resolvers";

function makeCtx(currentUser: GraphQLContext["currentUser"] = null): GraphQLContext {
  return { db, currentUser, responseHeaders: new Headers(), ip: "127.0.0.1" };
}

beforeAll(async () => {
  await runMigrations();
  await db.delete(picks);
  await db.delete(osrsTeamPicks);
  await db.delete(users);
});

describe("Mutation.register", () => {
  it("creates a user and returns it", async () => {
    const ctx = makeCtx();
    const result = await resolvers.Mutation.register(
      undefined,
      { username: "alice", password: "secret123" },
      ctx,
    );
    expect(result.user?.username).toBe("alice");
    expect(result.user?.id).toBeDefined();
  });

  it("sets an auth cookie on success", async () => {
    const ctx = makeCtx();
    await resolvers.Mutation.register(undefined, { username: "bob", password: "secret123" }, ctx);
    expect(ctx.responseHeaders.get("Set-Cookie")).toContain("token=");
    expect(ctx.responseHeaders.get("Set-Cookie")).toContain("HttpOnly");
  });

  it("throws when username is already taken", async () => {
    const ctx = makeCtx();
    await resolvers.Mutation.register(
      undefined,
      { username: "duplicate", password: "secret123" },
      ctx,
    );
    expect(
      resolvers.Mutation.register(
        undefined,
        { username: "duplicate", password: "secret123" },
        makeCtx(),
      ),
    ).rejects.toThrow("Username already taken");
  });
});

describe("Mutation.login", () => {
  it("returns the user with correct credentials", async () => {
    const ctx = makeCtx();
    await resolvers.Mutation.register(
      undefined,
      { username: "charlie", password: "mypassword" },
      makeCtx(),
    );
    const result = await resolvers.Mutation.login(
      undefined,
      { username: "charlie", password: "mypassword" },
      ctx,
    );
    expect(result.user.username).toBe("charlie");
  });

  it("sets an auth cookie on success", async () => {
    const ctx = makeCtx();
    await resolvers.Mutation.login(undefined, { username: "charlie", password: "mypassword" }, ctx);
    expect(ctx.responseHeaders.get("Set-Cookie")).toContain("token=");
  });

  it("throws with wrong password", async () => {
    expect(
      resolvers.Mutation.login(
        undefined,
        { username: "charlie", password: "wrongpassword" },
        makeCtx(),
      ),
    ).rejects.toThrow("Invalid credentials");
  });

  it("throws with unknown username", async () => {
    expect(
      resolvers.Mutation.login(undefined, { username: "nobody", password: "password" }, makeCtx()),
    ).rejects.toThrow("Invalid credentials");
  });
});

describe("Query.me", () => {
  it("returns null when no current user", async () => {
    const result = await resolvers.Query.me(undefined, undefined, makeCtx(null));
    expect(result).toBeNull();
  });

  it("returns the current user when authenticated", async () => {
    const ctx = makeCtx({ id: "test-id", username: "alice", isAdmin: false });
    const result = await resolvers.Query.me(undefined, undefined, ctx);
    expect(result).toEqual({ id: "test-id", username: "alice", isAdmin: false });
  });
});

describe("Mutation.logout", () => {
  it("clears the auth cookie", async () => {
    const ctx = makeCtx({ id: "test-id", username: "alice", isAdmin: false });
    const result = await resolvers.Mutation.logout(undefined, undefined, ctx);
    expect(result).toBe(true);
    expect(ctx.responseHeaders.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
