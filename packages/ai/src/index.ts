import { z } from "zod";

import {
  calculateDependencyCycleRisks,
  calculateDeveloperWorkload,
  calculateScopeChange,
  calculateTeamVelocity,
  findStaleIssues,
} from "@sprint-intelligence/analytics";
import type {
  Activity,
  Issue,
  IssueStatus,
  Sprint,
  SprintHistory,
} from "@sprint-intelligence/domain";

export interface SprintRepository {
  getSprintById(sprintId: string): Promise<Sprint | undefined>;
}

export interface IssueRepository {
  getIssueById(issueId: string): Promise<Issue | undefined>;
}

export interface IssueCollectionRepository {
  getIssuesByStatus(sprintId: string, status: IssueStatus): Promise<Issue[]>;
}

export interface VelocityHistoryRepository {
  getSprintHistory(sprintId: string): Promise<SprintHistory[]>;
}

export interface SprintScopeChangeRepository extends SprintRepository {
  getSprintActivities(sprintId: string): Promise<Activity[]>;
}

export interface GetStaleIssuesToolOptions {
  clock?: () => Date;
  thresholdDays?: number;
}

export const getStaleIssuesInputSchema = z
  .object({
    sprintId: z.string().trim().min(1),
  })
  .strict();

const staleIssueSchema = z
  .object({
    issueId: z.string().min(1),
    issueTitle: z.string().min(1),
    status: z.enum(["todo", "in_progress", "blocked"]),
    assigneeId: z.string().min(1).optional(),
    storyPoints: z.number().nonnegative().optional(),
    updatedAt: z.string().min(1),
    staleDays: z.number().int().nonnegative(),
  })
  .strict();

export const getStaleIssuesOutputSchema = z
  .object({
    sprintId: z.string().min(1),
    staleIssues: z.array(staleIssueSchema),
    staleIssueCount: z.number().int().nonnegative(),
    staleIssueIds: z.array(z.string().min(1)),
    staleStoryPoints: z.number().nonnegative(),
    thresholdDays: z.number().int().positive(),
    referenceDate: z.string().datetime(),
  })
  .strict();

export type GetStaleIssuesInput = z.infer<typeof getStaleIssuesInputSchema>;
export type GetStaleIssuesOutput = z.infer<typeof getStaleIssuesOutputSchema>;

export function createGetStaleIssuesTool(
  repository: SprintRepository,
  options: GetStaleIssuesToolOptions = {},
): SprintTool<GetStaleIssuesInput, GetStaleIssuesOutput> {
  const clock = options.clock ?? (() => new Date());

  return {
    description:
      "Return deterministic stale unfinished issues with exact issue, status, update-time, age, assignment, and estimate evidence.",
    inputSchema: getStaleIssuesInputSchema,
    outputSchema: getStaleIssuesOutputSchema,
    async execute(input: unknown) {
      const { sprintId } = getStaleIssuesInputSchema.parse(input);
      const sprint = await repository.getSprintById(sprintId);

      if (sprint === undefined) {
        throw new Error(`Sprint not found: ${sprintId}`);
      }

      return getStaleIssuesOutputSchema.parse({
        sprintId: sprint.id,
        ...findStaleIssues(sprint, {
          referenceDate: clock(),
          thresholdDays: options.thresholdDays,
        }),
      });
    },
  };
}

export const getDependencyRisksInputSchema = z
  .object({
    sprintId: z.string().trim().min(1),
  })
  .strict();

const dependencyEdgeSchema = z
  .object({
    taskId: z.string().min(1),
    dependencyId: z.string().min(1),
  })
  .strict();

const dependencyCycleRiskSchema = z
  .object({
    riskId: z.string().min(1),
    taskIds: z.array(z.string().min(1)).min(1),
    dependencyEdges: z.array(dependencyEdgeSchema).min(1),
    hoursAtRisk: z.number().nonnegative(),
    reason: z.string().min(1),
  })
  .strict();

export const getDependencyRisksOutputSchema = z
  .object({
    sprintId: z.string().min(1),
    risks: z.array(dependencyCycleRiskSchema),
    cycleCount: z.number().int().nonnegative(),
    affectedTaskCount: z.number().int().nonnegative(),
    affectedTaskIds: z.array(z.string().min(1)),
    totalHoursAtRisk: z.number().nonnegative(),
  })
  .strict();

export type GetDependencyRisksInput = z.infer<
  typeof getDependencyRisksInputSchema
>;
export type GetDependencyRisksOutput = z.infer<
  typeof getDependencyRisksOutputSchema
>;

export function createGetDependencyRisksTool(
  repository: SprintRepository,
): SprintTool<GetDependencyRisksInput, GetDependencyRisksOutput> {
  return {
    description:
      "Return deterministic dependency-cycle risks with exact task and dependency-edge evidence for one sprint.",
    inputSchema: getDependencyRisksInputSchema,
    outputSchema: getDependencyRisksOutputSchema,
    async execute(input: unknown) {
      const { sprintId } = getDependencyRisksInputSchema.parse(input);
      const sprint = await repository.getSprintById(sprintId);

      if (sprint === undefined) {
        throw new Error(`Sprint not found: ${sprintId}`);
      }

      return getDependencyRisksOutputSchema.parse({
        sprintId: sprint.id,
        ...calculateDependencyCycleRisks(sprint),
      });
    },
  };
}

export const getSprintOverviewInputSchema = z
  .object({
    sprintId: z.string().trim().min(1),
  })
  .strict();

const issueStatusCountSchema = z
  .object({
    todo: z.number().int().nonnegative(),
    in_progress: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
  })
  .strict();

export const getSprintOverviewOutputSchema = z
  .object({
    sprintId: z.string().min(1),
    name: z.string().min(1),
    goal: z.string().min(1).optional(),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    developerCount: z.number().int().nonnegative(),
    issueCount: z.number().int().nonnegative(),
    estimatedIssueCount: z.number().int().nonnegative(),
    totalStoryPoints: z.number().nonnegative(),
    completedStoryPoints: z.number().nonnegative(),
    issueCountsByStatus: issueStatusCountSchema,
  })
  .strict();

export type GetSprintOverviewInput = z.infer<
  typeof getSprintOverviewInputSchema
>;
export type GetSprintOverviewOutput = z.infer<
  typeof getSprintOverviewOutputSchema
>;

export interface SprintTool<TInput, TOutput> {
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  execute(input: unknown): Promise<TOutput>;
}

const ISSUE_STATUSES: IssueStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
];

export function createGetSprintOverviewTool(
  repository: SprintRepository,
): SprintTool<GetSprintOverviewInput, GetSprintOverviewOutput> {
  return {
    description:
      "Return compact identifying, schedule, staffing, issue, and story-point facts for one sprint.",
    inputSchema: getSprintOverviewInputSchema,
    outputSchema: getSprintOverviewOutputSchema,
    async execute(input: unknown) {
      const { sprintId } = getSprintOverviewInputSchema.parse(input);
      const sprint = await repository.getSprintById(sprintId);

      if (sprint === undefined) {
        throw new Error(`Sprint not found: ${sprintId}`);
      }

      const issues = sprint.issues ?? [];
      const issueCountsByStatus = Object.fromEntries(
        ISSUE_STATUSES.map((status) => [
          status,
          issues.filter((issue) => issue.status === status).length,
        ]),
      ) as Record<IssueStatus, number>;
      const estimatedIssues = issues.filter(
        (issue) => issue.storyPoints !== undefined,
      );

      return getSprintOverviewOutputSchema.parse({
        sprintId: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        developerCount: sprint.developers.length,
        issueCount: issues.length,
        estimatedIssueCount: estimatedIssues.length,
        totalStoryPoints: estimatedIssues.reduce(
          (total, issue) => total + issue.storyPoints!,
          0,
        ),
        completedStoryPoints: issues.reduce(
          (total, issue) =>
            issue.status === "done" ? total + (issue.storyPoints ?? 0) : total,
          0,
        ),
        issueCountsByStatus,
      });
    },
  };
}

export const getIssueInputSchema = z
  .object({
    issueId: z.string().trim().min(1),
  })
  .strict();

export const getIssueOutputSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["story", "bug", "task"]),
    status: z.enum(["todo", "in_progress", "blocked", "done"]),
    assigneeId: z.string().min(1).optional(),
    storyPoints: z.number().nonnegative().optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    sprintId: z.string().min(1),
    acceptanceCriteria: z.string().optional(),
    dependencies: z.array(z.string().min(1)),
  })
  .strict();

export type GetIssueInput = z.infer<typeof getIssueInputSchema>;
export type GetIssueOutput = z.infer<typeof getIssueOutputSchema>;

export function createGetIssueTool(
  repository: IssueRepository,
): SprintTool<GetIssueInput, GetIssueOutput> {
  return {
    description:
      "Return the canonical details and dependency evidence for one issue.",
    inputSchema: getIssueInputSchema,
    outputSchema: getIssueOutputSchema,
    async execute(input: unknown) {
      const { issueId } = getIssueInputSchema.parse(input);
      const issue = await repository.getIssueById(issueId);

      if (issue === undefined) {
        throw new Error(`Issue not found: ${issueId}`);
      }

      return getIssueOutputSchema.parse(issue);
    },
  };
}

export const getIssuesByStatusInputSchema = z
  .object({
    sprintId: z.string().trim().min(1),
    status: z.enum(["todo", "in_progress", "blocked", "done"]),
  })
  .strict();

const issueByStatusSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.enum(["story", "bug", "task"]),
    status: z.enum(["todo", "in_progress", "blocked", "done"]),
    assigneeId: z.string().min(1).optional(),
    storyPoints: z.number().nonnegative().optional(),
    updatedAt: z.string().min(1),
    dependencies: z.array(z.string().min(1)),
  })
  .strict();

export const getIssuesByStatusOutputSchema = z
  .object({
    sprintId: z.string().min(1),
    status: z.enum(["todo", "in_progress", "blocked", "done"]),
    issues: z.array(issueByStatusSchema),
  })
  .strict();

export type GetIssuesByStatusInput = z.infer<
  typeof getIssuesByStatusInputSchema
>;
export type GetIssuesByStatusOutput = z.infer<
  typeof getIssuesByStatusOutputSchema
>;

export function createGetIssuesByStatusTool(
  repository: IssueCollectionRepository,
): SprintTool<GetIssuesByStatusInput, GetIssuesByStatusOutput> {
  return {
    description:
      "Return compact issue evidence for one status within one sprint.",
    inputSchema: getIssuesByStatusInputSchema,
    outputSchema: getIssuesByStatusOutputSchema,
    async execute(input: unknown) {
      const { sprintId, status } = getIssuesByStatusInputSchema.parse(input);
      const issues = await repository.getIssuesByStatus(sprintId, status);

      if (
        issues.some(
          (issue) => issue.sprintId !== sprintId || issue.status !== status,
        )
      ) {
        throw new Error(
          `Issue repository returned data outside sprint ${sprintId} and status ${status}`,
        );
      }

      return getIssuesByStatusOutputSchema.parse({
        sprintId,
        status,
        issues: issues.map((issue) => ({
          id: issue.id,
          title: issue.title,
          type: issue.type,
          status: issue.status,
          assigneeId: issue.assigneeId,
          storyPoints: issue.storyPoints,
          updatedAt: issue.updatedAt,
          dependencies: issue.dependencies,
        })),
      });
    },
  };
}

export const getDeveloperWorkloadInputSchema = z
  .object({
    sprintId: z.string().trim().min(1),
  })
  .strict();

const developerWorkloadSchema = z
  .object({
    developerId: z.string().min(1),
    developerName: z.string().min(1),
    capacityHours: z.number().nonnegative(),
    assignedHours: z.number().nonnegative(),
    taskCount: z.number().int().nonnegative(),
    taskIds: z.array(z.string().min(1)),
    remainingCapacityHours: z.number(),
    overCapacityHours: z.number().nonnegative(),
    utilizationPercent: z.number().nonnegative(),
    status: z.enum(["available", "at_capacity", "overallocated"]),
  })
  .strict();

export const getDeveloperWorkloadOutputSchema = z
  .object({
    sprintId: z.string().min(1),
    workloads: z.array(developerWorkloadSchema),
    totalCapacityHours: z.number().nonnegative(),
    totalAssignedHours: z.number().nonnegative(),
    totalUnassignedHours: z.number().nonnegative(),
    unassignedTaskIds: z.array(z.string().min(1)),
  })
  .strict();

export type GetDeveloperWorkloadInput = z.infer<
  typeof getDeveloperWorkloadInputSchema
>;
export type GetDeveloperWorkloadOutput = z.infer<
  typeof getDeveloperWorkloadOutputSchema
>;

export function createGetDeveloperWorkloadTool(
  repository: SprintRepository,
): SprintTool<GetDeveloperWorkloadInput, GetDeveloperWorkloadOutput> {
  return {
    description:
      "Return deterministic developer capacity, utilization, assigned-task evidence, and unassigned work for one sprint.",
    inputSchema: getDeveloperWorkloadInputSchema,
    outputSchema: getDeveloperWorkloadOutputSchema,
    async execute(input: unknown) {
      const { sprintId } = getDeveloperWorkloadInputSchema.parse(input);
      const sprint = await repository.getSprintById(sprintId);

      if (sprint === undefined) {
        throw new Error(`Sprint not found: ${sprintId}`);
      }

      return getDeveloperWorkloadOutputSchema.parse({
        sprintId: sprint.id,
        ...calculateDeveloperWorkload(sprint),
      });
    },
  };
}

export const getVelocityHistoryInputSchema = z
  .object({
    sprintId: z.string().trim().min(1),
  })
  .strict();

const sprintVelocityEntrySchema = z
  .object({
    sprintId: z.string().min(1),
    sprintName: z.string().min(1),
    committedStoryPoints: z.number().nonnegative(),
    completedStoryPoints: z.number().nonnegative(),
    completionRate: z.number().nonnegative(),
  })
  .strict();

export const getVelocityHistoryOutputSchema = z
  .object({
    sprintId: z.string().min(1),
    sprints: z.array(sprintVelocityEntrySchema),
    sprintCount: z.number().int().nonnegative(),
    averageCommittedStoryPoints: z.number().nonnegative(),
    averageCompletedStoryPoints: z.number().nonnegative(),
    minCompletedStoryPoints: z.number().nonnegative(),
    maxCompletedStoryPoints: z.number().nonnegative(),
    completionRate: z.number().nonnegative(),
  })
  .strict();

export type GetVelocityHistoryInput = z.infer<
  typeof getVelocityHistoryInputSchema
>;
export type GetVelocityHistoryOutput = z.infer<
  typeof getVelocityHistoryOutputSchema
>;

export function createGetVelocityHistoryTool(
  repository: VelocityHistoryRepository,
): SprintTool<GetVelocityHistoryInput, GetVelocityHistoryOutput> {
  return {
    description:
      "Return deterministic historical sprint velocity and completion metrics for the team associated with one sprint.",
    inputSchema: getVelocityHistoryInputSchema,
    outputSchema: getVelocityHistoryOutputSchema,
    async execute(input: unknown) {
      const { sprintId } = getVelocityHistoryInputSchema.parse(input);
      const history = await repository.getSprintHistory(sprintId);

      return getVelocityHistoryOutputSchema.parse({
        sprintId,
        ...calculateTeamVelocity(history),
      });
    },
  };
}

export const getSprintScopeChangesInputSchema = z
  .object({
    sprintId: z.string().trim().min(1),
  })
  .strict();

const sprintScopeChangeEntrySchema = z
  .object({
    activityId: z.string().min(1),
    issueId: z.string().min(1),
    type: z.enum(["added_to_sprint", "removed_from_sprint"]),
    occurredAt: z.string().min(1),
    storyPoints: z.number().nonnegative(),
  })
  .strict();

export const getSprintScopeChangesOutputSchema = z
  .object({
    sprintId: z.string().min(1),
    changes: z.array(sprintScopeChangeEntrySchema),
    addedIssueCount: z.number().int().nonnegative(),
    addedIssueIds: z.array(z.string().min(1)),
    addedStoryPoints: z.number().nonnegative(),
    removedIssueCount: z.number().int().nonnegative(),
    removedIssueIds: z.array(z.string().min(1)),
    removedStoryPoints: z.number().nonnegative(),
    netIssueCountChange: z.number().int(),
    netStoryPointChange: z.number(),
    initialIssueCount: z.number().int().nonnegative(),
    initialStoryPoints: z.number().nonnegative(),
    currentIssueCount: z.number().int().nonnegative(),
    currentStoryPoints: z.number().nonnegative(),
    storyPointGrowthPercent: z.number(),
  })
  .strict();

export type GetSprintScopeChangesInput = z.infer<
  typeof getSprintScopeChangesInputSchema
>;
export type GetSprintScopeChangesOutput = z.infer<
  typeof getSprintScopeChangesOutputSchema
>;

export function createGetSprintScopeChangesTool(
  repository: SprintScopeChangeRepository,
): SprintTool<GetSprintScopeChangesInput, GetSprintScopeChangesOutput> {
  return {
    description:
      "Return deterministic sprint scope additions and removals with exact issue and activity evidence.",
    inputSchema: getSprintScopeChangesInputSchema,
    outputSchema: getSprintScopeChangesOutputSchema,
    async execute(input: unknown) {
      const { sprintId } = getSprintScopeChangesInputSchema.parse(input);
      const sprint = await repository.getSprintById(sprintId);

      if (sprint === undefined) {
        throw new Error(`Sprint not found: ${sprintId}`);
      }

      const activities = await repository.getSprintActivities(sprintId);
      if (
        activities.some(
          (activity) =>
            (activity.type === "added_to_sprint" &&
              activity.toValue !== sprintId) ||
            (activity.type === "removed_from_sprint" &&
              activity.fromValue !== sprintId),
        )
      ) {
        throw new Error(
          `Activity repository returned data outside sprint ${sprintId}`,
        );
      }

      return getSprintScopeChangesOutputSchema.parse({
        sprintId: sprint.id,
        ...calculateScopeChange(sprint, activities),
      });
    },
  };
}

export const riskSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const riskCategorySchema = z.enum([
  "capacity",
  "dependency",
  "scope",
  "blocker",
  "quality",
  "delivery",
]);

export const riskEvidenceSchema = z
  .object({
    issueId: z.string().trim().min(1).optional(),
    metric: z.string().trim().min(1).optional(),
    value: z.union([z.string(), z.number().finite()]).optional(),
  })
  .strict()
  .refine(
    (evidence) =>
      evidence.issueId !== undefined || evidence.metric !== undefined,
    "Evidence must identify an issue or metric",
  );

export const sprintRiskSchema = z
  .object({
    severity: riskSeveritySchema,
    category: riskCategorySchema,
    title: z.string().trim().min(1),
    explanation: z.string().trim().min(1),
    evidence: z.array(riskEvidenceSchema).min(1),
    recommendation: z.string().trim().min(1).optional(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const sprintAnalysisSchema = z
  .object({
    healthScore: z.number().int().min(0).max(100),
    summary: z.string().trim().min(1),
    risks: z.array(sprintRiskSchema),
  })
  .strict();

export type RiskSeverity = z.infer<typeof riskSeveritySchema>;
export type RiskCategory = z.infer<typeof riskCategorySchema>;
export type RiskEvidence = z.infer<typeof riskEvidenceSchema>;
export type SprintRisk = z.infer<typeof sprintRiskSchema>;
export type SprintAnalysis = z.infer<typeof sprintAnalysisSchema>;
