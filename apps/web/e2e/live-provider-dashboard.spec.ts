import { expect, test } from "@playwright/test";
import {
  agentRunResponseSchema,
  sprintAnalysisResponseSchema,
  sprintDetailResponseSchema,
} from "@sprint-intelligence/shared";

test.skip(
  process.env.RUN_LIVE_AI_DASHBOARD_TEST !== "true",
  "Opt-in test requires a seeded PostgreSQL API and live AI credentials",
);

test("analyzes the seeded sprint with a live provider and shows its evidence and trace", async ({
  page,
}) => {
  test.setTimeout(180_000);

  for (const name of [
    "DATABASE_URL",
    "AI_PROVIDER",
    "AI_MODEL",
    "AI_API_KEY",
  ]) {
    expect(process.env[name], `${name} must be configured`).toBeTruthy();
  }

  const detailResponse = await page.request.get("/api/sprints/sprint-24");
  expect(detailResponse.status(), await detailResponse.text()).toBe(200);
  const { sprint } = sprintDetailResponseSchema.parse(
    await detailResponse.json(),
  );
  expect(sprint.issues).toHaveLength(35);
  const knownIssueIds = new Set(sprint.issues.map((issue) => issue.id));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sprint 24" })).toBeVisible();

  const analysisResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/sprints/sprint-24/analyze",
    { timeout: 150_000 },
  );
  await page.getByRole("button", { name: "Analyze Sprint" }).click();
  const analysisResponse = await analysisResponsePromise;
  expect(analysisResponse.status(), await analysisResponse.text()).toBe(200);
  const { runId, analysis } = sprintAnalysisResponseSchema.parse(
    await analysisResponse.json(),
  );

  expect(analysis.risks.length).toBeGreaterThan(0);
  for (const risk of analysis.risks) {
    expect(
      risk.evidence.some((item) => item.issueId !== undefined),
      `${risk.title} must cite a specific issue`,
    ).toBe(true);
    for (const evidence of risk.evidence) {
      if (evidence.issueId) {
        expect(knownIssueIds.has(evidence.issueId)).toBe(true);
      }
    }
  }

  const runResponse = await page.request.get(`/api/agent-runs/${runId}`);
  expect(runResponse.status(), await runResponse.text()).toBe(200);
  const { run } = agentRunResponseSchema.parse(await runResponse.json());
  expect(run.status).toBe("completed");
  expect(run.toolCalls.length).toBeGreaterThan(0);
  expect(run.toolCalls.every((call) => call.status === "completed")).toBe(true);

  await expect(page.getByLabel("Sprint health score")).toHaveText(
    `${analysis.healthScore} / 100`,
  );
  const firstRisk = page.locator(".risk-card").first();
  await expect(firstRisk).toBeVisible();
  await firstRisk.getByRole("button", { name: "View evidence" }).click();
  const firstRiskTitle = await firstRisk.locator("h3").textContent();
  const firstRiskAnalysis = analysis.risks.find(
    (risk) => risk.title === firstRiskTitle,
  );
  expect(firstRiskAnalysis).toBeDefined();
  const firstIssueId = firstRiskAnalysis!.evidence.find(
    (item) => item.issueId,
  )!.issueId!;
  await expect(
    firstRisk.getByLabel(`Evidence for ${firstRiskTitle}`),
  ).toContainText(firstIssueId);

  await page.getByText("Agent activity").click();
  await expect(page.locator(".agent-activity")).toContainText(
    `${run.toolCalls.length} tool calls`,
  );
});
