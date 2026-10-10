import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  healthResponseSchema,
  apiErrorSchema,
  sprintDetailResponseSchema,
  sprintListResponseSchema,
  sprintMetricsResponseSchema,
  sprintAnalysisResponseSchema,
} from "@sprint-intelligence/shared";

import { buildApp } from "./app.js";

const analyzedSprintIds: string[] = [];
const app = buildApp(
  {
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
    async getById(id) {
      if (id !== "sprint-24") return undefined;
      return {
        id: "sprint-24",
        name: "Sprint 24",
        goal: "Ship invitations",
        startDate: "2026-10-01",
        endDate: "2026-10-14",
        developers: [{ id: "dev-anna", name: "Anna", capacityStoryPoints: 13 }],
        issues: [
          {
            id: "AUTH-231",
            title: "Invite users",
            type: "story",
            status: "blocked",
            assigneeId: "dev-anna",
            storyPoints: 5,
            updatedAt: "2026-10-03T10:00:00.000Z",
            acceptanceCriteria: null,
            dependencies: ["AUTH-198"],
          },
        ],
      };
    },
    async getMetricsById(id) {
      if (id !== "sprint-24") return undefined;
      return {
        sprintId: id,
        completion: {
          totalIssues: 1,
          completedIssues: 0,
          completionPercent: 0,
          totalStoryPoints: 5,
          completedStoryPoints: 0,
          storyPointCompletionPercent: 0,
        },
        blocked: { issueCount: 1, issueIds: ["AUTH-231"] },
        scope: {
          addedIssueCount: 0,
          addedIssueIds: [],
          netStoryPointChange: 0,
          storyPointGrowthPercent: 0,
        },
        velocity: {
          sprintCount: 0,
          averageCompletedStoryPoints: 0,
          completedStoryPointsBySprint: [],
        },
      };
    },
  },
  {
    async analyze(sprintId) {
      analyzedSprintIds.push(sprintId);
      return {
        healthScore: 68,
        summary: "An unfinished dependency threatens delivery.",
        risks: [
          {
            severity: "critical",
            category: "dependency",
            title: "Invitation work is blocked",
            explanation: "AUTH-231 depends on unfinished AUTH-198.",
            evidence: [{ issueId: "AUTH-231" }, { issueId: "AUTH-198" }],
            confidence: 0.95,
          },
        ],
      };
    },
  },
);

describe("sprint analysis endpoint", () => {
  it("returns a validated health score and evidence-backed risk", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sprints/sprint-24/analyze",
    });
    assert.equal(response.statusCode, 200);
    const { analysis } = sprintAnalysisResponseSchema.parse(response.json());
    assert.equal(analysis.healthScore, 68);
    assert.deepEqual(analysis.risks[0]?.evidence, [
      { issueId: "AUTH-231" },
      { issueId: "AUTH-198" },
    ]);
    assert.deepEqual(analyzedSprintIds, ["sprint-24"]);
  });

  it("does not invoke the agent for an unknown sprint", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sprints/unknown/analyze",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(
      apiErrorSchema.parse(response.json()).message,
      "Sprint not found",
    );
    assert.deepEqual(analyzedSprintIds, ["sprint-24"]);
  });
});

describe("sprint metrics endpoint", () => {
  it("returns validated metrics and exact blocked-issue evidence", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sprints/sprint-24/metrics",
    });
    assert.equal(response.statusCode, 200);
    const { metrics } = sprintMetricsResponseSchema.parse(response.json());
    assert.equal(metrics.completion.totalStoryPoints, 5);
    assert.deepEqual(metrics.blocked.issueIds, ["AUTH-231"]);
  });

  it("returns a structured 404 for an unknown sprint", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sprints/unknown/metrics",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(
      apiErrorSchema.parse(response.json()).message,
      "Sprint not found",
    );
  });
});

describe("sprint detail endpoint", () => {
  it("returns the shared detail contract including issue dependencies", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sprints/sprint-24",
    });

    assert.equal(response.statusCode, 200);
    const detail = sprintDetailResponseSchema.parse(response.json());
    assert.equal(detail.sprint.goal, "Ship invitations");
    assert.deepEqual(detail.sprint.issues[0]?.dependencies, ["AUTH-198"]);
  });

  it("returns a structured 404 for an unknown sprint", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sprints/unknown",
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(apiErrorSchema.parse(response.json()), {
      statusCode: 404,
      error: "Not Found",
      message: "Sprint not found",
    });
  });
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
