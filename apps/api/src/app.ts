import Fastify, { type FastifyInstance } from "fastify";
import {
  healthResponseSchema,
  type HealthResponse,
} from "@sprint-intelligence/shared";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get<{ Reply: HealthResponse }>("/health", async () =>
    healthResponseSchema.parse({ status: "ok" }),
  );

  return app;
}
