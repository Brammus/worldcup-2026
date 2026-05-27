export const typeDefs = /* GraphQL */ `
  type Query {
    me: User
    teams: [Team!]!
    team(id: ID!): Team
    matches(round: String, group: String): [Match!]!
  }

  type Mutation {
    register(username: String!, password: String!): AuthResult!
    login(username: String!, password: String!): AuthResult!
    logout: Boolean!
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
  }
`;
