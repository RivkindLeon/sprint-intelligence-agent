import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const issueType = pgEnum("issue_type", ["story", "bug", "task"]);
export const issueStatus = pgEnum("issue_status", [
  "todo",
  "in_progress",
  "blocked",
  "done",
]);
export const activityType = pgEnum("activity_type", [
  "created",
  "status_changed",
  "assignee_changed",
  "estimate_changed",
  "added_to_sprint",
  "removed_from_sprint",
]);

export const sprints = pgTable(
  "sprints",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    goal: text("goal"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
  },
  (table) => [
    check(
      "sprints_valid_date_range",
      sql`${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

export const developers = pgTable(
  "developers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").unique(),
    capacityStoryPoints: integer("capacity_story_points"),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    check(
      "developers_nonnegative_capacity",
      sql`${table.capacityStoryPoints} is null or ${table.capacityStoryPoints} >= 0`,
    ),
  ],
);

export const sprintDevelopers = pgTable(
  "sprint_developers",
  {
    sprintId: text("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
    developerId: text("developer_id")
      .notNull()
      .references(() => developers.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.sprintId, table.developerId] })],
);

export const issues = pgTable(
  "issues",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    type: issueType("type").notNull(),
    status: issueStatus("status").notNull(),
    assigneeId: text("assignee_id").references(() => developers.id, {
      onDelete: "set null",
    }),
    storyPoints: integer("story_points"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    sprintId: text("sprint_id")
      .notNull()
      .references(() => sprints.id, { onDelete: "cascade" }),
    acceptanceCriteria: text("acceptance_criteria"),
  },
  (table) => [
    check(
      "issues_nonnegative_story_points",
      sql`${table.storyPoints} is null or ${table.storyPoints} >= 0`,
    ),
  ],
);

export const issueDependencies = pgTable(
  "issue_dependencies",
  {
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    dependsOnIssueId: text("depends_on_issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.dependsOnIssueId] }),
    check(
      "issue_dependencies_no_self_reference",
      sql`${table.issueId} <> ${table.dependsOnIssueId}`,
    ),
  ],
);

export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  issueId: text("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  type: activityType("type").notNull(),
  occurredAt: timestamp("occurred_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
  fromValue: text("from_value"),
  toValue: text("to_value"),
});

export const sprintHistory = pgTable(
  "sprint_history",
  {
    id: text("id").primaryKey(),
    sprintId: text("sprint_id").notNull().unique(),
    sprintName: text("sprint_name").notNull(),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    committedStoryPoints: integer("committed_story_points").notNull(),
    completedStoryPoints: integer("completed_story_points").notNull(),
    carriedOverIssueIds: text("carried_over_issue_ids")
      .array()
      .notNull()
      .default([]),
  },
  (table) => [
    check(
      "sprint_history_valid_dates",
      sql`${table.completedAt} >= ${table.startedAt}`,
    ),
    check(
      "sprint_history_nonnegative_points",
      sql`${table.committedStoryPoints} >= 0 and ${table.completedStoryPoints} >= 0`,
    ),
  ],
);
