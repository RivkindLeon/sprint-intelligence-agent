"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDeveloperWorkload = calculateDeveloperWorkload;
exports.calculateBlockedTaskRisks = calculateBlockedTaskRisks;
exports.calculateReadyTaskSummary = calculateReadyTaskSummary;
exports.calculateAllocationRiskSummary = calculateAllocationRiskSummary;
exports.calculateSprintProgress = calculateSprintProgress;
function calculateDeveloperWorkload(sprint) {
    const tasksByAssignee = groupTasksByAssignee(sprint.tasks);
    const unassignedTasks = tasksByAssignee.get(undefined) ?? [];
    const workloads = sprint.developers.map((developer) => {
        const assignedTasks = tasksByAssignee.get(developer.id) ?? [];
        const assignedHours = sumTaskHours(assignedTasks);
        const remainingCapacityHours = developer.capacityHoursPerWeek - assignedHours;
        const overCapacityHours = Math.max(assignedHours - developer.capacityHoursPerWeek, 0);
        const utilizationPercent = developer.capacityHoursPerWeek === 0
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
        };
    });
    return {
        workloads,
        totalCapacityHours: sprint.developers.reduce((sum, developer) => sum + developer.capacityHoursPerWeek, 0),
        totalAssignedHours: sprint.tasks.reduce((sum, task) => sum + task.estimateHours, 0),
        totalUnassignedHours: sumTaskHours(unassignedTasks),
        unassignedTaskIds: unassignedTasks.map((task) => task.id)
    };
}
function calculateBlockedTaskRisks(sprint) {
    const tasksById = new Map(sprint.tasks.map((task) => [task.id, task]));
    const risks = [];
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
function calculateReadyTaskSummary(sprint) {
    const tasksById = new Map(sprint.tasks.map((task) => [task.id, task]));
    const developersById = new Map(sprint.developers.map((developer) => [developer.id, developer]));
    const readyTasks = [];
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
function calculateAllocationRiskSummary(sprint) {
    const workloadSummary = calculateDeveloperWorkload(sprint);
    const readyTaskSummary = calculateReadyTaskSummary(sprint);
    const risks = [];
    for (const workload of workloadSummary.workloads) {
        if (workload.overCapacityHours === 0) {
            continue;
        }
        const readyTasksForDeveloper = readyTaskSummary.readyTasks.filter((task) => task.assigneeId === workload.developerId);
        const evidenceTaskIds = readyTasksForDeveloper.length > 0
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
            reason: readyTasksForDeveloper.length > 0
                ? `Overallocated by ${workload.overCapacityHours}h; ready tasks can be reassigned`
                : `Overallocated by ${workload.overCapacityHours}h; no ready assigned tasks to rebalance`
        });
    }
    const remainingCapacityByDeveloper = new Map(workloadSummary.workloads.map((workload) => [
        workload.developerId,
        workload.remainingCapacityHours
    ]));
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
            const remaining = remainingCapacityByDeveloper.get(absorbingDeveloper.developerId) ?? 0;
            remainingCapacityByDeveloper.set(absorbingDeveloper.developerId, remaining - task.estimateHours);
        }
        risks.push({
            riskId: `unassigned:${task.taskId}`,
            kind: 'unassigned_ready_task',
            severity: matchingDevelopers.length > 0 ? 'medium' : 'high',
            taskIds: [task.taskId],
            hoursAtRisk: task.estimateHours,
            reason: matchingDevelopers.length > 0
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
function groupTasksByAssignee(tasks) {
    const grouped = new Map();
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
function sumTaskHours(tasks) {
    return tasks.reduce((sum, task) => sum + task.estimateHours, 0);
}
function determineStatus(assignedHours, capacityHours) {
    if (assignedHours > capacityHours) {
        return 'overallocated';
    }
    if (assignedHours === capacityHours) {
        return 'at_capacity';
    }
    return 'available';
}
function findBlockingDependencies(task, tasksById) {
    const blockedBy = [];
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
function groupReadyTasksByAssignee(readyTasks) {
    const grouped = new Map();
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
function buildBlockingReason(blockedBy) {
    return blockedBy
        .map((dependency) => `${dependency.dependencyId}:${dependency.dependencyStatus}`)
        .join(', ');
}
function roundToTwoDecimals(value) {
    return Math.round(value * 100) / 100;
}
const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
function calculateSprintProgress(sprint, options = {}) {
    const referenceDate = normalizeReferenceDate(options.referenceDate);
    const sprintStart = parseIsoDate(sprint.startDate);
    const sprintEnd = parseIsoDate(sprint.endDate);
    const sprintDurationDays = differenceInCalendarDays(sprintStart, sprintEnd) + 1;
    const elapsedSprintDays = clamp(differenceInCalendarDays(sprintStart, referenceDate) + 1, 0, sprintDurationDays);
    const remainingSprintDays = sprintDurationDays - elapsedSprintDays;
    const totalEstimatedHours = sprint.tasks.reduce((sum, task) => sum + task.estimateHours, 0);
    const statusBreakdown = TASK_STATUSES.map((status) => {
        const tasks = sprint.tasks.filter((task) => task.status === status);
        return {
            status,
            taskCount: tasks.length,
            totalHours: sumTaskHours(tasks),
            taskIds: tasks.map((task) => task.id)
        };
    });
    const completedSummary = statusBreakdown.find((summary) => summary.status === 'done');
    const inProgressSummary = statusBreakdown.find((summary) => summary.status === 'in_progress');
    const todoSummary = statusBreakdown.find((summary) => summary.status === 'todo');
    const completionRateByTasks = sprint.tasks.length === 0 ? 0 : roundToTwoDecimals((completedSummary.taskCount / sprint.tasks.length) * 100);
    const completionRateByHours = totalEstimatedHours === 0 ? 0 : roundToTwoDecimals((completedSummary.totalHours / totalEstimatedHours) * 100);
    const elapsedSprintPercent = sprintDurationDays === 0 ? 0 : roundToTwoDecimals((elapsedSprintDays / sprintDurationDays) * 100);
    const averageCompletedHoursPerElapsedDay = elapsedSprintDays === 0 ? 0 : roundToTwoDecimals(completedSummary.totalHours / elapsedSprintDays);
    const projectedCompletedHoursBySprintEnd = elapsedSprintDays === 0
        ? 0
        : roundToTwoDecimals((completedSummary.totalHours / elapsedSprintDays) * sprintDurationDays);
    const projectedCompletionRateByHours = totalEstimatedHours === 0
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
function normalizeReferenceDate(referenceDate) {
    if (referenceDate instanceof Date) {
        return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
    }
    if (referenceDate) {
        return parseIsoDate(referenceDate);
    }
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function parseIsoDate(value) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid ISO date: ${value}`);
    }
    return date;
}
function differenceInCalendarDays(start, end) {
    return Math.floor((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY);
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
