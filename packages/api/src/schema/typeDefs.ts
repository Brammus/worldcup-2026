export const typeDefs = /* GraphQL */ `
  type Query {
    me: User
    teams: [Team!]!
    team(id: ID!): Team
    matches(round: String, group: String): [Match!]!
    myPicks: [Pick!]!
    leaderboard: [LeaderboardEntry!]!
    userPicks(userId: ID!): [Pick!]!
    matchPicks(matchId: ID!): [MatchPick!]!
    osrsTeams: [OsrsTeam!]!
    myOsrsRanking: [OsrsTeamRanking!]!
  }

  type MatchPick {
    user: User!
    pickedTeam: Team
  }

  type LeaderboardEntry {
    rank: Int!
    user: User!
    totalPoints: Int!
    correctPicks: Int!
    totalPicks: Int!
  }

  type Mutation {
    register(username: String!, password: String!): AuthResult!
    login(username: String!, password: String!): AuthResult!
    logout: Boolean!
    setPick(matchId: ID!, teamId: ID): Pick!
    setResult(matchId: ID!, winnerId: ID, homeScore: Int!, awayScore: Int!): Match!
    rankOsrsTeams(rankings: [OsrsRankingInput!]!): [OsrsTeamRanking!]!
  }

  type OsrsTeamRanking {
    rank: Int!
    team: OsrsTeam!
  }

  input OsrsRankingInput {
    teamId: ID!
    rank: Int!
  }

  type OsrsTeam {
    id: ID!
    name: String!
    color: String!
    players: [OsrsPlayer!]!
    pickCount: Int!
  }

  type OsrsPlayer {
    id: ID!
    name: String!
    isCaptain: Boolean!
    streamUrl: String
  }

  type AuthResult {
    user: User!
  }

  type User {
    id: ID!
    username: String!
    isAdmin: Boolean!
  }

  type Team {
    id: ID!
    name: String!
    group: String!
  }

  type Match {
    id: ID!
    round: String!
    matchday: Int
    group: String
    homeTeam: Team
    awayTeam: Team
    homeTeamLabel: String!
    awayTeamLabel: String!
    venue: String!
    startsAt: String!
    isLocked: Boolean!
    myPick: Pick
    result: MatchResult
  }

  type Pick {
    id: ID!
    matchId: ID!
    pickedTeamId: ID
    match: Match!
    pickedTeam: Team
    points: Int
  }

  type MatchResult {
    matchId: ID!
    homeScore: Int!
    awayScore: Int!
    winnerTeamId: ID
    winner: Team
  }
`;
