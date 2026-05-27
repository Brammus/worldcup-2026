import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/worldcup2026";

const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });
export type DB = typeof db;
