import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, cp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { ProblemRegistry } from "../backend/src/problems/registry";
import { languages } from "../shared/types";
import { normalize } from "../judge/src/docker";
test("26 complete definitions load with all three languages and hidden tests", async () => {
  const r = new ProblemRegistry(path.resolve("problems"));
  await r.load();
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.problems.size, 26);
  for (const p of r.problems.values()) {
    assert.ok(p.tests.length >= 5);
    assert.equal(p.samples.length, 1);
    for (const l of languages) {
      assert.ok(p.starters[l]);
      assert.ok(p.solutions[l]);
    }
  }
});
test("new folder discovery, certificate invalidation, disabling and malformed diagnostics", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ada-registry-"));
  try {
    await cp("problems/even-or-odd", path.join(root, "new-question"), {
      recursive: true,
    });
    const file = path.join(root, "new-question", "problem.json");
    const config = JSON.parse(await readFile(file, "utf8"));
    config.id = "new-question";
    await writeFile(file, JSON.stringify(config));
    const r = new ProblemRegistry(root);
    await r.load();
    assert.equal(r.problems.size, 1);
    const p = r.problems.get("new-question")!;
    assert.equal(p.ready, false);
    await writeFile(
      path.join(root, "new-question", ".validated.json"),
      JSON.stringify({ fingerprint: p.fingerprint, languages }),
    );
    await r.load();
    assert.equal(r.eligible().length, 1);
    await writeFile(
      path.join(root, "new-question", "tests", "test01.out"),
      "broken\n",
    );
    await r.load();
    assert.equal(r.eligible().length, 0);
    config.enabled = false;
    await writeFile(file, JSON.stringify(config));
    await r.load();
    assert.equal(r.problems.size, 0);
    await writeFile(file, "{}");
    await r.load();
    assert.equal(r.diagnostics.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("normalization ignores trailing whitespace while preserving meaningful leading spaces", () => {
  assert.equal(normalize("a  \r\nb\n\n"), "a\nb");
  assert.notEqual(normalize(" a"), normalize("a"));
});
test("duplicate IDs remove every conflicting definition from live eligibility", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ada-duplicates-"));
  try {
    await cp("problems/even-or-odd", path.join(root, "first"), {
      recursive: true,
    });
    await cp("problems/even-or-odd", path.join(root, "second"), {
      recursive: true,
    });
    const r = new ProblemRegistry(root);
    await r.load();
    assert.equal(r.problems.size, 0);
    assert.match(r.diagnostics[0], /Duplicate problem ID/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
