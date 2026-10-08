import "dotenv/config";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { ProblemRegistry } from "../backend/src/problems/registry";
import { judge } from "../backend/src/judge";
import { languages } from "../shared/types";
const root = path.resolve(process.env.PROBLEMS_DIR || "problems");
const command = process.argv[2];
if (command === "new") {
  const id = process.argv.find((a) => a.startsWith("--id="))?.slice(5);
  if (!id || !/^[a-z0-9-]+$/.test(id))
    throw Error(
      "Use --id=example-problem (lowercase letters, digits and hyphens)",
    );
  const dir = path.join(root, id);
  try {
    await access(dir);
    throw Error("Folder already exists");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  for (const sub of ["starter", "solution", "tests"])
    await mkdir(path.join(dir, sub), { recursive: true });
  await writeFile(
    path.join(dir, "problem.json"),
    JSON.stringify(
      {
        id,
        title: "Example: Echo an Integer",
        difficulty: "very-easy",
        estimatedMinutes: 1,
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        enabled: false,
        tags: ["beginner"],
        samples: ["sample1"],
        supportedLanguages: languages,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(dir, "statement.md"),
    "# Echo an Integer\n\nRead and print an integer. Replace this example with your problem.\n\n## Input\nOne integer n.\n\n## Output\nPrint n.\n\n## Constraints\n-1000 ≤ n ≤ 1000.\n",
  );
  const templates = {
    cpp17:
      "#include <iostream>\nusing namespace std;\nint main(){\n    // TODO: solve the problem\n    return 0;\n}\n",
    python3: "# TODO: solve the problem\n",
    java17:
      "import java.util.*;\npublic class Main { public static void main(String[] args){\n    // TODO: solve the problem\n}}\n",
  };
  const files = { cpp17: "main.cpp", python3: "main.py", java17: "Main.java" };
  for (const lang of languages)
    for (const sub of ["starter", "solution"])
      await writeFile(path.join(dir, sub, files[lang]), templates[lang]);
  for (const [stem, value] of [
    ["sample1", "7"],
    ["test01", "0"],
    ["test02", "-1000"],
  ])
    for (const ext of ["in", "out"])
      await writeFile(path.join(dir, "tests", `${stem}.${ext}`), value + "\n");
  console.log(
    `Scaffolded ${dir}. Edit all files and reference solutions, set enabled=true, then run problems:validate.`,
  );
} else {
  const registry = new ProblemRegistry(root);
  await registry.load();
  registry.diagnostics.forEach((d) => console.error(d));
  let failed = registry.diagnostics.length > 0;
  for (const p of registry.problems.values()) {
    if (command === "list") {
      console.log(
        `${p.id} | ${p.difficulty} | ${p.ready ? "READY" : "NEEDS VALIDATION"} | ${p.tests.length} tests`,
      );
      continue;
    }
    if (command !== "validate") throw Error("Expected list, validate or new");
    let passed = true;
    for (const lang of languages) {
      const result = await judge(p, lang, p.solutions[lang], "submit");
      console.log(
        `${p.id} ${lang}: ${result.status} (${result.passedTests}/${result.totalTests})`,
      );
      if (result.status !== "accepted") {
        passed = false;
        failed = true;
      }
    }
    if (passed) {
      const folders = await import("node:fs/promises").then((fs) =>
        fs.readdir(root),
      );
      for (const folder of folders) {
        try {
          const config = JSON.parse(
            await import("node:fs/promises").then((fs) =>
              fs.readFile(path.join(root, folder, "problem.json"), "utf8"),
            ),
          );
          if (config.id === p.id) {
            await writeFile(
              path.join(root, folder, ".validated.json"),
              JSON.stringify(
                {
                  fingerprint: p.fingerprint,
                  languages,
                  validatedAt: new Date().toISOString(),
                },
                null,
                2,
              ),
            );
            break;
          }
        } catch {}
      }
    }
  }
  if (failed) process.exitCode = 1;
}
