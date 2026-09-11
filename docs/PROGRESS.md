# Progress

Milestone tracking against `docs/IMPLEMENTATION_BRIEF.md`. The nightly
development job reads this file to decide what to work on next.

**Keep this file honest.** It is the only memory that survives between nightly
sessions — each run starts with no history of previous runs. If it claims work
that was not done, the next session builds on a lie.

Last verified against the code: 2026-09-11.

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

**Status: complete.** `packages/domain` defines the initial `Sprint`,
`Issue`, `Developer`, `SprintHistory`, `IssueDependency`, and `Activity`
concepts, with tested status/type values. A deprecated hours-based `Task` shape
remains temporarily for compatibility with existing Milestone 2 analytics.

The API now has a PostgreSQL schema and generated migration for sprints,
developers, sprint membership, issues, normalized issue dependencies,
activities, and sprint history. Constraints enforce valid date ranges,
nonnegative estimates/capacity, and non-self dependencies. The database
integration suite applies the migration and verifies all seven tables when
`RUN_DATABASE_INTEGRATION_TEST=true` (as configured in CI).

The checked-in demo dataset now contains 6 developers, 1 active sprint, 35
issues, and 5 previous sprint summaries. Tests verify referential integrity and
the deliberately seeded signals: overload, blockers, unfinished dependencies,
scope additions, missing estimates, and missing acceptance criteria.

`pnpm --filter @sprint-intelligence/api db:seed` transactionally loads the JSON
dataset into PostgreSQL. It is safe to rerun: the demo sprint is replaced and
developers plus history records are updated. The database integration suite
verifies all 35 issues, normalized dependencies, scope-change activities, and
five history records after two consecutive seed runs.

## Milestone 2 — Analytics Engine

**Status: in progress — roughly half.**

`packages/analytics` is 1108 lines and is the only substantial code in the
repository. Against the ten functions required by section 7:

| Required                        | State                                        |
| ------------------------------- | -------------------------------------------- |
| `calculateSprintCompletion`     | covered by `calculateSprintProgress`         |
| `calculateDeveloperWorkload`    | done                                         |
| `findBlockedIssues`             | covered by `calculateBlockedTaskRisks`       |
| `findDependencyRisks`           | covered by `calculateDependencyCycleRisks`   |
| `calculateTeamVelocity`         | done — tested historical story-point summary |
| `calculateScopeChange`          | **missing**                                  |
| `findStaleIssues`               | **missing**                                  |
| `findMissingEstimates`          | **missing**                                  |
| `findMissingAcceptanceCriteria` | **missing**                                  |
| `calculateCarryOverRisk`        | **missing**                                  |

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

Continue with the earliest incomplete milestone: **Milestone 2 — Analytics
Engine**. Milestone 1 is complete. Implement the next missing required function,
`calculateScopeChange`, with unit tests before proceeding down the table.

Do not start Milestone 3 (AI tools) before the demo dataset exists — there
would be nothing for the tools to read.

## Correction for whoever edits the job prompt

The repository now has minimal `apps/api` and `apps/web` applications plus
`packages/shared`, but still does not have `packages/ai` or `demo`. Do not assume
the full aspirational structure in section 4 already exists.
