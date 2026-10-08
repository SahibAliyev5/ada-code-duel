import type { Problem, Language, JudgeResult } from "../../shared/types";
export type Judge = (
  problem: Problem,
  language: Language,
  source: string,
  mode: "run" | "submit",
) => Promise<JudgeResult>;
export const judge: Judge = async (problem, language, source, mode) => {
  const secret = process.env.JUDGE_SECRET;
  if (!secret)
    return {
      status: "judging-error",
      passedTests: 0,
      totalTests: 0,
      executionTimeMs: 0,
      message: "Judge secret is not configured.",
    };
  try {
    const response = await fetch(
      `${process.env.JUDGE_URL || "http://127.0.0.1:4001"}/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          source,
          language,
          mode,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
          tests: mode === "run" ? problem.samples : problem.tests,
        }),
        signal: AbortSignal.timeout(180000),
      },
    );
    if (!response.ok) throw Error(`Judge returned HTTP ${response.status}`);
    return (await response.json()) as JudgeResult;
  } catch {
    return {
      status: "judging-error",
      passedTests: 0,
      totalTests: 0,
      executionTimeMs: 0,
      message:
        "Local judge unavailable. Ask the organizer to check Docker and the judge service.",
    };
  }
};
