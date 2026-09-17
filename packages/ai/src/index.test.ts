import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sprintAnalysisSchema } from "./index.js";

const validAnalysis = {
  healthScore: 68,
  summary: "The sprint is at risk from an unfinished dependency.",
  risks: [
    {
      severity: "critical",
      category: "dependency",
      title: "Authentication dependency is unfinished",
      explanation: "AUTH-231 depends on AUTH-198, which is still in TODO.",
      evidence: [
        { issueId: "AUTH-231", metric: "dependsOn", value: "AUTH-198" },
        { issueId: "AUTH-198", metric: "status", value: "todo" },
      ],
      recommendation: "Complete AUTH-198 before starting dependent work.",
      confidence: 0.95,
    },
  ],
};

describe("SprintAnalysis output schema", () => {
  it("accepts a structured analysis with traceable evidence", () => {
    assert.deepEqual(sprintAnalysisSchema.parse(validAnalysis), validAnalysis);
  });

  it("rejects risks without evidence", () => {
    const result = sprintAnalysisSchema.safeParse({
      ...validAnalysis,
      risks: [{ ...validAnalysis.risks[0], evidence: [] }],
    });

    assert.equal(result.success, false);
  });

  it("rejects evidence that identifies neither an issue nor a metric", () => {
    const result = sprintAnalysisSchema.safeParse({
      ...validAnalysis,
      risks: [{ ...validAnalysis.risks[0], evidence: [{ value: 12 }] }],
    });

    assert.equal(result.success, false);
  });

  it("rejects invented health scores and confidence outside their ranges", () => {
    const invalidHealthScore = sprintAnalysisSchema.safeParse({
      ...validAnalysis,
      healthScore: 101,
    });
    const invalidConfidence = sprintAnalysisSchema.safeParse({
      ...validAnalysis,
      risks: [{ ...validAnalysis.risks[0], confidence: 1.1 }],
    });

    assert.equal(invalidHealthScore.success, false);
    assert.equal(invalidConfidence.success, false);
  });

  it("rejects unexpected fields", () => {
    const result = sprintAnalysisSchema.safeParse({
      ...validAnalysis,
      rationale: "Hidden reasoning must not be stored.",
    });

    assert.equal(result.success, false);
  });
});
