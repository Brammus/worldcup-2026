import path from "node:path";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { eq } from "drizzle-orm";
import { GraphQLError, Kind } from "graphql";
import type { DocumentNode, SelectionSetNode } from "graphql";
import { createYoga } from "graphql-yoga";
import { parseCookies } from "./auth/cookies";
import { verifyToken } from "./auth/jwt";
import { db } from "./db/client";
import { users } from "./db/schema";
import { resolvers } from "./schema/resolvers";
import { typeDefs } from "./schema/typeDefs";

// ── Startup validation ────────────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL env var is required");
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error("FATAL: JWT_SECRET must be set to at least 32 characters in production");
    process.exit(1);
  }
}

// ── Query depth limiting ──────────────────────────────────────────────────────

const MAX_QUERY_DEPTH = 7;

function selectionDepth(selectionSet: SelectionSetNode | undefined, depth = 0): number {
  if (!selectionSet) return depth;
  let max = depth;
  for (const sel of selectionSet.selections) {
    const child = "selectionSet" in sel ? sel.selectionSet : undefined;
    max = Math.max(max, selectionDepth(child, depth + 1));
  }
  return max;
}

function assertDepth(document: DocumentNode): void {
  for (const def of document.definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION) {
      const depth = selectionDepth(def.selectionSet);
      if (depth > MAX_QUERY_DEPTH) {
        throw new GraphQLError(
          `Query depth ${depth} exceeds maximum allowed depth of ${MAX_QUERY_DEPTH}`,
        );
      }
    }
  }
}

// ── Schema & server ───────────────────────────────────────────────────────────

const schema = makeExecutableSchema({ typeDefs, resolvers });
const isProduction = process.env.NODE_ENV === "production";

// WeakMap so response headers set by resolvers can be applied to the HTTP response
const responseHeadersMap = new WeakMap<Request, Headers>();

const yoga = createYoga({
  schema,
  graphiql: !isProduction,
  maskedErrors: isProduction,
  cors: {
    origin: process.env.ALLOWED_ORIGIN ?? "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type"],
    methods: ["POST", "GET", "OPTIONS"],
  },
  context: async ({ request }) => {
    const responseHeaders = new Headers();
    responseHeadersMap.set(request, responseHeaders);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

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

    return { db, currentUser, responseHeaders, ip };
  },
  plugins: [
    // Apply resolver-set response headers and add security headers
    {
      onResponse({ response, request }) {
        const headers = responseHeadersMap.get(request);
        if (headers) {
          for (const [key, value] of headers.entries()) {
            response.headers.append(key, value);
          }
          responseHeadersMap.delete(request);
        }
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("X-Frame-Options", "DENY");
        response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        if (isProduction) {
          response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }
      },
    },
    // Depth limiting + introspection blocking in production
    {
      onExecute({ args }: { args: { document: DocumentNode } }) {
        if (isProduction) {
          for (const def of args.document.definitions) {
            if (def.kind === Kind.OPERATION_DEFINITION) {
              for (const sel of def.selectionSet.selections) {
                if (
                  sel.kind === Kind.FIELD &&
                  (sel.name.value === "__schema" || sel.name.value === "__type")
                ) {
                  throw new GraphQLError("Introspection is disabled");
                }
              }
            }
          }
        }
        assertDepth(args.document);
      },
    },
  ],
});

// In production the Vite build is served from packages/web/dist
const staticDir = isProduction ? path.resolve(import.meta.dir, "../../../packages/web/dist") : null;

const server = Bun.serve({
  port: process.env.PORT ?? 4000,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname.startsWith("/graphql")) {
      return yoga.fetch(req);
    }

    if (staticDir) {
      const target = pathname === "/" ? "index.html" : pathname;
      const file = Bun.file(path.join(staticDir, target));
      if (await file.exists()) return new Response(file);
      // SPA fallback — let React Router handle unknown paths
      return new Response(Bun.file(path.join(staticDir, "index.html")));
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`GraphQL API running at http://localhost:${server.port}/graphql`);
