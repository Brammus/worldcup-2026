# World Cup 2026

[![CI](https://github.com/Brammus/worldcup-2026/actions/workflows/ci.yml/badge.svg)](https://github.com/Brammus/worldcup-2026/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-fbf0df?logo=bun&logoColor=black)](https://bun.sh/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?logo=graphql&logoColor=white)](https://graphql.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

Pick match winners across all 104 games of the 2026 FIFA World Cup and see how you stack up against your friends.

## Stack

| Layer | Tech |
|-------|------|
| Runtime & tooling | [Bun](https://bun.sh) |
| API | [graphql-yoga](https://the-guild.dev/graphql/yoga-server) + [Drizzle ORM](https://orm.drizzle.team) |
| Frontend | React + [Vite](https://vite.dev) + [urql](https://commerce.nearform.com/open-source/urql/) |
| Database | PostgreSQL |
| Linting | [Biome](https://biomejs.dev) |

## Getting started

```bash
bun install
```

Set your database URL:

```bash
cp packages/api/.env.example packages/api/.env
# edit packages/api/.env with your local Postgres credentials
```

```bash
cd packages/api && bun run db:migrate && bun run db:seed
cd ../..
bun run dev        # api → :4000  /  web → :3000
```

## Commands

```bash
bun test             # run all tests
bun run test:watch   # watch mode — re-runs on file changes
bun run coverage     # tests + coverage report (line/function %)
bun run typecheck    # typecheck all packages
bun run lint         # lint with Biome
bun run lint:fix     # auto-fix lint issues
```

Coverage is reported per-file in the terminal. In CI, the summary is posted to the GitHub Actions job summary tab on every run.
