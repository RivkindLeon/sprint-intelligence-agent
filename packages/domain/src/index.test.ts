import assert from "node:assert";
import test from "node:test";

import {
  ACTIVITY_TYPES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  type Activity,
  type Developer,
  type Issue,
  type IssueDependency,
  type Sprint,
  type SprintHistory,
} from "./index.js";

test("exports the supported issue and activity values", () => {
  assert.deepStrictEqual(ISSUE_TYPES, ["story", "bug", "task"]);
  assert.deepStrictEqual(ISSUE_STATUSES, [
    "todo",
    "in_progress",
    "blocked",
    "done",
  ]);
  assert.ok(ACTIVITY_TYPES.includes("added_to_sprint"));
});

test("represents a sprint and its traceable delivery history", () => {
  const developer: Developer = {
    id: "dev-1",
    name: "Ada Lovelace",
    email: "ada@example.test",
    capacityStoryPoints: 10,
    capacityHoursPerWeek: 40,
    active: true,
  };
  const issue: Issue = {
    id: "AUTH-231",
    title: "Add token refresh",
    type: "story",
    status: "blocked",
    assigneeId: developer.id,
    storyPoints: 5,
    createdAt: "2026-08-31T09:00:00.000Z",
    updatedAt: "2026-09-04T14:00:00.000Z",
    sprintId: "sprint-24",
    acceptanceCriteria: "Expired access tokens are refreshed once.",
    dependencies: ["AUTH-198"],
  };
  const sprint: Sprint = {
    id: "sprint-24",
    name: "Sprint 24",
    goal: "Ship authentication hardening",
    startDate: "2026-08-31",
    endDate: "2026-09-11",
    developers: [developer],
    issues: [issue],
    tasks: [],
  };
  const dependency: IssueDependency = {
    issueId: issue.id,
    dependsOnIssueId: "AUTH-198",
    createdAt: "2026-08-31T09:00:00.000Z",
  };
  const activity: Activity = {
    id: "activity-1",
    issueId: issue.id,
    type: "added_to_sprint",
    occurredAt: "2026-09-01T10:00:00.000Z",
    toValue: sprint.id,
  };
  const history: SprintHistory = {
    id: "history-23",
    sprintId: "sprint-23",
    sprintName: "Sprint 23",
    startedAt: "2026-08-17T09:00:00.000Z",
    completedAt: "2026-08-28T17:00:00.000Z",
    committedStoryPoints: 40,
    completedStoryPoints: 34,
    carriedOverIssueIds: ["AUTH-198"],
  };

  assert.strictEqual(sprint.issues?.[0]?.id, dependency.issueId);
  assert.strictEqual(activity.toValue, sprint.id);
  assert.deepStrictEqual(history.carriedOverIssueIds, ["AUTH-198"]);
});
