"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDeveloperWorkload = calculateDeveloperWorkload;
exports.calculateSprintProgress = calculateSprintProgress;
const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
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
    const projectedCompletedHoursBySprintEnd = roundToTwoDecimals(averageCompletedHoursPerElapsedDay * sprintDurationDays);
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
function roundToTwoDecimals(value) {
    return Math.round(value * 100) / 100;
}
