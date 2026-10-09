import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { AgentRunRepository } from "./agent-run-repository.js";
import { createDatabaseConnection } from "./client.js";
import { loadDemoDataset, seedDemoDataset } from "./seed.js";
import { SprintListRepository } from "./sprint-list-repository.js";

const runDatabaseIntegrationTest =
  process.env.RUN_DATABASE_INTEGRATION_TEST === "true";

describe("database connection", { skip: !runDatabaseIntegrationTest }, () => {
  it("connects to PostgreSQL and executes a query", async () => {
    const { client, db } = createDatabaseConnection();

    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      const [result] = await client<{ value: number }[]>`select 1 as value`;
      assert.equal(result?.value, 1);

      const tables = await client<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
        order by table_name
      `;
      assert.deepEqual(
        tables.map(({ table_name }) => table_name),
        [
          "activities",
          "agent_runs",
          "agent_tool_calls",
          "developers",
          "issue_dependencies",
          "issues",
          "sprint_developers",
          "sprint_history",
          "sprints",
        ],
      );
    } finally {
      await client.end();
    }
  });

  it("seeds the complete demo dataset idempotently", async () => {
    const { client, db } = createDatabaseConnection();

    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      const dataset = await loadDemoDataset();
      await seedDemoDataset(db, dataset);
      await seedDemoDataset(db, dataset);

      const [counts] = await client<
        Array<{
          developers: number;
          issues: number;
          dependencies: number;
          activities: number;
          history: number;
        }>
      >`
        select
          (select count(*)::int from developers) as developers,
          (select count(*)::int from issues where sprint_id = 'sprint-24') as issues,
          (select count(*)::int from issue_dependencies) as dependencies,
          (select count(*)::int from activities) as activities,
          (select count(*)::int from sprint_history) as history
      `;
      assert.deepEqual(counts, {
        developers: 6,
        issues: 35,
        dependencies: dataset.issues.reduce(
          (total, issue) => total + issue.dependencies.length,
          0,
        ),
        activities: dataset.issues.filter((issue) => issue.addedToSprintAt)
          .length,
        history: 5,
      });

      const sprintList = await new SprintListRepository(db).list();
      assert.deepEqual(sprintList, [
        {
          id: dataset.sprint.id,
          name: dataset.sprint.name,
          startDate: dataset.sprint.startDate,
          endDate: dataset.sprint.endDate,
        },
      ]);

      const sprintDetail = await new SprintListRepository(db).getById(
        dataset.sprint.id,
      );
      assert.equal(sprintDetail?.id, dataset.sprint.id);
      assert.equal(sprintDetail?.goal, dataset.sprint.goal);
      assert.equal(sprintDetail?.developers.length, 6);
      assert.equal(sprintDetail?.issues.length, 35);
      for (const issue of dataset.issues) {
        assert.deepEqual(
          sprintDetail?.issues.find((item) => item.id === issue.id)
            ?.dependencies,
          [...issue.dependencies].sort(),
        );
      }
      assert.equal(
        await new SprintListRepository(db).getById("missing-sprint"),
        undefined,
      );
      const metrics = await new SprintListRepository(db).getMetricsById(
        dataset.sprint.id,
      );
      assert.equal(metrics?.completion.totalIssues, 35);
      assert.equal(
        metrics?.completion.completedIssues,
        dataset.issues.filter((issue) => issue.status === "done").length,
      );
      assert.deepEqual(
        metrics?.blocked.issueIds,
        dataset.issues
          .filter((issue) => issue.status === "blocked")
          .map((issue) => issue.id)
          .sort(),
      );
      assert.equal(
        metrics?.scope.addedIssueCount,
        dataset.issues.filter((issue) => issue.addedToSprintAt).length,
      );
      assert.equal(metrics?.velocity.sprintCount, 5);
      assert.equal(
        await new SprintListRepository(db).getMetricsById("missing-sprint"),
        undefined,
      );
    } finally {
      await client.end();
    }
  });

  it("persists completed and failed agent runs with ordered tool traces", async () => {
    const { client, db } = createDatabaseConnection();

    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      await seedDemoDataset(db, await loadDemoDataset());
      const repository = new AgentRunRepository(db);
      const completedRunId = await repository.start({
        sprintId: "sprint-24",
        model: "test-model",
        startedAt: "2026-10-02T16:30:00.000Z",
      });

      await repository.recordToolCall(completedRunId, {
        step: 2,
        toolName: "getDependencyRisks",
        durationMs: 19,
        status: "completed",
        input: { sprintId: "sprint-24" },
        resultMetadata: { cycleCount: 1 },
      });
      await repository.recordToolCall(completedRunId, {
        step: 1,
        toolName: "getSprintOverview",
        durationMs: 7,
        status: "completed",
        input: { sprintId: "sprint-24" },
        resultMetadata: { issueCount: 35 },
      });
      await repository.complete(completedRunId, {
        endedAt: "2026-10-02T16:30:01.000Z",
        tokenUsage: { inputTokens: 120, outputTokens: 45 },
        finalResult: { healthScore: 68, risks: [] },
      });

      const completedRun = await repository.getById(completedRunId);
      assert.equal(completedRun?.status, "completed");
      assert.equal(completedRun?.model, "test-model");
      assert.deepEqual(completedRun?.tokenUsage, {
        inputTokens: 120,
        outputTokens: 45,
      });
      assert.deepEqual(
        completedRun?.toolCalls.map(({ step, toolName }) => ({
          step,
          toolName,
        })),
        [
          { step: 1, toolName: "getSprintOverview" },
          { step: 2, toolName: "getDependencyRisks" },
        ],
      );

      const failedRunId = await repository.start({
        sprintId: "sprint-24",
        model: "test-model",
        startedAt: "2026-10-02T16:31:00.000Z",
      });
      await repository.fail(failedRunId, {
        endedAt: "2026-10-02T16:31:01.000Z",
        error: "provider unavailable",
      });

      const failedRun = await repository.getById(failedRunId);
      assert.equal(failedRun?.status, "failed");
      assert.equal(failedRun?.error, "provider unavailable");
      assert.equal(failedRun?.finalResult, null);
      assert.equal(await repository.getById("missing-run"), undefined);
    } finally {
      await client.end();
    }
  });
});
