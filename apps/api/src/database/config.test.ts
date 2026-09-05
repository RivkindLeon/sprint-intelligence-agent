import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDatabaseUrl } from "./config.js";

describe("database configuration", () => {
  it("uses the Docker Compose database when DATABASE_URL is omitted", () => {
    assert.equal(
      getDatabaseUrl({}),
      "postgresql://sprint_intelligence:sprint_intelligence@localhost:5432/sprint_intelligence",
    );
  });

  it("accepts an explicit PostgreSQL URL", () => {
    const url = "postgres://user:password@database.example:5432/sprints";
    assert.equal(getDatabaseUrl({ DATABASE_URL: url }), url);
  });

  it("rejects malformed and non-PostgreSQL URLs", () => {
    assert.throws(
      () => getDatabaseUrl({ DATABASE_URL: "not a URL" }),
      /valid PostgreSQL connection URL/,
    );
    assert.throws(
      () => getDatabaseUrl({ DATABASE_URL: "mysql://localhost/sprints" }),
      /postgres or postgresql protocol/,
    );
  });
});
