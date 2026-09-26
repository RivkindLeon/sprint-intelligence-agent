import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Sprint, SprintHistory } from "@sprint-intelligence/domain";

import {
  createGetDependencyRisksTool,
  createGetDeveloperWorkloadTool,
  createGetIssueTool,
  createGetIssuesByStatusTool,
  createGetQualityProblemsTool,
  createGetSprintOverviewTool,
  createGetSprintScopeChangesTool,
  createGetStaleIssuesTool,
  createGetVelocityHistoryTool,
  sprintAnalysisSchema,
} from "./index.js";

const sprint: Sprint = {
  id: "sprint-24",
  name: "Sprint 24",
  goal: "Ship secure invitations",
  startDate: "2026-09-01",
  endDate: "2026-09-14",
  developers: [
    { id: "dev-1", name: "Leon", capacityHoursPerWeek: 40 },
    { id: "dev-2", name: "Anna", capacityHoursPerWeek: 40 },
  ],
  issues: [
    {
      id: "AUTH-1",
      title: "Invitation API",
      type: "story",
      status: "done",
      assigneeId: "dev-1",
      storyPoints: 5,
      createdAt: "2026-08-20T09:00:00Z",
      updatedAt: "2026-09-05T09:00:00Z",
      sprintId: "sprint-24",
      dependencies: [],
    },
    {
      id: "AUTH-2",
      title: "Invitation screen",
      type: "story",
      status: "in_progress",
      assigneeId: "dev-2",
      storyPoints: 3,
      createdAt: "2026-08-21T09:00:00Z",
      updatedAt: "2026-09-06T09:00:00Z",
      sprintId: "sprint-24",
      dependencies: ["AUTH-1"],
    },
    {
      id: "AUTH-3",
      title: "Invitation audit",
      type: "task",
      status: "todo",
      createdAt: "2026-08-22T09:00:00Z",
      updatedAt: "2026-09-01T09:00:00Z",
      sprintId: "sprint-24",
      dependencies: [],
    },
    {
      id: "AUTH-4",
      title: "Invitation key rotation",
      type: "task",
      status: "blocked",
      storyPoints: 2,
      createdAt: "2026-08-23T09:00:00Z",
      updatedAt: "2026-09-02T09:00:00Z",
      sprintId: "sprint-24",
      dependencies: [],
    },
  ],
  tasks: [],
};

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

describe("getSprintOverview tool", () => {
  const repository = {
    async getSprintById(sprintId: string) {
      return sprintId === sprint.id ? sprint : undefined;
    },
  };
  const tool = createGetSprintOverviewTool(repository);

  it("returns a compact deterministic sprint summary", async () => {
    assert.deepEqual(await tool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      name: "Sprint 24",
      goal: "Ship secure invitations",
      startDate: "2026-09-01",
      endDate: "2026-09-14",
      developerCount: 2,
      issueCount: 4,
      estimatedIssueCount: 3,
      totalStoryPoints: 10,
      completedStoryPoints: 5,
      issueCountsByStatus: {
        todo: 1,
        in_progress: 1,
        blocked: 1,
        done: 1,
      },
    });
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetSprintOverviewTool({
      async getSprintById() {
        queryCount += 1;
        return sprint;
      },
    });

    await assert.rejects(validatingTool.execute({ sprintId: "", extra: true }));
    assert.equal(queryCount, 0);
  });

  it("reports a missing sprint explicitly", async () => {
    await assert.rejects(
      tool.execute({ sprintId: "missing" }),
      /Sprint not found: missing/,
    );
  });
});

describe("getIssue tool", () => {
  const issue = sprint.issues![1]!;
  const repository = {
    async getIssueById(issueId: string) {
      return issueId === issue.id ? issue : undefined;
    },
  };
  const tool = createGetIssueTool(repository);

  it("returns canonical issue details with dependency evidence", async () => {
    assert.deepEqual(await tool.execute({ issueId: "AUTH-2" }), {
      id: "AUTH-2",
      title: "Invitation screen",
      type: "story",
      status: "in_progress",
      assigneeId: "dev-2",
      storyPoints: 3,
      createdAt: "2026-08-21T09:00:00Z",
      updatedAt: "2026-09-06T09:00:00Z",
      sprintId: "sprint-24",
      dependencies: ["AUTH-1"],
    });
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetIssueTool({
      async getIssueById() {
        queryCount += 1;
        return issue;
      },
    });

    await assert.rejects(validatingTool.execute({ issueId: "", extra: true }));
    assert.equal(queryCount, 0);
  });

  it("reports a missing issue explicitly", async () => {
    await assert.rejects(
      tool.execute({ issueId: "missing" }),
      /Issue not found: missing/,
    );
  });
});

describe("getIssuesByStatus tool", () => {
  const repository = {
    async getIssuesByStatus(sprintId: string, status: string) {
      return sprint.issues!.filter(
        (issue) => issue.sprintId === sprintId && issue.status === status,
      );
    },
  };
  const tool = createGetIssuesByStatusTool(repository);

  it("returns compact issue evidence for the requested sprint and status", async () => {
    assert.deepEqual(
      await tool.execute({ sprintId: sprint.id, status: "in_progress" }),
      {
        sprintId: "sprint-24",
        status: "in_progress",
        issues: [
          {
            id: "AUTH-2",
            title: "Invitation screen",
            type: "story",
            status: "in_progress",
            assigneeId: "dev-2",
            storyPoints: 3,
            updatedAt: "2026-09-06T09:00:00Z",
            dependencies: ["AUTH-1"],
          },
        ],
      },
    );
  });

  it("returns an empty collection when no issues have the requested status", async () => {
    assert.deepEqual(
      await tool.execute({ sprintId: "missing", status: "done" }),
      { sprintId: "missing", status: "done", issues: [] },
    );
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetIssuesByStatusTool({
      async getIssuesByStatus() {
        queryCount += 1;
        return [];
      },
    });

    await assert.rejects(
      validatingTool.execute({
        sprintId: sprint.id,
        status: "review",
        extra: true,
      }),
    );
    assert.equal(queryCount, 0);
  });

  it("rejects repository results outside the requested sprint or status", async () => {
    const mismatchedStatusTool = createGetIssuesByStatusTool({
      async getIssuesByStatus() {
        return [sprint.issues![0]!];
      },
    });
    const mismatchedSprintTool = createGetIssuesByStatusTool({
      async getIssuesByStatus() {
        return [{ ...sprint.issues![0]!, sprintId: "other-sprint" }];
      },
    });

    await assert.rejects(
      mismatchedStatusTool.execute({ sprintId: sprint.id, status: "blocked" }),
    );
    await assert.rejects(
      mismatchedSprintTool.execute({ sprintId: sprint.id, status: "done" }),
    );
  });
});

describe("getDeveloperWorkload tool", () => {
  const sprintWithWorkload: Sprint = {
    ...sprint,
    developers: [
      { id: "dev-1", name: "Leon", capacityHoursPerWeek: 30 },
      { id: "dev-2", name: "Anna", capacityHoursPerWeek: 20 },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Invitation API",
        assigneeId: "dev-1",
        estimateHours: 18,
        status: "in_progress",
        dependencies: [],
      },
      {
        id: "task-2",
        title: "Invitation audit",
        assigneeId: "dev-1",
        estimateHours: 16,
        status: "todo",
        dependencies: ["task-1"],
      },
      {
        id: "task-3",
        title: "Invitation documentation",
        estimateHours: 5,
        status: "todo",
        dependencies: [],
      },
    ],
  };
  const repository = {
    async getSprintById(sprintId: string) {
      return sprintId === sprintWithWorkload.id
        ? sprintWithWorkload
        : undefined;
    },
  };
  const tool = createGetDeveloperWorkloadTool(repository);

  it("returns deterministic workload metrics with task evidence", async () => {
    assert.deepEqual(await tool.execute({ sprintId: sprintWithWorkload.id }), {
      sprintId: "sprint-24",
      workloads: [
        {
          developerId: "dev-1",
          developerName: "Leon",
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
          developerName: "Anna",
          capacityHours: 20,
          assignedHours: 0,
          taskCount: 0,
          taskIds: [],
          remainingCapacityHours: 20,
          overCapacityHours: 0,
          utilizationPercent: 0,
          status: "available",
        },
      ],
      totalCapacityHours: 50,
      totalAssignedHours: 39,
      totalUnassignedHours: 5,
      unassignedTaskIds: ["task-3"],
    });
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetDeveloperWorkloadTool({
      async getSprintById() {
        queryCount += 1;
        return sprintWithWorkload;
      },
    });

    await assert.rejects(validatingTool.execute({ sprintId: "", extra: true }));
    assert.equal(queryCount, 0);
  });

  it("reports a missing sprint explicitly", async () => {
    await assert.rejects(
      tool.execute({ sprintId: "missing" }),
      /Sprint not found: missing/,
    );
  });
});

describe("getVelocityHistory tool", () => {
  const history: SprintHistory[] = [
    {
      id: "history-22",
      sprintId: "sprint-22",
      sprintName: "Sprint 22",
      startedAt: "2026-08-04T09:00:00Z",
      completedAt: "2026-08-17T17:00:00Z",
      committedStoryPoints: 40,
      completedStoryPoints: 32,
      carriedOverIssueIds: ["AUTH-1"],
    },
    {
      id: "history-23",
      sprintId: "sprint-23",
      sprintName: "Sprint 23",
      startedAt: "2026-08-18T09:00:00Z",
      completedAt: "2026-08-31T17:00:00Z",
      committedStoryPoints: 50,
      completedStoryPoints: 43,
      carriedOverIssueIds: [],
    },
  ];
  const repository = {
    async getSprintHistory(sprintId: string) {
      return sprintId === sprint.id ? history : [];
    },
  };
  const tool = createGetVelocityHistoryTool(repository);

  it("returns deterministic historical velocity metrics", async () => {
    assert.deepEqual(await tool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      sprints: [
        {
          sprintId: "sprint-22",
          sprintName: "Sprint 22",
          committedStoryPoints: 40,
          completedStoryPoints: 32,
          completionRate: 80,
        },
        {
          sprintId: "sprint-23",
          sprintName: "Sprint 23",
          committedStoryPoints: 50,
          completedStoryPoints: 43,
          completionRate: 86,
        },
      ],
      sprintCount: 2,
      averageCommittedStoryPoints: 45,
      averageCompletedStoryPoints: 37.5,
      minCompletedStoryPoints: 32,
      maxCompletedStoryPoints: 43,
      completionRate: 83.33,
    });
  });

  it("returns a zero summary when no sprint history exists", async () => {
    assert.deepEqual(await tool.execute({ sprintId: "new-sprint" }), {
      sprintId: "new-sprint",
      sprints: [],
      sprintCount: 0,
      averageCommittedStoryPoints: 0,
      averageCompletedStoryPoints: 0,
      minCompletedStoryPoints: 0,
      maxCompletedStoryPoints: 0,
      completionRate: 0,
    });
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetVelocityHistoryTool({
      async getSprintHistory() {
        queryCount += 1;
        return history;
      },
    });

    await assert.rejects(validatingTool.execute({ sprintId: "", extra: true }));
    assert.equal(queryCount, 0);
  });
});

describe("getSprintScopeChanges tool", () => {
  const activities = [
    {
      id: "activity-1",
      issueId: "AUTH-4",
      type: "added_to_sprint" as const,
      occurredAt: "2026-09-03T10:00:00Z",
      toValue: sprint.id,
    },
    {
      id: "activity-2",
      issueId: "AUTH-2",
      type: "removed_from_sprint" as const,
      occurredAt: "2026-09-04T10:00:00Z",
      fromValue: sprint.id,
    },
  ];
  const repository = {
    async getSprintById(sprintId: string) {
      return sprintId === sprint.id ? sprint : undefined;
    },
    async getSprintActivities(sprintId: string) {
      return sprintId === sprint.id ? activities : [];
    },
  };
  const tool = createGetSprintScopeChangesTool(repository);

  it("returns deterministic scope metrics with issue and activity evidence", async () => {
    assert.deepEqual(await tool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      changes: [
        {
          activityId: "activity-1",
          issueId: "AUTH-4",
          type: "added_to_sprint",
          occurredAt: "2026-09-03T10:00:00Z",
          storyPoints: 2,
        },
        {
          activityId: "activity-2",
          issueId: "AUTH-2",
          type: "removed_from_sprint",
          occurredAt: "2026-09-04T10:00:00Z",
          storyPoints: 3,
        },
      ],
      addedIssueCount: 1,
      addedIssueIds: ["AUTH-4"],
      addedStoryPoints: 2,
      removedIssueCount: 1,
      removedIssueIds: ["AUTH-2"],
      removedStoryPoints: 3,
      netIssueCountChange: 0,
      netStoryPointChange: -1,
      initialIssueCount: 4,
      initialStoryPoints: 11,
      currentIssueCount: 4,
      currentStoryPoints: 10,
      storyPointGrowthPercent: -9.09,
    });
  });

  it("returns a zero-change summary when no scope activities exist", async () => {
    const noChangesTool = createGetSprintScopeChangesTool({
      async getSprintById() {
        return sprint;
      },
      async getSprintActivities() {
        return [];
      },
    });

    assert.deepEqual(await noChangesTool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      changes: [],
      addedIssueCount: 0,
      addedIssueIds: [],
      addedStoryPoints: 0,
      removedIssueCount: 0,
      removedIssueIds: [],
      removedStoryPoints: 0,
      netIssueCountChange: 0,
      netStoryPointChange: 0,
      initialIssueCount: 4,
      initialStoryPoints: 10,
      currentIssueCount: 4,
      currentStoryPoints: 10,
      storyPointGrowthPercent: 0,
    });
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetSprintScopeChangesTool({
      async getSprintById() {
        queryCount += 1;
        return sprint;
      },
      async getSprintActivities() {
        queryCount += 1;
        return activities;
      },
    });

    await assert.rejects(validatingTool.execute({ sprintId: "", extra: true }));
    assert.equal(queryCount, 0);
  });

  it("reports a missing sprint before querying activities", async () => {
    let activityQueryCount = 0;
    const missingSprintTool = createGetSprintScopeChangesTool({
      async getSprintById() {
        return undefined;
      },
      async getSprintActivities() {
        activityQueryCount += 1;
        return [];
      },
    });

    await assert.rejects(
      missingSprintTool.execute({ sprintId: "missing" }),
      /Sprint not found: missing/,
    );
    assert.equal(activityQueryCount, 0);
  });

  it("rejects scope activities targeting another sprint", async () => {
    const mismatchedActivityTool = createGetSprintScopeChangesTool({
      async getSprintById() {
        return sprint;
      },
      async getSprintActivities() {
        return [{ ...activities[0]!, toValue: "other-sprint" }];
      },
    });

    await assert.rejects(
      mismatchedActivityTool.execute({ sprintId: sprint.id }),
      /Activity repository returned data outside sprint sprint-24/,
    );
  });
});

describe("getDependencyRisks tool", () => {
  const sprintWithDependencyCycle: Sprint = {
    ...sprint,
    tasks: [
      {
        id: "AUTH-198",
        title: "Create invitation tokens",
        assigneeId: "dev-1",
        estimateHours: 8,
        status: "in_progress",
        dependencies: ["AUTH-231"],
      },
      {
        id: "AUTH-231",
        title: "Send invitation emails",
        assigneeId: "dev-2",
        estimateHours: 5,
        status: "todo",
        dependencies: ["AUTH-198"],
      },
      {
        id: "AUTH-250",
        title: "Document invitations",
        estimateHours: 2,
        status: "todo",
        dependencies: [],
      },
    ],
  };
  const repository = {
    async getSprintById(sprintId: string) {
      return sprintId === sprint.id ? sprintWithDependencyCycle : undefined;
    },
  };
  const tool = createGetDependencyRisksTool(repository);

  it("returns dependency cycles with exact task and edge evidence", async () => {
    assert.deepEqual(await tool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      risks: [
        {
          riskId: "dependency-cycle:AUTH-198:AUTH-231",
          taskIds: ["AUTH-198", "AUTH-231"],
          dependencyEdges: [
            { taskId: "AUTH-198", dependencyId: "AUTH-231" },
            { taskId: "AUTH-231", dependencyId: "AUTH-198" },
          ],
          hoursAtRisk: 13,
          reason: "AUTH-198->AUTH-231, AUTH-231->AUTH-198",
        },
      ],
      cycleCount: 1,
      affectedTaskCount: 2,
      affectedTaskIds: ["AUTH-198", "AUTH-231"],
      totalHoursAtRisk: 13,
    });
  });

  it("returns an empty risk summary when dependencies are acyclic", async () => {
    const acyclicTool = createGetDependencyRisksTool({
      async getSprintById() {
        return { ...sprint, tasks: sprintWithDependencyCycle.tasks.slice(2) };
      },
    });

    assert.deepEqual(await acyclicTool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      risks: [],
      cycleCount: 0,
      affectedTaskCount: 0,
      affectedTaskIds: [],
      totalHoursAtRisk: 0,
    });
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetDependencyRisksTool({
      async getSprintById() {
        queryCount += 1;
        return sprintWithDependencyCycle;
      },
    });

    await assert.rejects(validatingTool.execute({ sprintId: "", extra: true }));
    assert.equal(queryCount, 0);
  });

  it("reports a missing sprint explicitly", async () => {
    await assert.rejects(
      tool.execute({ sprintId: "missing" }),
      /Sprint not found: missing/,
    );
  });
});

describe("getStaleIssues tool", () => {
  const repository = {
    async getSprintById(sprintId: string) {
      return sprintId === sprint.id ? sprint : undefined;
    },
  };
  const tool = createGetStaleIssuesTool(repository, {
    clock: () => new Date("2026-09-10T12:00:00Z"),
    thresholdDays: 5,
  });

  it("returns deterministic stale-work metrics with exact issue evidence", async () => {
    assert.deepEqual(await tool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      staleIssues: [
        {
          issueId: "AUTH-3",
          issueTitle: "Invitation audit",
          status: "todo",
          assigneeId: undefined,
          storyPoints: undefined,
          updatedAt: "2026-09-01T09:00:00Z",
          staleDays: 9,
        },
        {
          issueId: "AUTH-4",
          issueTitle: "Invitation key rotation",
          status: "blocked",
          assigneeId: undefined,
          storyPoints: 2,
          updatedAt: "2026-09-02T09:00:00Z",
          staleDays: 8,
        },
      ],
      staleIssueCount: 2,
      staleIssueIds: ["AUTH-3", "AUTH-4"],
      staleStoryPoints: 2,
      thresholdDays: 5,
      referenceDate: "2026-09-10T12:00:00.000Z",
    });
  });

  it("returns an empty summary when no unfinished issue reaches the threshold", async () => {
    const freshTool = createGetStaleIssuesTool(repository, {
      clock: () => new Date("2026-09-07T08:00:00Z"),
      thresholdDays: 7,
    });

    assert.deepEqual(await freshTool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      staleIssues: [],
      staleIssueCount: 0,
      staleIssueIds: [],
      staleStoryPoints: 0,
      thresholdDays: 7,
      referenceDate: "2026-09-07T08:00:00.000Z",
    });
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetStaleIssuesTool({
      async getSprintById() {
        queryCount += 1;
        return sprint;
      },
    });

    await assert.rejects(validatingTool.execute({ sprintId: "", extra: true }));
    assert.equal(queryCount, 0);
  });

  it("reports a missing sprint explicitly", async () => {
    await assert.rejects(
      tool.execute({ sprintId: "missing" }),
      /Sprint not found: missing/,
    );
  });

  it("rejects invalid configured thresholds", async () => {
    const invalidThresholdTool = createGetStaleIssuesTool(repository, {
      clock: () => new Date("2026-09-10T12:00:00Z"),
      thresholdDays: 0,
    });

    await assert.rejects(
      invalidThresholdTool.execute({ sprintId: sprint.id }),
      /thresholdDays must be a positive integer/,
    );
  });
});

describe("getQualityProblems tool", () => {
  const repository = {
    async getSprintById(sprintId: string) {
      return sprintId === sprint.id ? sprint : undefined;
    },
  };
  const tool = createGetQualityProblemsTool(repository);

  it("returns deterministic quality problems with exact issue evidence", async () => {
    assert.deepEqual(await tool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      missingEstimates: [
        {
          issueId: "AUTH-3",
          issueTitle: "Invitation audit",
          issueType: "task",
          status: "todo",
          assigneeId: undefined,
        },
      ],
      missingEstimateCount: 1,
      missingEstimateIssueIds: ["AUTH-3"],
      missingAcceptanceCriteria: sprint.issues!.map((issue) => ({
        issueId: issue.id,
        issueTitle: issue.title,
        issueType: issue.type,
        status: issue.status,
        assigneeId: issue.assigneeId,
      })),
      missingAcceptanceCriteriaCount: 4,
      missingAcceptanceCriteriaIssueIds: [
        "AUTH-1",
        "AUTH-2",
        "AUTH-3",
        "AUTH-4",
      ],
    });
  });

  it("returns empty problem collections for a fully specified sprint", async () => {
    const completeTool = createGetQualityProblemsTool({
      async getSprintById() {
        return {
          ...sprint,
          issues: sprint.issues!.map((issue) => ({
            ...issue,
            storyPoints: issue.storyPoints ?? 1,
            acceptanceCriteria: "The expected behavior is verified.",
          })),
        };
      },
    });

    assert.deepEqual(await completeTool.execute({ sprintId: sprint.id }), {
      sprintId: "sprint-24",
      missingEstimates: [],
      missingEstimateCount: 0,
      missingEstimateIssueIds: [],
      missingAcceptanceCriteria: [],
      missingAcceptanceCriteriaCount: 0,
      missingAcceptanceCriteriaIssueIds: [],
    });
  });

  it("validates input before querying the repository", async () => {
    let queryCount = 0;
    const validatingTool = createGetQualityProblemsTool({
      async getSprintById() {
        queryCount += 1;
        return sprint;
      },
    });

    await assert.rejects(validatingTool.execute({ sprintId: "", extra: true }));
    assert.equal(queryCount, 0);
  });

  it("reports a missing sprint explicitly", async () => {
    await assert.rejects(
      tool.execute({ sprintId: "missing" }),
      /Sprint not found: missing/,
    );
  });
});
