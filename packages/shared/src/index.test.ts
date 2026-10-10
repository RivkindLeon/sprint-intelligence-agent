import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  apiErrorSchema,
  healthResponseSchema,
  sprintListResponseSchema,
  sprintDetailResponseSchema,
  sprintMetricsResponseSchema,
  sprintAnalysisResponseSchema,
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

  it("validates sprint detail and exact issue dependency evidence", () => {
    const response = {
      sprint: {
        id: "sprint-24",
        name: "Sprint 24",
        goal: "Ship invitations",
        startDate: "2026-09-01",
        endDate: "2026-09-14",
        developers: [{ id: "dev-anna", name: "Anna", capacityStoryPoints: 13 }],
        issues: [
          {
            id: "AUTH-231",
            title: "Invite users",
            type: "story",
            status: "blocked",
            assigneeId: "dev-anna",
            storyPoints: 5,
            updatedAt: "2026-09-04T10:00:00.000Z",
            acceptanceCriteria: null,
            dependencies: ["AUTH-198"],
          },
        ],
      },
    };
    assert.deepEqual(sprintDetailResponseSchema.parse(response), response);
    assert.equal(
      sprintDetailResponseSchema.safeParse({
        sprint: {
          ...response.sprint,
          issues: [{ ...response.sprint.issues[0], dependencies: [5] }],
        },
      }).success,
      false,
    );
  });
});

describe("sprint analysis contract", () => {
  it("requires bounded scores and evidence on every risk", () => {
    const response = {
      analysis: {
        healthScore: 68,
        summary: "A dependency threatens delivery.",
        risks: [
          {
            severity: "high",
            category: "dependency",
            title: "Blocked invitation",
            explanation: "AUTH-231 depends on AUTH-198.",
            evidence: [{ issueId: "AUTH-231" }],
            confidence: 0.9,
          },
        ],
      },
    };
    assert.deepEqual(sprintAnalysisResponseSchema.parse(response), response);
    assert.equal(
      sprintAnalysisResponseSchema.safeParse({
        analysis: {
          ...response.analysis,
          risks: [{ ...response.analysis.risks[0], evidence: [] }],
        },
      }).success,
      false,
    );
    assert.equal(
      sprintAnalysisResponseSchema.safeParse({
        analysis: { ...response.analysis, healthScore: 101 },
      }).success,
      false,
    );
    assert.equal(
      sprintAnalysisResponseSchema.safeParse({
        analysis: {
          ...response.analysis,
          risks: [
            {
              ...response.analysis.risks[0],
              evidence: [{ metric: "blockedIssueCount", value: 1 }],
            },
          ],
        },
      }).success,
      false,
    );
  });
});

describe("sprint metrics contract", () => {
  it("requires bounded deterministic values and issue evidence", () => {
    const response = {
      metrics: {
        sprintId: "sprint-24",
        completion: {
          totalIssues: 2,
          completedIssues: 1,
          completionPercent: 50,
          totalStoryPoints: 5,
          completedStoryPoints: 3,
          storyPointCompletionPercent: 60,
        },
        blocked: { issueCount: 1, issueIds: ["AUTH-231"] },
        scope: {
          addedIssueCount: 1,
          addedIssueIds: ["AUTH-231"],
          netStoryPointChange: 3,
          storyPointGrowthPercent: 150,
        },
        velocity: {
          sprintCount: 1,
          averageCompletedStoryPoints: 48,
          completedStoryPointsBySprint: [
            { sprintId: "sprint-23", completedStoryPoints: 48 },
          ],
        },
      },
    };
    assert.deepEqual(sprintMetricsResponseSchema.parse(response), response);
    assert.equal(
      sprintMetricsResponseSchema.safeParse({
        metrics: {
          ...response.metrics,
          completion: {
            ...response.metrics.completion,
            completionPercent: 101,
          },
        },
      }).success,
      false,
    );
  });
});
