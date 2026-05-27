import { makeExecutableSchema } from "@graphql-tools/schema";
import { eq } from "drizzle-orm";
import { createYoga } from "graphql-yoga";
import { parseCookies } from "./auth/cookies";
import { verifyToken } from "./auth/jwt";
import { db } from "./db/client";
import { users } from "./db/schema";
import { resolvers } from "./schema/resolvers";
import { typeDefs } from "./schema/typeDefs";

const schema = makeExecutableSchema({ typeDefs, resolvers });

// WeakMap so response headers set by resolvers can be applied to the HTTP response
const responseHeadersMap = new WeakMap<Request, Headers>();

const yoga = createYoga({
  schema,
  context: async ({ request }) => {
    const responseHeaders = new Headers();
    responseHeadersMap.set(request, responseHeaders);

    const cookies = parseCookies(request.headers.get("cookie") ?? "");
    const token = cookies.get("token");

    let currentUser = null;
    if (token) {
      const userId = await verifyToken(token);
      if (userId) {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (user) currentUser = { id: user.id, username: user.username, isAdmin: user.isAdmin };
      }
    }

    return { db, currentUser, responseHeaders };
  },
  plugins: [
    {
      onResponse({ response, request }) {
        const headers = responseHeadersMap.get(request);
        if (headers) {
          for (const [key, value] of headers.entries()) {
            response.headers.append(key, value);
          }
          responseHeadersMap.delete(request);
        }
      },
    },
  ],
});

const server = Bun.serve({
  port: process.env.PORT ?? 4000,
  fetch: yoga.fetch,
});

console.log(`GraphQL API running at http://localhost:${server.port}/graphql`);
