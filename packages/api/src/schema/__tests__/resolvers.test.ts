import { describe, expect, it } from "bun:test";
import type { GraphQLContext } from "../resolvers";
import { resolvers } from "../resolvers";

const team = { id: "abc", name: "France", groupLetter: "I" };

function makeTeamsCtx(result: unknown): GraphQLContext {
  return {
    db: {
      select: () => ({ from: () => Promise.resolve(result) }),
    } as unknown as GraphQLContext["db"],
  };
}

function makeTeamCtx(result: unknown): GraphQLContext {
  return {
    db: {
      select: () => ({ from: () => ({ where: () => Promise.resolve(result) }) }),
    } as unknown as GraphQLContext["db"],
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
