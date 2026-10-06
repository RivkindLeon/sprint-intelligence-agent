import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LanguageModel } from "ai";
import { ZodError } from "zod";

import { VercelAiSdkSprintAnalysisModel } from "./vercel-ai-sdk-model.js";
import {
  createSprintAnalysisModelFromEnv,
  parseAiModelConfig,
} from "./model-factory.js";

describe("AI model configuration", () => {
  it("parses and normalizes complete OpenAI configuration", () => {
    assert.deepEqual(
      parseAiModelConfig({
        AI_PROVIDER: " OpenAI ",
        AI_MODEL: " gpt-5-mini ",
        AI_API_KEY: " test-key ",
      }),
      {
        provider: "openai",
        modelId: "gpt-5-mini",
        apiKey: "test-key",
      },
    );
  });

  it("rejects missing configuration and unsupported providers", () => {
    assert.throws(
      () => parseAiModelConfig({}),
      (error) =>
        error instanceof ZodError &&
        error.issues.some((issue) => issue.path[0] === "modelId") &&
        error.issues.some((issue) => issue.path[0] === "apiKey"),
    );
    assert.throws(
      () =>
        parseAiModelConfig({
          AI_PROVIDER: "anthropic",
          AI_MODEL: "claude",
          AI_API_KEY: "test-key",
        }),
      (error) =>
        error instanceof ZodError &&
        error.issues.some((issue) => issue.path[0] === "provider"),
    );
  });
});

describe("createSprintAnalysisModelFromEnv", () => {
  it("constructs an OpenAI-backed adapter without exposing provider setup", () => {
    const languageModel = {} as LanguageModel;
    let receivedApiKey: string | undefined;
    let receivedModelId: string | undefined;

    const configured = createSprintAnalysisModelFromEnv(
      {
        AI_PROVIDER: "openai",
        AI_MODEL: "gpt-5-mini",
        AI_API_KEY: "test-key",
      },
      {
        createOpenAIProvider: ({ apiKey }) => {
          receivedApiKey = apiKey;
          return (modelId) => {
            receivedModelId = modelId;
            return languageModel;
          };
        },
      },
    );

    assert.equal(receivedApiKey, "test-key");
    assert.equal(receivedModelId, "gpt-5-mini");
    assert.equal(configured.provider, "openai");
    assert.equal(configured.modelId, "gpt-5-mini");
    assert.ok(configured.model instanceof VercelAiSdkSprintAnalysisModel);
  });
});
