import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { z } from "zod";

import {
  SprintAnalysisAgent,
  type AgentModelRequest,
  type AgentModelStep,
} from "./agent.js";

const overviewTool = {
  description: "Return deterministic sprint completion facts.",
  inputSchema: z.object({ sprintId: z.string() }).strict(),
  outputSchema: z
    .object({ sprintId: z.string(), completedStoryPoints: z.number() })
    .strict(),
  async execute(input: unknown) {
    const { sprintId } = this.inputSchema.parse(input);
    return { sprintId, completedStoryPoints: 13 };
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
    const agent = new SprintAnalysisAgent(model, {
      getSprintOverview: overviewTool,
    });

    const result = await agent.analyze("sprint-24", 68);

    assert.equal(result.healthScore, 68);
    assert.equal(model.requests.length, 2);
    assert.deepEqual(model.requests[1]!.toolResults, [
      {
        step: 1,
        toolName: "getSprintOverview",
        input: { sprintId: "sprint-24" },
        output: { sprintId: "sprint-24", completedStoryPoints: 13 },
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
      new SprintAnalysisAgent(model, {}).analyze("sprint-24", 68),
    );
  });

  it("rejects model requests for unknown tools", async () => {
    const model = createModel([
      { type: "tool_call", toolName: "getEverything", input: {} },
    ]);

    await assert.rejects(
      new SprintAnalysisAgent(model, {}).analyze("sprint-24", 68),
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
      { maxSteps: 2 },
    );

    await assert.rejects(
      agent.analyze("sprint-24", 68),
      /exceeded the maximum of 2 model steps/,
    );
    assert.equal(model.requests.length, 2);
  });
});
