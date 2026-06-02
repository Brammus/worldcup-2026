export const MeQuery = `
  query Me {
    me {
      id
      username
      isAdmin
    }
  }
`;

export const LoginMutation = `
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      user {
        id
        username
      }
    }
  }
`;

export const RegisterMutation = `
  mutation Register($username: String!, $password: String!) {
    register(username: $username, password: $password) {
      user {
        id
        username
      }
    }
  }
`;

export const LogoutMutation = `
  mutation Logout {
    logout
  }
`;

export const MatchesQuery = `
  query Matches($round: String, $group: String) {
    matches(round: $round, group: $group) {
      id
      round
      matchday
      group
      homeTeamLabel
      awayTeamLabel
      homeTeam { id name group }
      awayTeam { id name group }
      startsAt
      isLocked
      myPick { pickedTeamId points }
      result { homeScore awayScore winnerTeamId }
    }
  }
`;

export const SetResultMutation = `
  mutation SetResult($matchId: ID!, $winnerId: ID, $homeScore: Int!, $awayScore: Int!) {
    setResult(matchId: $matchId, winnerId: $winnerId, homeScore: $homeScore, awayScore: $awayScore) {
      id
      round
      homeTeamLabel
      awayTeamLabel
      result { homeScore awayScore winnerTeamId }
    }
  }
`;

export const SetPickMutation = `
  mutation SetPick($matchId: ID!, $teamId: ID) {
    setPick(matchId: $matchId, teamId: $teamId) {
      id
      matchId
      pickedTeamId
    }
  }
`;

export const LeaderboardQuery = `
  query Leaderboard {
    leaderboard {
      rank
      user { id username }
      totalPoints
      correctPicks
      totalPicks
    }
  }
`;

export const UserPicksQuery = `
  query UserPicks($userId: ID!) {
    userPicks(userId: $userId) {
      id
      matchId
      pickedTeamId
      points
      match {
        id
        round
        group
        homeTeamLabel
        awayTeamLabel
        result { homeScore awayScore winnerTeamId }
      }
      pickedTeam { id name group }
    }
  }
`;

export const MatchPicksQuery = `
  query MatchPicks($matchId: ID!) {
    matchPicks(matchId: $matchId) {
      user { id username }
      pickedTeam { id name group }
    }
  }
`;

export const OsrsTeamsQuery = `
  query OsrsTeams {
    osrsTeams {
      id name color pickCount
      players { id name isCaptain streamUrl }
    }
    myOsrsRanking {
      rank
      team { id }
    }
  }
`;

export const RankOsrsTeamsMutation = `
  mutation RankOsrsTeams($rankings: [OsrsRankingInput!]!) {
    rankOsrsTeams(rankings: $rankings) {
      rank
      team { id name }
    }
  }
`;
