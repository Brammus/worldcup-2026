// Redirect all tests to the dedicated test database so the dev database
// is never wiped when running `bun test`.
const user = process.env.USER ?? "postgres";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgres://${user}@localhost:5432/worldcup2026_test`;
