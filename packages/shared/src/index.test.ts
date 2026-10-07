import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  apiErrorSchema,
  healthResponseSchema,
  sprintListResponseSchema,
} from "./index.js";

describe("shared API contracts", () => {
  it("accepts the API health response", () => {
    assert.deepEqual(healthResponseSchema.parse({ status: "ok" }), {
      status: "ok",
    });
  });

  it("rejects invalid error status codes", () => {
    const result = apiErrorSchema.safeParse({
      statusCode: 200,
      error: "Bad Request",
      message: "Invalid request",
    });

    assert.equal(result.success, false);
  });

  it("accepts compact sprint summaries and rejects extra fields", () => {
    const response = {
      sprints: [
        {
          id: "sprint-24",
          name: "Sprint 24",
          startDate: "2026-10-01",
          endDate: "2026-10-14",
        },
      ],
    };
    assert.deepEqual(sprintListResponseSchema.parse(response), response);
    assert.equal(
      sprintListResponseSchema.safeParse({
        sprints: [{ ...response.sprints[0], issueCount: 35 }],
      }).success,
      false,
    );
  });
});
