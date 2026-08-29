import assert from 'node:assert';
import test from 'node:test';

import type { Sprint } from '@sprint-intelligence/domain';

import { calculateAllocationRiskSummary, calculateBlockedTaskRisks, calculateDeveloperWorkload, calculateReadyTaskSummary, calculateSprintProgress } from './index.js';

test('calculateDeveloperWorkload summarizes capacity, utilization, and unassigned work', () => {
  const sprint: Sprint = {
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

  const summary = calculateDeveloperWorkload(sprint);

  assert.deepStrictEqual(summary, {
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

test('calculateDeveloperWorkload marks under-capacity developers as available', () => {
  const sprint: Sprint = {
    id: 'sprint-1',
    name: 'Lean sprint',
    startDate: '2026-08-24',
    endDate: '2026-08-31',
    developers: [{ id: 'dev-1', name: 'Dana', capacityHoursPerWeek: 40 }],
    tasks: [{ id: 'task-1', title: 'Bug fix', assigneeId: 'dev-1', estimateHours: 8, status: 'todo', dependencies: [] }]
  };

  const summary = calculateDeveloperWorkload(sprint);

  assert.deepStrictEqual(summary.workloads[0], {
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
  assert.strictEqual(summary.totalUnassignedHours, 0);
  assert.deepStrictEqual(summary.unassignedTaskIds, []);
});

test('calculateBlockedTaskRisks returns task-level risks with explicit dependency evidence', () => {
  const sprint: Sprint = {
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

  const summary = calculateBlockedTaskRisks(sprint);

  assert.deepStrictEqual(summary, {
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

test('calculateBlockedTaskRisks ignores completed tasks and ready work', () => {
  const sprint: Sprint = {
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

  const summary = calculateBlockedTaskRisks(sprint);

  assert.deepStrictEqual(summary, {
    risks: [],
    blockedTaskCount: 0,
    blockedHours: 0,
    blockedTaskIds: []
  });
});

test('calculateReadyTaskSummary returns executable tasks grouped by assignee', () => {
  const sprint: Sprint = {
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

  const summary = calculateReadyTaskSummary(sprint);

  assert.deepStrictEqual(summary, {
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

test('calculateReadyTaskSummary ignores done tasks and blocked tasks', () => {
  const sprint: Sprint = {
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

  const summary = calculateReadyTaskSummary(sprint);

  assert.deepStrictEqual(summary.readyTaskIds, ['task-3']);
  assert.strictEqual(summary.readyTaskCount, 1);
  assert.strictEqual(summary.readyHours, 2);
});

test('calculateAllocationRiskSummary highlights overloaded developers and ready unassigned work', () => {
  const sprint: Sprint = {
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

  const summary = calculateAllocationRiskSummary(sprint);

  assert.deepStrictEqual(summary, {
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

test('calculateAllocationRiskSummary omits balanced sprints', () => {
  const sprint: Sprint = {
    id: 'sprint-allocation-2',
    name: 'Balanced sprint',
    startDate: '2026-08-24',
    endDate: '2026-08-31',
    developers: [{ id: 'dev-1', name: 'Dana', capacityHoursPerWeek: 20 }],
    tasks: [{ id: 'task-1', title: 'Bugfix', assigneeId: 'dev-1', estimateHours: 8, status: 'todo', dependencies: [] }]
  };

  const summary = calculateAllocationRiskSummary(sprint);

  assert.deepStrictEqual(summary, {
    risks: [],
    riskCount: 0,
    highRiskCount: 0,
    totalHoursAtRisk: 0
  });
});

test('calculateSprintProgress summarizes status mix, elapsed time, and delivery projection', () => {
  const sprint: Sprint = {
    id: 'sprint-progress-1',
    name: 'Execution sprint',
    startDate: '2026-08-24',
    endDate: '2026-08-30',
    developers: [
      { id: 'dev-1', name: 'Alice', capacityHoursPerWeek: 30 },
      { id: 'dev-2', name: 'Bob', capacityHoursPerWeek: 25 }
    ],
    tasks: [
      { id: 'task-1', title: 'Foundation', assigneeId: 'dev-1', estimateHours: 8, status: 'done', dependencies: [] },
      { id: 'task-2', title: 'API integration', assigneeId: 'dev-1', estimateHours: 10, status: 'done', dependencies: [] },
      { id: 'task-3', title: 'Frontend wiring', assigneeId: 'dev-2', estimateHours: 6, status: 'in_progress', dependencies: [] },
      { id: 'task-4', title: 'QA pass', assigneeId: 'dev-2', estimateHours: 4, status: 'todo', dependencies: ['task-3'] },
      { id: 'task-5', title: 'Release notes', estimateHours: 2, status: 'todo', dependencies: [] }
    ]
  };

  const summary = calculateSprintProgress(sprint, { referenceDate: '2026-08-26' });

  assert.deepStrictEqual(summary, {
    totalTaskCount: 5,
    totalEstimatedHours: 30,
    statusBreakdown: [
      {
        status: 'todo',
        taskCount: 2,
        totalHours: 6,
        taskIds: ['task-4', 'task-5']
      },
      {
        status: 'in_progress',
        taskCount: 1,
        totalHours: 6,
        taskIds: ['task-3']
      },
      {
        status: 'done',
        taskCount: 2,
        totalHours: 18,
        taskIds: ['task-1', 'task-2']
      }
    ],
    completedTaskCount: 2,
    completedHours: 18,
    inProgressTaskCount: 1,
    inProgressHours: 6,
    todoTaskCount: 2,
    todoHours: 6,
    completionRateByTasks: 40,
    completionRateByHours: 60,
    sprintDurationDays: 7,
    elapsedSprintDays: 3,
    remainingSprintDays: 4,
    elapsedSprintPercent: 42.86,
    averageCompletedHoursPerElapsedDay: 6,
    projectedCompletedHoursBySprintEnd: 42,
    projectedCompletionRateByHours: 140,
    isProjectedToComplete: true
  });
});

test('calculateSprintProgress clamps elapsed days before the sprint starts', () => {
  const sprint: Sprint = {
    id: 'sprint-progress-2',
    name: 'Future sprint',
    startDate: '2026-09-10',
    endDate: '2026-09-16',
    developers: [],
    tasks: [{ id: 'task-1', title: 'Prep', estimateHours: 5, status: 'todo', dependencies: [] }]
  };

  const summary = calculateSprintProgress(sprint, { referenceDate: '2026-09-08' });

  assert.strictEqual(summary.elapsedSprintDays, 0);
  assert.strictEqual(summary.remainingSprintDays, 7);
  assert.strictEqual(summary.elapsedSprintPercent, 0);
  assert.strictEqual(summary.averageCompletedHoursPerElapsedDay, 0);
  assert.strictEqual(summary.projectedCompletedHoursBySprintEnd, 0);
  assert.strictEqual(summary.isProjectedToComplete, false);
});

test('calculateSprintProgress clamps elapsed days after the sprint ends', () => {
  const sprint: Sprint = {
    id: 'sprint-progress-3',
    name: 'Finished sprint',
    startDate: '2026-08-01',
    endDate: '2026-08-07',
    developers: [],
    tasks: [{ id: 'task-1', title: 'Follow-up', estimateHours: 3, status: 'done', dependencies: [] }]
  };

  const summary = calculateSprintProgress(sprint, { referenceDate: '2026-08-20' });

  assert.strictEqual(summary.elapsedSprintDays, 7);
  assert.strictEqual(summary.remainingSprintDays, 0);
  assert.strictEqual(summary.elapsedSprintPercent, 100);
  assert.strictEqual(summary.projectedCompletedHoursBySprintEnd, 3);
  assert.strictEqual(summary.projectedCompletionRateByHours, 100);
  assert.strictEqual(summary.isProjectedToComplete, true);
});
