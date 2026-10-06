import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { z } from "zod";

import type { SprintAnalysisModel } from "./agent.js";
import { VercelAiSdkSprintAnalysisModel } from "./vercel-ai-sdk-model.js";

const aiModelConfigSchema = z
  .object({
    provider: z.enum(["openai"]),
    modelId: z.string().trim().min(1, "AI_MODEL is required"),
    apiKey: z.string().trim().min(1, "AI_API_KEY is required"),
  })
  .strict();

export type AiModelConfig = z.infer<typeof aiModelConfigSchema>;

export interface ConfiguredSprintAnalysisModel {
  provider: AiModelConfig["provider"];
  modelId: string;
  model: SprintAnalysisModel;
}

type OpenAIProviderFactory = (options: {
  apiKey: string;
}) => (modelId: string) => LanguageModel;

export interface AiModelFactoryDependencies {
  createOpenAIProvider?: OpenAIProviderFactory;
}

export function parseAiModelConfig(
  environment: NodeJS.ProcessEnv,
): AiModelConfig {
  return aiModelConfigSchema.parse({
    provider: environment.AI_PROVIDER?.trim().toLowerCase(),
    modelId: environment.AI_MODEL,
    apiKey: environment.AI_API_KEY,
  });
}

/**
 * Builds the provider-specific AI SDK model behind the provider-agnostic agent
 * interface. Application code only needs this factory and never handles an
 * OpenAI client directly.
 */
export function createSprintAnalysisModelFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: AiModelFactoryDependencies = {},
): ConfiguredSprintAnalysisModel {
  const config = parseAiModelConfig(environment);
  const providerFactory = dependencies.createOpenAIProvider ?? createOpenAI;
  const languageModel = providerFactory({ apiKey: config.apiKey })(
    config.modelId,
  );

  return {
    provider: config.provider,
    modelId: config.modelId,
    model: new VercelAiSdkSprintAnalysisModel(languageModel),
  };
}
