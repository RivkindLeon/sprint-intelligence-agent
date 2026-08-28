"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDeveloperWorkload = calculateDeveloperWorkload;
exports.calculateBlockedTaskRisks = calculateBlockedTaskRisks;
exports.calculateReadyTaskSummary = calculateReadyTaskSummary;
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
