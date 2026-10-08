import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type {
  Language,
  Verdict,
  TestCase,
  JudgeResult,
} from "../../shared/types";
export interface Job {
  source: string;
  language: Language;
  mode: "run" | "submit";
  timeLimitMs: number;
  memoryLimitMb: number;
  tests: TestCase[];
}
interface Execution {
  status: Verdict | "ok";
  output: string;
  error: string;
  executionTimeMs: number;
}
function docker(
  args: string[],
  input?: string,
  timeout = 25000,
): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true });
    let out = "",
      err = "",
      size = 0;
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("Docker infrastructure timeout"));
    }, timeout);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.stdout.on("data", (d) => {
      size += d.length;
      if (size > 512000) {
        child.kill();
        reject(Error("Invalid sandbox output"));
      } else out += d;
    });
    child.stderr.on("data", (d) => {
      if (err.length < 65536) err += d;
    });
    child.stdin.on("error", () => {});
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out, err });
    });
    child.stdin.end(input);
  });
}
export async function execute(job: Job, test: TestCase): Promise<Execution> {
  const name = `ada-exec-${randomUUID()}`;
  try {
    const result = await docker(
      [
        "run",
        "--name",
        name,
        "--interactive",
        "--network",
        "none",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--cap-add",
        "SETUID",
        "--cap-add",
        "SETGID",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "64",
        "--cpus",
        "1",
        "--memory",
        `${job.memoryLimitMb}m`,
        "--memory-swap",
        `${job.memoryLimitMb}m`,
        "--ulimit",
        "nofile=64:64",
        "--ulimit",
        "core=0:0",
        "--tmpfs",
        `/work:rw,exec,nosuid,size=32m,mode=0777`,
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=16m",
        "ada-code-race-sandbox:local",
      ],
      JSON.stringify({
        source: job.source,
        language: job.language,
        input: test.input,
        timeLimitMs: job.timeLimitMs,
        memoryLimitMb: job.memoryLimitMb,
      }) + "\n",
    );
    const inspected = await docker([
      "inspect",
      "--format",
      "{{.State.OOMKilled}}",
      name,
    ]);
    if (inspected.out.trim() === "true")
      return {
        status: "memory-limit-exceeded",
        output: "",
        error: "Memory limit exceeded.",
        executionTimeMs: 0,
      };
    if (result.code !== 0)
      throw Error(result.err || "Sandbox exited unexpectedly");
    const parsed = JSON.parse(result.out.trim()) as Execution;
    if (
      typeof parsed.output !== "string" ||
      typeof parsed.executionTimeMs !== "number"
    )
      throw Error("Invalid supervisor result");
    return parsed;
  } finally {
    await docker(["rm", "--force", name]).catch(() => {});
  }
}
// Ignore trailing whitespace on each line and trailing blank lines; preserve leading whitespace.
export function normalize(output: string) {
  return output
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}
export async function evaluate(job: Job): Promise<JudgeResult> {
  const result: JudgeResult = {
    status: "accepted",
    passedTests: 0,
    totalTests: job.tests.length,
    executionTimeMs: 0,
  };
  if (job.mode === "run") result.samples = [];
  try {
    for (const test of job.tests) {
      const run = await execute(job, test);
      const status: Verdict =
        run.status === "ok"
          ? normalize(run.output) === normalize(test.output)
            ? "accepted"
            : "wrong-answer"
          : run.status;
      result.executionTimeMs += run.executionTimeMs;
      if (job.mode === "run")
        result.samples!.push({
          input: test.input,
          expected: test.output,
          actual: run.output,
          status,
        });
      if (status === "accepted") result.passedTests++;
      else {
        result.status = status;
        if (job.mode === "run" || status === "compilation-error")
          result.message = run.error.slice(0, 8000);
        if (job.mode === "submit") break;
      }
    }
  } catch {
    result.status = "judging-error";
    result.message = "Docker sandbox unavailable or failed.";
  }
  return result;
}
