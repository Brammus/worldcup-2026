export const typeDefs = /* GraphQL */ `
  type Query {
    teams: [Team!]!
    team(id: ID!): Team
  }

  type Team {
    id: ID!
    name: String!
    group: String!
  }
`;
