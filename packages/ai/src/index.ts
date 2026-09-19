import { z } from "zod";

import type { Issue, IssueStatus, Sprint } from "@sprint-intelligence/domain";

export interface SprintRepository {
  getSprintById(sprintId: string): Promise<Sprint | undefined>;
}

export interface IssueRepository {
  getIssueById(issueId: string): Promise<Issue | undefined>;
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
