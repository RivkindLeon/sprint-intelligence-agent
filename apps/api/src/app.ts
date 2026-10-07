import Fastify, { type FastifyInstance } from "fastify";
import {
  healthResponseSchema,
  sprintListResponseSchema,
  type HealthResponse,
  type SprintListResponse,
} from "@sprint-intelligence/shared";

export interface SprintListReader {
  list(): Promise<SprintListResponse["sprints"]>;
}

export function buildApp(sprintListReader: SprintListReader): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get<{ Reply: HealthResponse }>("/health", async () =>
    healthResponseSchema.parse({ status: "ok" }),
  );

  app.get<{ Reply: SprintListResponse }>("/api/sprints", async () =>
    sprintListResponseSchema.parse({ sprints: await sprintListReader.list() }),
  );

  return app;
}
