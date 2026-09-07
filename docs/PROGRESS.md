# Progress

Milestone tracking against `docs/IMPLEMENTATION_BRIEF.md`. The nightly
development job reads this file to decide what to work on next.

**Keep this file honest.** It is the only memory that survives between nightly
sessions — each run starts with no history of previous runs. If it claims work
that was not done, the next session builds on a lie.

Last verified against the code: 2026-09-07.

---

## Milestone 0 — Bootstrap

**Status: complete.**

| Required             | State                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| Workspace            | done — pnpm workspace + turbo; generated dependencies, builds, and turbo caches are ignored |
| Shared types         | partial — tested Zod API contracts now live in `packages/shared`; domain types remain small |
| Tests                | done — Node test runner suites across all current workspaces, passing                       |
| Frontend             | done — tested React/Vite application shell in `apps/web`                                    |
| Backend              | done — Fastify health endpoint plus tested Drizzle/PostgreSQL connection plumbing           |
| PostgreSQL           | done — configured through Drizzle with a live connection/query integration test in CI       |
| Docker setup         | done — PostgreSQL Compose service mirrors the PostgreSQL 17 service verified by CI          |
| Linting / formatting | done — ESLint for TypeScript and Prettier checks run locally and in CI                      |

Later milestones still add `packages/ai` and `demo/`.
`.env.example` now documents database, API, and future AI settings. `README.md`
is 28 bytes.

## Milestone 0.5 — Continuous Integration

**Status: complete.**

`.github/workflows/ci.yml` runs on every pull request and on every push to
`main`: frozen pnpm install, lint, formatting check, build, and test across the
turbo workspace.

Registered as a required status check on `main`. A red build now blocks the
merge instead of depending on the session's own judgement.

Not yet included: a standalone type-check command. Package builds currently run
TypeScript compilation, so type errors still fail CI.

**Before merging anything, read "If CI fails" in the brief.**

## Milestone 1 — Domain + Demo

**Status: in progress.** `packages/domain` defines the initial `Sprint`,
`Issue`, `Developer`, `SprintHistory`, `IssueDependency`, and `Activity`
concepts, with tested status/type values. A deprecated hours-based `Task` shape
remains temporarily for compatibility with existing Milestone 2 analytics.

Still missing: database tables and migrations, the synthetic dataset (6
developers, 1 active sprint, ~35 issues, 5 previous sprints, and seeded
problems), and a seed command.

## Milestone 2 — Analytics Engine

**Status: in progress — roughly half.**

`packages/analytics` is 1108 lines and is the only substantial code in the
repository. Against the ten functions required by section 7:

| Required                        | State                                      |
| ------------------------------- | ------------------------------------------ |
| `calculateSprintCompletion`     | covered by `calculateSprintProgress`       |
| `calculateDeveloperWorkload`    | done                                       |
| `findBlockedIssues`             | covered by `calculateBlockedTaskRisks`     |
| `findDependencyRisks`           | covered by `calculateDependencyCycleRisks` |
| `calculateTeamVelocity`         | **missing**                                |
| `calculateScopeChange`          | **missing**                                |
| `findStaleIssues`               | **missing**                                |
| `findMissingEstimates`          | **missing**                                |
| `findMissingAcceptanceCriteria` | **missing**                                |
| `calculateCarryOverRisk`        | **missing**                                |

Two extra functions exist that the brief does not ask for:
`calculateReadyTaskSummary` and `calculateAllocationRiskSummary`. They are
tested and harmless, but they were added instead of the six missing ones.

## Milestone 3 — AI Tools

**Status: not started.** No `packages/ai`, no typed tool layer, no
`SprintAnalysis` output schema.

## Milestone 4 — Sprint Agent

**Status: not started.** No agent, no tool loop, no evidence requirement, no
agent run logging.

## Milestone 5 — Dashboard

**Status: not started.**

## Milestone 6 — Ask the Sprint

**Status: not started.**

## Milestone 7 — Documentation

**Status: not started.**

---

## Where the next session should start

The repository skipped ahead: Milestone 2 is half-built while Milestone 0 and
Milestone 1 are largely untouched. Analytics functions are pure and easy to add
with no infrastructure, which is why they kept getting chosen — but the brief is
explicit in section 21 that work should proceed milestone by milestone.

Continue with the earliest incomplete milestone: **Milestone 1 — Domain + Demo**.
The initial domain model is complete. Next, implement the corresponding
PostgreSQL tables and migration. Then add the realistic synthetic dataset and
seed command before returning to the remaining Milestone 2 analytics.

Do not start Milestone 3 (AI tools) before the demo dataset exists — there
would be nothing for the tools to read.

## Correction for whoever edits the job prompt

The repository now has minimal `apps/api` and `apps/web` applications plus
`packages/shared`, but still does not have `packages/ai` or `demo`. Do not assume
the full aspirational structure in section 4 already exists.
