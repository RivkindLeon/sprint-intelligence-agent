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

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
