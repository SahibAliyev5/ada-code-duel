import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { ProblemRegistry } from "../../backend/src/problems/registry";
import path from "node:path";
test("two browsers join, start, get feedback, win, rematch and reset using real judge", async ({
  browser,
  request,
}) => {
  const health = await request.get("/api/health");
  expect(
    (await health.json()).readyProblems,
    "Validate problems with Docker before this test",
  ).toBeGreaterThan(0);
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  const a = await c1.newPage();
  const b = await c2.newPage();
  try {
    await a.goto("/");
    await b.goto("/");
    await a.getByLabel("Your display name").fill("Ada");
    await a.getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(a.getByText("Your opponent awaits.")).toBeVisible();
    const code = (await a.locator(".room-code-card>div").innerText()).trim();
    await b
      .getByRole("button", { name: "Have a room code? Join Room" })
      .click();
    await b.getByLabel("Your display name").fill("Bob");
    await b.getByLabel("Room code", { exact: true }).fill(code);
    await b.getByRole("button", { name: "Join Room", exact: true }).click();
    await expect(b.getByText("Your opponent awaits.")).toBeVisible();
    await a.getByLabel("Problem", { exact: true }).selectOption("sum-of-two");
    await a.getByLabel("Your language").selectOption("python3");
    await a.getByRole("button", { name: "Start the Race" }).click();
    await expect(
      a.getByRole("heading", { name: "Sum of Two Numbers" }),
    ).toBeVisible();
    await expect(
      b.getByRole("heading", { name: "Sum of Two Numbers" }),
    ).toBeVisible();
    await expect(a.locator(".countdown strong")).toHaveText(/0[45]:\d{2}/);
    const editor = a.getByRole("textbox", { name: "Editor content" });
    await editor.focus();
    await a.keyboard.press("ControlOrMeta+A");
    await a.keyboard.type("print(0)");
    await a.getByRole("button", { name: "Run Code", exact: true }).click();
    await expect(a.getByText("Wrong Answer", { exact: true })).toBeVisible({
      timeout: 60000,
    });
    await editor.focus();
    await a.keyboard.press("ControlOrMeta+A");
    await a.keyboard.insertText(
      await readFile("problems/sum-of-two/solution/main.py", "utf8"),
    );
    await a.getByRole("button", { name: "Submit Solution" }).click();
    await expect(a.getByRole("heading", { name: "Ada wins!" })).toBeVisible({
      timeout: 90000,
    });
    await expect(b.getByRole("heading", { name: "Ada wins!" })).toBeVisible();
    await a.getByRole("button", { name: "Play Again" }).click();
    await expect(a.locator(".match-state")).toContainText("Race in progress");
    const title = await a.locator(".problem-content h1").innerText();
    expect(title).not.toBe("Sum of Two Numbers");
    const registry = new ProblemRegistry(path.resolve("problems"));
    await registry.load();
    const problem = [...registry.problems.values()].find(
      (p) => p.title === title,
    )!;
    await editor.focus();
    await a.keyboard.press("ControlOrMeta+A");
    await a.keyboard.insertText(problem.solutions.python3);
    await a.getByRole("button", { name: "Submit Solution" }).click();
    await expect(a.getByRole("heading", { name: "Ada wins!" })).toBeVisible({
      timeout: 90000,
    });
    await a.getByRole("button", { name: "New Players" }).click();
    await expect(a.getByLabel("Your display name")).toHaveValue("");
    await expect(b.getByLabel("Your display name")).toHaveValue("");
  } finally {
    await c1.close();
    await c2.close();
  }
});
