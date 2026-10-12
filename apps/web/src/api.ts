import {
  agentRunResponseSchema,
  sprintAnalysisResponseSchema,
  sprintDetailResponseSchema,
  sprintListResponseSchema,
  sprintMetricsResponseSchema,
} from "@sprint-intelligence/shared";

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

export const api = {
  listSprints: async () =>
    sprintListResponseSchema.parse(await request("/api/sprints")),
  getSprint: async (id: string) =>
    sprintDetailResponseSchema.parse(
      await request(`/api/sprints/${encodeURIComponent(id)}`),
    ),
  getMetrics: async (id: string) =>
    sprintMetricsResponseSchema.parse(
      await request(`/api/sprints/${encodeURIComponent(id)}/metrics`),
    ),
  analyze: async (id: string) =>
    sprintAnalysisResponseSchema.parse(
      await request(`/api/sprints/${encodeURIComponent(id)}/analyze`, {
        method: "POST",
      }),
    ),
  getRun: async (id: string) =>
    agentRunResponseSchema.parse(
      await request(`/api/agent-runs/${encodeURIComponent(id)}`),
    ),
};
