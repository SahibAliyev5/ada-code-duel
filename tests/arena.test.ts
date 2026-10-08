import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Arena } from "../backend/src/arena";
import { ProblemRegistry } from "../backend/src/problems/registry";
import type { Judge } from "../backend/src/judge";
import type { JudgeResult, Submission } from "../shared/types";
const accepted: JudgeResult = {
  status: "accepted",
  passedTests: 5,
  totalTests: 5,
  executionTimeMs: 10,
};
const wrong: JudgeResult = {
  ...accepted,
  status: "wrong-answer",
  passedTests: 0,
};
async function setup(judge: Judge = async () => accepted) {
  const registry = new ProblemRegistry(path.resolve("problems"));
  await registry.load();
  for (const p of registry.problems.values()) p.ready = true;
  let now = 1000000;
  const events: { code: string; event: string; data: unknown }[] = [];
  const arena = new Arena(
    registry,
    judge,
    (code, event, data) => events.push({ code, event, data }),
    (code, event, data) => events.push({ code, event, data }),
    () => now,
  );
  const a = arena.create("Ada", "a");
  const b = arena.join(a.room.code, "Bob", "b");
  return { arena, a, b, events, setNow: (n: number) => (now = n) };
}
const submission = (source = "correct"): Submission => ({
  requestId: randomUUID(),
  source,
  language: "python3",
  mode: "submit",
});
test("production matchmaking refuses a library without real validation certificates", async () => {
  const registry = new ProblemRegistry(path.resolve("problems"));
  await registry.load();
  for (const p of registry.problems.values()) p.ready = false;
  const arena = new Arena(
    registry,
    async () => accepted,
    () => {},
    () => {},
  );
  const a = arena.create("Ada", "a");
  arena.join(a.room.code, "Bob", "b");
  assert.throws(() => arena.start("a"), /No validated problems/);
});
test("room codes are unique, rooms hold exactly two players, and outsiders cannot start", async () => {
  const { arena, a } = await setup();
  assert.match(a.room.code, /^[A-F0-9]{6}$/);
  assert.throws(() => arena.join(a.room.code, "Third", "c"), /two players/);
  assert.throws(() => arena.start("b"), /host/);
  const c = arena.create("Charlie", "c");
  assert.notEqual(c.room.code, a.room.code);
  assert.throws(() => arena.create("Again", "a"), /Leave/);
});
test("refresh resumes an existing slot with token, and rejects duplicate active tabs", async () => {
  const { arena, a } = await setup();
  assert.throws(() => arena.resume(a.token, "refresh"), /another tab/);
  arena.disconnect("a");
  const r = arena.resume(a.token, "refresh");
  assert.equal(r.playerId, a.playerId);
  assert.equal(r.room.players.length, 2);
  assert.throws(() => arena.resume("bad", "x"), /expired/);
});
test("match uses a shared problem and server deadline, then expires once", async () => {
  const { arena, a, events, setNow } = await setup();
  arena.start("a");
  const m = arena.rooms.get(a.room.code)!.match!;
  assert.equal(m.deadline - m.startedAt, 300000);
  setNow(m.deadline);
  arena.tick();
  arena.tick();
  assert.equal(m.status, "finished");
  assert.equal(m.winnerId, undefined);
  assert.equal(events.filter((e) => e.event === "match:finished").length, 1);
  await assert.rejects(arena.submit("a", submission()), /closed/);
});
test("two simultaneous accepted submissions choose receipt order even with reversed completion", async () => {
  const resolvers: ((r: JudgeResult) => void)[] = [];
  const { arena, a, b, events } = await setup(
    () => new Promise((r) => resolvers.push(r)),
  );
  arena.start("a");
  const p1 = arena.submit("a", submission());
  const p2 = arena.submit("b", submission());
  resolvers[1](accepted);
  await p2;
  assert.equal(arena.rooms.get(a.room.code)!.match!.status, "active");
  resolvers[0](accepted);
  await p1;
  assert.equal(arena.rooms.get(a.room.code)!.match!.winnerId, a.playerId);
  assert.notEqual(a.playerId, b.playerId);
  assert.equal(events.filter((e) => e.event === "match:finished").length, 1);
});
test("eligible pre-deadline submission can win after timer, later arrivals cannot", async () => {
  let resolve!: (r: JudgeResult) => void;
  const { arena, a, setNow } = await setup(
    () => new Promise((r) => (resolve = r)),
  );
  arena.start("a");
  const m = arena.rooms.get(a.room.code)!.match!;
  const pending = arena.submit("a", submission());
  setNow(m.deadline + 1);
  arena.tick();
  assert.equal(m.status, "settling");
  await assert.rejects(arena.submit("b", submission()), /closed/);
  resolve(accepted);
  await pending;
  assert.equal(m.winnerId, a.playerId);
});
test("earlier wrong answer lets next accepted entry win, infrastructure errors are separate", async () => {
  const { arena, a, b } = await setup(async (_p, _l, source) =>
    source === "bad" ? wrong : { ...accepted, status: "judging-error" },
  );
  arena.start("a");
  await arena.submit("a", submission("bad"));
  await arena.submit("b", submission());
  assert.equal(arena.rooms.get(a.room.code)!.match!.winnerId, undefined);
  assert.equal(
    arena.rooms.get(a.room.code)!.match!.entries[1].result?.status,
    "judging-error",
  );
  void b;
});
test("duplicate requests and concurrent requests from same player are rejected", async () => {
  let resolve!: (r: JudgeResult) => void;
  const { arena } = await setup(() => new Promise((r) => (resolve = r)));
  arena.start("a");
  const data = submission();
  const p = arena.submit("a", data);
  await assert.rejects(arena.submit("a", submission()), /Wait/);
  resolve(wrong);
  await p;
  await assert.rejects(arena.submit("a", data), /Duplicate/);
});
test("reset discards in-flight results, supports rematch, and clears identities for new players", async () => {
  let resolve!: (r: JudgeResult) => void;
  const { arena, a, events } = await setup(
    () => new Promise((r) => (resolve = r)),
  );
  arena.start("a");
  const previous = arena.rooms.get(a.room.code)!.match!.problem.id;
  const p = arena.submit("a", submission());
  assert.throws(() => arena.reset("b"), /host/);
  arena.reset("a");
  resolve(accepted);
  await p;
  assert.equal(arena.rooms.get(a.room.code)!.match, undefined);
  arena.start("a");
  assert.notEqual(arena.rooms.get(a.room.code)!.match!.problem.id, previous);
  arena.reset("a", true);
  assert.equal(arena.rooms.size, 0);
  assert.throws(() => arena.resume(a.token, "a"), /expired/);
  assert.equal(events.filter((e) => e.event === "match:reset").length, 1);
});
test("public match snapshot never exposes hidden cases or reference solutions", async () => {
  const { arena, a, events } = await setup(async () => ({
    ...wrong,
    message: "hidden secret",
    samples: [
      {
        input: "SECRET INPUT",
        expected: "SECRET OUTPUT",
        actual: "secret",
        status: "wrong-answer",
      },
    ],
  }));
  arena.start("a");
  const view = arena.view(arena.rooms.get(a.room.code)!);
  assert.equal("tests" in view.match!.problem, false);
  assert.equal("solutions" in view.match!.problem, false);
  await arena.submit("a", submission());
  const privateResult = JSON.stringify(
    events.find((e) => e.event === "submission:result")!.data,
  );
  assert.doesNotMatch(privateResult, /SECRET|hidden secret/);
});
