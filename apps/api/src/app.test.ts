import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { buildApp } from "./app.js";

const app = buildApp();

after(async () => {
  await app.close();
});

describe("health endpoint", () => {
  it("reports that the API is available", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  });
});
