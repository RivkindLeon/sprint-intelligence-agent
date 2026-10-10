import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { z } from "zod";

import {
  SprintAnalysisAgent,
  type AgentRunPersistence,
  type AgentModelRequest,
  type AgentModelStep,
  type JsonValue,
} from "./agent.js";

const overviewTool = {
  description: "Return deterministic sprint completion facts.",
  inputSchema: z.object({ sprintId: z.string() }).strict(),
  outputSchema: z
    .object({
      sprintId: z.string(),
      completedStoryPoints: z.number(),
      issueIds: z.array(z.string()),
    })
    .strict(),
  async execute(input: unknown) {
    const { sprintId } = this.inputSchema.parse(input);
    return { sprintId, completedStoryPoints: 13, issueIds: ["AUTH-2"] };
  },
};

const healthScoreSource = {
  async calculate() {
    return { score: 68, penalties: [], totalPenalty: 32 };
  },
};

function createModel(steps: AgentModelStep[]) {
  const requests: AgentModelRequest[] = [];
  return {
    requests,
    async nextStep(request: AgentModelRequest) {
      requests.push(request);
      const step = steps.shift();
      if (step === undefined) throw new Error("Unexpected model call");
      return step;
    },
  };
}

function createRunRepository() {
  const events: Array<{ type: string; runId?: string; input: unknown }> = [];
  const repository: AgentRunPersistence = {
    async start(input) {
      events.push({ type: "start", input });
      return "run-1";
    },
    async recordToolCall(runId, input) {
      events.push({ type: "tool", runId, input });
    },
    async complete(runId, input) {
      events.push({ type: "complete", runId, input });
    },
    async fail(runId, input) {
      events.push({ type: "fail", runId, input });
    },
  };
  return { events, repository };
}

function sequenceClock(...timestamps: string[]) {
  return () => new Date(timestamps.shift() ?? "2026-10-03T16:30:10.000Z");
}

const finalAnalysis = {
  healthScore: 1,
  summary: "Completion is behind plan.",
  risks: [
    {
      severity: "high",
      category: "delivery",
      title: "Incomplete committed work",
      explanation: "The sprint has completed only 13 story points.",
      evidence: [
        { metric: "completedStoryPoints", value: 13 },
        { issueId: "AUTH-2" },
      ],
      confidence: 0.9,
    },
  ],
};

describe("SprintAnalysisAgent", () => {
  it("runs validated tools and returns a schema-validated final analysis", async () => {
    const model = createModel([
      {
        type: "tool_call",
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
      },
      { type: "final", analysis: finalAnalysis },
    ]);
    const agent = new SprintAnalysisAgent(
      model,
      { getSprintOverview: overviewTool },
      healthScoreSource,
    );

    const result = await agent.analyze("sprint-24");

    assert.equal(result.healthScore, 68);
    assert.equal(model.requests.length, 2);
    assert.deepEqual(model.requests[1]!.toolResults, [
      {
        step: 1,
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
        output: {
          sprintId: "sprint-24",
          completedStoryPoints: 13,
          issueIds: ["AUTH-2"],
        },
      },
    ]);
  });

  it("rejects unsupported final risks through the output schema", async () => {
    const model = createModel([
      {
        type: "final",
        analysis: {
          ...finalAnalysis,
          risks: [{ ...finalAnalysis.risks[0], evidence: [] }],
        },
      },
    ]);

    await assert.rejects(
      new SprintAnalysisAgent(model, {}, healthScoreSource).analyze(
        "sprint-24",
      ),
    );
  });

  it("rejects issue evidence that was not returned by a tool in this run", async () => {
    const model = createModel([
      {
        type: "tool_call",
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
      },
      {
        type: "final",
        analysis: {
          ...finalAnalysis,
          risks: [
            {
              ...finalAnalysis.risks[0],
              evidence: [{ issueId: "AUTH-999" }],
            },
          ],
        },
      },
    ]);

    await assert.rejects(
      new SprintAnalysisAgent(
        model,
        { getSprintOverview: overviewTool },
        healthScoreSource,
      ).analyze("sprint-24"),
      /Unsupported evidence.*AUTH-999/,
    );
  });

  it("rejects metric values that differ from validated tool output", async () => {
    const model = createModel([
      {
        type: "tool_call",
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
      },
      {
        type: "final",
        analysis: {
          ...finalAnalysis,
          risks: [
            {
              ...finalAnalysis.risks[0],
              evidence: [
                { issueId: "AUTH-2" },
                { metric: "completedStoryPoints", value: 21 },
              ],
            },
          ],
        },
      },
    ]);

    await assert.rejects(
      new SprintAnalysisAgent(
        model,
        { getSprintOverview: overviewTool },
        healthScoreSource,
      ).analyze("sprint-24"),
      /Unsupported evidence.*completedStoryPoints/,
    );
  });

  it("rejects model requests for unknown tools", async () => {
    const model = createModel([
      { type: "tool_call", toolName: "getEverything", input: {} },
    ]);

    await assert.rejects(
      new SprintAnalysisAgent(model, {}, healthScoreSource).analyze(
        "sprint-24",
      ),
      /Unknown agent tool: getEverything/,
    );
  });

  it("stops after the configured maximum number of model steps", async () => {
    const model = createModel([
      {
        type: "tool_call",
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
      },
      {
        type: "tool_call",
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
      },
    ]);
    const agent = new SprintAnalysisAgent(
      model,
      { getSprintOverview: overviewTool },
      healthScoreSource,
      { maxSteps: 2 },
    );

    await assert.rejects(
      agent.analyze("sprint-24"),
      /exceeded the maximum of 2 model steps/,
    );
    assert.equal(model.requests.length, 2);
  });

  it("persists the run lifecycle and compact successful tool metadata", async () => {
    const model = createModel([
      {
        type: "tool_call",
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
      },
      { type: "final", analysis: finalAnalysis },
    ]);
    const { events, repository } = createRunRepository();
    const agent = new SprintAnalysisAgent(
      model,
      { getSprintOverview: overviewTool },
      healthScoreSource,
      {
        observability: {
          model: "test-model",
          repository,
          now: sequenceClock(
            "2026-10-03T16:30:00.000Z",
            "2026-10-03T16:30:01.000Z",
            "2026-10-03T16:30:01.025Z",
            "2026-10-03T16:30:02.000Z",
          ),
        },
      },
    );

    await agent.analyze("sprint-24");

    assert.deepEqual(events[0], {
      type: "start",
      input: {
        sprintId: "sprint-24",
        model: "test-model",
        startedAt: "2026-10-03T16:30:00.000Z",
      },
    });
    assert.deepEqual(events[1], {
      type: "tool",
      runId: "run-1",
      input: {
        step: 1,
        toolName: "getSprintOverview",
        durationMs: 25,
        status: "completed",
        input: { sprintId: "sprint-24" },
        resultMetadata: {
          type: "object",
          fields: ["completedStoryPoints", "issueIds", "sprintId"],
        },
      },
    });
    assert.equal(events[2]!.type, "complete");
    assert.equal(
      (events[2]!.input as { endedAt: string }).endedAt,
      "2026-10-03T16:30:02.000Z",
    );
    assert.deepEqual(
      (events[2]!.input as { finalResult: JsonValue }).finalResult,
      { ...finalAnalysis, healthScore: 68 },
    );
  });

  it("persists failed tool calls and marks the run failed", async () => {
    const failure = new Error("repository unavailable");
    const failingTool = {
      ...overviewTool,
      async execute() {
        throw failure;
      },
    };
    const model = createModel([
      {
        type: "tool_call",
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
      },
    ]);
    const { events, repository } = createRunRepository();
    const agent = new SprintAnalysisAgent(
      model,
      { getSprintOverview: failingTool },
      healthScoreSource,
      {
        observability: {
          model: "test-model",
          repository,
          now: sequenceClock(
            "2026-10-03T16:30:00.000Z",
            "2026-10-03T16:30:01.000Z",
            "2026-10-03T16:30:01.040Z",
            "2026-10-03T16:30:02.000Z",
          ),
        },
      },
    );

    await assert.rejects(agent.analyze("sprint-24"), failure);
    assert.deepEqual(events.slice(1), [
      {
        type: "tool",
        runId: "run-1",
        input: {
          step: 1,
          toolName: "getSprintOverview",
          durationMs: 40,
          status: "failed",
          input: { sprintId: "sprint-24" },
          error: "repository unavailable",
        },
      },
      {
        type: "fail",
        runId: "run-1",
        input: {
          endedAt: "2026-10-03T16:30:02.000Z",
          error: "repository unavailable",
        },
      },
    ]);
  });
});
