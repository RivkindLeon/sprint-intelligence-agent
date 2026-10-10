import {
  SprintAnalysisAgent,
  createGetBlockedIssuesTool,
  createGetDependencyRisksTool,
  createGetDeveloperWorkloadTool,
  createGetIssueTool,
  createGetIssuesByStatusTool,
  createGetQualityProblemsTool,
  createGetSprintOverviewTool,
  createGetSprintScopeChangesTool,
  createGetStaleIssuesTool,
  createGetVelocityHistoryTool,
  createSprintAnalysisModelFromEnv,
  createSprintHealthScoreSource,
  type SprintAnalysis,
} from "@sprint-intelligence/ai";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { AgentRunRepository } from "./database/agent-run-repository.js";
import { SprintAnalysisRepository } from "./database/sprint-analysis-repository.js";
import type * as schema from "./database/schema.js";

export interface SprintAnalyzer {
  analyze(sprintId: string): Promise<SprintAnalysis>;
}

export function createSprintAnalyzer(
  db: PostgresJsDatabase<typeof schema>,
  environment: NodeJS.ProcessEnv = process.env,
  modelFactory: typeof createSprintAnalysisModelFromEnv = createSprintAnalysisModelFromEnv,
): SprintAnalyzer {
  const repository = new SprintAnalysisRepository(db);
  const runRepository = new AgentRunRepository(db);
  const tools = {
    getSprintOverview: createGetSprintOverviewTool(repository),
    getIssue: createGetIssueTool(repository),
    getIssuesByStatus: createGetIssuesByStatusTool(repository),
    getDeveloperWorkload: createGetDeveloperWorkloadTool(repository),
    getVelocityHistory: createGetVelocityHistoryTool(repository),
    getSprintScopeChanges: createGetSprintScopeChangesTool(repository),
    getBlockedIssues: createGetBlockedIssuesTool(repository),
    getDependencyRisks: createGetDependencyRisksTool(repository),
    getStaleIssues: createGetStaleIssuesTool(repository),
    getQualityProblems: createGetQualityProblemsTool(repository),
  };
  const health = createSprintHealthScoreSource(repository);

  return {
    async analyze(sprintId) {
      // Defer AI configuration until analysis is requested. Read-only endpoints
      // remain usable without credentials.
      const configured = modelFactory(environment);
      return new SprintAnalysisAgent(configured.model, tools, health, {
        observability: {
          model: `${configured.provider}/${configured.modelId}`,
          repository: runRepository,
        },
      }).analyze(sprintId);
    },
  };
}
