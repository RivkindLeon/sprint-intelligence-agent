import { randomUUID } from "node:crypto";

import type { AgentRunPersistence, JsonValue } from "@sprint-intelligence/ai";
import { asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { agentRuns, agentToolCalls } from "./schema.js";
import type * as schema from "./schema.js";

export interface StartAgentRunInput {
  sprintId: string;
  model: string;
  startedAt: string;
}

export interface RecordAgentToolCallInput {
  step: number;
  toolName: string;
  durationMs: number;
  status: "completed" | "failed";
  input: JsonValue;
  resultMetadata?: JsonValue;
  error?: string;
}

export interface CompleteAgentRunInput {
  endedAt: string;
  tokenUsage?: JsonValue;
  finalResult: JsonValue;
}

export interface FailAgentRunInput {
  endedAt: string;
  tokenUsage?: JsonValue;
  error: string;
}

export class AgentRunRepository implements AgentRunPersistence {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async start(input: StartAgentRunInput): Promise<string> {
    const id = randomUUID();
    await this.db.insert(agentRuns).values({ id, ...input });
    return id;
  }

  async recordToolCall(
    runId: string,
    input: RecordAgentToolCallInput,
  ): Promise<void> {
    await this.db.insert(agentToolCalls).values({
      id: randomUUID(),
      runId,
      ...input,
    });
  }

  async complete(runId: string, input: CompleteAgentRunInput): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({
        status: "completed",
        endedAt: input.endedAt,
        tokenUsage: input.tokenUsage,
        finalResult: input.finalResult,
        error: null,
      })
      .where(eq(agentRuns.id, runId));
  }

  async fail(runId: string, input: FailAgentRunInput): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({
        status: "failed",
        endedAt: input.endedAt,
        tokenUsage: input.tokenUsage,
        error: input.error,
        finalResult: null,
      })
      .where(eq(agentRuns.id, runId));
  }

  async getById(runId: string) {
    const run = await this.db.query.agentRuns.findFirst({
      where: eq(agentRuns.id, runId),
    });
    if (run === undefined) return undefined;

    const toolCalls = await this.db
      .select()
      .from(agentToolCalls)
      .where(eq(agentToolCalls.runId, runId))
      .orderBy(asc(agentToolCalls.step));

    return { ...run, toolCalls };
  }
}
