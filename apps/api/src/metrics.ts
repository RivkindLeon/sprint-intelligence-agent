import {
  calculateScopeChange,
  calculateTeamVelocity,
} from "@sprint-intelligence/analytics";
import type { Activity, SprintHistory } from "@sprint-intelligence/domain";
import type {
  SprintDetailResponse,
  SprintMetricsResponse,
} from "@sprint-intelligence/shared";

type SprintDetail = SprintDetailResponse["sprint"];

function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 10_000) / 100;
}

export function calculateSprintMetrics(
  detail: SprintDetail,
  activities: Activity[],
  history: SprintHistory[],
): SprintMetricsResponse["metrics"] {
  const completed = detail.issues.filter((issue) => issue.status === "done");
  const blocked = detail.issues.filter((issue) => issue.status === "blocked");
  const totalStoryPoints = detail.issues.reduce(
    (sum, issue) => sum + (issue.storyPoints ?? 0),
    0,
  );
  const completedStoryPoints = completed.reduce(
    (sum, issue) => sum + (issue.storyPoints ?? 0),
    0,
  );
  // The existing scope calculation needs only sprint dates and canonical issues.
  // Legacy hour-based tasks are intentionally empty; no hours-to-points conversion.
  const scope = calculateScopeChange(
    {
      id: detail.id,
      name: detail.name,
      startDate: detail.startDate,
      endDate: detail.endDate,
      developers: [],
      tasks: [],
      issues: detail.issues.map((issue) => ({
        ...issue,
        sprintId: detail.id,
        createdAt: issue.updatedAt,
        assigneeId: issue.assigneeId ?? undefined,
        storyPoints: issue.storyPoints ?? undefined,
        acceptanceCriteria: issue.acceptanceCriteria ?? undefined,
      })),
    },
    activities,
  );
  const velocity = calculateTeamVelocity(history);

  return {
    sprintId: detail.id,
    completion: {
      totalIssues: detail.issues.length,
      completedIssues: completed.length,
      completionPercent: percent(completed.length, detail.issues.length),
      totalStoryPoints,
      completedStoryPoints,
      storyPointCompletionPercent: percent(
        completedStoryPoints,
        totalStoryPoints,
      ),
    },
    blocked: {
      issueCount: blocked.length,
      issueIds: blocked.map((issue) => issue.id),
    },
    scope: {
      addedIssueCount: scope.addedIssueCount,
      addedIssueIds: scope.addedIssueIds,
      netStoryPointChange: scope.netStoryPointChange,
      storyPointGrowthPercent: scope.storyPointGrowthPercent,
    },
    velocity: {
      sprintCount: velocity.sprintCount,
      averageCompletedStoryPoints: velocity.averageCompletedStoryPoints,
      completedStoryPointsBySprint: velocity.sprints.map((sprint) => ({
        sprintId: sprint.sprintId,
        completedStoryPoints: sprint.completedStoryPoints,
      })),
    },
  };
}
