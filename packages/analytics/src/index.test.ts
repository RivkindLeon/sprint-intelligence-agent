import assert from "node:assert";
import test from "node:test";

import type {
  Activity,
  Issue,
  Sprint,
  SprintHistory,
} from "@sprint-intelligence/domain";

import {
  calculateAllocationRiskSummary,
  calculateBlockedTaskRisks,
  calculateCarryOverRisk,
  calculateDependencyCycleRisks,
  calculateDeveloperWorkload,
  calculateReadyTaskSummary,
  calculateScopeChange,
  calculateSprintProgress,
  calculateTeamVelocity,
  findMissingAcceptanceCriteria,
  findMissingEstimates,
  findStaleIssues,
} from "./index.js";

test("calculateCarryOverRisk forecasts excess commitment with issue evidence", () => {
  const sprint: Sprint = {
    id: "sprint-24",
    name: "Sprint 24",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
    issues: [
      { ...createIssue("DONE-1", 20), status: "done" },
      {
        ...createIssue("AUTH-198", 20),
        status: "in_progress",
        assigneeId: "dev-1",
      },
      {
        ...createIssue("PAY-205", 15),
        status: "blocked",
        dependencies: ["AUTH-198"],
      },
      createIssue("TODO-1", 5),
    ],
  };
  const history: SprintHistory[] = [
    createHistory("sprint-22", 40, ["AUTH-198"]),
    createHistory("sprint-23", 50, ["AUTH-198", "PAY-205"]),
  ];

  assert.deepStrictEqual(calculateCarryOverRisk(sprint, history), {
    riskLevel: "high",
    atRiskIssues: [
      {
        issueId: "AUTH-198",
        issueTitle: "AUTH-198",
        status: "in_progress",
        assigneeId: "dev-1",
        storyPoints: 20,
        dependencyIds: [],
        previousCarryOverCount: 2,
      },
      {
        issueId: "PAY-205",
        issueTitle: "PAY-205",
        status: "blocked",
        assigneeId: undefined,
        storyPoints: 15,
        dependencyIds: ["AUTH-198"],
        previousCarryOverCount: 1,
      },
      {
        issueId: "TODO-1",
        issueTitle: "TODO-1",
        status: "todo",
        assigneeId: undefined,
        storyPoints: 5,
        dependencyIds: [],
        previousCarryOverCount: 0,
      },
    ],
    atRiskIssueCount: 3,
    atRiskIssueIds: ["AUTH-198", "PAY-205", "TODO-1"],
    committedStoryPoints: 60,
    completedStoryPoints: 20,
    unfinishedStoryPoints: 40,
    unestimatedUnfinishedIssueCount: 0,
    historicalAverageCompletedStoryPoints: 45,
    forecastCompletedStoryPoints: 45,
    forecastCarryOverStoryPoints: 15,
    forecastCarryOverPercent: 25,
  });
});

test("calculateCarryOverRisk flags unestimated unfinished work even within velocity", () => {
  const sprint: Sprint = {
    id: "sprint-24",
    name: "Sprint 24",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
    issues: [createIssue("UNKNOWN-1")],
  };

  const summary = calculateCarryOverRisk(sprint, [
    createHistory("sprint-23", 50),
  ]);

  assert.strictEqual(summary.riskLevel, "low");
  assert.strictEqual(summary.forecastCarryOverStoryPoints, 0);
  assert.strictEqual(summary.unestimatedUnfinishedIssueCount, 1);
  assert.deepStrictEqual(summary.atRiskIssueIds, ["UNKNOWN-1"]);
});

test("calculateCarryOverRisk returns no risk when forecast capacity covers the sprint", () => {
  const sprint: Sprint = {
    id: "sprint-24",
    name: "Sprint 24",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
    issues: [
      { ...createIssue("DONE-1", 20), status: "done" },
      createIssue("TODO-1", 10),
    ],
  };

  const summary = calculateCarryOverRisk(sprint, [
    createHistory("sprint-23", 40),
  ]);

  assert.strictEqual(summary.riskLevel, "none");
  assert.strictEqual(summary.forecastCompletedStoryPoints, 30);
  assert.deepStrictEqual(summary.atRiskIssues, []);
});

function createHistory(
  sprintId: string,
  completedStoryPoints: number,
  carriedOverIssueIds: string[] = [],
): SprintHistory {
  return {
    id: `history-${sprintId}`,
    sprintId,
    sprintName: sprintId,
    startedAt: "2026-08-01T09:00:00Z",
    completedAt: "2026-08-14T17:00:00Z",
    committedStoryPoints: completedStoryPoints + 10,
    completedStoryPoints,
    carriedOverIssueIds,
  };
}

test("calculateScopeChange reports sprint additions and removals with issue evidence", () => {
  const issues: Issue[] = [
    createIssue("CORE-1", 8),
    createIssue("CORE-2", 5),
    createIssue("ADDED-1", 3),
    createIssue("ADDED-2"),
  ];
  const sprint: Sprint = {
    id: "sprint-24",
    name: "Sprint 24",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    issues,
    tasks: [],
  };
  const activities: Activity[] = [
    createScopeActivity(
      "add-1",
      "ADDED-1",
      "added_to_sprint",
      "2026-09-03T11:00:00Z",
    ),
    createScopeActivity(
      "add-2",
      "ADDED-2",
      "added_to_sprint",
      "2026-09-05T10:00:00Z",
    ),
    createScopeActivity(
      "remove-1",
      "CORE-2",
      "removed_from_sprint",
      "2026-09-06T14:00:00Z",
    ),
    createScopeActivity(
      "other-sprint",
      "CORE-1",
      "added_to_sprint",
      "2026-09-04T10:00:00Z",
      "sprint-99",
    ),
    createScopeActivity(
      "before-start",
      "CORE-1",
      "added_to_sprint",
      "2026-08-31T10:00:00Z",
    ),
    {
      id: "status-change",
      issueId: "CORE-1",
      type: "status_changed",
      occurredAt: "2026-09-04T10:00:00Z",
      fromValue: "todo",
      toValue: "in_progress",
    },
  ];

  assert.deepStrictEqual(calculateScopeChange(sprint, activities), {
    changes: [
      {
        activityId: "add-1",
        issueId: "ADDED-1",
        type: "added_to_sprint",
        occurredAt: "2026-09-03T11:00:00Z",
        storyPoints: 3,
      },
      {
        activityId: "add-2",
        issueId: "ADDED-2",
        type: "added_to_sprint",
        occurredAt: "2026-09-05T10:00:00Z",
        storyPoints: 0,
      },
      {
        activityId: "remove-1",
        issueId: "CORE-2",
        type: "removed_from_sprint",
        occurredAt: "2026-09-06T14:00:00Z",
        storyPoints: 5,
      },
    ],
    addedIssueCount: 2,
    addedIssueIds: ["ADDED-1", "ADDED-2"],
    addedStoryPoints: 3,
    removedIssueCount: 1,
    removedIssueIds: ["CORE-2"],
    removedStoryPoints: 5,
    netIssueCountChange: 1,
    netStoryPointChange: -2,
    initialIssueCount: 3,
    initialStoryPoints: 18,
    currentIssueCount: 4,
    currentStoryPoints: 16,
    storyPointGrowthPercent: -11.11,
  });
});

test("calculateScopeChange returns a zero summary when scope did not change", () => {
  const sprint: Sprint = {
    id: "sprint-stable",
    name: "Stable sprint",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    issues: [createIssue("CORE-1", 5)],
    tasks: [],
  };

  assert.deepStrictEqual(calculateScopeChange(sprint, []), {
    changes: [],
    addedIssueCount: 0,
    addedIssueIds: [],
    addedStoryPoints: 0,
    removedIssueCount: 0,
    removedIssueIds: [],
    removedStoryPoints: 0,
    netIssueCountChange: 0,
    netStoryPointChange: 0,
    initialIssueCount: 1,
    initialStoryPoints: 5,
    currentIssueCount: 1,
    currentStoryPoints: 5,
    storyPointGrowthPercent: 0,
  });
});

function createIssue(id: string, storyPoints?: number): Issue {
  return {
    id,
    title: id,
    type: "story",
    status: "todo",
    storyPoints,
    createdAt: "2026-08-20T09:00:00Z",
    updatedAt: "2026-09-01T09:00:00Z",
    sprintId: "sprint-24",
    dependencies: [],
  };
}

function createScopeActivity(
  id: string,
  issueId: string,
  type: "added_to_sprint" | "removed_from_sprint",
  occurredAt: string,
  sprintId = "sprint-24",
): Activity {
  return {
    id,
    issueId,
    type,
    occurredAt,
    ...(type === "added_to_sprint"
      ? { toValue: sprintId }
      : { fromValue: sprintId }),
  };
}

test("calculateTeamVelocity summarizes completed story points across sprint history", () => {
  const history: SprintHistory[] = [
    {
      id: "history-21",
      sprintId: "sprint-21",
      sprintName: "Sprint 21",
      startedAt: "2026-07-21T09:00:00Z",
      completedAt: "2026-08-03T17:00:00Z",
      committedStoryPoints: 62,
      completedStoryPoints: 48,
      carriedOverIssueIds: ["OPS-77"],
    },
    {
      id: "history-22",
      sprintId: "sprint-22",
      sprintName: "Sprint 22",
      startedAt: "2026-08-04T09:00:00Z",
      completedAt: "2026-08-17T17:00:00Z",
      committedStoryPoints: 57,
      completedStoryPoints: 52,
      carriedOverIssueIds: [],
    },
    {
      id: "history-23",
      sprintId: "sprint-23",
      sprintName: "Sprint 23",
      startedAt: "2026-08-18T09:00:00Z",
      completedAt: "2026-08-31T17:00:00Z",
      committedStoryPoints: 60,
      completedStoryPoints: 49,
      carriedOverIssueIds: ["AUTH-198", "PAY-205"],
    },
  ];

  assert.deepStrictEqual(calculateTeamVelocity(history), {
    sprints: [
      {
        sprintId: "sprint-21",
        sprintName: "Sprint 21",
        committedStoryPoints: 62,
        completedStoryPoints: 48,
        completionRate: 77.42,
      },
      {
        sprintId: "sprint-22",
        sprintName: "Sprint 22",
        committedStoryPoints: 57,
        completedStoryPoints: 52,
        completionRate: 91.23,
      },
      {
        sprintId: "sprint-23",
        sprintName: "Sprint 23",
        committedStoryPoints: 60,
        completedStoryPoints: 49,
        completionRate: 81.67,
      },
    ],
    sprintCount: 3,
    averageCommittedStoryPoints: 59.67,
    averageCompletedStoryPoints: 49.67,
    minCompletedStoryPoints: 48,
    maxCompletedStoryPoints: 52,
    completionRate: 83.24,
  });
});

test("calculateTeamVelocity returns a zero summary without history", () => {
  assert.deepStrictEqual(calculateTeamVelocity([]), {
    sprints: [],
    sprintCount: 0,
    averageCommittedStoryPoints: 0,
    averageCompletedStoryPoints: 0,
    minCompletedStoryPoints: 0,
    maxCompletedStoryPoints: 0,
    completionRate: 0,
  });
});

test("findMissingEstimates reports issues without story points as evidence", () => {
  const sprint: Sprint = {
    id: "sprint-estimates",
    name: "Estimate audit",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
    issues: [
      {
        ...createIssue("MISSING-1"),
        title: "Paginate audit events",
        type: "task",
        assigneeId: "dev-1",
      },
      { ...createIssue("MISSING-2"), status: "done" },
      createIssue("ESTIMATED-1", 5),
      createIssue("ZERO-1", 0),
    ],
  };

  assert.deepStrictEqual(findMissingEstimates(sprint), {
    issues: [
      {
        issueId: "MISSING-1",
        issueTitle: "Paginate audit events",
        issueType: "task",
        status: "todo",
        assigneeId: "dev-1",
      },
      {
        issueId: "MISSING-2",
        issueTitle: "MISSING-2",
        issueType: "story",
        status: "done",
        assigneeId: undefined,
      },
    ],
    missingEstimateCount: 2,
    missingEstimateIssueIds: ["MISSING-1", "MISSING-2"],
  });
});

test("findMissingEstimates returns an empty summary without sprint issues", () => {
  const sprint: Sprint = {
    id: "sprint-empty",
    name: "Empty sprint",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
  };

  assert.deepStrictEqual(findMissingEstimates(sprint), {
    issues: [],
    missingEstimateCount: 0,
    missingEstimateIssueIds: [],
  });
});

test("findMissingAcceptanceCriteria reports blank or absent criteria as evidence", () => {
  const sprint: Sprint = {
    id: "sprint-quality",
    name: "Quality audit",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
    issues: [
      {
        ...createIssue("MISSING-AC-1", 5),
        title: "Document token refresh behavior",
        assigneeId: "dev-1",
      },
      {
        ...createIssue("BLANK-AC-1", 3),
        type: "bug",
        status: "done",
        acceptanceCriteria: "   ",
      },
      {
        ...createIssue("DEFINED-AC-1", 8),
        acceptanceCriteria: "Refresh succeeds without signing the user out.",
      },
    ],
  };

  assert.deepStrictEqual(findMissingAcceptanceCriteria(sprint), {
    issues: [
      {
        issueId: "MISSING-AC-1",
        issueTitle: "Document token refresh behavior",
        issueType: "story",
        status: "todo",
        assigneeId: "dev-1",
      },
      {
        issueId: "BLANK-AC-1",
        issueTitle: "BLANK-AC-1",
        issueType: "bug",
        status: "done",
        assigneeId: undefined,
      },
    ],
    missingAcceptanceCriteriaCount: 2,
    missingAcceptanceCriteriaIssueIds: ["MISSING-AC-1", "BLANK-AC-1"],
  });
});

test("findMissingAcceptanceCriteria returns an empty summary without sprint issues", () => {
  const sprint: Sprint = {
    id: "sprint-empty",
    name: "Empty sprint",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
  };

  assert.deepStrictEqual(findMissingAcceptanceCriteria(sprint), {
    issues: [],
    missingAcceptanceCriteriaCount: 0,
    missingAcceptanceCriteriaIssueIds: [],
  });
});

test("findStaleIssues reports unfinished issues at or beyond the configured threshold", () => {
  const sprint: Sprint = {
    id: "sprint-stale",
    name: "Stale work sprint",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
    issues: [
      {
        ...createIssue("STALE-1", 8),
        title: "Blocked authentication dependency",
        status: "blocked",
        assigneeId: "dev-1",
        updatedAt: "2026-09-05T12:00:00Z",
      },
      {
        ...createIssue("BOUNDARY-1"),
        status: "in_progress",
        updatedAt: "2026-09-07T12:00:00Z",
      },
      {
        ...createIssue("FRESH-1", 3),
        updatedAt: "2026-09-08T12:00:01Z",
      },
      {
        ...createIssue("DONE-1", 5),
        status: "done",
        updatedAt: "2026-08-20T09:00:00Z",
      },
    ],
  };

  assert.deepStrictEqual(
    findStaleIssues(sprint, {
      referenceDate: "2026-09-10T12:00:00Z",
      thresholdDays: 3,
    }),
    {
      staleIssues: [
        {
          issueId: "STALE-1",
          issueTitle: "Blocked authentication dependency",
          status: "blocked",
          assigneeId: "dev-1",
          storyPoints: 8,
          updatedAt: "2026-09-05T12:00:00Z",
          staleDays: 5,
        },
        {
          issueId: "BOUNDARY-1",
          issueTitle: "BOUNDARY-1",
          status: "in_progress",
          assigneeId: undefined,
          storyPoints: undefined,
          updatedAt: "2026-09-07T12:00:00Z",
          staleDays: 3,
        },
      ],
      staleIssueCount: 2,
      staleIssueIds: ["STALE-1", "BOUNDARY-1"],
      staleStoryPoints: 8,
      thresholdDays: 3,
      referenceDate: "2026-09-10T12:00:00.000Z",
    },
  );
});

test("findStaleIssues returns an empty summary without stale work", () => {
  const sprint: Sprint = {
    id: "sprint-fresh",
    name: "Fresh work sprint",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
  };

  assert.deepStrictEqual(
    findStaleIssues(sprint, { referenceDate: "2026-09-10T12:00:00Z" }),
    {
      staleIssues: [],
      staleIssueCount: 0,
      staleIssueIds: [],
      staleStoryPoints: 0,
      thresholdDays: 3,
      referenceDate: "2026-09-10T12:00:00.000Z",
    },
  );
});

test("findStaleIssues rejects invalid thresholds and timestamps", () => {
  const sprint: Sprint = {
    id: "sprint-invalid",
    name: "Invalid inputs",
    startDate: "2026-09-01",
    endDate: "2026-09-14",
    developers: [],
    tasks: [],
    issues: [createIssue("ISSUE-1")],
  };

  assert.throws(
    () => findStaleIssues(sprint, { thresholdDays: 0 }),
    /positive integer/,
  );
  assert.throws(
    () => findStaleIssues(sprint, { referenceDate: "not-a-date" }),
    /Invalid date/,
  );
});

test("calculateDependencyCycleRisks reports cycles with issue and dependency evidence", () => {
  const sprint: Sprint = {
    id: "sprint-cycles",
    name: "Cycle audit",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [],
    tasks: [
      {
        id: "task-a",
        title: "API",
        estimateHours: 5,
        status: "todo",
        dependencies: ["task-b"],
      },
      {
        id: "task-b",
        title: "Schema",
        estimateHours: 3,
        status: "in_progress",
        dependencies: ["task-a"],
      },
      {
        id: "task-c",
        title: "Docs",
        estimateHours: 2,
        status: "todo",
        dependencies: ["task-c"],
      },
      {
        id: "task-d",
        title: "Deploy",
        estimateHours: 4,
        status: "todo",
        dependencies: ["task-a", "missing"],
      },
    ],
  };

  assert.deepStrictEqual(calculateDependencyCycleRisks(sprint), {
    risks: [
      {
        riskId: "dependency-cycle:task-a:task-b",
        taskIds: ["task-a", "task-b"],
        dependencyEdges: [
          { taskId: "task-a", dependencyId: "task-b" },
          { taskId: "task-b", dependencyId: "task-a" },
        ],
        hoursAtRisk: 8,
        reason: "task-a->task-b, task-b->task-a",
      },
      {
        riskId: "dependency-cycle:task-c",
        taskIds: ["task-c"],
        dependencyEdges: [{ taskId: "task-c", dependencyId: "task-c" }],
        hoursAtRisk: 2,
        reason: "task-c->task-c",
      },
    ],
    cycleCount: 2,
    affectedTaskCount: 3,
    affectedTaskIds: ["task-a", "task-b", "task-c"],
    totalHoursAtRisk: 10,
  });
});

test("calculateDependencyCycleRisks ignores acyclic and missing dependencies", () => {
  const sprint: Sprint = {
    id: "sprint-acyclic",
    name: "Healthy graph",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [],
    tasks: [
      {
        id: "task-a",
        title: "Schema",
        estimateHours: 3,
        status: "done",
        dependencies: [],
      },
      {
        id: "task-b",
        title: "API",
        estimateHours: 5,
        status: "todo",
        dependencies: ["task-a"],
      },
      {
        id: "task-c",
        title: "UI",
        estimateHours: 4,
        status: "todo",
        dependencies: ["missing"],
      },
    ],
  };
  assert.deepStrictEqual(calculateDependencyCycleRisks(sprint), {
    risks: [],
    cycleCount: 0,
    affectedTaskCount: 0,
    affectedTaskIds: [],
    totalHoursAtRisk: 0,
  });
});

test("calculateDeveloperWorkload summarizes capacity, utilization, and unassigned work", () => {
  const sprint: Sprint = {
    id: "sprint-42",
    name: "Sprint 42",
    startDate: "2026-08-24",
    endDate: "2026-09-04",
    developers: [
      { id: "dev-1", name: "Alice", capacityHoursPerWeek: 30 },
      { id: "dev-2", name: "Bob", capacityHoursPerWeek: 20 },
      { id: "dev-3", name: "Carol", capacityHoursPerWeek: 0 },
    ],
    tasks: [
      {
        id: "task-1",
        title: "API endpoint",
        assigneeId: "dev-1",
        estimateHours: 18,
        status: "in_progress",
        dependencies: [],
      },
      {
        id: "task-2",
        title: "UI wiring",
        assigneeId: "dev-1",
        estimateHours: 16,
        status: "todo",
        dependencies: ["task-1"],
      },
      {
        id: "task-3",
        title: "Regression fix",
        assigneeId: "dev-2",
        estimateHours: 20,
        status: "todo",
        dependencies: [],
      },
      {
        id: "task-4",
        title: "Scope spike",
        estimateHours: 6,
        status: "todo",
        dependencies: ["task-2"],
      },
      {
        id: "task-5",
        title: "Docs handoff",
        assigneeId: "dev-3",
        estimateHours: 4,
        status: "todo",
        dependencies: [],
      },
    ],
  };

  const summary = calculateDeveloperWorkload(sprint);

  assert.deepStrictEqual(summary, {
    workloads: [
      {
        developerId: "dev-1",
        developerName: "Alice",
        capacityHours: 30,
        assignedHours: 34,
        taskCount: 2,
        taskIds: ["task-1", "task-2"],
        remainingCapacityHours: -4,
        overCapacityHours: 4,
        utilizationPercent: 113.33,
        status: "overallocated",
      },
      {
        developerId: "dev-2",
        developerName: "Bob",
        capacityHours: 20,
        assignedHours: 20,
        taskCount: 1,
        taskIds: ["task-3"],
        remainingCapacityHours: 0,
        overCapacityHours: 0,
        utilizationPercent: 100,
        status: "at_capacity",
      },
      {
        developerId: "dev-3",
        developerName: "Carol",
        capacityHours: 0,
        assignedHours: 4,
        taskCount: 1,
        taskIds: ["task-5"],
        remainingCapacityHours: -4,
        overCapacityHours: 4,
        utilizationPercent: 100,
        status: "overallocated",
      },
    ],
    totalCapacityHours: 50,
    totalAssignedHours: 64,
    totalUnassignedHours: 6,
    unassignedTaskIds: ["task-4"],
  });
});

test("calculateDeveloperWorkload marks under-capacity developers as available", () => {
  const sprint: Sprint = {
    id: "sprint-1",
    name: "Lean sprint",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [{ id: "dev-1", name: "Dana", capacityHoursPerWeek: 40 }],
    tasks: [
      {
        id: "task-1",
        title: "Bug fix",
        assigneeId: "dev-1",
        estimateHours: 8,
        status: "todo",
        dependencies: [],
      },
    ],
  };

  const summary = calculateDeveloperWorkload(sprint);

  assert.deepStrictEqual(summary.workloads[0], {
    developerId: "dev-1",
    developerName: "Dana",
    capacityHours: 40,
    assignedHours: 8,
    taskCount: 1,
    taskIds: ["task-1"],
    remainingCapacityHours: 32,
    overCapacityHours: 0,
    utilizationPercent: 20,
    status: "available",
  });
  assert.strictEqual(summary.totalUnassignedHours, 0);
  assert.deepStrictEqual(summary.unassignedTaskIds, []);
});

test("calculateBlockedTaskRisks returns task-level risks with explicit dependency evidence", () => {
  const sprint: Sprint = {
    id: "sprint-risk-1",
    name: "Dependency heavy sprint",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [
      { id: "dev-1", name: "Alice", capacityHoursPerWeek: 30 },
      { id: "dev-2", name: "Bob", capacityHoursPerWeek: 30 },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Backend schema",
        assigneeId: "dev-1",
        estimateHours: 10,
        status: "done",
        dependencies: [],
      },
      {
        id: "task-2",
        title: "API endpoint",
        assigneeId: "dev-1",
        estimateHours: 12,
        status: "in_progress",
        dependencies: ["task-1"],
      },
      {
        id: "task-3",
        title: "Frontend integration",
        assigneeId: "dev-2",
        estimateHours: 8,
        status: "todo",
        dependencies: ["task-2"],
      },
      {
        id: "task-4",
        title: "QA pass",
        estimateHours: 6,
        status: "todo",
        dependencies: ["task-3", "task-99"],
      },
    ],
  };

  const summary = calculateBlockedTaskRisks(sprint);

  assert.deepStrictEqual(summary, {
    risks: [
      {
        taskId: "task-3",
        taskTitle: "Frontend integration",
        assigneeId: "dev-2",
        blockedBy: [
          { dependencyId: "task-2", dependencyStatus: "in_progress" },
        ],
        blockedHours: 8,
        reason: "task-2:in_progress",
      },
      {
        taskId: "task-4",
        taskTitle: "QA pass",
        assigneeId: undefined,
        blockedBy: [
          { dependencyId: "task-3", dependencyStatus: "todo" },
          { dependencyId: "task-99", dependencyStatus: "missing" },
        ],
        blockedHours: 6,
        reason: "task-3:todo, task-99:missing",
      },
    ],
    blockedTaskCount: 2,
    blockedHours: 14,
    blockedTaskIds: ["task-3", "task-4"],
  });
});

test("calculateBlockedTaskRisks ignores completed tasks and ready work", () => {
  const sprint: Sprint = {
    id: "sprint-risk-2",
    name: "Ready sprint",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [{ id: "dev-1", name: "Eve", capacityHoursPerWeek: 40 }],
    tasks: [
      {
        id: "task-1",
        title: "Completed dependency",
        assigneeId: "dev-1",
        estimateHours: 5,
        status: "done",
        dependencies: [],
      },
      {
        id: "task-2",
        title: "Ready follow-up",
        assigneeId: "dev-1",
        estimateHours: 3,
        status: "todo",
        dependencies: ["task-1"],
      },
    ],
  };

  const summary = calculateBlockedTaskRisks(sprint);

  assert.deepStrictEqual(summary, {
    risks: [],
    blockedTaskCount: 0,
    blockedHours: 0,
    blockedTaskIds: [],
  });
});

test("calculateReadyTaskSummary returns executable tasks grouped by assignee", () => {
  const sprint: Sprint = {
    id: "sprint-ready-1",
    name: "Execution sprint",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [
      { id: "dev-1", name: "Alice", capacityHoursPerWeek: 30 },
      { id: "dev-2", name: "Bob", capacityHoursPerWeek: 20 },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Schema",
        assigneeId: "dev-1",
        estimateHours: 5,
        status: "done",
        dependencies: [],
      },
      {
        id: "task-2",
        title: "API endpoint",
        assigneeId: "dev-1",
        estimateHours: 8,
        status: "in_progress",
        dependencies: ["task-1"],
      },
      {
        id: "task-3",
        title: "Frontend wiring",
        assigneeId: "dev-2",
        estimateHours: 6,
        status: "todo",
        dependencies: ["task-1"],
      },
      {
        id: "task-4",
        title: "QA pass",
        estimateHours: 4,
        status: "todo",
        dependencies: ["task-2"],
      },
      {
        id: "task-5",
        title: "Release notes",
        estimateHours: 2,
        status: "todo",
        dependencies: [],
      },
      {
        id: "task-6",
        title: "Follow-up",
        assigneeId: "dev-2",
        estimateHours: 3,
        status: "todo",
        dependencies: ["task-99"],
      },
    ],
  };

  const summary = calculateReadyTaskSummary(sprint);

  assert.deepStrictEqual(summary, {
    readyTasks: [
      {
        taskId: "task-2",
        taskTitle: "API endpoint",
        assigneeId: "dev-1",
        assigneeName: "Alice",
        status: "in_progress",
        estimateHours: 8,
        dependencyIds: ["task-1"],
      },
      {
        taskId: "task-3",
        taskTitle: "Frontend wiring",
        assigneeId: "dev-2",
        assigneeName: "Bob",
        status: "todo",
        estimateHours: 6,
        dependencyIds: ["task-1"],
      },
      {
        taskId: "task-5",
        taskTitle: "Release notes",
        assigneeId: undefined,
        assigneeName: undefined,
        status: "todo",
        estimateHours: 2,
        dependencyIds: [],
      },
    ],
    readyTaskCount: 3,
    readyHours: 16,
    readyTaskIds: ["task-2", "task-3", "task-5"],
    readyUnassignedTaskCount: 1,
    readyUnassignedHours: 2,
    readyUnassignedTaskIds: ["task-5"],
    readyByAssignee: [
      {
        assigneeId: "dev-1",
        assigneeName: "Alice",
        taskCount: 1,
        totalHours: 8,
        taskIds: ["task-2"],
      },
      {
        assigneeId: "dev-2",
        assigneeName: "Bob",
        taskCount: 1,
        totalHours: 6,
        taskIds: ["task-3"],
      },
      {
        assigneeId: undefined,
        assigneeName: "Unassigned",
        taskCount: 1,
        totalHours: 2,
        taskIds: ["task-5"],
      },
    ],
  });
});

test("calculateReadyTaskSummary ignores done tasks and blocked tasks", () => {
  const sprint: Sprint = {
    id: "sprint-ready-2",
    name: "Blocked sprint",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [],
    tasks: [
      {
        id: "task-1",
        title: "Done task",
        estimateHours: 1,
        status: "done",
        dependencies: [],
      },
      {
        id: "task-2",
        title: "Blocked task",
        estimateHours: 3,
        status: "todo",
        dependencies: ["task-1", "task-3"],
      },
      {
        id: "task-3",
        title: "Not started dependency",
        estimateHours: 2,
        status: "todo",
        dependencies: [],
      },
    ],
  };

  const summary = calculateReadyTaskSummary(sprint);

  assert.deepStrictEqual(summary.readyTaskIds, ["task-3"]);
  assert.strictEqual(summary.readyTaskCount, 1);
  assert.strictEqual(summary.readyHours, 2);
});

test("calculateAllocationRiskSummary highlights overloaded developers and ready unassigned work", () => {
  const sprint: Sprint = {
    id: "sprint-allocation-1",
    name: "Allocation pressure sprint",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [
      { id: "dev-1", name: "Alice", capacityHoursPerWeek: 20 },
      { id: "dev-2", name: "Bob", capacityHoursPerWeek: 12 },
      { id: "dev-3", name: "Carol", capacityHoursPerWeek: 5 },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Backend API",
        assigneeId: "dev-1",
        estimateHours: 14,
        status: "in_progress",
        dependencies: [],
      },
      {
        id: "task-2",
        title: "Frontend flow",
        assigneeId: "dev-1",
        estimateHours: 10,
        status: "todo",
        dependencies: [],
      },
      {
        id: "task-3",
        title: "QA pass",
        assigneeId: "dev-2",
        estimateHours: 4,
        status: "todo",
        dependencies: [],
      },
      {
        id: "task-4",
        title: "Docs",
        estimateHours: 3,
        status: "todo",
        dependencies: [],
      },
      {
        id: "task-5",
        title: "Release prep",
        estimateHours: 7,
        status: "todo",
        dependencies: [],
      },
    ],
  };

  const summary = calculateAllocationRiskSummary(sprint);

  assert.deepStrictEqual(summary, {
    risks: [
      {
        riskId: "overallocated:dev-1",
        kind: "overallocated_developer",
        severity: "medium",
        developerId: "dev-1",
        developerName: "Alice",
        taskIds: ["task-1", "task-2"],
        hoursAtRisk: 4,
        reason: "Overallocated by 4h; ready tasks can be reassigned",
      },
      {
        riskId: "unassigned:task-4",
        kind: "unassigned_ready_task",
        severity: "medium",
        taskIds: ["task-4"],
        hoursAtRisk: 3,
        reason: "Ready but unassigned; fits dev-2, dev-3",
      },
      {
        riskId: "unassigned:task-5",
        kind: "unassigned_ready_task",
        severity: "high",
        taskIds: ["task-5"],
        hoursAtRisk: 7,
        reason:
          "Ready but unassigned; no developer has enough remaining capacity",
      },
    ],
    riskCount: 3,
    highRiskCount: 1,
    totalHoursAtRisk: 14,
  });
});

test("calculateAllocationRiskSummary omits balanced sprints", () => {
  const sprint: Sprint = {
    id: "sprint-allocation-2",
    name: "Balanced sprint",
    startDate: "2026-08-24",
    endDate: "2026-08-31",
    developers: [{ id: "dev-1", name: "Dana", capacityHoursPerWeek: 20 }],
    tasks: [
      {
        id: "task-1",
        title: "Bugfix",
        assigneeId: "dev-1",
        estimateHours: 8,
        status: "todo",
        dependencies: [],
      },
    ],
  };

  const summary = calculateAllocationRiskSummary(sprint);

  assert.deepStrictEqual(summary, {
    risks: [],
    riskCount: 0,
    highRiskCount: 0,
    totalHoursAtRisk: 0,
  });
});

test("calculateSprintProgress summarizes status mix, elapsed time, and delivery projection", () => {
  const sprint: Sprint = {
    id: "sprint-progress-1",
    name: "Execution sprint",
    startDate: "2026-08-24",
    endDate: "2026-08-30",
    developers: [
      { id: "dev-1", name: "Alice", capacityHoursPerWeek: 30 },
      { id: "dev-2", name: "Bob", capacityHoursPerWeek: 25 },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Foundation",
        assigneeId: "dev-1",
        estimateHours: 8,
        status: "done",
        dependencies: [],
      },
      {
        id: "task-2",
        title: "API integration",
        assigneeId: "dev-1",
        estimateHours: 10,
        status: "done",
        dependencies: [],
      },
      {
        id: "task-3",
        title: "Frontend wiring",
        assigneeId: "dev-2",
        estimateHours: 6,
        status: "in_progress",
        dependencies: [],
      },
      {
        id: "task-4",
        title: "QA pass",
        assigneeId: "dev-2",
        estimateHours: 4,
        status: "todo",
        dependencies: ["task-3"],
      },
      {
        id: "task-5",
        title: "Release notes",
        estimateHours: 2,
        status: "todo",
        dependencies: [],
      },
    ],
  };

  const summary = calculateSprintProgress(sprint, {
    referenceDate: "2026-08-26",
  });

  assert.deepStrictEqual(summary, {
    totalTaskCount: 5,
    totalEstimatedHours: 30,
    statusBreakdown: [
      {
        status: "todo",
        taskCount: 2,
        totalHours: 6,
        taskIds: ["task-4", "task-5"],
      },
      {
        status: "in_progress",
        taskCount: 1,
        totalHours: 6,
        taskIds: ["task-3"],
      },
      {
        status: "done",
        taskCount: 2,
        totalHours: 18,
        taskIds: ["task-1", "task-2"],
      },
    ],
    completedTaskCount: 2,
    completedHours: 18,
    inProgressTaskCount: 1,
    inProgressHours: 6,
    todoTaskCount: 2,
    todoHours: 6,
    completionRateByTasks: 40,
    completionRateByHours: 60,
    sprintDurationDays: 7,
    elapsedSprintDays: 3,
    remainingSprintDays: 4,
    elapsedSprintPercent: 42.86,
    averageCompletedHoursPerElapsedDay: 6,
    projectedCompletedHoursBySprintEnd: 42,
    projectedCompletionRateByHours: 140,
    isProjectedToComplete: true,
  });
});

test("calculateSprintProgress clamps elapsed days before the sprint starts", () => {
  const sprint: Sprint = {
    id: "sprint-progress-2",
    name: "Future sprint",
    startDate: "2026-09-10",
    endDate: "2026-09-16",
    developers: [],
    tasks: [
      {
        id: "task-1",
        title: "Prep",
        estimateHours: 5,
        status: "todo",
        dependencies: [],
      },
    ],
  };

  const summary = calculateSprintProgress(sprint, {
    referenceDate: "2026-09-08",
  });

  assert.strictEqual(summary.elapsedSprintDays, 0);
  assert.strictEqual(summary.remainingSprintDays, 7);
  assert.strictEqual(summary.elapsedSprintPercent, 0);
  assert.strictEqual(summary.averageCompletedHoursPerElapsedDay, 0);
  assert.strictEqual(summary.projectedCompletedHoursBySprintEnd, 0);
  assert.strictEqual(summary.isProjectedToComplete, false);
});

test("calculateSprintProgress clamps elapsed days after the sprint ends", () => {
  const sprint: Sprint = {
    id: "sprint-progress-3",
    name: "Finished sprint",
    startDate: "2026-08-01",
    endDate: "2026-08-07",
    developers: [],
    tasks: [
      {
        id: "task-1",
        title: "Follow-up",
        estimateHours: 3,
        status: "done",
        dependencies: [],
      },
    ],
  };

  const summary = calculateSprintProgress(sprint, {
    referenceDate: "2026-08-20",
  });

  assert.strictEqual(summary.elapsedSprintDays, 7);
  assert.strictEqual(summary.remainingSprintDays, 0);
  assert.strictEqual(summary.elapsedSprintPercent, 100);
  assert.strictEqual(summary.projectedCompletedHoursBySprintEnd, 3);
  assert.strictEqual(summary.projectedCompletionRateByHours, 100);
  assert.strictEqual(summary.isProjectedToComplete, true);
});
