import { describe, expect, it } from "bun:test";
import type { GraphQLContext } from "../resolvers";
import { resolvers } from "../resolvers";

const team = { id: "abc", name: "France", groupLetter: "I" };

function makeTeamsCtx(result: unknown): GraphQLContext {
  return {
    db: {
      select: () => ({ from: () => Promise.resolve(result) }),
    } as unknown as GraphQLContext["db"],
    currentUser: null,
    responseHeaders: new Headers(),
    ip: "127.0.0.1",
  };
}

function makeTeamCtx(result: unknown): GraphQLContext {
  return {
    db: {
      select: () => ({ from: () => ({ where: () => Promise.resolve(result) }) }),
    } as unknown as GraphQLContext["db"],
    currentUser: null,
    responseHeaders: new Headers(),
    ip: "127.0.0.1",
  };
}

const match = {
  id: "m1",
  round: "group",
  matchday: 1,
  groupLetter: "A",
  homeTeamId: "abc",
  awayTeamId: "def",
  homeTeamLabel: "France",
  awayTeamLabel: "Germany",
  venue: "MetLife",
  startsAt: new Date(),
};
const _pick = { id: "p1", matchId: "m1", pickedTeamId: "abc", userId: "u1", createdAt: new Date() };
const matchResult = {
  matchId: "m1",
  winnerTeamId: "abc",
  homeScore: 1,
  awayScore: 0,
  recordedAt: new Date(),
};

// ctx that returns result for select().from().where()
function makeWhereCtx(result: unknown): GraphQLContext {
  return {
    db: {
      select: () => ({ from: () => ({ where: () => Promise.resolve(result) }) }),
    } as unknown as GraphQLContext["db"],
    currentUser: null,
    responseHeaders: new Headers(),
    ip: "127.0.0.1",
  };
}

describe("Query.teams", () => {
  it("returns all teams from db", async () => {
    const result = await resolvers.Query.teams(undefined, undefined, makeTeamsCtx([team]));
    expect(result).toEqual([team]);
  });
});

describe("Query.team", () => {
  it("returns null when team not found", async () => {
    const result = await resolvers.Query.team(undefined, { id: "x" }, makeTeamCtx([]));
    expect(result).toBeNull();
  });

  it("returns team when found", async () => {
    const result = await resolvers.Query.team(undefined, { id: "abc" }, makeTeamCtx([team]));
    expect(result).toEqual(team);
  });
});

describe("Match.homeTeam", () => {
  it("returns null when homeTeamId is null", async () => {
    const result = await resolvers.Match.homeTeam(
      { homeTeamId: null },
      undefined,
      makeWhereCtx([team]),
    );
    expect(result).toBeNull();
  });

  it("returns team when homeTeamId is set", async () => {
    const result = await resolvers.Match.homeTeam(
      { homeTeamId: "abc" },
      undefined,
      makeWhereCtx([team]),
    );
    expect(result).toEqual(team);
  });
});

describe("Match.awayTeam", () => {
  it("returns null when awayTeamId is null", async () => {
    const result = await resolvers.Match.awayTeam(
      { awayTeamId: null },
      undefined,
      makeWhereCtx([team]),
    );
    expect(result).toBeNull();
  });

  it("returns team when awayTeamId is set", async () => {
    const result = await resolvers.Match.awayTeam(
      { awayTeamId: "def" },
      undefined,
      makeWhereCtx([team]),
    );
    expect(result).toEqual(team);
  });
});

describe("Match.result", () => {
  it("returns null when no result exists", async () => {
    const result = await resolvers.Match.result({ id: "m1" }, undefined, makeWhereCtx([]));
    expect(result).toBeNull();
  });

  it("returns result when it exists", async () => {
    const result = await resolvers.Match.result(
      { id: "m1" },
      undefined,
      makeWhereCtx([matchResult]),
    );
    expect(result).toEqual(matchResult);
  });
});

describe("Pick.match", () => {
  it("returns the match for the pick", async () => {
    const result = await resolvers.Pick.match({ matchId: "m1" }, undefined, makeWhereCtx([match]));
    expect(result).toEqual(match);
  });
});

describe("Pick.pickedTeam", () => {
  it("returns the team for the pick", async () => {
    const result = await resolvers.Pick.pickedTeam(
      { pickedTeamId: "abc" },
      undefined,
      makeWhereCtx([team]),
    );
    expect(result).toEqual(team);
  });
});

describe("Query.matchPicks", () => {
  const lockedMatch = {
    id: "m1",
    startsAt: new Date(Date.now() - 60_000), // past = locked
    round: "group",
    homeTeamId: "abc",
    awayTeamId: "def",
  };

  it("returns picks with user and team for a locked match", async () => {
    const pickRow = { id: "p1", matchId: "m1", pickedTeamId: "abc", userId: "u1" };
    const userRow = { id: "u1", username: "alice", isAdmin: false };
    const teamRow = { id: "abc", name: "France", groupLetter: "I" };

    // DB calls in order:
    //   1. match lookup (lock check)
    //   2. picks for matchId
    //   3. users inArray (Promise.all first)
    //   4. teams inArray (Promise.all second)
    let callCount = 0;
    const ctx: GraphQLContext = {
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              callCount += 1;
              if (callCount === 1) return Promise.resolve([lockedMatch]);
              if (callCount === 2) return Promise.resolve([pickRow]);
              if (callCount === 3) return Promise.resolve([userRow]);
              return Promise.resolve([teamRow]);
            },
          }),
        }),
      } as unknown as GraphQLContext["db"],
      currentUser: null,
      responseHeaders: new Headers(),
      ip: "127.0.0.1",
    };

    const result = await resolvers.Query.matchPicks(undefined, { matchId: "m1" }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      user: { id: "u1", username: "alice", isAdmin: false },
      pickedTeam: teamRow,
    });
  });

  it("throws when match is not yet locked", async () => {
    const unlockedMatch = { id: "m1", startsAt: new Date(Date.now() + 3_600_000) };
    const ctx: GraphQLContext = {
      db: {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([unlockedMatch]),
          }),
        }),
      } as unknown as GraphQLContext["db"],
      currentUser: null,
      responseHeaders: new Headers(),
      ip: "127.0.0.1",
    };
    await expect(resolvers.Query.matchPicks(undefined, { matchId: "m1" }, ctx)).rejects.toThrow(
      "not available until the match is locked",
    );
  });

  it("returns empty array when no picks exist for locked match", async () => {
    let callCount = 0;
    const ctx: GraphQLContext = {
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              callCount += 1;
              if (callCount === 1) return Promise.resolve([lockedMatch]);
              return Promise.resolve([]);
            },
          }),
        }),
      } as unknown as GraphQLContext["db"],
      currentUser: null,
      responseHeaders: new Headers(),
      ip: "127.0.0.1",
    };

    const result = await resolvers.Query.matchPicks(undefined, { matchId: "no-match" }, ctx);
    expect(result).toHaveLength(0);
  });
});

describe("Mutation.register re-throw", () => {
  it("wraps unexpected DB errors as a generic message", async () => {
    const dbError = new Error("connection refused");
    const ctx: GraphQLContext = {
      db: {
        insert: () => ({ values: () => ({ returning: () => Promise.reject(dbError) }) }),
      } as unknown as GraphQLContext["db"],
      currentUser: null,
      responseHeaders: new Headers(),
      ip: "127.0.0.1",
    };
    // Use valid credentials so validation passes and the DB error is reached
    await expect(
      resolvers.Mutation.register(
        undefined,
        { username: "validuser", password: "validpassword123" },
        ctx,
      ),
    ).rejects.toThrow("Registration failed");
  });
});

describe("Mutation.register validation", () => {
  function makeErrCtx(): GraphQLContext {
    return {
      db: {} as unknown as GraphQLContext["db"],
      currentUser: null,
      responseHeaders: new Headers(),
      ip: "127.0.0.1",
    };
  }

  it("throws when username is too short", async () => {
    await expect(
      resolvers.Mutation.register(
        undefined,
        { username: "x", password: "validpassword123" },
        makeErrCtx(),
      ),
    ).rejects.toThrow("Username must be between 2 and 32 characters");
  });

  it("throws when username is too long", async () => {
    await expect(
      resolvers.Mutation.register(
        undefined,
        { username: "a".repeat(33), password: "validpassword123" },
        makeErrCtx(),
      ),
    ).rejects.toThrow("Username must be between 2 and 32 characters");
  });

  it("throws when username has invalid characters", async () => {
    await expect(
      resolvers.Mutation.register(
        undefined,
        { username: "bad user!", password: "validpassword123" },
        makeErrCtx(),
      ),
    ).rejects.toThrow("Username may only contain");
  });

  it("throws when password is too short", async () => {
    await expect(
      resolvers.Mutation.register(
        undefined,
        { username: "validuser", password: "short" },
        makeErrCtx(),
      ),
    ).rejects.toThrow("Password must be at least 8 characters");
  });
});
