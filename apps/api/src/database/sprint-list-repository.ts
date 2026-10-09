import { asc, desc, eq, inArray, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Activity } from "@sprint-intelligence/domain";

import type {
  SprintDetailResponse,
  SprintListResponse,
  SprintMetricsResponse,
} from "@sprint-intelligence/shared";

import { calculateSprintMetrics } from "../metrics.js";

import {
  activities,
  developers,
  issueDependencies,
  issues,
  sprintDevelopers,
  sprintHistory,
  sprints,
} from "./schema.js";
import type * as schema from "./schema.js";

export class SprintListRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async list(): Promise<SprintListResponse["sprints"]> {
    return this.db
      .select({
        id: sprints.id,
        name: sprints.name,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
      })
      .from(sprints)
      .orderBy(desc(sprints.startDate), asc(sprints.id));
  }

  async getById(
    id: string,
  ): Promise<SprintDetailResponse["sprint"] | undefined> {
    const [sprint] = await this.db
      .select({
        id: sprints.id,
        name: sprints.name,
        goal: sprints.goal,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
      })
      .from(sprints)
      .where(eq(sprints.id, id));
    if (!sprint) return undefined;

    const [team, sprintIssues] = await Promise.all([
      this.db
        .select({
          id: developers.id,
          name: developers.name,
          capacityStoryPoints: developers.capacityStoryPoints,
        })
        .from(sprintDevelopers)
        .innerJoin(developers, eq(sprintDevelopers.developerId, developers.id))
        .where(eq(sprintDevelopers.sprintId, id))
        .orderBy(asc(developers.name), asc(developers.id)),
      this.db
        .select({
          id: issues.id,
          title: issues.title,
          type: issues.type,
          status: issues.status,
          assigneeId: issues.assigneeId,
          storyPoints: issues.storyPoints,
          updatedAt: issues.updatedAt,
          acceptanceCriteria: issues.acceptanceCriteria,
        })
        .from(issues)
        .where(eq(issues.sprintId, id))
        .orderBy(asc(issues.id)),
    ]);
    const dependencies = sprintIssues.length
      ? await this.db
          .select({
            issueId: issueDependencies.issueId,
            dependsOnIssueId: issueDependencies.dependsOnIssueId,
          })
          .from(issueDependencies)
          .where(
            inArray(
              issueDependencies.issueId,
              sprintIssues.map(({ id }) => id),
            ),
          )
          .orderBy(
            asc(issueDependencies.issueId),
            asc(issueDependencies.dependsOnIssueId),
          )
      : [];
    const dependenciesByIssue = new Map<string, string[]>();
    for (const { issueId, dependsOnIssueId } of dependencies) {
      const issueDependencies = dependenciesByIssue.get(issueId) ?? [];
      issueDependencies.push(dependsOnIssueId);
      dependenciesByIssue.set(issueId, issueDependencies);
    }

    return {
      ...sprint,
      developers: team,
      issues: sprintIssues.map((issue) => ({
        ...issue,
        dependencies: dependenciesByIssue.get(issue.id) ?? [],
      })),
    };
  }

  async getMetricsById(
    id: string,
  ): Promise<SprintMetricsResponse["metrics"] | undefined> {
    const detail = await this.getById(id);
    if (!detail) return undefined;

    const [activityRows, historyRows] = await Promise.all([
      this.db
        .select({
          id: activities.id,
          issueId: activities.issueId,
          type: activities.type,
          occurredAt: activities.occurredAt,
          fromValue: activities.fromValue,
          toValue: activities.toValue,
        })
        .from(activities)
        .where(or(eq(activities.fromValue, id), eq(activities.toValue, id)))
        .orderBy(asc(activities.occurredAt), asc(activities.id)),
      this.db
        .select()
        .from(sprintHistory)
        .orderBy(asc(sprintHistory.startedAt), asc(sprintHistory.id)),
    ]);

    const sprintActivities: Activity[] = activityRows.map((row) => ({
      ...row,
      fromValue: row.fromValue ?? undefined,
      toValue: row.toValue ?? undefined,
    }));
    return calculateSprintMetrics(detail, sprintActivities, historyRows);
  }
}
