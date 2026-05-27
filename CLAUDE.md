# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Runtime / package manager / build**: Bun (used for everything)
- **Frontend**: React + TypeScript, built with Vite
- **API**: GraphQL via `graphql-yoga` + `@graphql-tools/schema`
- **Database**: PostgreSQL with Drizzle ORM
- **GraphQL client**: urql with codegen for end-to-end type safety
- **Linting / formatting**: Biome (replaces ESLint + Prettier)

Keep things simple — avoid unnecessary abstraction layers.

## Workflow: TDD

New features follow **red → green → refactor**:

1. Write a failing test that describes the desired behaviour
2. Write the minimal code to make it pass
3. Refactor while keeping tests green

The CI gate (`typecheck` → `lint` → `test`) must stay green on every commit.

## Commands

All commands run from the repo root unless noted.

```bash
# Install dependencies
bun install

# Run all tests (both packages)
bun test
# or per-package
bun run --filter '*' test

# Typecheck
bun run typecheck

# Lint (Biome)
bun run lint
bun run lint:fix

# Dev servers (api on :4000, web on :3000)
bun run dev

# Single test file
bun test packages/api/src/schema/__tests__/resolvers.test.ts
```

### API-specific (`packages/api`)
```bash
bun run db:generate   # generate Drizzle migrations from schema changes
bun run db:migrate    # apply migrations
bun run db:studio     # open Drizzle Studio
```

### Web-specific (`packages/web`)
```bash
bun run codegen       # generate GraphQL types from running API (requires api running)
```

## Architecture

Bun monorepo with two packages: `@worldcup/api` and `@worldcup/web`.

### API (`packages/api`)

- **Entry**: `src/index.ts` — starts a `Bun.serve` server with `graphql-yoga`
- **Schema**: `src/schema/typeDefs.ts` (SDL) + `src/schema/resolvers.ts` — standard `makeExecutableSchema` pattern
- **DB**: `src/db/schema.ts` defines Drizzle tables; `src/db/client.ts` exports the `db` instance; migrations live in `src/db/migrations/`
- **Context**: `GraphQLContext` type (defined in `resolvers.ts`) carries the `db` instance into every resolver — extend it as features are added
- `DATABASE_URL` env var controls the Postgres connection (default: `postgres://postgres:postgres@localhost:5432/worldcup2026`)

### Web (`packages/web`)

- **Entry**: `src/main.tsx` — mounts React with `urql` `<Provider>` wrapping the app
- **GraphQL client**: `src/client.ts` — urql client pointing at `/graphql` (proxied to `:4000` by Vite in dev)
- **Codegen**: `codegen.ts` generates TypeScript types into `src/gql/` (gitignored) — use the `graphql` tag from `src/gql/` in components for typed queries/mutations

### Testing

- API resolver tests mock the `db` by casting minimal objects to `unknown as GraphQLContext["db"]` — keep this pattern for unit tests; use a real DB for integration tests
- Web tests use `happy-dom` for the DOM environment. `test-utils.tsx` auto-initializes it when `document` is undefined, so tests work both from `packages/web/` and from the root
- CI runs Postgres 17 as a service container and applies migrations before tests

### CI (`.github/workflows/ci.yml`)

Order: `typecheck` → `lint` → `db:migrate` → `test`
