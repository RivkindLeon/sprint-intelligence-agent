import assert from "node:assert/strict";
import { test } from "node:test";

import { getTableName } from "drizzle-orm";

import {
  activities,
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
    ].map(getTableName),
    [
      "sprints",
      "developers",
      "sprint_developers",
      "issues",
      "issue_dependencies",
      "activities",
      "sprint_history",
    ],
  );
});

test("keeps dependencies normalized for traceable evidence", () => {
  assert.equal(issueDependencies.issueId.notNull, true);
  assert.equal(issueDependencies.dependsOnIssueId.notNull, true);
  assert.equal(issues.sprintId.notNull, true);
  assert.equal(activities.issueId.notNull, true);
});
