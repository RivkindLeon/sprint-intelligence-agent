import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SprintDetailResponse } from "@sprint-intelligence/shared";

import { calculateSprintMetrics } from "./metrics.js";

const sprint: SprintDetailResponse["sprint"] = {
  id: "sprint-24",
  name: "Sprint 24",
  goal: null,
  startDate: "2026-09-01",
  endDate: "2026-09-14",
  developers: [],
  issues: [
    {
      id: "AUTH-231",
      title: "Invite users",
      type: "story",
      status: "done",
      assigneeId: null,
      storyPoints: 3,
      updatedAt: "2026-09-05T10:00:00Z",
      acceptanceCriteria: null,
      dependencies: [],
    },
    {
      id: "AUTH-198",
      title: "Token API",
      type: "task",
      status: "blocked",
      assigneeId: null,
      storyPoints: 5,
      updatedAt: "2026-09-05T10:00:00Z",
      acceptanceCriteria: null,
      dependencies: [],
    },
  ],
};

describe("sprint dashboard metrics", () => {
  it("combines issue completion with deterministic scope and velocity analytics", () => {
    const metrics = calculateSprintMetrics(
      sprint,
      [
        {
          id: "scope-1",
          issueId: "AUTH-198",
          type: "added_to_sprint",
          occurredAt: "2026-09-03T10:00:00Z",
          toValue: sprint.id,
        },
      ],
      [
        {
          id: "history-23",
          sprintId: "sprint-23",
          sprintName: "Sprint 23",
          startedAt: "2026-08-18T09:00:00Z",
          completedAt: "2026-08-31T17:00:00Z",
          committedStoryPoints: 10,
          completedStoryPoints: 6,
          carriedOverIssueIds: [],
        },
      ],
    );

    assert.deepEqual(metrics.completion, {
      totalIssues: 2,
      completedIssues: 1,
      completionPercent: 50,
      totalStoryPoints: 8,
      completedStoryPoints: 3,
      storyPointCompletionPercent: 37.5,
    });
    assert.deepEqual(metrics.blocked, {
      issueCount: 1,
      issueIds: ["AUTH-198"],
    });
    assert.deepEqual(metrics.scope, {
      addedIssueCount: 1,
      addedIssueIds: ["AUTH-198"],
      netStoryPointChange: 5,
      storyPointGrowthPercent: 166.67,
    });
    assert.deepEqual(metrics.velocity, {
      sprintCount: 1,
      averageCompletedStoryPoints: 6,
      completedStoryPointsBySprint: [
        { sprintId: "sprint-23", completedStoryPoints: 6 },
      ],
    });
  });

  it("reports zero percentages for an empty sprint", () => {
    const metrics = calculateSprintMetrics({ ...sprint, issues: [] }, [], []);
    assert.equal(metrics.completion.completionPercent, 0);
    assert.equal(metrics.completion.storyPointCompletionPercent, 0);
    assert.equal(metrics.velocity.sprintCount, 0);
  });
});
