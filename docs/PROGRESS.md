# Progress

Milestone tracking against `docs/IMPLEMENTATION_BRIEF.md`. The nightly
development job reads this file to decide what to work on next.

**Keep this file honest.** It is the only memory that survives between nightly
sessions — each run starts with no history of previous runs. If it claims work
that was not done, the next session builds on a lie.

Last verified against the code: 2026-08-31.

---

## Milestone 0 — Bootstrap

**Status: partially complete.**

| Required | State |
|---|---|
| Workspace | done — pnpm workspace + turbo; generated dependencies, builds, and turbo caches are ignored |
| Shared types | partial — `packages/domain` is 29 lines of types |
| Tests | done — Node test runner unit tests on analytics, passing |
| Frontend | **not done** — `apps/` does not exist |
| Backend | **not done** — `apps/` does not exist |
| PostgreSQL | **not done** |
| Docker setup | **not done** — no `docker-compose.yml` |
| Linting / formatting | **not done** |

Also missing from section 4 of the brief: `packages/ai`, `packages/shared`,
`demo/`, `docs/`, `.env.example`. `README.md` is 28 bytes.

## Milestone 0.5 — Continuous Integration

**Status: complete.**

`.github/workflows/ci.yml` runs on every pull request and on every push to
`main`: frozen pnpm install, build, and test across the turbo workspace.

Registered as a required status check on `main`. A red build now blocks the
merge instead of depending on the session's own judgement.

Not yet included: linting, formatting and type checking. `turbo.json` declares a
`lint` pipeline but no package defines a `lint` script, so there is nothing to
run yet. Wire it up when a linter is actually added.

**Before merging anything, read "If CI fails" in the brief.**

## Milestone 1 — Domain + Demo

**Status: not started.** `packages/domain` holds a small set of types. There is
no synthetic dataset (the brief asks for 6 developers, 1 active sprint, ~35
issues, 5 previous sprints, seeded problems), no database, and no seed command.

## Milestone 2 — Analytics Engine

**Status: in progress — roughly half.**

`packages/analytics` is 1108 lines and is the only substantial code in the
repository. Against the ten functions required by section 7:

| Required | State |
|---|---|
| `calculateSprintCompletion` | covered by `calculateSprintProgress` |
| `calculateDeveloperWorkload` | done |
| `findBlockedIssues` | covered by `calculateBlockedTaskRisks` |
| `findDependencyRisks` | covered by `calculateDependencyCycleRisks` |
| `calculateTeamVelocity` | **missing** |
| `calculateScopeChange` | **missing** |
| `findStaleIssues` | **missing** |
| `findMissingEstimates` | **missing** |
| `findMissingAcceptanceCriteria` | **missing** |
| `calculateCarryOverRisk` | **missing** |

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

Continue with the earliest incomplete milestone. **Finish Milestone 0 next**:
add `apps/api` with Fastify, `apps/web` with React/Vite, PostgreSQL via Drizzle,
`docker-compose.yml`, `.env.example`, `packages/shared`, and linting/formatting.
Then complete Milestone 1's domain model, synthetic demo dataset, and seed
command before returning to the remaining Milestone 2 analytics.

Do not start Milestone 3 (AI tools) before the demo dataset exists — there
would be nothing for the tools to read.

## Correction for whoever edits the job prompt

The cron prompt currently describes this repository as already having
`apps/web/`, `apps/api/`, `packages/ai/` and `packages/shared/`. **None of those
directories exist.** That description was aspirational, taken from section 4 of
the brief, and it misleads every session that reads it.
