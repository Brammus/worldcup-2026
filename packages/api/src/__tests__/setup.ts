import { existsSync, readFileSync } from "node:fs";

// Load packages/api/.env explicitly so this setup works regardless of CWD
// (e.g. `bun test` from the monorepo root vs from packages/api)
const envPath = new URL("../../.env", import.meta.url).pathname;
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const [, key, val] = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/) ?? [];
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}

// Redirect all tests to the dedicated test database so the dev database
// is never wiped when running `bun test`.
const user = process.env.USER ?? "postgres";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgres://${user}@localhost:5432/worldcup2026_test`;
