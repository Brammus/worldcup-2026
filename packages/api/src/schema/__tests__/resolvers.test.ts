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
  };
}

function makeTeamCtx(result: unknown): GraphQLContext {
  return {
    db: {
      select: () => ({ from: () => ({ where: () => Promise.resolve(result) }) }),
    } as unknown as GraphQLContext["db"],
    currentUser: null,
    responseHeaders: new Headers(),
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
  it("returns picks with user and team for a match", async () => {
    const pickRow = { id: "p1", matchId: "m1", pickedTeamId: "abc", userId: "u1" };
    const userRow = { id: "u1", username: "alice", isAdmin: false };
    const teamRow = { id: "abc", name: "France", groupLetter: "I" };

    // Mock DB: select().from().where() called 3 times:
    //   1st call returns [pickRow] (picks for matchId)
    //   2nd call returns [userRow] (user lookup)
    //   3rd call returns [teamRow] (team lookup)
    let callCount = 0;
    const ctx: GraphQLContext = {
      db: {
        select: () => ({
          from: () => ({
            where: () => {
              callCount += 1;
              if (callCount === 1) return Promise.resolve([pickRow]);
              if (callCount === 2) return Promise.resolve([userRow]);
              return Promise.resolve([teamRow]);
            },
          }),
        }),
      } as unknown as GraphQLContext["db"],
      currentUser: null,
      responseHeaders: new Headers(),
    };

    const result = await resolvers.Query.matchPicks(undefined, { matchId: "m1" }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      user: { id: "u1", username: "alice", isAdmin: false },
      pickedTeam: teamRow,
    });
  });

  it("returns empty array when no picks exist for match", async () => {
    const ctx: GraphQLContext = {
      db: {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      } as unknown as GraphQLContext["db"],
      currentUser: null,
      responseHeaders: new Headers(),
    };

    const result = await resolvers.Query.matchPicks(undefined, { matchId: "no-match" }, ctx);
    expect(result).toHaveLength(0);
  });
});

describe("Mutation.register re-throw", () => {
  it("re-throws non-unique DB errors", async () => {
    const dbError = new Error("connection refused");
    const ctx: GraphQLContext = {
      db: {
        insert: () => ({ values: () => ({ returning: () => Promise.reject(dbError) }) }),
      } as unknown as GraphQLContext["db"],
      currentUser: null,
      responseHeaders: new Headers(),
    };
    await expect(
      resolvers.Mutation.register(undefined, { username: "x", password: "y" }, ctx),
    ).rejects.toThrow("connection refused");
  });
});
