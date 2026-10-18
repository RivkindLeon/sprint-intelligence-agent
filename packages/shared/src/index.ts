import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  error: z.string().min(1),
  message: z.string().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const sprintListResponseSchema = z
  .object({
    sprints: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          startDate: z.iso.date(),
          endDate: z.iso.date(),
        })
        .strict(),
    ),
  })
  .strict();

export type SprintListResponse = z.infer<typeof sprintListResponseSchema>;

export const sprintDetailResponseSchema = z
  .object({
    sprint: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        goal: z.string().nullable(),
        startDate: z.iso.date(),
        endDate: z.iso.date(),
        developers: z.array(
          z
            .object({
              id: z.string().min(1),
              name: z.string().min(1),
              capacityStoryPoints: z.number().int().nonnegative().nullable(),
            })
            .strict(),
        ),
        issues: z.array(
          z
            .object({
              id: z.string().min(1),
              title: z.string().min(1),
              type: z.enum(["story", "bug", "task"]),
              status: z.enum(["todo", "in_progress", "blocked", "done"]),
              assigneeId: z.string().nullable(),
              storyPoints: z.number().int().nonnegative().nullable(),
              updatedAt: z.iso.datetime({ offset: true }),
              acceptanceCriteria: z.string().nullable(),
              dependencies: z.array(z.string().min(1)),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export type SprintDetailResponse = z.infer<typeof sprintDetailResponseSchema>;

export const sprintMetricsResponseSchema = z
  .object({
    metrics: z
      .object({
        sprintId: z.string().min(1),
        healthScore: z.number().int().min(0).max(100),
        completion: z
          .object({
            totalIssues: z.number().int().nonnegative(),
            completedIssues: z.number().int().nonnegative(),
            completionPercent: z.number().min(0).max(100),
            totalStoryPoints: z.number().int().nonnegative(),
            completedStoryPoints: z.number().int().nonnegative(),
            storyPointCompletionPercent: z.number().min(0).max(100),
          })
          .strict(),
        blocked: z
          .object({
            issueCount: z.number().int().nonnegative(),
            issueIds: z.array(z.string().min(1)),
          })
          .strict(),
        scope: z
          .object({
            addedIssueCount: z.number().int().nonnegative(),
            addedIssueIds: z.array(z.string().min(1)),
            netStoryPointChange: z.number(),
            storyPointGrowthPercent: z.number(),
          })
          .strict(),
        velocity: z
          .object({
            sprintCount: z.number().int().nonnegative(),
            averageCompletedStoryPoints: z.number().nonnegative(),
            completedStoryPointsBySprint: z.array(
              z
                .object({
                  sprintId: z.string().min(1),
                  completedStoryPoints: z.number().int().nonnegative(),
                })
                .strict(),
            ),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type SprintMetricsResponse = z.infer<typeof sprintMetricsResponseSchema>;

export const sprintAnalysisResponseSchema = z
  .object({
    runId: z.uuid(),
    analysis: z
      .object({
        healthScore: z.number().int().min(0).max(100),
        summary: z.string().trim().min(1),
        risks: z.array(
          z
            .object({
              severity: z.enum(["low", "medium", "high", "critical"]),
              category: z.enum([
                "capacity",
                "dependency",
                "scope",
                "blocker",
                "quality",
                "delivery",
              ]),
              title: z.string().trim().min(1),
              explanation: z.string().trim().min(1),
              evidence: z
                .array(
                  z
                    .object({
                      issueId: z.string().trim().min(1).optional(),
                      metric: z.string().trim().min(1).optional(),
                      value: z
                        .union([z.string(), z.number().finite()])
                        .optional(),
                    })
                    .strict()
                    .refine(
                      (item) =>
                        item.issueId !== undefined || item.metric !== undefined,
                    ),
                )
                .min(1)
                .refine((items) =>
                  items.some((item) => item.issueId !== undefined),
                ),
              recommendation: z.string().trim().min(1).optional(),
              confidence: z.number().min(0).max(1),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export type SprintAnalysisResponse = z.infer<
  typeof sprintAnalysisResponseSchema
>;

export const agentRunResponseSchema = z
  .object({
    run: z
      .object({
        id: z.uuid(),
        sprintId: z.string().min(1),
        model: z.string().min(1),
        status: z.enum(["running", "completed", "failed"]),
        startedAt: z.iso.datetime({ offset: true }),
        endedAt: z.iso.datetime({ offset: true }).nullable(),
        error: z.string().nullable(),
        toolCalls: z.array(
          z
            .object({
              step: z.number().int().positive(),
              toolName: z.string().min(1),
              durationMs: z.number().int().nonnegative(),
              status: z.enum(["completed", "failed"]),
              error: z.string().nullable(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export type AgentRunResponse = z.infer<typeof agentRunResponseSchema>;
