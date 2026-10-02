import assert from "node:assert/strict";
import { test } from "node:test";

import { getTableName } from "drizzle-orm";

import {
  activities,
  agentRuns,
  agentToolCalls,
  developers,
  issueDependencies,
  issues,
  sprintDevelopers,
  sprintHistory,
  sprints,
} from "./schema.js";

test("defines the Milestone 1 domain tables", () => {
  assert.deepEqual(
    [
      sprints,
      developers,
      sprintDevelopers,
      issues,
      issueDependencies,
      activities,
      sprintHistory,
      agentRuns,
      agentToolCalls,
    ].map(getTableName),
    [
      "sprints",
      "developers",
      "sprint_developers",
      "issues",
      "issue_dependencies",
      "activities",
      "sprint_history",
      "agent_runs",
      "agent_tool_calls",
    ],
  );
});

test("defines normalized agent observability tables", () => {
  assert.equal(agentRuns.sprintId.notNull, true);
  assert.equal(agentRuns.model.notNull, true);
  assert.equal(agentRuns.startedAt.notNull, true);
  assert.equal(agentToolCalls.runId.notNull, true);
  assert.equal(agentToolCalls.toolName.notNull, true);
  assert.equal(agentToolCalls.durationMs.notNull, true);
});

test("keeps dependencies normalized for traceable evidence", () => {
  assert.equal(issueDependencies.issueId.notNull, true);
  assert.equal(issueDependencies.dependsOnIssueId.notNull, true);
  assert.equal(issues.sprintId.notNull, true);
  assert.equal(activities.issueId.notNull, true);
});
