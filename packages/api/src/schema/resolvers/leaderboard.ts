import { matchResults, matches, picks, users } from "../../db/schema";
import type { GraphQLContext } from "./context";

type LeaderboardEntry = {
  rank: number;
  user: { id: string; username: string; isAdmin: boolean };
  totalPoints: number;
  correctPicks: number;
  totalPicks: number;
};

export const leaderboardResolvers = {
  Query: {
    leaderboard: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const allUsers = await ctx.db.select().from(users);
      const allPicks = await ctx.db.select().from(picks);
      const allMatches = await ctx.db.select().from(matches);
      const allResults = await ctx.db.select().from(matchResults);

      const matchById = new Map(allMatches.map((m) => [m.id, m]));
      const resultByMatchId = new Map(allResults.map((r) => [r.matchId, r]));

      const entries = allUsers.map((user) => {
        const userPicks = allPicks.filter((p) => p.userId === user.id);
        let totalPoints = 0;
        let correctPicks = 0;

        for (const pick of userPicks) {
          const result = resultByMatchId.get(pick.matchId);
          if (!result) continue;
          if (result.winnerTeamId !== pick.pickedTeamId) continue;

          const match = matchById.get(pick.matchId);
          const isKnockout = match?.round !== "group";
          const pts = isKnockout ? 3 : 2;
          totalPoints += pts;
          correctPicks += 1;
        }

        return {
          rank: 0,
          user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
          totalPoints,
          correctPicks,
          totalPicks: userPicks.length,
        } satisfies LeaderboardEntry;
      });

      entries.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return a.user.username.localeCompare(b.user.username);
      });

      let currentRank = 1;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const prev = entries[i - 1];
        if (entry === undefined) continue;
        if (i > 0 && prev !== undefined && entry.totalPoints < prev.totalPoints) {
          currentRank = i + 1;
        }
        entry.rank = currentRank;
      }

      return entries;
    },
  },
};
