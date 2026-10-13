import { expect, test } from "@playwright/test";

test("opens the demo sprint and reveals issue evidence for an analyzed risk", async ({
  page,
}) => {
  const runId = "b68b26b5-a5d5-4cda-9ae7-9d6d6cd53ac7";
  const responses: Record<string, unknown> = {
    "/api/sprints": {
      sprints: [
        {
          id: "sprint-24",
          name: "Sprint 24",
          startDate: "2026-10-01",
          endDate: "2026-10-15",
        },
      ],
    },
    "/api/sprints/sprint-24": {
      sprint: {
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
            type: "story",
            status: "blocked",
            assigneeId: "dev-1",
            storyPoints: 8,
            updatedAt: "2026-10-10T12:00:00Z",
            acceptanceCriteria: "Users can log in",
            dependencies: ["AUTH-198"],
          },
        ],
      },
    },
    "/api/sprints/sprint-24/metrics": {
      metrics: {
        sprintId: "sprint-24",
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
    },
    "/api/sprints/sprint-24/analyze": {
      runId,
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
    },
    [`/api/agent-runs/${runId}`]: {
      run: {
        id: runId,
        sprintId: "sprint-24",
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
    },
  };

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!(path in responses)) {
      await route.abort();
      return;
    }
    if (path.endsWith("/analyze")) {
      expect(route.request().method()).toBe("POST");
    }
    await route.fulfill({ json: responses[path] });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sprint 24" })).toBeVisible();
  await expect(page.getByText("6 / 10").first()).toBeVisible();
  await page.getByRole("button", { name: "Analyze Sprint" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Authentication dependency is unfinished",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Sprint health score")).toHaveText("68 / 100");

  await page.getByRole("button", { name: "View evidence" }).click();
  const evidence = page.getByLabel(
    "Evidence for Authentication dependency is unfinished",
  );
  await expect(evidence).toContainText("AUTH-231");
  await expect(evidence).toContainText("Authentication rollout");
  await expect(evidence).toContainText("status: blocked");
});
