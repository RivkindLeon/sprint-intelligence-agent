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
export declare function calculateDeveloperWorkload(sprint: Sprint): SprintWorkloadSummary;
export declare function calculateBlockedTaskRisks(sprint: Sprint): SprintBlockingRiskSummary;
export declare function calculateReadyTaskSummary(sprint: Sprint): SprintReadyTaskSummary;
export declare function calculateAllocationRiskSummary(sprint: Sprint): SprintAllocationRiskSummary;
