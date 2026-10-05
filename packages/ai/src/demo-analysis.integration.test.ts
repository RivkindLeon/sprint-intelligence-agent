import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type {
  Activity,
  Developer,
  Issue,
  Sprint,
  SprintHistory,
} from "@sprint-intelligence/domain";

import {
  SprintAnalysisAgent,
  type AgentModelRequest,
  type AgentRunPersistence,
  type JsonValue,
} from "./agent.js";
import { createSprintHealthScoreSource } from "./health.js";
import {
  createGetBlockedIssuesTool,
  createGetDeveloperWorkloadTool,
  createGetQualityProblemsTool,
  createGetSprintOverviewTool,
} from "./index.js";

type DemoSprint = Omit<Sprint, "developers" | "issues" | "tasks"> & {
  developerIds: string[];
};

type DemoDeveloper = Omit<Developer, "capacityHoursPerWeek"> & {
  capacityStoryPoints: number;
};

type DemoIssue = Issue & { addedToSprintAt?: string };

async function readDemoFile<T>(name: string): Promise<T> {
  const file = new URL(`../../../demo/sprint/${name}`, import.meta.url);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function loadDemoAnalysisData(): Promise<{
  sprint: Sprint;
  activities: Activity[];
  history: SprintHistory[];
}> {
  const [demoSprint, demoDevelopers, issues, history] = await Promise.all([
    readDemoFile<DemoSprint>("sprint.json"),
    readDemoFile<DemoDeveloper[]>("developers.json"),
    readDemoFile<DemoIssue[]>("issues.json"),
    readDemoFile<SprintHistory[]>("history.json"),
  ]);
  const developers = demoDevelopers.map((developer): Developer => ({
    ...developer,
    // Transitional analytics use hours; preserve the demo's relative
    // point capacities until those analytics use the canonical issue model.
    capacityHoursPerWeek: developer.capacityStoryPoints,
  }));
  const sprint: Sprint = {
    id: demoSprint.id,
    name: demoSprint.name,
    goal: demoSprint.goal,
    startDate: demoSprint.startDate,
    endDate: demoSprint.endDate,
    developers,
    issues,
    tasks: issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      assigneeId: issue.assigneeId,
      estimateHours: issue.storyPoints ?? 0,
      status: issue.status === "blocked" ? "in_progress" : issue.status,
      dependencies: issue.dependencies,
    })),
  };
  const activities = issues.flatMap((issue): Activity[] =>
    issue.addedToSprintAt === undefined
      ? []
      : [
          {
            id: `demo-added-${issue.id}`,
            issueId: issue.id,
            type: "added_to_sprint",
            occurredAt: issue.addedToSprintAt,
            toValue: sprint.id,
          },
        ],
  );

  return { sprint, activities, history };
}

function createInMemoryRunRepository() {
  const runs: Array<{
    id: string;
    sprintId: string;
    model: string;
    startedAt: string;
    endedAt?: string;
    finalResult?: JsonValue;
  }> = [];
  const toolCalls: Array<{
    runId: string;
    step: number;
    toolName: string;
    status: "completed" | "failed";
    resultMetadata?: JsonValue;
  }> = [];
  const repository: AgentRunPersistence = {
    async start(input) {
      const id = `run-${runs.length + 1}`;
      runs.push({ id, ...input });
      return id;
    },
    async recordToolCall(runId, input) {
      toolCalls.push({
        runId,
        step: input.step,
        toolName: input.toolName,
        status: input.status,
        resultMetadata: input.resultMetadata,
      });
    },
    async complete(runId, input) {
      const run = runs.find(({ id }) => id === runId);
      assert.ok(run);
      run.endedAt = input.endedAt;
      run.finalResult = input.finalResult;
    },
    async fail() {},
  };

  return { repository, runs, toolCalls };
}

test("analyzes the synthetic sprint end to end without a real LLM", async () => {
  const { sprint, activities, history } = await loadDemoAnalysisData();
  const repository = {
    async getSprintById(sprintId: string) {
      return sprintId === sprint.id ? sprint : undefined;
    },
    async getSprintActivities(sprintId: string) {
      return sprintId === sprint.id ? activities : [];
    },
    async getSprintHistory(sprintId: string) {
      return sprintId === sprint.id ? history : [];
    },
  };
  const healthScoreSource = createSprintHealthScoreSource(repository, {
    clock: () => new Date("2026-09-10T12:00:00.000Z"),
  });
  const expectedHealth = await healthScoreSource.calculate(sprint.id);
  const requests: AgentModelRequest[] = [];
  const model = {
    async nextStep(request: AgentModelRequest) {
      requests.push(request);
      if (request.step === 1) {
        return {
          type: "tool_call" as const,
          toolName: "getSprintOverview",
          input: { sprintId: request.sprintId },
        };
      }
      if (request.step === 2) {
        return {
          type: "tool_call" as const,
          toolName: "getBlockedIssues",
          input: { sprintId: request.sprintId },
        };
      }
      if (request.step === 3) {
        return {
          type: "tool_call" as const,
          toolName: "getDeveloperWorkload",
          input: { sprintId: request.sprintId },
        };
      }
      if (request.step === 4) {
        return {
          type: "tool_call" as const,
          toolName: "getQualityProblems",
          input: { sprintId: request.sprintId },
        };
      }

      const blocked = request.toolResults.find(
        ({ toolName }) => toolName === "getBlockedIssues",
      )?.output as { blockedIssueCount: number };
      const quality = request.toolResults.find(
        ({ toolName }) => toolName === "getQualityProblems",
      )?.output as { missingAcceptanceCriteriaCount: number };

      return {
        type: "final" as const,
        analysis: {
          healthScore: 1,
          summary:
            "Unfinished dependencies, workload imbalance, and quality gaps threaten delivery.",
          risks: [
            {
              severity: "critical",
              category: "blocker",
              title: "Payment delivery depends on unfinished infrastructure",
              explanation:
                "PAY-205 is blocked by OPS-91, which is not completed.",
              evidence: [
                { issueId: "PAY-205" },
                { issueId: "OPS-91" },
                {
                  metric: "blockedIssueCount",
                  value: blocked.blockedIssueCount,
                },
              ],
              recommendation: "Complete OPS-91 before resuming PAY-205.",
              confidence: 0.98,
            },
            {
              severity: "high",
              category: "capacity",
              title: "Leon is over capacity",
              explanation:
                "Leon has more unfinished assigned work than his configured capacity.",
              evidence: [
                { issueId: "AUTH-231" },
                { metric: "status", value: "overallocated" },
              ],
              confidence: 0.95,
            },
            {
              severity: "medium",
              category: "quality",
              title: "Acceptance criteria are missing",
              explanation:
                "Several issues do not define verifiable acceptance criteria.",
              evidence: [
                {
                  metric: "missingAcceptanceCriteriaCount",
                  value: quality.missingAcceptanceCriteriaCount,
                },
              ],
              confidence: 0.99,
            },
          ],
        },
      };
    },
  };
  const {
    repository: runRepository,
    runs,
    toolCalls,
  } = createInMemoryRunRepository();
  const tools = {
    getSprintOverview: createGetSprintOverviewTool(repository),
    getBlockedIssues: createGetBlockedIssuesTool(repository),
    getDeveloperWorkload: createGetDeveloperWorkloadTool(repository),
    getQualityProblems: createGetQualityProblemsTool(repository),
  };
  const timestamps = [
    "2026-09-10T12:00:00.000Z",
    "2026-09-10T12:00:00.010Z",
    "2026-09-10T12:00:00.020Z",
    "2026-09-10T12:00:00.030Z",
    "2026-09-10T12:00:00.040Z",
    "2026-09-10T12:00:00.050Z",
    "2026-09-10T12:00:00.060Z",
    "2026-09-10T12:00:00.070Z",
    "2026-09-10T12:00:00.080Z",
    "2026-09-10T12:00:00.090Z",
  ];
  const agent = new SprintAnalysisAgent(model, tools, healthScoreSource, {
    maxSteps: 5,
    observability: {
      model: "fake-demo-model",
      repository: runRepository,
      now: () => new Date(timestamps.shift()!),
    },
  });

  const analysis = await agent.analyze(sprint.id);

  assert.equal(analysis.healthScore, expectedHealth.score);
  assert.notEqual(analysis.healthScore, 1);
  assert.equal(analysis.risks.length, 3);
  assert.deepEqual(
    requests.at(-1)?.toolResults.map(({ toolName }) => toolName),
    [
      "getSprintOverview",
      "getBlockedIssues",
      "getDeveloperWorkload",
      "getQualityProblems",
    ],
  );
  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.model, "fake-demo-model");
  assert.deepEqual(runs[0]?.finalResult, analysis);
  assert.ok(runs[0]?.endedAt);
  assert.deepEqual(
    toolCalls.map(({ step, toolName, status }) => ({
      step,
      toolName,
      status,
    })),
    [
      { step: 1, toolName: "getSprintOverview", status: "completed" },
      { step: 2, toolName: "getBlockedIssues", status: "completed" },
      { step: 3, toolName: "getDeveloperWorkload", status: "completed" },
      { step: 4, toolName: "getQualityProblems", status: "completed" },
    ],
  );
  assert.ok(toolCalls.every(({ resultMetadata }) => resultMetadata));
});
