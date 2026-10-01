import { z } from "zod";

import { sprintAnalysisSchema } from "./analysis.js";
import type { RiskEvidence, SprintAnalysis } from "./analysis.js";
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
  tools: Record<string, { description: string; inputSchema: z.ZodType }>;
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

function hasValue(value: unknown, expected: string | number): boolean {
  if (Object.is(value, expected)) return true;
  if (Array.isArray(value)) {
    return value.some((item) => hasValue(item, expected));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).some((item) => hasValue(item, expected));
  }
  return false;
}

function hasMetric(
  value: unknown,
  metric: string,
  expected?: string | number,
): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasMetric(item, metric, expected));
  }
  if (value === null || typeof value !== "object") return false;

  for (const [key, item] of Object.entries(value)) {
    if (
      key === metric &&
      (expected === undefined || hasValue(item, expected))
    ) {
      return true;
    }
    if (hasMetric(item, metric, expected)) return true;
  }
  return false;
}

function evidenceIsSupported(
  evidence: RiskEvidence,
  toolResults: AgentToolResult[],
): boolean {
  const outputs = toolResults.map(({ output }) => output);
  const issueIsSupported =
    evidence.issueId === undefined ||
    outputs.some((output) => hasValue(output, evidence.issueId!));
  const metricIsSupported =
    evidence.metric === undefined ||
    outputs.some((output) =>
      hasMetric(output, evidence.metric!, evidence.value),
    );

  return issueIsSupported && metricIsSupported;
}

function assertEvidenceProvenance(
  analysis: SprintAnalysis,
  toolResults: AgentToolResult[],
): void {
  for (const risk of analysis.risks) {
    for (const evidence of risk.evidence) {
      if (!evidenceIsSupported(evidence, toolResults)) {
        throw new Error(
          `Unsupported evidence in risk "${risk.title}": ${JSON.stringify(evidence)}`,
        );
      }
    }
  }
}

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
    const modelTools = Object.fromEntries(
      Object.entries(this.tools).map(([name, tool]) => [
        name,
        { description: tool.description, inputSchema: tool.inputSchema },
      ]),
    );

    for (let step = 1; step <= this.maxSteps; step += 1) {
      const modelStep = await this.model.nextStep({
        sprintId: parsedSprintId,
        deterministicHealthScore: parsedHealthScore,
        step,
        maxSteps: this.maxSteps,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: modelTools,
        toolResults: [...toolResults],
      });

      if (modelStep.type === "final") {
        const analysis = z
          .record(z.string(), z.unknown())
          .parse(modelStep.analysis);
        const parsedAnalysis = sprintAnalysisSchema.parse({
          ...analysis,
          healthScore: parsedHealthScore,
        });
        assertEvidenceProvenance(parsedAnalysis, toolResults);
        return parsedAnalysis;
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
