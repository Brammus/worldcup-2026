export type { CurrentUser, GraphQLContext } from "./resolvers/context";
import { authResolvers } from "./resolvers/auth";
import { leaderboardResolvers } from "./resolvers/leaderboard";
import { matchesResolvers } from "./resolvers/matches";
import { picksResolvers } from "./resolvers/picks";
import { teamsResolvers } from "./resolvers/teams";

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...teamsResolvers.Query,
    ...matchesResolvers.Query,
    ...picksResolvers.Query,
    ...leaderboardResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...matchesResolvers.Mutation,
    ...picksResolvers.Mutation,
  },
  Team: teamsResolvers.Team,
  Match: matchesResolvers.Match,
  MatchResult: matchesResolvers.MatchResult,
  Pick: picksResolvers.Pick,
  User: authResolvers.User,
};
