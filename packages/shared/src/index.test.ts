import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { apiErrorSchema, healthResponseSchema } from "./index.js";

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
});
