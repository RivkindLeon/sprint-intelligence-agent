import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import { App } from "./App";

vi.mock("./api", () => ({
  api: {
    listSprints: vi.fn(),
    getSprint: vi.fn(),
    getMetrics: vi.fn(),
    analyze: vi.fn(),
    getRun: vi.fn(),
  },
}));

const sprint = {
  id: "sprint-24",
  name: "Sprint 24",
  goal: "Ship the account experience",
  startDate: "2026-10-01",
  endDate: "2026-10-15",
  developers: [{ id: "dev-1", name: "Leon", capacityStoryPoints: 20 }],
  issues: [
    {
      id: "AUTH-231",
      title: "Authentication rollout",
      type: "story" as const,
      status: "blocked" as const,
      assigneeId: "dev-1",
      storyPoints: 8,
      updatedAt: "2026-10-10T12:00:00Z",
      acceptanceCriteria: "Users can log in",
      dependencies: ["AUTH-198"],
    },
  ],
};

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listSprints).mockResolvedValue({
    sprints: [
      {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      },
    ],
  });
  vi.mocked(api.getSprint).mockResolvedValue({ sprint });
  vi.mocked(api.getMetrics).mockResolvedValue({
    metrics: {
      sprintId: sprint.id,
      completion: {
        totalIssues: 10,
        completedIssues: 6,
        completionPercent: 60,
        totalStoryPoints: 40,
        completedStoryPoints: 24,
        storyPointCompletionPercent: 60,
      },
      blocked: { issueCount: 1, issueIds: ["AUTH-231"] },
      scope: {
        addedIssueCount: 2,
        addedIssueIds: ["AUTH-231"],
        netStoryPointChange: 8,
        storyPointGrowthPercent: 20,
      },
      velocity: {
        sprintCount: 0,
        averageCompletedStoryPoints: 0,
        completedStoryPointsBySprint: [],
      },
    },
  });
  vi.mocked(api.analyze).mockResolvedValue({
    runId: "b68b26b5-a5d5-4cda-9ae7-9d6d6cd53ac7",
    analysis: {
      healthScore: 68,
      summary: "Authentication delivery is at risk.",
      risks: [
        {
          severity: "critical",
          category: "dependency",
          title: "Authentication dependency is unfinished",
          explanation: "AUTH-231 remains blocked by unfinished work.",
          evidence: [
            { issueId: "AUTH-231", metric: "status", value: "blocked" },
          ],
          recommendation: "Prioritize the dependency.",
          confidence: 0.9,
        },
      ],
    },
  });
  vi.mocked(api.getRun).mockResolvedValue({
    run: {
      id: "b68b26b5-a5d5-4cda-9ae7-9d6d6cd53ac7",
      sprintId: sprint.id,
      model: "openai/test-model",
      status: "completed",
      startedAt: "2026-10-12T16:30:00Z",
      endedAt: "2026-10-12T16:30:02Z",
      error: null,
      toolCalls: [
        {
          step: 1,
          toolName: "getDependencyRisks",
          durationMs: 14,
          status: "completed",
          error: null,
        },
      ],
    },
  });
});

describe("dashboard", () => {
  it("loads sprint metrics and runs an analysis with issue evidence and saved activity", async () => {
    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Sprint 24" }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("6 / 10")).length).toBe(2);
    expect(screen.getByText("+2 issues")).toBeInTheDocument();
    expect(screen.getByText("— / 100")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Analyze Sprint" }));
    expect(
      await screen.findByText("Authentication dependency is unfinished"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("68 / 100").length).toBe(2);
    expect(vi.mocked(api.analyze).mock.calls[0]?.[0]).toBe("sprint-24");

    fireEvent.click(screen.getByRole("button", { name: "View evidence" }));
    const evidence = screen.getByLabelText(
      "Evidence for Authentication dependency is unfinished",
    );
    expect(within(evidence).getByText("AUTH-231")).toBeInTheDocument();
    expect(
      within(evidence).getByText(/Authentication rollout/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Agent activity"));
    expect(await screen.findByText("getDependencyRisks")).toBeInTheDocument();
    expect(screen.getByText(/14 ms · completed/)).toBeInTheDocument();
  });

  it("shows a useful empty state when the sprint list is empty", async () => {
    vi.mocked(api.listSprints).mockResolvedValueOnce({ sprints: [] });
    renderApp();

    expect(
      await screen.findByText(/Seed the demo database first/),
    ).toBeInTheDocument();
    expect(api.getSprint).not.toHaveBeenCalled();
  });
});
