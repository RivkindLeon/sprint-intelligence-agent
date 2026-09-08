# Sprint Intelligence Agent

Engineering intelligence that combines deterministic sprint analytics with LLM reasoning.

The central design rule is simple: **the model should reason; application code should calculate.** Instead of sending raw Jira-like data to a model and asking it to do arithmetic, this project is building typed evidence and analytics that a future agent can inspect and explain.

## Why this project

Sprint status is often spread across issues, estimates, dependencies, ownership, and history. A useful engineering assistant should surface delivery risks with traceable evidence: which work is blocked, who is overloaded, and which dependency creates the risk. It should explain conclusions without turning deterministic business logic into an opaque prompt.

This is intentionally not a generic Jira chatbot. It is an evidence-first foundation for an engineering intelligence product.

## Current state

### Implemented today

- Full-stack TypeScript monorepo using pnpm and Turborepo.
- React 19 + Vite web application shell.
- Fastify API with a tested `/health` endpoint.
- PostgreSQL connection configuration and Drizzle ORM migration plumbing.
- Tested shared API contracts with Zod.
- Pure, tested analytics for developer workload, sprint progress/completion, blocked work, dependency cycles, ready work, and allocation risks.
- Docker Compose PostgreSQL service and GitHub Actions CI for install, lint, formatting, build, tests, and PostgreSQL integration tests.

### In progress

- Completing the domain and demo foundation: database tables, migrations, and a realistic synthetic sprint dataset.
- Expanding the remaining deterministic analytics described in the implementation brief.

### Planned

- Typed analytics/data tools for an LLM.
- A bounded agent/tool loop with structured, evidence-linked sprint analysis.
- Dashboard and conversational “ask the sprint” workflows.

The AI agent and tool layer is **not finished yet**. The current repository is the full-stack and analytics foundation, not a completed AI product.

See the detailed [progress tracker](docs/PROGRESS.md) and [implementation brief](docs/IMPLEMENTATION_BRIEF.md).

## Architecture

```text
React + Vite web app
          │
          ▼
      Fastify API ─── shared Zod contracts
          │
          ▼
 PostgreSQL + Drizzle ORM

 Domain model ─── pure deterministic analytics
                         │
                         ▼
                 future typed AI tools
                         │
                         ▼
                 future evidence-based agent
```

The analytics package is deliberately independent of the AI layer. A tool such as `getDeveloperWorkload` should return calculated values and the IDs that support them; the model can then interpret the evidence, compare risks, and communicate uncertainty.

## Why deterministic evidence matters

LLMs are good at synthesis, explanation, and asking the next useful question. They are not the right place to calculate utilization, traverse dependency graphs, or decide whether a date is stale. Keeping those operations in typed application code makes results reproducible and testable, reduces hallucinated arithmetic, and gives every conclusion an evidence trail.

## Tech stack

- React 19, TypeScript, Vite
- Node.js, Fastify
- PostgreSQL, Drizzle ORM
- Zod for shared contracts
- pnpm workspaces, Turborepo
- Docker Compose
- GitHub Actions

## Local development

Prerequisites: Node.js 22+, pnpm 11+, and Docker for the PostgreSQL service.

```bash
pnpm install --frozen-lockfile
docker compose up -d
pnpm lint
pnpm format:check
pnpm build
pnpm test
```

The API and web packages also expose `dev` scripts:

```bash
pnpm --filter @sprint-intelligence/api dev
pnpm --filter @sprint-intelligence/web dev
```

Database configuration is documented in `.env.example`. The demo seed and AI runtime are planned work, so local setup currently validates the foundation rather than launching a complete agent.

## Repository map

```text
apps/api/       Fastify API and database wiring
apps/web/       React/Vite application shell
packages/domain Domain concepts and types
packages/analytics Deterministic sprint calculations
packages/shared Shared API contracts
docs/           Brief and milestone progress
```

This is an active side project. The roadmap is intentionally visible so the repository shows what is real, what is being built, and what remains an experiment.
