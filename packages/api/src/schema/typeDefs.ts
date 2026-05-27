export const typeDefs = /* GraphQL */ `
  type Query {
    teams: [Team!]!
    team(id: ID!): Team
    matches(round: String, group: String): [Match!]!
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
