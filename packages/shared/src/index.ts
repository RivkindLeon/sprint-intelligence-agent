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
