# Progress

Milestone tracking against `docs/IMPLEMENTATION_BRIEF.md`. The nightly
development job reads this file to decide what to work on next.

**Keep this file honest.** It is the only memory that survives between nightly
sessions — each run starts with no history of previous runs. If it claims work
that was not done, the next session builds on a lie.

Last verified against the code: 2026-10-09.

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

**Status: complete.**

Against the ten functions required by section 7:

| Required                        | State                                        |
| ------------------------------- | -------------------------------------------- |
| `calculateSprintCompletion`     | covered by `calculateSprintProgress`         |
| `calculateDeveloperWorkload`    | done                                         |
| `findBlockedIssues`             | covered by `calculateBlockedTaskRisks`       |
| `findDependencyRisks`           | covered by `calculateDependencyCycleRisks`   |
| `calculateTeamVelocity`         | done — tested historical story-point summary |
| `calculateScopeChange`          | done — tested issue and story-point deltas   |
| `findStaleIssues`               | done — tested age threshold + issue evidence |
| `findMissingEstimates`          | done — tested issue-level evidence           |
| `findMissingAcceptanceCriteria` | done — tested issue-level evidence           |
| `calculateCarryOverRisk`        | done — tested velocity forecast + evidence   |

Two extra functions exist that the brief does not ask for:
`calculateReadyTaskSummary` and `calculateAllocationRiskSummary`. They are
tested and harmless, but they were added instead of the six missing ones.

## Milestone 3 — AI Tools

**Status: complete.** `packages/ai` now defines and tests the strict
`SprintAnalysis` output schema. Health scores and confidence values have bounded
ranges, unknown fields are rejected, and every risk must include at least one
evidence item identifying an issue or metric.

The first typed tool, `getSprintOverview`, now validates strict input and output
schemas, reads through an injected sprint repository, and returns only compact
schedule, staffing, status-count, and story-point facts. Tests cover its
deterministic output, invalid input, and a missing sprint.

The `getIssue` tool now validates strict input and output schemas, reads through
an injected issue repository, and returns canonical issue details including the
exact dependency identifiers needed for evidence. Tests cover its output,
validation before repository access, and a missing issue.

The `getIssuesByStatus` tool now validates a sprint ID and canonical issue
status, reads through an injected collection repository, and returns compact
issue evidence including identifiers, assignment, estimates, update times, and
dependencies. Tests cover populated and empty results, validation before
repository access, and rejection of mismatched repository data.

The `getDeveloperWorkload` tool now validates a sprint ID, runs the existing
deterministic workload analytics over repository data, and returns per-developer
capacity/utilization with exact assigned and unassigned task IDs as evidence.
Tests cover overload, available capacity, unassigned work, validation before
repository access, and a missing sprint.

The `getVelocityHistory` tool now validates a sprint ID, reads historical
sprints through an injected repository, and returns the deterministic team
velocity summary with per-sprint committed/completed point evidence. Tests
cover representative history, empty history, and validation before repository
access.

The `getSprintScopeChanges` tool now validates a sprint ID, reads the sprint
and its activities through an injected repository, and returns the existing
deterministic scope-change analytics with exact issue and activity evidence.
Tests cover additions and removals, an unchanged sprint, input validation, a
missing sprint, and repository data outside the requested sprint.

The `getBlockedIssues` tool now validates a sprint ID, runs the existing
deterministic blocked-work analytics, and returns exact blocked issue,
unfinished or missing dependency, assignment, and estimate evidence. Tests
cover unfinished and missing dependencies, an unblocked sprint, input
validation, and a missing sprint. This tool was previously and incorrectly
listed as complete even though it was absent from the code.

The `getDependencyRisks` tool now validates a sprint ID, reads through an
injected sprint repository, and returns the existing deterministic dependency
cycle analytics with exact task and dependency-edge evidence. Tests cover a
cycle, an acyclic graph, validation before repository access, and a missing
sprint.

The `getStaleIssues` tool now validates a sprint ID, reads through an injected
sprint repository, and returns the existing deterministic stale-work analytics
with exact issue, status, update-time, age, assignment, and estimate evidence.
Its clock and threshold are application configuration rather than model input.
Tests cover stale and fresh work, input validation, a missing sprint, and an
invalid configured threshold.

The `getQualityProblems` tool now validates a sprint ID, reads through an
injected sprint repository, and returns the existing deterministic
missing-estimate and missing-acceptance-criteria analytics with exact issue
evidence. Tests cover populated and empty results, validation before repository
access, and a missing sprint.

All ten tools listed in section 8 are implemented and tested. No LLM
orchestration or provider dependency has been added; that belongs to Milestone 4.

## Milestone 4 — Sprint Agent

**Status: complete.** `SprintAnalysisAgent` now provides a tested,
provider-agnostic model boundary and a hard, configurable maximum number of
model steps. It exposes only registered tools, validates every tool input and
output, feeds tool results back to the model, validates the final structured
analysis, and replaces any model-provided health score with the deterministic
score supplied by application code.

The analytics package now calculates that deterministic integer 0-100 health score
from seven bounded risk percentages: blocked work, capacity imbalance,
dependency risk, scope growth, stale work, expected carry-over, and quality
problems. The documented weighted formula returns an auditable per-factor
penalty breakdown and is tested for representative values, clamping, and
invalid inputs.

The agent entry point now calculates that score through a repository-backed
source instead of accepting a number from its caller. The source loads the
sprint, activity, and history data and derives all seven inputs through existing
deterministic analytics. Tests verify the complete input mapping and confirm the
agent replaces the model's proposed score with the repository-derived value.

`VercelAiSdkSprintAnalysisModel` now adapts any Vercel AI SDK `LanguageModel`
to the provider-agnostic agent interface. It exposes the registered Zod input
schemas as AI SDK tools, requests the strict `SprintAnalysis` structured
output, carries validated prior tool results into each call, and rejects
multiple simultaneous tool calls so the outer agent remains the sole owner of
tool execution and step limits. Tests cover tool-call mapping, structured final
output, and the multiple-call guard.

Final analysis evidence is now checked against the validated tool outputs from
the current agent run. Issue identifiers must occur in those outputs, and each
metric name plus any claimed value must match an exact returned field. Tests
verify supported evidence and reject invented issue IDs and altered metrics.

The PostgreSQL persistence foundation for agent observability now exists.
`agent_runs` stores sprint/model identity, lifecycle timestamps and status,
optional token usage, the final structured result, and errors;
`agent_tool_calls` stores ordered steps, tool names, duration, status, validated
input, compact result metadata, and errors. The repository supports starting,
completing, failing, retrieving, and appending tool traces. A generated
migration and PostgreSQL integration test cover completed and failed runs plus
ordered trace retrieval.

The agent loop now uses an injected persistence boundary implemented by the
PostgreSQL repository. Each analysis records its model and lifecycle, each tool
call records its validated input, duration, status, compact result shape or
error, and successful runs store the final validated analysis. Tests cover both
successful and failed tool executions and run lifecycle transitions.

An end-to-end integration test now loads the checked-in synthetic sprint and
runs the real agent, deterministic health source, and typed tools against a
fake model. It verifies structured output, exact issue and metric evidence,
replacement of the model's health score, the complete tool sequence, and
persisted run/tool-call observability without calling a real LLM. The test's
fixture bridge documents the temporary story-point-to-hours mapping required
by the legacy analytics model.

The live-model factory now validates `AI_PROVIDER`, `AI_MODEL`, and
`AI_API_KEY`, constructs the OpenAI AI SDK provider in one isolated boundary,
and returns the provider-agnostic model adapter plus non-secret provider/model
identity for observability. Tests cover normalization, missing and unsupported
configuration, and provider construction without making a live model call.

The agent has a strict output contract, deterministic health scoring, evidence
provenance, a bounded provider-agnostic tool loop, a concrete configurable
provider, persistence, and end-to-end synthetic-sprint coverage.

## Milestone 5 — Dashboard

**Status: in progress.** The API now exposes `GET /api/sprints` through a
PostgreSQL-backed repository and a strict shared response contract. It returns
compact sprint identifiers, names, and dates in newest-first order. The shared
contract and Fastify route pass local tests; a seeded PostgreSQL integration
assertion is in the CI suite.

`GET /api/sprints/:id` now returns sprint metadata, its team, and canonical
issues with exact dependency IDs through a strict shared response contract. An
unknown sprint returns a structured 404. Shared-contract and route tests pass
locally; the seeded PostgreSQL integration assertion is in the CI suite.

`GET /api/sprints/:id/metrics` now has a strict shared contract and a
PostgreSQL-backed reader. It returns issue and story-point completion, exact
blocked issue IDs, deterministic scope-change metrics, and historical team
velocity. The scope and velocity values reuse the analytics package; no model
calculates them. Shared-contract, route, and pure calculation tests pass
locally. A seeded PostgreSQL integration assertion is in the CI suite but was
not run locally because PostgreSQL/Docker are unavailable on this host.
This is not a full dashboard yet: the analysis endpoint, deterministic health
score in an API response, and dashboard UI remain unfinished.

## Milestone 6 — Ask the Sprint

**Status: not started.**

## Milestone 7 — Documentation

**Status: not started.**

---

## Where the next session should start

Continue with the earliest incomplete milestone: **Milestone 5 — Dashboard**.
Next, add the analysis endpoint and wire its deterministic health score and
evidence-backed risks into the API. The sprint list, detail, and metrics
endpoints are available; the dashboard UI is not implemented.

## Correction for whoever edits the job prompt

The repository now has minimal `apps/api` and `apps/web` applications,
`packages/shared`, the checked-in `demo/sprint` dataset, and `packages/ai`.
Do not assume the full aspirational structure in section 4 already exists.
