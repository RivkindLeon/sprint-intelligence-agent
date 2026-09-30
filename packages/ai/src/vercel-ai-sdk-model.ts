import {
  generateText,
  Output,
  tool,
  type GenerateTextResult,
  type LanguageModel,
  type ToolSet,
} from "ai";

import type {
  AgentModelRequest,
  AgentModelStep,
  SprintAnalysisModel,
} from "./agent.js";
import { sprintAnalysisSchema } from "./analysis.js";

type Generate = (
  options: Parameters<typeof generateText>[0],
) => Promise<
  Pick<
    GenerateTextResult<ToolSet, never, ReturnType<typeof Output.object>>,
    "output" | "toolCalls"
  >
>;

export interface VercelAiSdkSprintAnalysisModelOptions {
  generate?: Generate;
}

/**
 * Adapts any Vercel AI SDK language model to the provider-agnostic agent loop.
 * Tool execution and step limiting remain owned by SprintAnalysisAgent.
 */
export class VercelAiSdkSprintAnalysisModel implements SprintAnalysisModel {
  private readonly generate: Generate;

  constructor(
    private readonly model: LanguageModel,
    options: VercelAiSdkSprintAnalysisModelOptions = {},
  ) {
    this.generate = options.generate ?? (generateText as Generate);
  }

  async nextStep(request: AgentModelRequest): Promise<AgentModelStep> {
    const tools = Object.fromEntries(
      Object.entries(request.tools).map(([name, definition]) => [
        name,
        tool({
          description: definition.description,
          inputSchema: definition.inputSchema,
        }),
      ]),
    );

    const result = await this.generate({
      model: this.model,
      system: request.systemInstruction,
      prompt: buildPrompt(request),
      tools,
      output: Output.object({
        schema: sprintAnalysisSchema,
        name: "sprintAnalysis",
        description:
          "A sprint risk analysis whose health score exactly matches the supplied deterministic score and whose risks cite tool evidence.",
      }),
    });

    if (result.toolCalls.length > 1) {
      throw new Error(
        "The sprint analysis model requested multiple tools in one step",
      );
    }

    const toolCall = result.toolCalls[0];
    if (toolCall !== undefined) {
      return {
        type: "tool_call",
        toolName: toolCall.toolName,
        input: toolCall.input,
      };
    }

    return { type: "final", analysis: result.output };
  }
}

function buildPrompt(request: AgentModelRequest): string {
  return [
    `Analyze sprint ${JSON.stringify(request.sprintId)}.`,
    `The deterministic health score is ${request.deterministicHealthScore}.`,
    `This is model step ${request.step} of at most ${request.maxSteps}.`,
    "Call at most one tool in this step. If the evidence is sufficient, return the final structured analysis.",
    `Validated tool results from earlier steps:\n${JSON.stringify(request.toolResults)}`,
  ].join("\n");
}
