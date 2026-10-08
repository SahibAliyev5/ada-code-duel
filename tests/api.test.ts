import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { io as client, type Socket } from "socket.io-client";
import { createApplication } from "../backend/src/server";
import { ProblemRegistry } from "../backend/src/problems/registry";
import type { ClientEvents, ServerEvents, Reply } from "../shared/types";
test("real HTTP and Socket.IO APIs reject unauthorized organizers and synchronize clients", async () => {
  const registry = new ProblemRegistry(path.resolve("problems"));
  await registry.load();
  for (const p of registry.problems.values()) p.ready = true;
  process.env.ORGANIZER_SECRET = "local-test-organizer-secret";
  const application = await createApplication(registry, async () => ({
    status: "wrong-answer",
    passedTests: 0,
    totalTests: 5,
    executionTimeMs: 1,
  }));
  await new Promise<void>((r) => application.http.listen(0, "127.0.0.1", r));
  const address = application.http.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  const a: Socket<ServerEvents, ClientEvents> = client(url);
  const b: Socket<ServerEvents, ClientEvents> = client(url);
  const c: Socket<ServerEvents, ClientEvents> = client(url);
  try {
    await Promise.all(
      [a, b, c].map((s) => new Promise<void>((r) => s.on("connect", r))),
    );
    assert.equal((await fetch(url + "/api/organizer")).status, 401);
    assert.equal(
      (
        await fetch(url + "/api/organizer/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "AAAAAA" }),
        })
      ).status,
      401,
    );
    const room = await new Promise<Reply>((r) =>
      a.emit("room:create", { name: "Ada" }, r),
    );
    const joined = await new Promise<Reply>((r) =>
      b.emit("room:join", { name: "Bob", code: room.room!.code }, r),
    );
    assert.equal(joined.room?.players.length, 2);
    const third = await new Promise<Reply>((r) =>
      c.emit("room:join", { name: "Eve", code: room.room!.code }, r),
    );
    assert.match(third.error!, /two players/);
    const startedA = new Promise<void>((r) =>
      a.once("match:started", (v) => {
        assert.equal(v.players.length, 2);
        r();
      }),
    );
    const startedB = new Promise<void>((r) =>
      b.once("match:started", (v) => {
        assert.ok(v.match?.problem);
        assert.equal("tests" in v.match!.problem, false);
        r();
      }),
    );
    a.emit("match:start", () => {});
    await Promise.all([startedA, startedB]);
    const auth = { Authorization: "Bearer local-test-organizer-secret" };
    assert.equal(
      (await fetch(url + "/api/organizer", { headers: auth })).status,
      200,
    );
    const reset = await fetch(url + "/api/organizer/reset", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ code: room.room!.code }),
    });
    assert.equal(reset.status, 200);
    assert.equal(application.arena.rooms.size, 0);
  } finally {
    a.disconnect();
    b.disconnect();
    c.disconnect();
    await new Promise<void>((r) => application.io.close(() => r()));
  }
});
