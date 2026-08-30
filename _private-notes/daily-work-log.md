# Daily Work Log

## 2026-08-23
- Added a new `@sprint-intelligence/analytics` workspace package with deterministic `calculateDeveloperWorkload()` logic.
- Covered overallocated, at-capacity, under-capacity, zero-capacity, and unassigned task scenarios with automated tests.
- Validation: `npm run build`, `npm test`.
- Branch: `feat/analytics-workload-summary`
- Commit: `4904924` (`feat: add deterministic workload analytics`)
- PR: #1 `feat: add deterministic workload analytics` (merged)

## 2026-08-24
- Added deterministic `calculateBlockedTaskRisks()` analytics so sprint risk analysis can cite exact blocking dependencies instead of relying on LLM guesses.
- Covered active blockers, missing dependencies, completed dependencies, and ready work with automated tests.
- Validation: `npm run build`, `npm test`.
- Branch: `feat/blocking-risk-analytics`
- Commit: feature branch head (`feat: add deterministic blocking risk analytics`)
- PR: #2 `feat: add deterministic blocking risk analytics` (open)

## 2026-08-26
- Added deterministic `calculateReadyTaskSummary()` analytics to expose the executable task queue for the sprint, grouped by assignee and highlighting ready unassigned work.
- Reused dependency checks so only non-blocked tasks are surfaced, giving the LLM prepared evidence about what can start now instead of guessing from raw task lists.
- Covered executable, blocked, missing-dependency, completed, and unassigned-task scenarios with automated tests.
- Validation: `npm run build`, `npm test`.
- Branch: `feat/ready-task-analytics`
- Commit: feature branch head (`feat: add ready task analytics`)
- PR: #4 `feat: add ready task analytics` (open)

## 2026-08-29
- Fixed deterministic sprint delivery projections to calculate from the full-precision completion rate instead of a prematurely rounded daily average.
- Prevented completed sprints from reporting impossible projection artifacts such as 3.01 projected hours from exactly 3 completed hours.
- Updated regression coverage for completed-sprint projected hours and completion percentage.
- Validation: `npm run build`, `npm test`.
- Branch: `feat/progress-risk-indicators`
- Commit: feature branch head (`fix: preserve precision in sprint projections`)
- PR: pending

## 2026-08-30
- Added deterministic `calculateDependencyCycleRisks()` analytics to detect circular task dependencies that cannot resolve through normal sprint execution.
- Each risk includes the affected task IDs, exact dependency edges, and estimated hours at risk so downstream AI conclusions can cite concrete issue/dependency evidence.
- Covered multi-task cycles, self-dependencies, acyclic graphs, and missing dependencies with automated tests.
- Validation: `npm test`, `npm run build`, `npm run lint` (no package lint tasks configured).
- Branch: `feat/dependency-cycle-risks`
- Commit: `09096da` (`feat: detect sprint dependency cycles`)
- PR: #8 `feat: detect sprint dependency cycles` (open)
