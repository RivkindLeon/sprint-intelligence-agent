import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Sprint } from "@sprint-intelligence/domain";

import {
  createGetIssueTool,
  createGetIssuesByStatusTool,
  createGetSprintOverviewTool,
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
