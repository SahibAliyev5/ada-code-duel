import { test, expect } from "@playwright/test";
test("lobby explains missing validated problems when both players are connected", async ({
  browser,
}) => {
  const a = await browser.newPage();
  const b = await browser.newPage();
  try {
    await a.route("**/api/health", (route) =>
      route.fulfill({
        json: { ok: true, readyProblems: 0, clubFairMode: true },
      }),
    );
    await a.route("**/api/problems", (route) => route.fulfill({ json: [] }));
    await a.goto("/");
    await b.goto("/");
    await a.getByLabel("Your display name").fill("Host");
    await a.getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(a.getByText("Your opponent awaits.")).toBeVisible();
    const code = (await a.locator(".room-code-card>div").innerText()).trim();
    await b
      .getByRole("button", { name: "Have a room code? Join Room" })
      .click();
    await b.getByLabel("Your display name").fill("Guest");
    await b.getByLabel("Room code", { exact: true }).fill(code);
    await b.getByRole("button", { name: "Join Room", exact: true }).click();
    await expect(a.locator("#start-feedback")).toContainText(
      "No validated problems",
    );
    await expect(
      a.getByRole("button", { name: "Start the Race" }),
    ).toBeDisabled();
  } finally {
    await a.close();
    await b.close();
  }
});
test("home instructions, invalid joins and responsive layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little code. A friendly rivalry." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "First time here? How to Play" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Let’s race" }).click();
  await page
    .getByRole("button", { name: "Have a room code? Join Room" })
    .click();
  await page.getByLabel("Your display name").fill("Ada");
  await page.getByLabel("Room code", { exact: true }).fill("ABCDEF");
  await page.getByRole("button", { name: "Join Room", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Room not found");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("two browsers render a battle, preserve drafts on refresh, show verdicts and rematch/reset", async ({
  browser,
}) => {
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  const a = await c1.newPage();
  const b = await c2.newPage();
  const errors: string[] = [];
  a.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  const externalRequests: string[] = [];
  a.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:3100") &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith("blob:")
    )
      externalRequests.push(r.url());
  });
  try {
    await a.goto("/");
    await b.goto("/");
    await a.getByLabel("Your display name").fill("Ada");
    await a.getByRole("button", { name: "Create Room", exact: true }).click();
    await expect(a.getByText("Your opponent awaits.")).toBeVisible();
    await expect(a.locator("#start-feedback")).toContainText(
      "Waiting for a second connected player",
    );
    const code = (await a.locator(".room-code-card>div").innerText()).trim();
    await b
      .getByRole("button", { name: "Have a room code? Join Room" })
      .click();
    await b.getByLabel("Your display name").fill("Bob");
    await b.getByLabel("Room code", { exact: true }).fill(code);
    await b.getByRole("button", { name: "Join Room", exact: true }).click();
    await expect(b.getByText("Your opponent awaits.")).toBeVisible();
    await expect(
      a.getByRole("button", { name: "Start the Race" }),
    ).toBeEnabled();
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
    const editor = () => a.getByRole("textbox", { name: "Editor content" });
    await editor().focus();
    await a.keyboard.press("ControlOrMeta+A");
    await a.keyboard.insertText("print(0) # private draft");
    await a.getByLabel("Programming language").selectOption("java17");
    await a.getByLabel("Programming language").selectOption("python3");
    await expect(a.locator(".view-lines")).toContainText("private draft");
    await a.reload();
    await expect(a.locator(".view-lines")).toContainText("private draft");
    await expect(b.locator(".view-lines")).not.toContainText("private draft");
    await a.getByRole("button", { name: "Run Code", exact: true }).click();
    await expect(a.getByText("Wrong Answer", { exact: true })).toBeVisible();
    await editor().focus();
    await a.keyboard.press("ControlOrMeta+A");
    await a.keyboard.insertText("# UI_TEST_ACCEPT");
    await a.getByRole("button", { name: "Submit Solution" }).click();
    await expect(a.getByRole("heading", { name: "Ada wins!" })).toBeVisible();
    await expect(b.getByRole("heading", { name: "Ada wins!" })).toBeVisible();
    await a.screenshot({ path: "test-results/winner.png", fullPage: true });
    await a.getByRole("button", { name: "Play Again" }).click();
    await expect(a.locator(".match-state")).toContainText("Race in progress");
    await editor().focus();
    await a.keyboard.press("ControlOrMeta+A");
    await a.keyboard.insertText("# UI_TEST_ACCEPT");
    await a.getByRole("button", { name: "Submit Solution" }).click();
    await expect(a.getByRole("heading", { name: "Ada wins!" })).toBeVisible();
    await a.getByRole("button", { name: "New Players" }).click();
    await expect(a.getByLabel("Your display name")).toHaveValue("");
    await expect(b.getByLabel("Your display name")).toHaveValue("");
    expect(
      await a.evaluate(() => sessionStorage.getItem("ada-token")),
    ).toBeNull();
    expect(
      await b.evaluate(() => sessionStorage.getItem("ada-draft")),
    ).toBeNull();
    expect(errors).toEqual([]);
    expect(externalRequests).toEqual([]);
  } finally {
    await c1.close();
    await c2.close();
  }
});
