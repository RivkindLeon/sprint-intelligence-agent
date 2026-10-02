import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { getDatabaseUrl } from "./config.js";
import * as schema from "./schema.js";

export type DatabaseConnection = {
  client: Sql;
  db: PostgresJsDatabase<typeof schema>;
};

export function createDatabaseConnection(
  environment: Record<string, string | undefined> = process.env,
): DatabaseConnection {
  const client = postgres(getDatabaseUrl(environment), { max: 10 });
  return { client, db: drizzle(client, { schema }) };
}
