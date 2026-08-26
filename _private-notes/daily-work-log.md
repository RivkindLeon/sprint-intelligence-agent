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
