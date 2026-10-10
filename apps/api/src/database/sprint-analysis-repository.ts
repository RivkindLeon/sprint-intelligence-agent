import { asc, eq, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  Activity,
  Issue,
  IssueStatus,
  Sprint,
  SprintHistory,
} from "@sprint-intelligence/domain";

import { SprintListRepository } from "./sprint-list-repository.js";
import { activities, issues, sprintHistory, sprints } from "./schema.js";
import type * as schema from "./schema.js";

/** Bridges canonical PostgreSQL issues to the transitional hours-based analytics. */
export class SprintAnalysisRepository {
  private readonly sprintList: SprintListRepository;

  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {
    this.sprintList = new SprintListRepository(db);
  }

  async getSprintById(id: string): Promise<Sprint | undefined> {
    const detail = await this.sprintList.getById(id);
    if (!detail) return undefined;

    const issueDetails = await this.db
      .select({
        id: issues.id,
        description: issues.description,
        createdAt: issues.createdAt,
      })
      .from(issues)
      .where(eq(issues.sprintId, id));
    const detailsById = new Map(issueDetails.map((issue) => [issue.id, issue]));
    const canonicalIssues: Issue[] = detail.issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      description: detailsById.get(issue.id)?.description ?? undefined,
      type: issue.type,
      status: issue.status,
      assigneeId: issue.assigneeId ?? undefined,
      storyPoints: issue.storyPoints ?? undefined,
      createdAt: detailsById.get(issue.id)!.createdAt,
      updatedAt: issue.updatedAt,
      sprintId: id,
      acceptanceCriteria: issue.acceptanceCriteria ?? undefined,
      dependencies: issue.dependencies,
    }));

    return {
      id: detail.id,
      name: detail.name,
      goal: detail.goal ?? undefined,
      startDate: detail.startDate,
      endDate: detail.endDate,
      developers: detail.developers.map((developer) => ({
        ...developer,
        capacityStoryPoints: developer.capacityStoryPoints ?? undefined,
        // Legacy workload calculations use hours; keep the demo's point ratios.
        capacityHoursPerWeek: developer.capacityStoryPoints ?? 0,
      })),
      issues: canonicalIssues,
      tasks: canonicalIssues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        assigneeId: issue.assigneeId,
        estimateHours: issue.storyPoints ?? 0,
        status: issue.status === "blocked" ? "in_progress" : issue.status,
        dependencies: issue.dependencies,
      })),
    };
  }

  async getIssueById(issueId: string): Promise<Issue | undefined> {
    const [row] = await this.db
      .select({ sprintId: issues.sprintId })
      .from(issues)
      .where(eq(issues.id, issueId));
    if (!row) return undefined;
    return (await this.getSprintById(row.sprintId))?.issues?.find(
      (issue) => issue.id === issueId,
    );
  }

  async getIssuesByStatus(
    sprintId: string,
    status: IssueStatus,
  ): Promise<Issue[]> {
    const sprint = await this.getSprintById(sprintId);
    if (!sprint) throw new Error(`Sprint not found: ${sprintId}`);
    return (sprint.issues ?? []).filter((issue) => issue.status === status);
  }

  async getSprintActivities(sprintId: string): Promise<Activity[]> {
    const rows = await this.db
      .select()
      .from(activities)
      .where(
        or(
          eq(activities.fromValue, sprintId),
          eq(activities.toValue, sprintId),
        ),
      )
      .orderBy(asc(activities.occurredAt), asc(activities.id));
    return rows.map((row) => ({
      ...row,
      fromValue: row.fromValue ?? undefined,
      toValue: row.toValue ?? undefined,
    }));
  }

  async getSprintHistory(sprintId: string): Promise<SprintHistory[]> {
    const [sprint] = await this.db
      .select({ id: sprints.id })
      .from(sprints)
      .where(eq(sprints.id, sprintId));
    if (!sprint) throw new Error(`Sprint not found: ${sprintId}`);
    return this.db
      .select()
      .from(sprintHistory)
      .orderBy(asc(sprintHistory.startedAt));
  }
}
