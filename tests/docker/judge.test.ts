import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, type Job } from "../../judge/src/docker";
import { ProblemRegistry } from "../../backend/src/problems/registry";
import path from "node:path";
import { languages } from "../../shared/types";
const base: Job = {
  source: "print(input())",
  language: "python3",
  mode: "submit",
  timeLimitMs: 500,
  memoryLimitMb: 256,
  tests: [{ name: "test", input: "7\n", output: "7\n" }],
};
test("all problem references pass the real Docker judge in all three languages", async () => {
  const r = new ProblemRegistry(path.resolve("problems"));
  await r.load();
  for (const p of r.problems.values())
    for (const language of languages) {
      const v = await evaluate({
        ...base,
        source: p.solutions[language],
        language,
        timeLimitMs: p.timeLimitMs,
        memoryLimitMb: p.memoryLimitMb,
        tests: p.tests,
      });
      assert.equal(
        v.status,
        "accepted",
        `${p.id} ${language}: ${v.message || v.status}`,
      );
    }
});
test("wrong output, compilation error, runtime error, loops, output and memory limits", async () => {
  for (const [source, language, status] of [
    ["print(0)", "python3", "wrong-answer"],
    ["invalid C++", "cpp17", "compilation-error"],
    ["public class Main { bad }", "java17", "compilation-error"],
    ['raise RuntimeError("failure")', "python3", "runtime-error"],
    ["while True: pass", "python3", "time-limit-exceeded"],
    ['print("x"*200000)', "python3", "output-limit-exceeded"],
    ["a=bytearray(1024*1024*1024)", "python3", "memory-limit-exceeded"],
  ] as const) {
    const v = await evaluate({ ...base, source, language });
    assert.equal(v.status, status, `${source}: ${v.message || v.status}`);
  }
});
test("sandbox cannot reach network or host files, and has no socket or secrets", async () => {
  const source = `import os,socket\nassert not os.path.exists('/var/run/docker.sock')\nassert not os.path.exists('/app/.env')\nassert not os.environ.get('JUDGE_SECRET')\ns=socket.socket();s.settimeout(.1)\ntry:\n s.connect(('1.1.1.1',80));print('network-access')\nexcept OSError:\n print('isolated')\n`;
  const v = await evaluate({
    ...base,
    source,
    tests: [{ name: "isolation", input: "", output: "isolated\n" }],
  });
  assert.equal(v.status, "accepted");
});
