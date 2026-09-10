import { readFile } from "node:fs/promises";

import { eq, inArray, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { createDatabaseConnection } from "./client.js";
import {
  activities,
  developers,
  issueDependencies,
  issues,
  sprintDevelopers,
  sprintHistory,
  sprints,
} from "./schema.js";

type DemoSprint = typeof sprints.$inferInsert & { developerIds: string[] };
type DemoDeveloper = typeof developers.$inferInsert;
type DemoHistory = typeof sprintHistory.$inferInsert;
type DemoIssue = typeof issues.$inferInsert & {
  dependencies: string[];
  addedToSprintAt?: string;
};

export type DemoDataset = {
  sprint: DemoSprint;
  developers: DemoDeveloper[];
  history: DemoHistory[];
  issues: DemoIssue[];
};

async function readJson<T>(name: string): Promise<T> {
  const file = new URL(`../../../../demo/sprint/${name}`, import.meta.url);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function loadDemoDataset(): Promise<DemoDataset> {
  const [sprint, demoDevelopers, history, demoIssues] = await Promise.all([
    readJson<DemoSprint>("sprint.json"),
    readJson<DemoDeveloper[]>("developers.json"),
    readJson<DemoHistory[]>("history.json"),
    readJson<DemoIssue[]>("issues.json"),
  ]);

  return { sprint, developers: demoDevelopers, history, issues: demoIssues };
}

export async function seedDemoDataset(
  db: PostgresJsDatabase,
  dataset: DemoDataset,
): Promise<void> {
  const { developerIds, ...sprint } = dataset.sprint;
  const issueRows = dataset.issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    type: issue.type,
    status: issue.status,
    assigneeId: issue.assigneeId,
    storyPoints: issue.storyPoints,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    sprintId: issue.sprintId,
    acceptanceCriteria: issue.acceptanceCriteria,
  }));
  const dependencyRows = dataset.issues.flatMap((issue) =>
    issue.dependencies.map((dependsOnIssueId) => ({
      issueId: issue.id,
      dependsOnIssueId,
      createdAt: issue.addedToSprintAt ?? `${sprint.startDate}T09:00:00Z`,
    })),
  );
  const activityRows = dataset.issues.flatMap((issue) =>
    issue.addedToSprintAt
      ? [
          {
            id: `demo-added-${issue.id}`,
            issueId: issue.id,
            type: "added_to_sprint" as const,
            occurredAt: issue.addedToSprintAt,
            toValue: sprint.id,
          },
        ]
      : [],
  );

  await db.transaction(async (tx) => {
    await tx
      .insert(developers)
      .values(dataset.developers)
      .onConflictDoUpdate({
        target: developers.id,
        set: {
          name: sql`excluded.name`,
          email: sql`excluded.email`,
          capacityStoryPoints: sql`excluded.capacity_story_points`,
          active: sql`excluded.active`,
        },
      });
    await tx
      .insert(sprints)
      .values(sprint)
      .onConflictDoUpdate({
        target: sprints.id,
        set: {
          name: sprint.name,
          goal: sprint.goal,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
        },
      });
    const issueIds = issueRows.map(({ id }) => id);
    await tx
      .delete(issueDependencies)
      .where(
        or(
          inArray(issueDependencies.issueId, issueIds),
          inArray(issueDependencies.dependsOnIssueId, issueIds),
        ),
      );
    await tx.delete(issues).where(eq(issues.sprintId, sprint.id));
    await tx
      .delete(sprintDevelopers)
      .where(eq(sprintDevelopers.sprintId, sprint.id));
    await tx.insert(sprintDevelopers).values(
      developerIds.map((developerId) => ({
        sprintId: sprint.id,
        developerId,
      })),
    );
    await tx.insert(issues).values(issueRows);
    if (dependencyRows.length > 0) {
      await tx.insert(issueDependencies).values(dependencyRows);
    }
    if (activityRows.length > 0) {
      await tx.insert(activities).values(activityRows);
    }
    for (const history of dataset.history) {
      await tx
        .insert(sprintHistory)
        .values(history)
        .onConflictDoUpdate({
          target: sprintHistory.id,
          set: {
            sprintId: history.sprintId,
            sprintName: history.sprintName,
            startedAt: history.startedAt,
            completedAt: history.completedAt,
            committedStoryPoints: history.committedStoryPoints,
            completedStoryPoints: history.completedStoryPoints,
            carriedOverIssueIds: history.carriedOverIssueIds,
          },
        });
    }
  });
}

async function main(): Promise<void> {
  const { client, db } = createDatabaseConnection();
  try {
    const dataset = await loadDemoDataset();
    await seedDemoDataset(db, dataset);
    console.log(
      `Seeded ${dataset.sprint.name}: ${dataset.developers.length} developers, ${dataset.issues.length} issues, ${dataset.history.length} history records.`,
    );
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  await main();
}
