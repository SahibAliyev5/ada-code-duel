// Browser rendering fixture ONLY. It does not execute source code or certify problems.
// Production starts backend/src/server.ts and always uses the real authenticated judge.
import path from "node:path";
import { createApplication } from "../backend/src/server";
import { ProblemRegistry } from "../backend/src/problems/registry";
const registry = new ProblemRegistry(path.resolve("problems"));
await registry.load();
for (const p of registry.problems.values()) p.ready = true;
const application = await createApplication(
  registry,
  async (p, _language, source, mode) => {
    await new Promise((r) => setTimeout(r, 200));
    const status = source.includes("UI_TEST_ACCEPT")
      ? "accepted"
      : "wrong-answer";
    return {
      status,
      passedTests: status === "accepted" ? p.tests.length : 0,
      totalTests: mode === "run" ? p.samples.length : p.tests.length,
      executionTimeMs: 20,
      samples:
        mode === "run"
          ? p.samples.map((t) => ({
              input: t.input,
              expected: t.output,
              actual: "0\n",
              status,
            }))
          : undefined,
    };
  },
);
application.http.listen(3100, "127.0.0.1", () =>
  console.log(
    "UI TEST FIXTURE on 3100 — controlled verdicts, no code execution.",
  ),
);
