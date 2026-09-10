import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabaseConnection } from "./client.js";
import { loadDemoDataset, seedDemoDataset } from "./seed.js";

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

  it("seeds the complete demo dataset idempotently", async () => {
    const { client, db } = createDatabaseConnection();

    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      const dataset = await loadDemoDataset();
      await seedDemoDataset(db, dataset);
      await seedDemoDataset(db, dataset);

      const [counts] = await client<
        Array<{
          developers: number;
          issues: number;
          dependencies: number;
          activities: number;
          history: number;
        }>
      >`
        select
          (select count(*)::int from developers) as developers,
          (select count(*)::int from issues where sprint_id = 'sprint-24') as issues,
          (select count(*)::int from issue_dependencies) as dependencies,
          (select count(*)::int from activities) as activities,
          (select count(*)::int from sprint_history) as history
      `;
      assert.deepEqual(counts, {
        developers: 6,
        issues: 35,
        dependencies: dataset.issues.reduce(
          (total, issue) => total + issue.dependencies.length,
          0,
        ),
        activities: dataset.issues.filter((issue) => issue.addedToSprintAt)
          .length,
        history: 5,
      });
    } finally {
      await client.end();
    }
  });
});
