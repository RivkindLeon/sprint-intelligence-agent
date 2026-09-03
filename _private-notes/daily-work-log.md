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
- PR: #9 `chore: standardize workspace on pnpm` (open)

## 2026-08-30
- Added deterministic `calculateDependencyCycleRisks()` analytics to detect circular task dependencies that cannot resolve through normal sprint execution.
- Each risk includes the affected task IDs, exact dependency edges, and estimated hours at risk so downstream AI conclusions can cite concrete issue/dependency evidence.
- Covered multi-task cycles, self-dependencies, acyclic graphs, and missing dependencies with automated tests.
- Validation: `npm test`, `npm run build`, `npm run lint` (no package lint tasks configured).
- Branch: `feat/dependency-cycle-risks`
- Commit: `09096da` (`feat: detect sprint dependency cycles`)
- PR: #8 `feat: detect sprint dependency cycles` (open)

## 2026-08-31
- Standardized Milestone 0's workspace on pnpm, including a workspace manifest, pinned package manager, lockfile, and workspace protocol for internal dependencies.
- Updated CI to install with the frozen pnpm lockfile and run the existing build and test suite through pnpm.
- Stopped versioning generated `node_modules`, build output, and turbo caches; these remain reproducible from source and the lockfile.
- Corrected `docs/PROGRESS.md` to direct the next session to the earliest incomplete milestone instead of skipping ahead to analytics.
- Validation: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test` (13 analytics tests and 1 domain test passing).
- Branch: `chore/m0-pnpm-workspace`
- Commit: feature branch head (`chore: standardize workspace on pnpm`)
- PR: pending

## 2026-09-01
- Completed Milestone 0's linting and formatting slice with ESLint for workspace TypeScript and Prettier for repository formatting.
- Added package lint scripts and made pull-request CI enforce linting and formatting before build and test.
- Established a Prettier baseline for existing source and documentation; no application behavior changed.
- Updated `docs/PROGRESS.md` to record only the verified bootstrap work and leave the remaining frontend, backend, PostgreSQL, Docker, and shared-package tasks open.
- Validation: `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm test` (13 analytics tests and 1 domain test passing).
- Branch: `chore/m0-lint-format`
- Commit: feature branch head (`chore: enforce linting and formatting`)
- PR: pending

## 2026-09-02
- Added a runnable `@sprint-intelligence/api` Fastify workspace as the next Milestone 0 slice.
- Added a `/health` endpoint and an injection test that verifies its status code and structured response.
- Configured the API build, development, start, test, and lint commands; explicitly allowed the required esbuild install script.
- Updated `docs/PROGRESS.md` to keep the remaining Bootstrap work explicit.
- Validation: `pnpm install`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm test` (13 analytics tests, 1 domain test, and 1 API test passing); required GitHub CI passed.
- Branch: `feat/m0-fastify-api`
- Commit: `ede852d` (`feat: bootstrap Fastify API`)
- PR: #11 `feat: bootstrap Fastify API` (merged as `525b3a6`)

## 2026-09-03
- Added the `@sprint-intelligence/shared` workspace as the next Milestone 0 slice.
- Added tested Zod contracts for API health responses and structured API errors.
- Updated the Fastify health route and its integration test to consume the shared health contract.
- Updated `docs/PROGRESS.md` to record the verified shared-package state and keep the remaining Bootstrap work explicit.
- Validation: `pnpm lint`, `pnpm format:check`, `pnpm build`, and `pnpm test` (17 tests passing across analytics, domain, shared, and API).
- CI initially caught a Prettier mismatch in `docs/PROGRESS.md` after its final edit; formatted the file and reran all validation before updating the branch.
- Branch: `feat/m0-shared-contracts`
- Commit: `feat: add shared API contracts`
- PR: to be opened after push
