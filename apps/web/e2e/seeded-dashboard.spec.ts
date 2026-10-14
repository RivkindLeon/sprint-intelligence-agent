import { expect, test } from "@playwright/test";

test.skip(
  process.env.RUN_SEEDED_DASHBOARD_TEST !== "true",
  "Requires a migrated and seeded PostgreSQL API",
);

test("loads the seeded sprint and deterministic metrics from the running API", async ({
  page,
}) => {
  const apiResponses: string[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/api/")) {
      apiResponses.push(
        `${response.status()} ${new URL(response.url()).pathname}`,
      );
    }
  });

  const directList = await page.request.get(
    "http://127.0.0.1:3000/api/sprints",
  );
  const proxiedList = await page.request.get("/api/sprints");
  expect(directList.status()).toBe(200);
  expect(proxiedList.status()).toBe(200);
  expect(await proxiedList.json()).toEqual(await directList.json());
  expect(await directList.json()).toEqual({
    sprints: [expect.objectContaining({ id: "sprint-24" })],
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sprint 24" })).toBeVisible();
  await expect(page.getByText("12 / 35").first()).toBeVisible();
  await expect(page.getByText("PAY-205")).toBeVisible();
  await expect(page.getByText("+2 issues")).toBeVisible();
  await expect(
    page.getByText("5 prior sprints", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Completed story points by sprint"),
  ).toBeVisible();
  await expect(page.getByText("Team members").locator("..")).toContainText("6");

  expect(apiResponses).toEqual(
    expect.arrayContaining([
      "200 /api/sprints",
      "200 /api/sprints/sprint-24",
      "200 /api/sprints/sprint-24/metrics",
    ]),
  );
});
