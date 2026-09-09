import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type Developer = {
  id: string;
  capacityStoryPoints: number;
};

type DemoIssue = {
  id: string;
  assigneeId?: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  storyPoints?: number;
  acceptanceCriteria?: string;
  dependencies: string[];
  addedToSprintAt?: string;
};

async function readDemoFile<T>(name: string): Promise<T> {
  const contents = await readFile(
    new URL(`../../../demo/sprint/${name}`, import.meta.url),
    "utf8",
  );
  return JSON.parse(contents) as T;
}

test("demo dataset contains the required team and sprint history", async () => {
  const [sprint, developers, history] = await Promise.all([
    readDemoFile<{ id: string; developerIds: string[] }>("sprint.json"),
    readDemoFile<Developer[]>("developers.json"),
    readDemoFile<Array<{ completedStoryPoints: number }>>("history.json"),
  ]);

  assert.equal(sprint.id, "sprint-24");
  assert.equal(developers.length, 6);
  assert.equal(new Set(developers.map(({ id }) => id)).size, 6);
  assert.deepEqual(
    sprint.developerIds,
    developers.map(({ id }) => id),
  );
  assert.equal(history.length, 5);
  assert.ok(
    history.every(({ completedStoryPoints }) => completedStoryPoints > 0),
  );
});

test("demo issues contain deliberate, traceable delivery risks", async () => {
  const [developers, issues] = await Promise.all([
    readDemoFile<Developer[]>("developers.json"),
    readDemoFile<DemoIssue[]>("issues.json"),
  ]);
  const issueIds = new Set(issues.map(({ id }) => id));
  const developerIds = new Set(developers.map(({ id }) => id));

  assert.equal(issues.length, 35);
  assert.equal(issueIds.size, issues.length);
  assert.ok(
    issues.every(
      ({ assigneeId }) => !assigneeId || developerIds.has(assigneeId),
    ),
  );
  assert.ok(
    issues
      .flatMap(({ dependencies }) => dependencies)
      .every((id) => issueIds.has(id)),
  );

  const leonPoints = issues
    .filter(
      ({ assigneeId, status }) =>
        assigneeId === "dev-leon" && status !== "done",
    )
    .reduce((total, { storyPoints = 0 }) => total + storyPoints, 0);
  assert.ok(
    leonPoints > 13,
    "Leon should be committed beyond his 13-point capacity",
  );

  assert.ok(issues.some(({ status }) => status === "blocked"));
  assert.ok(
    issues.filter(({ storyPoints }) => storyPoints === undefined).length >= 2,
  );
  assert.ok(
    issues.filter(({ acceptanceCriteria }) => !acceptanceCriteria).length >= 3,
  );
  assert.ok(
    issues.filter(({ addedToSprintAt }) => addedToSprintAt).length >= 2,
  );
  assert.deepEqual(
    issues.find(({ id }) => id === "PAY-205")?.dependencies,
    ["OPS-91"],
    "the blocked payment story must cite its unfinished infrastructure dependency",
  );
  assert.deepEqual(issues.find(({ id }) => id === "AUTH-231")?.dependencies, [
    "AUTH-198",
  ]);
});
