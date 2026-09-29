import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  Activity,
  Sprint,
  SprintHistory,
} from "@sprint-intelligence/domain";

import { createSprintHealthScoreSource } from "./health.js";

const sprint: Sprint = {
  id: "sprint-24",
  name: "Sprint 24",
  startDate: "2026-01-01",
  endDate: "2026-01-14",
  developers: [
    { id: "dev-1", name: "Leon", capacityHoursPerWeek: 8 },
    { id: "dev-2", name: "Anna", capacityHoursPerWeek: 8 },
  ],
  issues: [
    {
      id: "ISSUE-1",
      title: "Blocked story",
      type: "story",
      status: "blocked",
      assigneeId: "dev-1",
      storyPoints: 5,
      createdAt: "2025-12-20T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      sprintId: "sprint-24",
      dependencies: ["ISSUE-2"],
    },
    {
      id: "ISSUE-2",
      title: "Dependency",
      type: "task",
      status: "todo",
      assigneeId: "dev-1",
      acceptanceCriteria: "Dependency is available",
      createdAt: "2025-12-20T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sprintId: "sprint-24",
      dependencies: ["ISSUE-1"],
    },
    {
      id: "ISSUE-3",
      title: "Fresh work",
      type: "story",
      status: "in_progress",
      assigneeId: "dev-2",
      storyPoints: 10,
      createdAt: "2025-12-20T00:00:00.000Z",
      updatedAt: "2026-01-09T00:00:00.000Z",
      sprintId: "sprint-24",
      dependencies: [],
    },
    {
      id: "ISSUE-4",
      title: "Completed story",
      type: "story",
      status: "done",
      storyPoints: 5,
      acceptanceCriteria: "Released",
      createdAt: "2025-12-20T00:00:00.000Z",
      updatedAt: "2026-01-08T00:00:00.000Z",
      sprintId: "sprint-24",
      dependencies: [],
    },
  ],
  tasks: [
    {
      id: "ISSUE-1",
      title: "Blocked story",
      assigneeId: "dev-1",
      estimateHours: 10,
      status: "in_progress",
      dependencies: ["ISSUE-2"],
    },
    {
      id: "ISSUE-2",
      title: "Dependency",
      assigneeId: "dev-1",
      estimateHours: 5,
      status: "todo",
      dependencies: ["ISSUE-1"],
    },
    {
      id: "ISSUE-3",
      title: "Fresh work",
      assigneeId: "dev-2",
      estimateHours: 3,
      status: "in_progress",
      dependencies: [],
    },
  ],
};

const activities: Activity[] = [
  {
    id: "activity-1",
    issueId: "ISSUE-1",
    type: "added_to_sprint",
    occurredAt: "2026-01-03T00:00:00.000Z",
    toValue: "sprint-24",
  },
];

const history: SprintHistory[] = [
  {
    id: "history-1",
    sprintId: "previous-sprint",
    sprintName: "Previous sprint",
    startedAt: "2025-12-01",
    completedAt: "2025-12-14",
    committedStoryPoints: 15,
    completedStoryPoints: 10,
    carriedOverIssueIds: [],
  },
];

describe("createSprintHealthScoreSource", () => {
  it("derives all seven health inputs from repository analytics", async () => {
    const source = createSprintHealthScoreSource(
      {
        async getSprintById() {
          return sprint;
        },
        async getSprintActivities() {
          return activities;
        },
        async getSprintHistory() {
          return history;
        },
      },
      { clock: () => new Date("2026-01-10T00:00:00.000Z") },
    );

    const result = await source.calculate("sprint-24");
    const factors = Object.fromEntries(
      result.penalties.map(({ factor, valuePercent }) => [
        factor,
        valuePercent,
      ]),
    );

    assert.equal(result.score, 38);
    assert.deepEqual(factors, {
      blockedWorkPercent: 83.33333333333334,
      capacityImbalancePercent: 50,
      dependencyRiskPercent: 66.66666666666666,
      scopeGrowthPercent: 33.33,
      staleWorkPercent: 66.66666666666666,
      forecastCarryOverPercent: 50,
      qualityProblemPercent: 75,
    });
  });

  it("rejects a missing sprint", async () => {
    const source = createSprintHealthScoreSource({
      async getSprintById() {
        return undefined;
      },
      async getSprintActivities() {
        return [];
      },
      async getSprintHistory() {
        return [];
      },
    });

    await assert.rejects(
      source.calculate("missing"),
      /Sprint not found: missing/,
    );
  });
});
