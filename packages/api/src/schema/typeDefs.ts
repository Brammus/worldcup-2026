export const typeDefs = /* GraphQL */ `
  type Query {
    me: User
    teams: [Team!]!
    team(id: ID!): Team
    matches(round: String, group: String): [Match!]!
    myPicks: [Pick!]!
  }

  type Mutation {
    register(username: String!, password: String!): AuthResult!
    login(username: String!, password: String!): AuthResult!
    logout: Boolean!
    setPick(matchId: ID!, teamId: ID!): Pick!
  }

  type AuthResult {
    user: User!
  }

  type User {
    id: ID!
    username: String!
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
    pickedTeamId: ID!
    match: Match!
    pickedTeam: Team!
  }

  type MatchResult {
    matchId: ID!
    homeScore: Int!
    awayScore: Int!
    winnerTeamId: ID
  }
`;
