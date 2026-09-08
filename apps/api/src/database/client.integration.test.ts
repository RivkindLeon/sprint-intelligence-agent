import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabaseConnection } from "./client.js";

const runDatabaseIntegrationTest =
  process.env.RUN_DATABASE_INTEGRATION_TEST === "true";

describe("database connection", { skip: !runDatabaseIntegrationTest }, () => {
  it("connects to PostgreSQL and executes a query", async () => {
    const { client, db } = createDatabaseConnection();

    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      const [result] = await client<{ value: number }[]>`select 1 as value`;
      assert.equal(result?.value, 1);

      const tables = await client<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
        order by table_name
      `;
      assert.deepEqual(
        tables.map(({ table_name }) => table_name),
        [
          "activities",
          "developers",
          "issue_dependencies",
          "issues",
          "sprint_developers",
          "sprint_history",
          "sprints",
        ],
      );
    } finally {
      await client.end();
    }
  });
});
