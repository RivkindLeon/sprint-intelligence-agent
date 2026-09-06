import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDatabaseConnection } from "./client.js";

const runDatabaseIntegrationTest =
  process.env.RUN_DATABASE_INTEGRATION_TEST === "true";

describe("database connection", { skip: !runDatabaseIntegrationTest }, () => {
  it("connects to PostgreSQL and executes a query", async () => {
    const { client } = createDatabaseConnection();

    try {
      const [result] = await client<{ value: number }[]>`select 1 as value`;
      assert.equal(result?.value, 1);
    } finally {
      await client.end();
    }
  });
});
