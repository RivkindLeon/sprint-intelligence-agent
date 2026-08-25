import assert from 'node:assert';
import test from 'node:test';

import type { Sprint } from '@sprint-intelligence/domain';

import { calculateDeveloperWorkload, calculateSprintProgress } from './index.js';

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
  assert.strictEqual(summary.projectedCompletedHoursBySprintEnd, 3.01);
  assert.strictEqual(summary.projectedCompletionRateByHours, 100.33);
  assert.strictEqual(summary.isProjectedToComplete, true);
});
