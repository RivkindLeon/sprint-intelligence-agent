import {
  calculateBlockedTaskRisks,
  calculateCarryOverRisk,
  calculateDependencyCycleRisks,
  calculateDeveloperWorkload,
  calculateScopeChange,
  calculateSprintHealthScore,
  findMissingAcceptanceCriteria,
  findMissingEstimates,
  findStaleIssues,
} from "@sprint-intelligence/analytics";
import type { SprintHealthScore } from "@sprint-intelligence/analytics";
import type {
  Activity,
  Sprint,
  SprintHistory,
} from "@sprint-intelligence/domain";

export interface SprintHealthRepository {
  getSprintById(sprintId: string): Promise<Sprint | undefined>;
  getSprintActivities(sprintId: string): Promise<Activity[]>;
  getSprintHistory(sprintId: string): Promise<SprintHistory[]>;
}

export interface SprintHealthScoreSource {
  calculate(sprintId: string): Promise<SprintHealthScore>;
}

export interface SprintHealthScoreSourceOptions {
  clock?: () => Date;
  staleThresholdDays?: number;
}

export function createSprintHealthScoreSource(
  repository: SprintHealthRepository,
  options: SprintHealthScoreSourceOptions = {},
): SprintHealthScoreSource {
  return {
    async calculate(sprintId: string) {
      const [sprint, activities, history] = await Promise.all([
        repository.getSprintById(sprintId),
        repository.getSprintActivities(sprintId),
        repository.getSprintHistory(sprintId),
      ]);

      if (sprint === undefined) {
        throw new Error(`Sprint not found: ${sprintId}`);
      }

      const issues = sprint.issues ?? [];
      const unfinishedIssues = issues.filter(
        (issue) => issue.status !== "done",
      );
      const unfinishedTasks = sprint.tasks.filter(
        (task) => task.status !== "done",
      );
      const unfinishedTaskHours = unfinishedTasks.reduce(
        (sum, task) => sum + task.estimateHours,
        0,
      );
      const blocking = calculateBlockedTaskRisks(sprint);
      const workload = calculateDeveloperWorkload(sprint);
      const dependencies = calculateDependencyCycleRisks(sprint);
      const scope = calculateScopeChange(sprint, activities);
      const stale = findStaleIssues(sprint, {
        referenceDate: options.clock?.() ?? new Date(),
        thresholdDays: options.staleThresholdDays,
      });
      const carryOver = calculateCarryOverRisk(sprint, history);
      const qualityIssueIds = new Set([
        ...findMissingEstimates(sprint).missingEstimateIssueIds,
        ...findMissingAcceptanceCriteria(sprint)
          .missingAcceptanceCriteriaIssueIds,
      ]);

      return calculateSprintHealthScore({
        blockedWorkPercent: percentage(
          blocking.blockedHours,
          unfinishedTaskHours,
        ),
        capacityImbalancePercent: percentage(
          workload.workloads.filter(
            (developer) => developer.status === "overallocated",
          ).length,
          workload.workloads.length,
        ),
        dependencyRiskPercent: percentage(
          dependencies.affectedTaskCount,
          unfinishedTasks.length,
        ),
        scopeGrowthPercent: Math.max(scope.storyPointGrowthPercent, 0),
        staleWorkPercent: percentage(
          stale.staleIssueCount,
          unfinishedIssues.length,
        ),
        forecastCarryOverPercent: carryOver.forecastCarryOverPercent,
        qualityProblemPercent: percentage(qualityIssueIds.size, issues.length),
      });
    },
  };
}

function percentage(affected: number, total: number): number {
  return total === 0 ? 0 : (affected / total) * 100;
}
