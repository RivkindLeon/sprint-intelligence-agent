import { buildApp } from "./app.js";
import { createDatabaseConnection } from "./database/client.js";
import { SprintListRepository } from "./database/sprint-list-repository.js";
import { createSprintAnalyzer } from "./analysis-service.js";
import { AgentRunRepository } from "./database/agent-run-repository.js";
import { createSprintHealthScoreSource } from "@sprint-intelligence/ai";
import { SprintAnalysisRepository } from "./database/sprint-analysis-repository.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const { client, db } = createDatabaseConnection();
const app = buildApp(
  new SprintListRepository(db),
  createSprintAnalyzer(db),
  {
    getById: (id) => new AgentRunRepository(db).getPublicById(id),
  },
  createSprintHealthScoreSource(new SprintAnalysisRepository(db)),
);
app.addHook("onClose", async () => {
  await client.end();
});

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
