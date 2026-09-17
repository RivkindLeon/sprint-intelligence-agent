import { z } from "zod";

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
