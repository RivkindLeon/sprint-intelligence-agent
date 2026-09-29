import { z } from "zod";

import { sprintAnalysisSchema } from "./analysis.js";
import type { SprintAnalysis } from "./analysis.js";
import type { SprintHealthScoreSource } from "./health.js";

export interface AgentTool {
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  execute(input: unknown): Promise<unknown>;
}

export type AgentToolSet = Record<string, AgentTool>;

export interface AgentToolResult {
  step: number;
  toolName: string;
  input: unknown;
  output: unknown;
}

export interface AgentModelRequest {
  sprintId: string;
  deterministicHealthScore: number;
  step: number;
  maxSteps: number;
  systemInstruction: string;
  tools: Record<string, { description: string }>;
  toolResults: AgentToolResult[];
}

export type AgentModelStep =
  | { type: "tool_call"; toolName: string; input: unknown }
  | { type: "final"; analysis: unknown };

export interface SprintAnalysisModel {
  nextStep(request: AgentModelRequest): Promise<AgentModelStep>;
}

export interface SprintAnalysisAgentOptions {
  maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 8;

const SYSTEM_INSTRUCTION =
  "Investigate sprint delivery risks using the available tools. Every risk must cite exact issue or metric evidence from tool results. Do not calculate metrics or change the supplied deterministic health score.";

export class SprintAnalysisAgent {
  private readonly maxSteps: number;

  constructor(
    private readonly model: SprintAnalysisModel,
    private readonly tools: AgentToolSet,
    private readonly healthScoreSource: SprintHealthScoreSource,
    options: SprintAnalysisAgentOptions = {},
  ) {
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    if (!Number.isInteger(this.maxSteps) || this.maxSteps < 1) {
      throw new Error("maxSteps must be a positive integer");
    }
  }

  async analyze(sprintId: string): Promise<SprintAnalysis> {
    const parsedSprintId = z.string().trim().min(1).parse(sprintId);
    const parsedHealthScore = z
      .number()
      .int()
      .min(0)
      .max(100)
      .parse((await this.healthScoreSource.calculate(parsedSprintId)).score);
    const toolResults: AgentToolResult[] = [];
    const toolDescriptions = Object.fromEntries(
      Object.entries(this.tools).map(([name, tool]) => [
        name,
        { description: tool.description },
      ]),
    );

    for (let step = 1; step <= this.maxSteps; step += 1) {
      const modelStep = await this.model.nextStep({
        sprintId: parsedSprintId,
        deterministicHealthScore: parsedHealthScore,
        step,
        maxSteps: this.maxSteps,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: toolDescriptions,
        toolResults: [...toolResults],
      });

      if (modelStep.type === "final") {
        const analysis = z
          .record(z.string(), z.unknown())
          .parse(modelStep.analysis);
        return sprintAnalysisSchema.parse({
          ...analysis,
          healthScore: parsedHealthScore,
        });
      }

      const tool = this.tools[modelStep.toolName];
      if (tool === undefined) {
        throw new Error(`Unknown agent tool: ${modelStep.toolName}`);
      }

      const input = tool.inputSchema.parse(modelStep.input);
      const output = tool.outputSchema.parse(await tool.execute(input));
      toolResults.push({
        step,
        toolName: modelStep.toolName,
        input,
        output,
      });
    }

    throw new Error(
      `Sprint analysis exceeded the maximum of ${this.maxSteps} model steps`,
    );
  }
}
