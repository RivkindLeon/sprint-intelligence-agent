import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LanguageModel } from "ai";
import { z } from "zod";

import type { AgentModelRequest } from "./agent.js";
import { VercelAiSdkSprintAnalysisModel } from "./vercel-ai-sdk-model.js";

const languageModel = {} as LanguageModel;

const request: AgentModelRequest = {
  sprintId: "sprint-24",
  deterministicHealthScore: 68,
  step: 2,
  maxSteps: 8,
  systemInstruction: "Investigate using deterministic tool evidence.",
  tools: {
    getSprintOverview: {
      description: "Return sprint overview facts.",
      inputSchema: z.object({ sprintId: z.string() }).strict(),
    },
  },
  toolResults: [
    {
      step: 1,
      toolName: "getIssue",
      input: { issueId: "AUTH-2" },
      output: { issueId: "AUTH-2", status: "blocked" },
    },
  ],
};

const finalAnalysis = {
  healthScore: 68,
  summary: "Blocked work threatens delivery.",
  risks: [
    {
      severity: "high" as const,
      category: "blocker" as const,
      title: "Authentication is blocked",
      explanation: "AUTH-2 is blocked.",
      evidence: [{ issueId: "AUTH-2" }],
      confidence: 0.9,
    },
  ],
};

describe("VercelAiSdkSprintAnalysisModel", () => {
  it("maps an AI SDK tool call to one provider-agnostic agent step", async () => {
    let capturedOptions: Record<string, unknown> | undefined;
    const model = new VercelAiSdkSprintAnalysisModel(languageModel, {
      generate: async (options) => {
        capturedOptions = options as unknown as Record<string, unknown>;
        return {
          toolCalls: [
            {
              type: "tool-call",
              toolCallId: "call-1",
              toolName: "getSprintOverview",
              input: { sprintId: "sprint-24" },
            },
          ],
          output: undefined,
        } as never;
      },
    });

    assert.deepEqual(await model.nextStep(request), {
      type: "tool_call",
      toolName: "getSprintOverview",
      input: { sprintId: "sprint-24" },
    });
    assert.equal(capturedOptions?.model, languageModel);
    assert.equal(capturedOptions?.system, request.systemInstruction);
    assert.match(
      String(capturedOptions?.prompt),
      /deterministic health score is 68/,
    );
    assert.match(String(capturedOptions?.prompt), /AUTH-2/);
    assert.ok(capturedOptions?.tools);
    assert.ok(capturedOptions?.output);
  });

  it("maps a structured AI SDK output to a final agent step", async () => {
    const model = new VercelAiSdkSprintAnalysisModel(languageModel, {
      generate: async () => ({ toolCalls: [], output: finalAnalysis }) as never,
    });

    assert.deepEqual(await model.nextStep(request), {
      type: "final",
      analysis: finalAnalysis,
    });
  });

  it("rejects multiple tool calls because the outer loop executes one step at a time", async () => {
    const model = new VercelAiSdkSprintAnalysisModel(languageModel, {
      generate: async () =>
        ({
          toolCalls: [
            { toolName: "first", input: {} },
            { toolName: "second", input: {} },
          ],
          output: undefined,
        }) as never,
    });

    await assert.rejects(
      model.nextStep(request),
      /requested multiple tools in one step/,
    );
  });
});
