import assert from 'node:assert';
import test from 'node:test';

import type { Sprint } from '@sprint-intelligence/domain';

import { calculateDeveloperWorkload } from './index.js';

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
