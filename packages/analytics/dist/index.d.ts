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
export declare function calculateDeveloperWorkload(sprint: Sprint): SprintWorkloadSummary;
export declare function calculateSprintProgress(sprint: Sprint, options?: SprintProgressOptions): SprintProgressSummary;
