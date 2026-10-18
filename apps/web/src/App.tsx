import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Chip, CircularProgress } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  SprintAnalysisResponse,
  SprintDetailResponse,
  SprintMetricsResponse,
} from "@sprint-intelligence/shared";

import { api } from "./api";

function daysRemaining(endDate: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return Math.max(
    0,
    Math.ceil((Date.parse(endDate) - Date.parse(today)) / 86_400_000),
  );
}

function SprintHealth({
  metrics,
  healthScore,
}: {
  metrics: SprintMetricsResponse["metrics"];
  healthScore?: number;
}) {
  const { completion, blocked, scope, velocity } = metrics;
  return (
    <section className="panel health-panel" aria-labelledby="health-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Deterministic analytics</p>
          <h2 id="health-title">Sprint health</h2>
        </div>
        <div className="score" aria-label="Sprint health score">
          {healthScore === undefined ? "—" : `${healthScore} / 100`}
        </div>
      </div>
      <div className="metric-grid">
        <div className="metric">
          <span>Completed issues</span>
          <strong>
            {completion.completedIssues} / {completion.totalIssues}
          </strong>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Issue completion"
            aria-valuenow={completion.completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${completion.completionPercent}%` }} />
          </div>
        </div>
        <div className="metric">
          <span>Completed story points</span>
          <strong>
            {completion.completedStoryPoints} / {completion.totalStoryPoints}
          </strong>
          <small>{completion.storyPointCompletionPercent}% complete</small>
        </div>
        <div className="metric">
          <span>Blocked work</span>
          <strong>{blocked.issueCount}</strong>
          <small>{blocked.issueIds.join(", ") || "No blocked issues"}</small>
        </div>
        <div className="metric">
          <span>Scope added</span>
          <strong>+{scope.addedIssueCount} issues</strong>
          <small>{scope.storyPointGrowthPercent}% story-point growth</small>
        </div>
      </div>
      <div className="velocity-section">
        <div>
          <h3>Historical velocity</h3>
          <p>
            {velocity.sprintCount} prior sprints ·{" "}
            {velocity.averageCompletedStoryPoints} average completed points
          </p>
        </div>
        {velocity.completedStoryPointsBySprint.length > 0 ? (
          <div
            className="velocity-chart"
            role="img"
            aria-label="Completed story points by sprint"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocity.completedStoryPointsBySprint}>
                <CartesianGrid vertical={false} stroke="#e8ece9" />
                <XAxis dataKey="sprintId" tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="completedStoryPoints"
                  fill="#32785a"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>No previous sprint history.</p>
        )}
      </div>
    </section>
  );
}

function Analysis({
  result,
  sprint,
}: {
  result: SprintAnalysisResponse;
  sprint: SprintDetailResponse["sprint"];
}) {
  const [expandedRisk, setExpandedRisk] = useState<number | null>(null);
  const run = useQuery({
    queryKey: ["agent-run", result.runId],
    queryFn: () => api.getRun(result.runId),
  });
  const issueTitles = new Map(
    sprint.issues.map((issue) => [issue.id, issue.title]),
  );
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const risks = [...result.analysis.risks].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return (
    <section className="panel analysis-panel" aria-labelledby="analysis-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Evidence-backed assessment</p>
          <h2 id="analysis-title">AI risk analysis</h2>
        </div>
        <Chip label={`${risks.length} risks`} size="small" />
      </div>
      <p className="analysis-summary">{result.analysis.summary}</p>
      {risks.length === 0 ? (
        <p>No delivery risks were reported for this sprint.</p>
      ) : (
        <div className="risk-list">
          {risks.map((risk, index) => (
            <article className="risk-card" key={`${risk.title}-${index}`}>
              <div className="risk-topline">
                <span className={`severity severity-${risk.severity}`}>
                  {risk.severity}
                </span>
                <span>{risk.category}</span>
              </div>
              <h3>{risk.title}</h3>
              <p>{risk.explanation}</p>
              {risk.recommendation && (
                <p className="recommendation">
                  <strong>Recommended:</strong> {risk.recommendation}
                </p>
              )}
              <button
                className="text-button"
                type="button"
                aria-expanded={expandedRisk === index}
                onClick={() =>
                  setExpandedRisk(expandedRisk === index ? null : index)
                }
              >
                {expandedRisk === index ? "Hide evidence" : "View evidence"}
              </button>
              {expandedRisk === index && (
                <div
                  className="evidence"
                  aria-label={`Evidence for ${risk.title}`}
                >
                  {risk.evidence.map((item, evidenceIndex) => (
                    <div key={evidenceIndex}>
                      {item.issueId && (
                        <span>
                          <strong>{item.issueId}</strong>
                          {issueTitles.has(item.issueId)
                            ? ` · ${issueTitles.get(item.issueId)}`
                            : ""}
                        </span>
                      )}
                      {item.metric && (
                        <span>
                          {item.issueId ? " · " : ""}
                          {item.metric}
                          {item.value !== undefined ? `: ${item.value}` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <details className="agent-activity">
        <summary>Agent activity</summary>
        {run.isPending && <p>Loading saved tool trace…</p>}
        {run.isError && (
          <Alert severity="error">Could not load the saved tool trace.</Alert>
        )}
        {run.data && (
          <>
            <p>
              {run.data.run.model} · {run.data.run.status} ·{" "}
              {run.data.run.toolCalls.length} tool calls
            </p>
            <ol className="tool-list">
              {run.data.run.toolCalls.map((call) => (
                <li key={call.step}>
                  <span>{call.toolName}</span>
                  <span>
                    {call.durationMs} ms · {call.status}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </details>
    </section>
  );
}

export function App() {
  const list = useQuery({ queryKey: ["sprints"], queryFn: api.listSprints });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    sprintId: string;
    response: SprintAnalysisResponse;
  } | null>(null);
  const sprintId = selectedId ?? list.data?.sprints[0]?.id;
  const sprint = useQuery({
    queryKey: ["sprint", sprintId],
    queryFn: () => api.getSprint(sprintId!),
    enabled: Boolean(sprintId),
  });
  const metrics = useQuery({
    queryKey: ["metrics", sprintId],
    queryFn: () => api.getMetrics(sprintId!),
    enabled: Boolean(sprintId),
  });
  const analyze = useMutation({
    mutationFn: api.analyze,
    onSuccess: (response, id) => setAnalysis({ sprintId: id, response }),
  });
  const currentAnalysis =
    analysis && analysis.sprintId === sprintId ? analysis.response : null;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            SI
          </div>
          <span>Sprint Intelligence</span>
        </div>
        <span className="header-caption">
          Delivery clarity, grounded in evidence
        </span>
      </header>

      {list.isPending && (
        <div className="loading">
          <CircularProgress aria-label="Loading sprints" />
        </div>
      )}
      {list.isError && (
        <Alert severity="error">
          Could not load sprints. Check the API connection.
        </Alert>
      )}
      {list.data?.sprints.length === 0 && (
        <Alert severity="info">
          No sprints are available. Seed the demo database first.
        </Alert>
      )}

      {sprintId && (
        <>
          <div className="hero">
            <div>
              <p className="eyebrow">Sprint overview</p>
              <h1>{sprint.data?.sprint.name ?? "Loading sprint…"}</h1>
              {sprint.data?.sprint.goal && (
                <p className="sprint-goal">{sprint.data.sprint.goal}</p>
              )}
            </div>
            <div className="hero-actions">
              <label htmlFor="sprint-select">Sprint</label>
              <select
                id="sprint-select"
                value={sprintId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  analyze.reset();
                }}
              >
                {list.data?.sprints.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Button
                variant="contained"
                disabled={analyze.isPending || !sprint.data || !metrics.data}
                onClick={() => analyze.mutate(sprintId)}
              >
                {analyze.isPending ? "Analyzing…" : "Analyze Sprint"}
              </Button>
            </div>
          </div>

          {sprint.isError || metrics.isError ? (
            <Alert severity="error">
              Could not load sprint details or metrics.
            </Alert>
          ) : sprint.isPending || metrics.isPending ? (
            <div className="loading">
              <CircularProgress aria-label="Loading sprint details" />
            </div>
          ) : (
            <>
              <div className="quick-stats">
                <div>
                  <span>Health score</span>
                  <strong>{metrics.data.metrics.healthScore} / 100</strong>
                </div>
                <div>
                  <span>Days remaining</span>
                  <strong>{daysRemaining(sprint.data.sprint.endDate)}</strong>
                </div>
                <div>
                  <span>Issues completed</span>
                  <strong>
                    {metrics.data.metrics.completion.completedIssues} /{" "}
                    {metrics.data.metrics.completion.totalIssues}
                  </strong>
                </div>
                <div>
                  <span>Team members</span>
                  <strong>{sprint.data.sprint.developers.length}</strong>
                </div>
              </div>
              <div className="dashboard-grid">
                <SprintHealth
                  metrics={metrics.data.metrics}
                  healthScore={metrics.data.metrics.healthScore}
                />
                {currentAnalysis ? (
                  <Analysis
                    key={currentAnalysis.runId}
                    result={currentAnalysis}
                    sprint={sprint.data.sprint}
                  />
                ) : (
                  <section
                    className="panel empty-analysis"
                    aria-labelledby="analysis-title"
                  >
                    <p className="eyebrow">Evidence-backed assessment</p>
                    <h2 id="analysis-title">AI risk analysis</h2>
                    <p>
                      Run an analysis to investigate delivery risks and inspect
                      the issue evidence behind each finding.
                    </p>
                  </section>
                )}
              </div>
              {analyze.isError && (
                <Alert severity="error" className="analysis-error">
                  Analysis failed. Check the API and AI provider configuration,
                  then try again.
                </Alert>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
