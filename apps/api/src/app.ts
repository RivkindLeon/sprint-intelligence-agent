import Fastify, { type FastifyInstance } from "fastify";
import {
  healthResponseSchema,
  apiErrorSchema,
  sprintDetailResponseSchema,
  sprintListResponseSchema,
  sprintMetricsResponseSchema,
  type SprintDetailResponse,
  type HealthResponse,
  type SprintListResponse,
  type SprintMetricsResponse,
} from "@sprint-intelligence/shared";

export interface SprintListReader {
  list(): Promise<SprintListResponse["sprints"]>;
  getById(id: string): Promise<SprintDetailResponse["sprint"] | undefined>;
  getMetricsById(
    id: string,
  ): Promise<SprintMetricsResponse["metrics"] | undefined>;
}

export function buildApp(sprintListReader: SprintListReader): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get<{ Reply: HealthResponse }>("/health", async () =>
    healthResponseSchema.parse({ status: "ok" }),
  );

  app.get<{ Reply: SprintListResponse }>("/api/sprints", async () =>
    sprintListResponseSchema.parse({ sprints: await sprintListReader.list() }),
  );

  app.get<{ Params: { id: string } }>(
    "/api/sprints/:id",
    async (request, reply) => {
      const sprint = await sprintListReader.getById(request.params.id);
      if (!sprint) {
        return reply.code(404).send(
          apiErrorSchema.parse({
            statusCode: 404,
            error: "Not Found",
            message: "Sprint not found",
          }),
        );
      }
      return sprintDetailResponseSchema.parse({ sprint });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/sprints/:id/metrics",
    async (request, reply) => {
      const metrics = await sprintListReader.getMetricsById(request.params.id);
      if (!metrics) {
        return reply.code(404).send(
          apiErrorSchema.parse({
            statusCode: 404,
            error: "Not Found",
            message: "Sprint not found",
          }),
        );
      }
      return sprintMetricsResponseSchema.parse({ metrics });
    },
  );

  return app;
}
