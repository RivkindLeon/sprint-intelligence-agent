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

export interface BlockingDependency {
  dependencyId: string;
  dependencyStatus: Task['status'] | 'missing';
}

export interface BlockedTaskRisk {
  taskId: string;
  taskTitle: string;
  assigneeId?: string;
  blockedBy: BlockingDependency[];
  blockedHours: number;
  reason: string;
}

export interface SprintBlockingRiskSummary {
  risks: BlockedTaskRisk[];
  blockedTaskCount: number;
  blockedHours: number;
  blockedTaskIds: string[];
}

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

export function calculateBlockedTaskRisks(sprint: Sprint): SprintBlockingRiskSummary {
  const tasksById = new Map(sprint.tasks.map((task) => [task.id, task]));
  const risks: BlockedTaskRisk[] = [];

  for (const task of sprint.tasks) {
    if (task.status === 'done') {
      continue;
    }

    const blockedBy: BlockingDependency[] = [];

    for (const dependencyId of task.dependencies) {
      const dependency = tasksById.get(dependencyId);

      if (!dependency) {
        blockedBy.push({
          dependencyId,
          dependencyStatus: 'missing'
        });
        continue;
      }

      if (dependency.status === 'done') {
        continue;
      }

      blockedBy.push({
        dependencyId,
        dependencyStatus: dependency.status
      });
    }

    if (blockedBy.length === 0) {
      continue;
    }

    risks.push({
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: task.assigneeId,
      blockedBy,
      blockedHours: task.estimateHours,
      reason: buildBlockingReason(blockedBy)
    });
  }

  return {
    risks,
    blockedTaskCount: risks.length,
    blockedHours: risks.reduce((sum, risk) => sum + risk.blockedHours, 0),
    blockedTaskIds: risks.map((risk) => risk.taskId)
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

function buildBlockingReason(blockedBy: BlockingDependency[]): string {
  return blockedBy
    .map((dependency) => `${dependency.dependencyId}:${dependency.dependencyStatus}`)
    .join(', ');
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
