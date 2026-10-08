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
