import type { Sprint } from '@sprint-intelligence/domain';
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
export declare function calculateDeveloperWorkload(sprint: Sprint): SprintWorkloadSummary;
