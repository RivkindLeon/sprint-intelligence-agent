import type { Sprint, Task } from '@sprint-intelligence/domain';

export type WorkloadStatus = 'available' | 'at_capacity' | 'overallocated';

export interface DeveloperWorkload {
  developerId: string;
  developerName: string;
  capacityHours: number;
  assignedHours: number;
  taskCount: number;
  taskIds: string[];
  remainingCapacityHours: number;
  overCapacityHours: number;
  utilizationPercent: number;
  status: WorkloadStatus;
}

export interface SprintWorkloadSummary {
  workloads: DeveloperWorkload[];
  totalCapacityHours: number;
  totalAssignedHours: number;
  totalUnassignedHours: number;
  unassignedTaskIds: string[];
}

export interface SprintStatusSummary {
  status: Task['status'];
  taskCount: number;
  totalHours: number;
  taskIds: string[];
}

export interface SprintProgressSummary {
  totalTaskCount: number;
  totalEstimatedHours: number;
  statusBreakdown: SprintStatusSummary[];
  completedTaskCount: number;
  completedHours: number;
  inProgressTaskCount: number;
  inProgressHours: number;
  todoTaskCount: number;
  todoHours: number;
  completionRateByTasks: number;
  completionRateByHours: number;
  sprintDurationDays: number;
  elapsedSprintDays: number;
  remainingSprintDays: number;
  elapsedSprintPercent: number;
  averageCompletedHoursPerElapsedDay: number;
  projectedCompletedHoursBySprintEnd: number;
  projectedCompletionRateByHours: number;
  isProjectedToComplete: boolean;
}

export interface SprintProgressOptions {
  referenceDate?: string | Date;
}

const TASK_STATUSES: Task['status'][] = ['todo', 'in_progress', 'done'];
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateDeveloperWorkload(sprint: Sprint): SprintWorkloadSummary {
  const tasksByAssignee = groupTasksByAssignee(sprint.tasks);
  const unassignedTasks = tasksByAssignee.get(undefined) ?? [];

  const workloads = sprint.developers.map((developer) => {
    const assignedTasks = tasksByAssignee.get(developer.id) ?? [];
    const assignedHours = sumTaskHours(assignedTasks);
    const remainingCapacityHours = developer.capacityHoursPerWeek - assignedHours;
    const overCapacityHours = Math.max(assignedHours - developer.capacityHoursPerWeek, 0);
    const utilizationPercent =
      developer.capacityHoursPerWeek === 0
        ? assignedHours > 0
          ? 100
          : 0
        : roundToTwoDecimals((assignedHours / developer.capacityHoursPerWeek) * 100);

    return {
      developerId: developer.id,
      developerName: developer.name,
      capacityHours: developer.capacityHoursPerWeek,
      assignedHours,
      taskCount: assignedTasks.length,
      taskIds: assignedTasks.map((task) => task.id),
      remainingCapacityHours,
      overCapacityHours,
      utilizationPercent,
      status: determineStatus(assignedHours, developer.capacityHoursPerWeek)
    } satisfies DeveloperWorkload;
  });

  return {
    workloads,
    totalCapacityHours: sprint.developers.reduce((sum, developer) => sum + developer.capacityHoursPerWeek, 0),
    totalAssignedHours: sprint.tasks.reduce((sum, task) => sum + task.estimateHours, 0),
    totalUnassignedHours: sumTaskHours(unassignedTasks),
    unassignedTaskIds: unassignedTasks.map((task) => task.id)
  };
}

export function calculateSprintProgress(
  sprint: Sprint,
  options: SprintProgressOptions = {}
): SprintProgressSummary {
  const referenceDate = normalizeReferenceDate(options.referenceDate);
  const sprintStart = parseIsoDate(sprint.startDate);
  const sprintEnd = parseIsoDate(sprint.endDate);
  const sprintDurationDays = differenceInCalendarDays(sprintStart, sprintEnd) + 1;
  const elapsedSprintDays = clamp(
    differenceInCalendarDays(sprintStart, referenceDate) + 1,
    0,
    sprintDurationDays
  );
  const remainingSprintDays = sprintDurationDays - elapsedSprintDays;
  const totalEstimatedHours = sprint.tasks.reduce((sum, task) => sum + task.estimateHours, 0);

  const statusBreakdown = TASK_STATUSES.map((status) => {
    const tasks = sprint.tasks.filter((task) => task.status === status);

    return {
      status,
      taskCount: tasks.length,
      totalHours: sumTaskHours(tasks),
      taskIds: tasks.map((task) => task.id)
    } satisfies SprintStatusSummary;
  });

  const completedSummary = statusBreakdown.find((summary) => summary.status === 'done')!;
  const inProgressSummary = statusBreakdown.find((summary) => summary.status === 'in_progress')!;
  const todoSummary = statusBreakdown.find((summary) => summary.status === 'todo')!;

  const completionRateByTasks =
    sprint.tasks.length === 0 ? 0 : roundToTwoDecimals((completedSummary.taskCount / sprint.tasks.length) * 100);
  const completionRateByHours =
    totalEstimatedHours === 0 ? 0 : roundToTwoDecimals((completedSummary.totalHours / totalEstimatedHours) * 100);
  const elapsedSprintPercent =
    sprintDurationDays === 0 ? 0 : roundToTwoDecimals((elapsedSprintDays / sprintDurationDays) * 100);
  const averageCompletedHoursPerElapsedDay =
    elapsedSprintDays === 0 ? 0 : roundToTwoDecimals(completedSummary.totalHours / elapsedSprintDays);
  const projectedCompletedHoursBySprintEnd = roundToTwoDecimals(
    averageCompletedHoursPerElapsedDay * sprintDurationDays
  );
  const projectedCompletionRateByHours =
    totalEstimatedHours === 0
      ? 0
      : roundToTwoDecimals((projectedCompletedHoursBySprintEnd / totalEstimatedHours) * 100);

  return {
    totalTaskCount: sprint.tasks.length,
    totalEstimatedHours,
    statusBreakdown,
    completedTaskCount: completedSummary.taskCount,
    completedHours: completedSummary.totalHours,
    inProgressTaskCount: inProgressSummary.taskCount,
    inProgressHours: inProgressSummary.totalHours,
    todoTaskCount: todoSummary.taskCount,
    todoHours: todoSummary.totalHours,
    completionRateByTasks,
    completionRateByHours,
    sprintDurationDays,
    elapsedSprintDays,
    remainingSprintDays,
    elapsedSprintPercent,
    averageCompletedHoursPerElapsedDay,
    projectedCompletedHoursBySprintEnd,
    projectedCompletionRateByHours,
    isProjectedToComplete: projectedCompletedHoursBySprintEnd >= totalEstimatedHours
  };
}

function groupTasksByAssignee(tasks: Task[]): Map<string | undefined, Task[]> {
  const grouped = new Map<string | undefined, Task[]>();

  for (const task of tasks) {
    const key = task.assigneeId;
    const bucket = grouped.get(key);

    if (bucket) {
      bucket.push(task);
      continue;
    }

    grouped.set(key, [task]);
  }

  return grouped;
}

function sumTaskHours(tasks: Task[]): number {
  return tasks.reduce((sum, task) => sum + task.estimateHours, 0);
}

function determineStatus(assignedHours: number, capacityHours: number): WorkloadStatus {
  if (assignedHours > capacityHours) {
    return 'overallocated';
  }

  if (assignedHours === capacityHours) {
    return 'at_capacity';
  }

  return 'available';
}

function normalizeReferenceDate(referenceDate?: string | Date): Date {
  if (referenceDate instanceof Date) {
    return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  }

  if (referenceDate) {
    return parseIsoDate(referenceDate);
  }

  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  return date;
}

function differenceInCalendarDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
