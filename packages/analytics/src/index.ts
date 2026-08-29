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

export interface ReadyTask {
  taskId: string;
  taskTitle: string;
  assigneeId?: string;
  assigneeName?: string;
  status: Exclude<Task['status'], 'done'>;
  estimateHours: number;
  dependencyIds: string[];
}

export interface ReadyTaskAssigneeSummary {
  assigneeId?: string;
  assigneeName: string;
  taskCount: number;
  totalHours: number;
  taskIds: string[];
}

export interface SprintReadyTaskSummary {
  readyTasks: ReadyTask[];
  readyTaskCount: number;
  readyHours: number;
  readyTaskIds: string[];
  readyUnassignedTaskCount: number;
  readyUnassignedHours: number;
  readyUnassignedTaskIds: string[];
  readyByAssignee: ReadyTaskAssigneeSummary[];
}

export type AllocationRiskKind = 'overallocated_developer' | 'unassigned_ready_task';

export type AllocationRiskSeverity = 'medium' | 'high';

export interface AllocationRisk {
  riskId: string;
  kind: AllocationRiskKind;
  severity: AllocationRiskSeverity;
  developerId?: string;
  developerName?: string;
  taskIds: string[];
  hoursAtRisk: number;
  reason: string;
}

export interface SprintAllocationRiskSummary {
  risks: AllocationRisk[];
  riskCount: number;
  highRiskCount: number;
  totalHoursAtRisk: number;
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

    const blockedBy = findBlockingDependencies(task, tasksById);

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

export function calculateReadyTaskSummary(sprint: Sprint): SprintReadyTaskSummary {
  const tasksById = new Map(sprint.tasks.map((task) => [task.id, task]));
  const developersById = new Map(sprint.developers.map((developer) => [developer.id, developer]));
  const readyTasks: ReadyTask[] = [];

  for (const task of sprint.tasks) {
    if (task.status === 'done') {
      continue;
    }

    if (findBlockingDependencies(task, tasksById).length > 0) {
      continue;
    }

    readyTasks.push({
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeId ? developersById.get(task.assigneeId)?.name : undefined,
      status: task.status,
      estimateHours: task.estimateHours,
      dependencyIds: [...task.dependencies]
    });
  }

  const readyByAssignee = groupReadyTasksByAssignee(readyTasks);
  const readyUnassignedTasks = readyTasks.filter((task) => task.assigneeId === undefined);

  return {
    readyTasks,
    readyTaskCount: readyTasks.length,
    readyHours: readyTasks.reduce((sum, task) => sum + task.estimateHours, 0),
    readyTaskIds: readyTasks.map((task) => task.taskId),
    readyUnassignedTaskCount: readyUnassignedTasks.length,
    readyUnassignedHours: readyUnassignedTasks.reduce((sum, task) => sum + task.estimateHours, 0),
    readyUnassignedTaskIds: readyUnassignedTasks.map((task) => task.taskId),
    readyByAssignee
  };
}

export function calculateAllocationRiskSummary(sprint: Sprint): SprintAllocationRiskSummary {
  const workloadSummary = calculateDeveloperWorkload(sprint);
  const readyTaskSummary = calculateReadyTaskSummary(sprint);
  const risks: AllocationRisk[] = [];

  for (const workload of workloadSummary.workloads) {
    if (workload.overCapacityHours === 0) {
      continue;
    }

    const readyTasksForDeveloper = readyTaskSummary.readyTasks.filter(
      (task) => task.assigneeId === workload.developerId
    );
    const evidenceTaskIds =
      readyTasksForDeveloper.length > 0
        ? readyTasksForDeveloper.map((task) => task.taskId)
        : workload.taskIds;

    risks.push({
      riskId: `overallocated:${workload.developerId}`,
      kind: 'overallocated_developer',
      severity: workload.overCapacityHours >= 8 ? 'high' : 'medium',
      developerId: workload.developerId,
      developerName: workload.developerName,
      taskIds: evidenceTaskIds,
      hoursAtRisk: workload.overCapacityHours,
      reason:
        readyTasksForDeveloper.length > 0
          ? `Overallocated by ${workload.overCapacityHours}h; ready tasks can be reassigned`
          : `Overallocated by ${workload.overCapacityHours}h; no ready assigned tasks to rebalance`
    });
  }

  const remainingCapacityByDeveloper = new Map<string, number>(
    workloadSummary.workloads.map((workload) => [
      workload.developerId,
      workload.remainingCapacityHours
    ])
  );

  for (const task of readyTaskSummary.readyTasks) {
    if (task.assigneeId !== undefined) {
      continue;
    }

    const matchingDevelopers = workloadSummary.workloads.filter((workload) => {
      const remaining = remainingCapacityByDeveloper.get(workload.developerId) ?? 0;
      return remaining > 0 && remaining >= task.estimateHours;
    });

    const absorbingDeveloper = matchingDevelopers[0];

    if (absorbingDeveloper !== undefined) {
      const remaining =
        remainingCapacityByDeveloper.get(absorbingDeveloper.developerId) ?? 0;
      remainingCapacityByDeveloper.set(
        absorbingDeveloper.developerId,
        remaining - task.estimateHours
      );
    }

    risks.push({
      riskId: `unassigned:${task.taskId}`,
      kind: 'unassigned_ready_task',
      severity: matchingDevelopers.length > 0 ? 'medium' : 'high',
      taskIds: [task.taskId],
      hoursAtRisk: task.estimateHours,
      reason:
        matchingDevelopers.length > 0
          ? `Ready but unassigned; fits ${matchingDevelopers.map((workload) => workload.developerId).join(', ')}`
          : 'Ready but unassigned; no developer has enough remaining capacity'
    });
  }

  return {
    risks,
    riskCount: risks.length,
    highRiskCount: risks.filter((risk) => risk.severity === 'high').length,
    totalHoursAtRisk: risks.reduce((sum, risk) => sum + risk.hoursAtRisk, 0)
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

function findBlockingDependencies(
  task: Task,
  tasksById: Map<string, Task>
): BlockingDependency[] {
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

  return blockedBy;
}

function groupReadyTasksByAssignee(readyTasks: ReadyTask[]): ReadyTaskAssigneeSummary[] {
  const grouped = new Map<string | undefined, ReadyTaskAssigneeSummary>();

  for (const task of readyTasks) {
    const key = task.assigneeId;
    const current = grouped.get(key);

    if (current) {
      current.taskCount += 1;
      current.totalHours += task.estimateHours;
      current.taskIds.push(task.taskId);
      continue;
    }

    grouped.set(key, {
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName ?? 'Unassigned',
      taskCount: 1,
      totalHours: task.estimateHours,
      taskIds: [task.taskId]
    });
  }

  return [...grouped.values()];
}

function buildBlockingReason(blockedBy: BlockingDependency[]): string {
  return blockedBy
    .map((dependency) => `${dependency.dependencyId}:${dependency.dependencyStatus}`)
    .join(', ');
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
