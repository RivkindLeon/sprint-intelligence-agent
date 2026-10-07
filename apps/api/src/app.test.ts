import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  healthResponseSchema,
  sprintListResponseSchema,
} from "@sprint-intelligence/shared";

import { buildApp } from "./app.js";

const app = buildApp({
  async list() {
    return [
      {
        id: "sprint-24",
        name: "Sprint 24",
        startDate: "2026-10-01",
        endDate: "2026-10-14",
      },
    ];
  },
});

after(async () => {
  await app.close();
});

describe("health endpoint", () => {
  it("reports that the API is available", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(healthResponseSchema.parse(response.json()), {
      status: "ok",
    });
  });
});

describe("sprint list endpoint", () => {
  it("returns the compact shared sprint contract", async () => {
    const response = await app.inject({ method: "GET", url: "/api/sprints" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(sprintListResponseSchema.parse(response.json()), {
      sprints: [
        {
          id: "sprint-24",
          name: "Sprint 24",
          startDate: "2026-10-01",
          endDate: "2026-10-14",
        },
      ],
    });
  });
});
