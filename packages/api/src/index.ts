import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { db } from "./db/client";
import { resolvers } from "./schema/resolvers";
import { typeDefs } from "./schema/typeDefs";

const schema = makeExecutableSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  context: () => ({ db }),
});

const server = Bun.serve({
  port: process.env.PORT ?? 4000,
  fetch: yoga.fetch,
});

console.log(`GraphQL API running at http://localhost:${server.port}/graphql`);
