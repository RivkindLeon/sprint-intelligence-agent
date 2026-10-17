import assert from "node:assert/strict";
import test from "node:test";

import { loadDemoDataset } from "./seed.js";

test("loads the demo sprint as an active sprint while preserving relative event dates", async () => {
  const dataset = await loadDemoDataset(new Date("2026-10-17T23:30:00Z"));

  assert.equal(dataset.sprint.startDate, "2026-10-08");
  assert.equal(dataset.sprint.endDate, "2026-10-21");
  assert.equal(dataset.issues.length, 35);
  assert.equal(dataset.history.length, 5);

  const dependency = dataset.issues.find(({ id }) => id === "AUTH-198");
  assert.equal(dependency?.updatedAt, "2026-10-04T11:00:00.000Z");
  assert.deepEqual(
    dataset.issues.find(({ id }) => id === "AUTH-231")?.dependencies,
    ["AUTH-198"],
  );
  assert.equal(
    dataset.issues.find(({ id }) => id === "BUG-901")?.addedToSprintAt,
    "2026-10-10T11:00:00.000Z",
  );
  assert.equal(dataset.history.at(-1)?.completedAt, "2026-10-07T17:00:00.000Z");
  assert.ok(
    dataset.issues.every(
      ({ updatedAt }) => Date.parse(updatedAt) < Date.parse("2026-10-17"),
    ),
  );
});

test("uses UTC calendar days, not the time of day, to position the demo", async () => {
  const morning = await loadDemoDataset(new Date("2026-10-17T00:01:00Z"));
  const evening = await loadDemoDataset(new Date("2026-10-17T23:59:00Z"));

  assert.deepEqual(morning, evening);
});
