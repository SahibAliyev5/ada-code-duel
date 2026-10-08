import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  languages,
  type Problem,
  type PublicProblem,
} from "../../../shared/types";
const safeName = z.string().regex(/^[a-zA-Z0-9_-]+$/);
export const schema = z.object({
  id: safeName,
  title: z.string().min(1).max(100),
  difficulty: z.enum(["very-easy", "easy"]),
  estimatedMinutes: z.number().int().min(1).max(5),
  timeLimitMs: z.number().int().min(100).max(5000),
  memoryLimitMb: z.number().int().min(64).max(512),
  enabled: z.boolean(),
  tags: z.array(z.string()),
  samples: z.array(safeName).min(1),
  supportedLanguages: z
    .array(z.enum(languages))
    .refine((v) => new Set(v).size === 3, "All three languages are required"),
});
const filenames = {
  cpp17: "main.cpp",
  python3: "main.py",
  java17: "Main.java",
};
export class ProblemRegistry {
  problems = new Map<string, Problem>();
  diagnostics: string[] = [];
  constructor(public root: string) {}
  async load() {
    this.problems.clear();
    this.diagnostics = [];
    const root = await realpath(this.root);
    const seen = new Set<string>();
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        const dir = path.join(root, entry.name);
        const read = async (file: string) => {
          const target = await realpath(path.join(dir, file));
          if (!target.startsWith(root + path.sep))
            throw Error("File escapes problems directory");
          if (!(await stat(target)).isFile())
            throw Error("Expected regular file");
          return readFile(target, "utf8");
        };
        const configText = await read("problem.json");
        const config = schema.parse(JSON.parse(configText));
        if (seen.has(config.id)) {
          this.problems.delete(config.id);
          throw Error(`Duplicate problem ID: ${config.id}`);
        }
        seen.add(config.id);
        const statement = await read("statement.md");
        const starters = {} as Problem["starters"];
        const solutions = {} as Problem["solutions"];
        for (const lang of languages) {
          starters[lang] = await read(`starter/${filenames[lang]}`);
          solutions[lang] = await read(`solution/${filenames[lang]}`);
        }
        const testDir = await realpath(path.join(dir, "tests"));
        if (!testDir.startsWith(root + path.sep))
          throw Error("Tests escape directory");
        const entries = await readdir(testDir);
        const tests: Problem["tests"] = [];
        for (const name of entries.filter((n) => n.endsWith(".in")).sort()) {
          const stem = name.slice(0, -3);
          safeName.parse(stem);
          tests.push({
            name: stem,
            input: await read(`tests/${name}`),
            output: await read(`tests/${stem}.out`),
          });
        }
        if (
          entries.some(
            (n) =>
              n.endsWith(".out") && !entries.includes(n.slice(0, -4) + ".in"),
          )
        )
          throw Error("Orphan output file");
        if (
          !tests.length ||
          config.samples.some((n) => !tests.some((t) => t.name === n)) ||
          tests.length <= config.samples.length
        )
          throw Error("Samples and hidden tests are required");
        const fingerprint = createHash("sha256")
          .update(
            JSON.stringify({ config, statement, starters, solutions, tests }),
          )
          .digest("hex");
        let ready = false;
        try {
          const certificate = JSON.parse(await read(".validated.json"));
          ready =
            certificate.fingerprint === fingerprint &&
            certificate.languages?.join(",") === languages.join(",");
        } catch {}
        if (!config.enabled) continue;
        this.problems.set(config.id, {
          ...config,
          statement,
          starters,
          solutions,
          tests,
          samples: tests.filter((t) => config.samples.includes(t.name)),
          fingerprint,
          ready,
        });
      } catch (error) {
        this.diagnostics.push(
          `${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  eligible() {
    return [...this.problems.values()].filter((p) => p.ready);
  }
}
export function publicProblem(p: Problem): PublicProblem {
  return {
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    statement: p.statement,
    timeLimitMs: p.timeLimitMs,
    memoryLimitMb: p.memoryLimitMb,
    starters: p.starters,
    samples: p.samples,
  };
}
