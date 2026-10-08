import { asc, desc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type {
  SprintDetailResponse,
  SprintListResponse,
} from "@sprint-intelligence/shared";

import {
  developers,
  issueDependencies,
  issues,
  sprintDevelopers,
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
}
