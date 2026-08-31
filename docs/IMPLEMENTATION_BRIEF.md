# Sprint Intelligence Agent

## 1. Project Goal

Build an AI-powered engineering sprint analysis system.

The application should analyze structured sprint/project data, use deterministic engineering metrics together with an LLM agent, and identify:

- delivery risks;
- overloaded engineers;
- blocked work;
- dependency risks;
- stale issues;
- scope changes;
- missing acceptance criteria;
- unrealistic sprint commitments;
- likely carry-over work.

The system must explain **why** it reached each conclusion and reference the exact issues/data used as evidence.

This is not a generic Jira chatbot.

The main technical focus is:

**LLM agent + tool calling + deterministic analytics + structured output + full-stack architecture.**

---

# 2. Core Principle

Never ask the LLM to calculate data that can be calculated deterministically.

Bad:

`Here are 100 Jira issues. Tell me whether the sprint is overloaded.`

Good:

`Agent → calculateTeamCapacity() → getVelocityHistory() → calculateWorkload() → inspectDependencies() → reason over returned evidence.`

The LLM should reason.

Application code should calculate.

---

# 3. Tech Stack

## Frontend

- React
- TypeScript
- Vite
- TanStack Query
- MUI
- Recharts or similar for simple visualizations

## Backend

- Node.js
- TypeScript
- Fastify
- Zod
- PostgreSQL
- Drizzle ORM

## AI

Use Vercel AI SDK as the initial LLM abstraction.

Implement an agent/tool loop with a hard maximum number of steps.

Initial provider can be OpenAI, but the AI layer must be provider-agnostic enough to allow another provider later.

Environment configuration:

```text
AI_PROVIDER=
AI_MODEL=
AI_API_KEY=
```

Do not spread provider-specific code throughout the application.

---

# 4. Repository Structure

Use a pnpm workspace.

```text
sprint-intelligence-agent/

apps/
  web/
  api/

packages/
  domain/
  analytics/
  ai/
  shared/

demo/
  sprint/
    sprint.json
    issues.json
    developers.json
    history.json

docs/

docker-compose.yml
README.md
.env.example
```

Responsibilities:

```text
domain
  domain types and business concepts

analytics
  deterministic sprint calculations

ai
  tools, prompts, orchestration and output schemas

shared
  API contracts and shared utilities
```

The AI package must not contain normal sprint business calculations.

---

# 5. Domain Model

Initial entities:

```text
Sprint
Issue
Developer
SprintHistory
IssueDependency
Activity
```

Example Issue:

```ts
type Issue = {
  id: string;
  title: string;
  description?: string;
  type: "story" | "bug" | "task";
  status: "todo" | "in_progress" | "blocked" | "done";
  assigneeId?: string;
  storyPoints?: number;
  createdAt: string;
  updatedAt: string;
  sprintId: string;
  acceptanceCriteria?: string;
  dependencies: string[];
};
```

Keep the initial model simple.

Do not attempt to replicate the full Jira schema.

---

# 6. Demo Dataset

The repository must work without Jira credentials.

Create a realistic synthetic engineering team:

```text
6 developers
1 active sprint
~35 issues
5 previous sprints
several dependencies
one overloaded developer
several stale issues
one hidden critical dependency
scope added after sprint start
some missing estimates
some missing acceptance criteria
```

The demo dataset should intentionally contain problems for the system to discover.

Running:

```bash
docker compose up
```

should be enough to start the local infrastructure.

Provide a seed command.

---

# 7. Deterministic Analytics

Implement these services before implementing the agent.

```text
calculateSprintCompletion()
calculateTeamVelocity()
calculateDeveloperWorkload()
calculateScopeChange()
findBlockedIssues()
findDependencyRisks()
findStaleIssues()
findMissingEstimates()
findMissingAcceptanceCriteria()
calculateCarryOverRisk()
```

All functions must have unit tests.

Example:

```text
calculateDeveloperWorkload()

Leon     21 SP
Anna     10 SP
David     8 SP
Team median: 10 SP

Result:
Leon workloadRatio = 2.1
```

The AI should receive this result instead of trying to derive it from raw issues.

---

# 8. Agent Tools

Expose analytics and data access as typed AI tools.

Initial tools:

```text
getSprintOverview
getIssue
getIssuesByStatus
getDeveloperWorkload
getVelocityHistory
getSprintScopeChanges
getBlockedIssues
getDependencyRisks
getStaleIssues
getQualityProblems
```

Each tool:

- accepts validated structured input;
- returns structured output;
- does one clear thing;
- has tests;
- must not return unnecessary data.

Do not implement one giant `getEverything()` tool.

---

# 9. Agent

Create:

```text
SprintAnalysisAgent
```

Primary question:

> Analyze the current sprint and identify the most important delivery risks.

The agent can autonomously decide which tools it needs.

Limit the number of tool iterations.

The final response must conform to a strict schema.

Example:

```ts
type SprintAnalysis = {
  healthScore: number;

  summary: string;

  risks: Array<{
    severity: "low" | "medium" | "high" | "critical";
    category:
      | "capacity"
      | "dependency"
      | "scope"
      | "blocker"
      | "quality"
      | "delivery";

    title: string;
    explanation: string;

    evidence: Array<{
      issueId?: string;
      metric?: string;
      value?: string | number;
    }>;

    recommendation?: string;
    confidence: number;
  }>;
};
```

---

# 10. Evidence Is Mandatory

The agent must not produce unsupported claims.

Example:

Bad:

> The authentication work may be delayed.

Good:

> AUTH-231 has a high delivery risk because it depends on AUTH-198, which is still in TODO and has not been updated for five days.

Evidence:

```text
AUTH-231 → depends on AUTH-198
AUTH-198 → TODO
lastUpdated → 5 days ago
```

Every significant risk should contain traceable evidence.

---

# 11. Health Score

The sprint health score must not be invented by the LLM.

Implement a deterministic scoring algorithm.

Example factors:

```text
blocked work
capacity imbalance
dependency risk
scope growth
stale work
expected completion
quality problems
```

Return:

```text
0–100
```

The exact initial formula can be simple, but it must be documented and tested.

The agent can explain the score but cannot change it.

---

# 12. UI — V1

Create one polished dashboard.

## Header

```text
Sprint 24
Health: 68 / 100
6 days remaining
23 / 37 issues completed
```

## Main sections

### Sprint Health

Simple visualization of:

```text
completion
velocity
scope change
blocked work
```

### AI Risk Analysis

Cards:

```text
CRITICAL
Backend dependency threatens authentication delivery

HIGH
Developer workload imbalance

MEDIUM
3 stories have no acceptance criteria
```

### Evidence

Clicking a risk should reveal evidence.

### Agent Activity

Add a collapsible developer-oriented panel:

```text
Agent run

1. getSprintOverview()
2. getDeveloperWorkload()
3. getDependencyRisks()
4. getVelocityHistory()
5. finalAnalysis()
```

Include:

```text
tool
duration
status
```

This is important because the project should demonstrate how the agent works.

---

# 13. Ask the Sprint

Add a secondary interface:

```text
Ask the Sprint
```

Examples:

> What is the biggest risk?

> Who is overloaded?

> What should we remove from this sprint?

> Why is the sprint health score only 68?

The same domain tools should be reused.

Do not create a second unrelated agent implementation.

---

# 14. API

Initial endpoints:

```text
GET  /api/sprints
GET  /api/sprints/:id
GET  /api/sprints/:id/metrics

POST /api/sprints/:id/analyze

POST /api/sprints/:id/chat

GET  /api/agent-runs/:id
```

Streaming can be added to the analysis/chat endpoint if useful.

---

# 15. Agent Observability

Persist agent runs.

Store:

```text
run id
model
start/end time
tool calls
tool durations
tool results metadata
token usage if available
final result
errors
```

Do not store hidden model reasoning.

The UI should show observable actions and evidence only.

---

# 16. Testing

Required:

## Unit

Vitest.

Test all deterministic analytics.

## Agent tool tests

Test tool schemas and outputs without calling a real LLM.

## Integration

Run an analysis against the synthetic sprint.

Validate the final structured schema.

## Frontend

At least a small Playwright smoke test:

```text
open sprint
run analysis
risk cards appear
open evidence
```

---

# 17. V1 Non-Goals

Do NOT initially implement:

- Jira OAuth;
- Jira Marketplace integration;
- Slack;
- GitHub integration;
- RAG;
- autonomous ticket modification;
- project management features;
- multi-tenant SaaS;
- billing;
- user authentication.

These can come later.

First build the intelligence engine.

---

# 18. Milestones

## Milestone 0 — Bootstrap

Create:

- workspace;
- frontend;
- backend;
- PostgreSQL;
- shared types;
- linting;
- formatting;
- tests;
- Docker setup.

Commit.

## Milestone 1 — Domain + Demo

Implement domain model and synthetic dataset.

Add database seeding.

Commit.

## Milestone 2 — Analytics Engine

Implement deterministic metrics with good unit test coverage.

Commit.

## Milestone 3 — AI Tools

Expose analytics through typed tools.

Implement SprintAnalysis output schema.

Commit.

## Milestone 4 — Sprint Agent

Implement tool loop and structured analysis.

Add evidence requirements.

Add agent run logging.

Commit.

## Milestone 5 — Dashboard

Implement polished sprint dashboard.

Commit.

## Milestone 6 — Ask the Sprint

Implement conversational analysis using the same tool layer.

Commit.

## Milestone 7 — Documentation

Finish README, architecture diagram and screenshots.

Commit.

---

# 19. README Story

The README should explain the engineering problem, not market the application.

Opening concept:

> Sprint planning data contains useful signals about delivery risk, but identifying those signals usually requires an experienced engineering manager manually connecting workload, dependencies, velocity and issue history.
>
> Sprint Intelligence Agent combines deterministic sprint analytics with an LLM tool-using agent. Metrics are calculated by code; the model is responsible for investigation, prioritization and explanation.

README sections:

```text
Problem
Architecture
Why tools instead of one giant prompt
Deterministic vs AI responsibilities
Demo
Agent trace example
Screenshots
Testing
Limitations
Future work
```

---

# 20. Definition of Done

V1 is complete when a developer can:

```bash
git clone ...
cp .env.example .env
docker compose up
```

open the app,

select the bundled demo sprint,

click:

```text
Analyze Sprint
```

and receive a real agent-generated analysis containing:

- health score;
- prioritized risks;
- recommendations;
- confidence;
- evidence;
- visible tool execution trace.

No Jira account should be required.

---

# 21. Instructions to Coding Agent

Start implementing this project.

Do not attempt all milestones in one change.

Work milestone-by-milestone.

Before implementing a milestone:

1. inspect existing repository state;
2. create/update the relevant tests;
3. implement the smallest complete version;
4. run lint/typecheck/tests;
5. update documentation where relevant;
6. make a clean commit.

Prioritize architecture and correctness over feature count.

Do not add technologies simply because they are popular.

Do not add RAG unless there is an actual retrieval problem.

Do not let the LLM perform deterministic calculations.

The repository should feel like a Senior Software Engineer's AI engineering project, not a hackathon chatbot.