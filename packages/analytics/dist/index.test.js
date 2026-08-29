"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = __importDefault(require("node:assert"));
const node_test_1 = __importDefault(require("node:test"));
const index_js_1 = require("./index.js");
(0, node_test_1.default)('calculateDeveloperWorkload summarizes capacity, utilization, and unassigned work', () => {
    const sprint = {
        id: 'sprint-42',
        name: 'Sprint 42',
        startDate: '2026-08-24',
        endDate: '2026-09-04',
        developers: [
            { id: 'dev-1', name: 'Alice', capacityHoursPerWeek: 30 },
            { id: 'dev-2', name: 'Bob', capacityHoursPerWeek: 20 },
            { id: 'dev-3', name: 'Carol', capacityHoursPerWeek: 0 }
        ],
        tasks: [
            { id: 'task-1', title: 'API endpoint', assigneeId: 'dev-1', estimateHours: 18, status: 'in_progress', dependencies: [] },
            { id: 'task-2', title: 'UI wiring', assigneeId: 'dev-1', estimateHours: 16, status: 'todo', dependencies: ['task-1'] },
            { id: 'task-3', title: 'Regression fix', assigneeId: 'dev-2', estimateHours: 20, status: 'todo', dependencies: [] },
            { id: 'task-4', title: 'Scope spike', estimateHours: 6, status: 'todo', dependencies: ['task-2'] },
            { id: 'task-5', title: 'Docs handoff', assigneeId: 'dev-3', estimateHours: 4, status: 'todo', dependencies: [] }
        ]
    };
    const summary = (0, index_js_1.calculateDeveloperWorkload)(sprint);
    node_assert_1.default.deepStrictEqual(summary, {
        workloads: [
            {
                developerId: 'dev-1',
                developerName: 'Alice',
                capacityHours: 30,
                assignedHours: 34,
                taskCount: 2,
                taskIds: ['task-1', 'task-2'],
                remainingCapacityHours: -4,
                overCapacityHours: 4,
                utilizationPercent: 113.33,
                status: 'overallocated'
            },
            {
                developerId: 'dev-2',
                developerName: 'Bob',
                capacityHours: 20,
                assignedHours: 20,
                taskCount: 1,
                taskIds: ['task-3'],
                remainingCapacityHours: 0,
                overCapacityHours: 0,
                utilizationPercent: 100,
                status: 'at_capacity'
            },
            {
                developerId: 'dev-3',
                developerName: 'Carol',
                capacityHours: 0,
                assignedHours: 4,
                taskCount: 1,
                taskIds: ['task-5'],
                remainingCapacityHours: -4,
                overCapacityHours: 4,
                utilizationPercent: 100,
                status: 'overallocated'
            }
        ],
        totalCapacityHours: 50,
        totalAssignedHours: 64,
        totalUnassignedHours: 6,
        unassignedTaskIds: ['task-4']
    });
});
(0, node_test_1.default)('calculateDeveloperWorkload marks under-capacity developers as available', () => {
    const sprint = {
        id: 'sprint-1',
        name: 'Lean sprint',
        startDate: '2026-08-24',
        endDate: '2026-08-31',
        developers: [{ id: 'dev-1', name: 'Dana', capacityHoursPerWeek: 40 }],
        tasks: [{ id: 'task-1', title: 'Bug fix', assigneeId: 'dev-1', estimateHours: 8, status: 'todo', dependencies: [] }]
    };
    const summary = (0, index_js_1.calculateDeveloperWorkload)(sprint);
    node_assert_1.default.deepStrictEqual(summary.workloads[0], {
        developerId: 'dev-1',
        developerName: 'Dana',
        capacityHours: 40,
        assignedHours: 8,
        taskCount: 1,
        taskIds: ['task-1'],
        remainingCapacityHours: 32,
        overCapacityHours: 0,
        utilizationPercent: 20,
        status: 'available'
    });
    node_assert_1.default.strictEqual(summary.totalUnassignedHours, 0);
    node_assert_1.default.deepStrictEqual(summary.unassignedTaskIds, []);
});
(0, node_test_1.default)('calculateBlockedTaskRisks returns task-level risks with explicit dependency evidence', () => {
    const sprint = {
        id: 'sprint-risk-1',
        name: 'Dependency heavy sprint',
        startDate: '2026-08-24',
        endDate: '2026-08-31',
        developers: [
            { id: 'dev-1', name: 'Alice', capacityHoursPerWeek: 30 },
            { id: 'dev-2', name: 'Bob', capacityHoursPerWeek: 30 }
        ],
        tasks: [
            { id: 'task-1', title: 'Backend schema', assigneeId: 'dev-1', estimateHours: 10, status: 'done', dependencies: [] },
            { id: 'task-2', title: 'API endpoint', assigneeId: 'dev-1', estimateHours: 12, status: 'in_progress', dependencies: ['task-1'] },
            { id: 'task-3', title: 'Frontend integration', assigneeId: 'dev-2', estimateHours: 8, status: 'todo', dependencies: ['task-2'] },
            { id: 'task-4', title: 'QA pass', estimateHours: 6, status: 'todo', dependencies: ['task-3', 'task-99'] }
        ]
    };
    const summary = (0, index_js_1.calculateBlockedTaskRisks)(sprint);
    node_assert_1.default.deepStrictEqual(summary, {
        risks: [
            {
                taskId: 'task-3',
                taskTitle: 'Frontend integration',
                assigneeId: 'dev-2',
                blockedBy: [{ dependencyId: 'task-2', dependencyStatus: 'in_progress' }],
                blockedHours: 8,
                reason: 'task-2:in_progress'
            },
            {
                taskId: 'task-4',
                taskTitle: 'QA pass',
                assigneeId: undefined,
                blockedBy: [
                    { dependencyId: 'task-3', dependencyStatus: 'todo' },
                    { dependencyId: 'task-99', dependencyStatus: 'missing' }
                ],
                blockedHours: 6,
                reason: 'task-3:todo, task-99:missing'
            }
        ],
        blockedTaskCount: 2,
        blockedHours: 14,
        blockedTaskIds: ['task-3', 'task-4']
    });
});
(0, node_test_1.default)('calculateBlockedTaskRisks ignores completed tasks and ready work', () => {
    const sprint = {
        id: 'sprint-risk-2',
        name: 'Ready sprint',
        startDate: '2026-08-24',
        endDate: '2026-08-31',
        developers: [{ id: 'dev-1', name: 'Eve', capacityHoursPerWeek: 40 }],
        tasks: [
            { id: 'task-1', title: 'Completed dependency', assigneeId: 'dev-1', estimateHours: 5, status: 'done', dependencies: [] },
            { id: 'task-2', title: 'Ready follow-up', assigneeId: 'dev-1', estimateHours: 3, status: 'todo', dependencies: ['task-1'] }
        ]
    };
    const summary = (0, index_js_1.calculateBlockedTaskRisks)(sprint);
    node_assert_1.default.deepStrictEqual(summary, {
        risks: [],
        blockedTaskCount: 0,
        blockedHours: 0,
        blockedTaskIds: []
    });
});
(0, node_test_1.default)('calculateReadyTaskSummary returns executable tasks grouped by assignee', () => {
    const sprint = {
        id: 'sprint-ready-1',
        name: 'Execution sprint',
        startDate: '2026-08-24',
        endDate: '2026-08-31',
        developers: [
            { id: 'dev-1', name: 'Alice', capacityHoursPerWeek: 30 },
            { id: 'dev-2', name: 'Bob', capacityHoursPerWeek: 20 }
        ],
        tasks: [
            { id: 'task-1', title: 'Schema', assigneeId: 'dev-1', estimateHours: 5, status: 'done', dependencies: [] },
            { id: 'task-2', title: 'API endpoint', assigneeId: 'dev-1', estimateHours: 8, status: 'in_progress', dependencies: ['task-1'] },
            { id: 'task-3', title: 'Frontend wiring', assigneeId: 'dev-2', estimateHours: 6, status: 'todo', dependencies: ['task-1'] },
            { id: 'task-4', title: 'QA pass', estimateHours: 4, status: 'todo', dependencies: ['task-2'] },
            { id: 'task-5', title: 'Release notes', estimateHours: 2, status: 'todo', dependencies: [] },
            { id: 'task-6', title: 'Follow-up', assigneeId: 'dev-2', estimateHours: 3, status: 'todo', dependencies: ['task-99'] }
        ]
    };
    const summary = (0, index_js_1.calculateReadyTaskSummary)(sprint);
    node_assert_1.default.deepStrictEqual(summary, {
        readyTasks: [
            {
                taskId: 'task-2',
                taskTitle: 'API endpoint',
                assigneeId: 'dev-1',
                assigneeName: 'Alice',
                status: 'in_progress',
                estimateHours: 8,
                dependencyIds: ['task-1']
            },
            {
                taskId: 'task-3',
                taskTitle: 'Frontend wiring',
                assigneeId: 'dev-2',
                assigneeName: 'Bob',
                status: 'todo',
                estimateHours: 6,
                dependencyIds: ['task-1']
            },
            {
                taskId: 'task-5',
                taskTitle: 'Release notes',
                assigneeId: undefined,
                assigneeName: undefined,
                status: 'todo',
                estimateHours: 2,
                dependencyIds: []
            }
        ],
        readyTaskCount: 3,
        readyHours: 16,
        readyTaskIds: ['task-2', 'task-3', 'task-5'],
        readyUnassignedTaskCount: 1,
        readyUnassignedHours: 2,
        readyUnassignedTaskIds: ['task-5'],
        readyByAssignee: [
            {
                assigneeId: 'dev-1',
                assigneeName: 'Alice',
                taskCount: 1,
                totalHours: 8,
                taskIds: ['task-2']
            },
            {
                assigneeId: 'dev-2',
                assigneeName: 'Bob',
                taskCount: 1,
                totalHours: 6,
                taskIds: ['task-3']
            },
            {
                assigneeId: undefined,
                assigneeName: 'Unassigned',
                taskCount: 1,
                totalHours: 2,
                taskIds: ['task-5']
            }
        ]
    });
});
(0, node_test_1.default)('calculateReadyTaskSummary ignores done tasks and blocked tasks', () => {
    const sprint = {
        id: 'sprint-ready-2',
        name: 'Blocked sprint',
        startDate: '2026-08-24',
        endDate: '2026-08-31',
        developers: [],
        tasks: [
            { id: 'task-1', title: 'Done task', estimateHours: 1, status: 'done', dependencies: [] },
            { id: 'task-2', title: 'Blocked task', estimateHours: 3, status: 'todo', dependencies: ['task-1', 'task-3'] },
            { id: 'task-3', title: 'Not started dependency', estimateHours: 2, status: 'todo', dependencies: [] }
        ]
    };
    const summary = (0, index_js_1.calculateReadyTaskSummary)(sprint);
    node_assert_1.default.deepStrictEqual(summary.readyTaskIds, ['task-3']);
    node_assert_1.default.strictEqual(summary.readyTaskCount, 1);
    node_assert_1.default.strictEqual(summary.readyHours, 2);
});
(0, node_test_1.default)('calculateAllocationRiskSummary highlights overloaded developers and ready unassigned work', () => {
    const sprint = {
        id: 'sprint-allocation-1',
        name: 'Allocation pressure sprint',
        startDate: '2026-08-24',
        endDate: '2026-08-31',
        developers: [
            { id: 'dev-1', name: 'Alice', capacityHoursPerWeek: 20 },
            { id: 'dev-2', name: 'Bob', capacityHoursPerWeek: 12 },
            { id: 'dev-3', name: 'Carol', capacityHoursPerWeek: 5 }
        ],
        tasks: [
            { id: 'task-1', title: 'Backend API', assigneeId: 'dev-1', estimateHours: 14, status: 'in_progress', dependencies: [] },
            { id: 'task-2', title: 'Frontend flow', assigneeId: 'dev-1', estimateHours: 10, status: 'todo', dependencies: [] },
            { id: 'task-3', title: 'QA pass', assigneeId: 'dev-2', estimateHours: 4, status: 'todo', dependencies: [] },
            { id: 'task-4', title: 'Docs', estimateHours: 3, status: 'todo', dependencies: [] },
            { id: 'task-5', title: 'Release prep', estimateHours: 7, status: 'todo', dependencies: [] }
        ]
    };
    const summary = (0, index_js_1.calculateAllocationRiskSummary)(sprint);
    node_assert_1.default.deepStrictEqual(summary, {
        risks: [
            {
                riskId: 'overallocated:dev-1',
                kind: 'overallocated_developer',
                severity: 'medium',
                developerId: 'dev-1',
                developerName: 'Alice',
                taskIds: ['task-1', 'task-2'],
                hoursAtRisk: 4,
                reason: 'Overallocated by 4h; ready tasks can be reassigned'
            },
            {
                riskId: 'unassigned:task-4',
                kind: 'unassigned_ready_task',
                severity: 'medium',
                taskIds: ['task-4'],
                hoursAtRisk: 3,
                reason: 'Ready but unassigned; fits dev-2, dev-3'
            },
            {
                riskId: 'unassigned:task-5',
                kind: 'unassigned_ready_task',
                severity: 'high',
                taskIds: ['task-5'],
                hoursAtRisk: 7,
                reason: 'Ready but unassigned; no developer has enough remaining capacity'
            }
        ],
        riskCount: 3,
        highRiskCount: 1,
        totalHoursAtRisk: 14
    });
});
(0, node_test_1.default)('calculateAllocationRiskSummary omits balanced sprints', () => {
    const sprint = {
        id: 'sprint-allocation-2',
        name: 'Balanced sprint',
        startDate: '2026-08-24',
        endDate: '2026-08-31',
        developers: [{ id: 'dev-1', name: 'Dana', capacityHoursPerWeek: 20 }],
        tasks: [{ id: 'task-1', title: 'Bugfix', assigneeId: 'dev-1', estimateHours: 8, status: 'todo', dependencies: [] }]
    };
    const summary = (0, index_js_1.calculateAllocationRiskSummary)(sprint);
    node_assert_1.default.deepStrictEqual(summary, {
        risks: [],
        riskCount: 0,
        highRiskCount: 0,
        totalHoursAtRisk: 0
    });
});
