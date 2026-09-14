import { expect, test } from "@playwright/test";
import { objectives, prompt, run, startMission } from "./helpers";

/**
 * One happy path per module (md-files/00-overview-and-improvements.md, improvement #10;
 * md-files/11-testing-security-deployment.md, "Testing strategy"), each the way a first-time
 * learner would use it.
 */

test.describe("Campaign", () => {
  test("shows chapter 1 in order, with Start here, and every mission open", async ({ page }) => {
    await page.goto("/campaign");
    await expect(page.getByRole("heading", { level: 2, name: "First shift" })).toBeVisible();
    const missions = page.getByRole("list", { name: "Chapter 1 missions" }).getByRole("link");
    await expect(missions).toHaveCount(3);
    await expect(missions.first()).toContainText("Start here");
    await missions.nth(2).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Mapping the network" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start mission" })).toBeEnabled();
  });
});

test.describe("Missions", () => {
  test("filters the list by skill and level", async ({ page }) => {
    await page.goto("/missions");
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(3);
    await page
      .getByRole("group", { name: "Skill" })
      .getByRole("button", { name: "Networking" })
      .click();
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("listitem")).toContainText("Mapping the network");
  });

  test("a wrong answer is safe: a teammate explains, and you pick again", async ({ page }) => {
    await startMission(page, "intro-01");
    await run(page, "whoami");
    await run(page, "ls");
    await run(page, "cat scope-letter.txt");
    await page.getByRole("button", { name: "Take a look at the bakery's server now" }).click();
    await expect(page.getByRole("main")).toContainText("isn't ours to touch");
    await page.getByRole("button", { name: "Wait for Roz to sign the letter" }).click();
    await expect(objectives(page)).toContainText("You waited for permission.");
  });

  test("asks before leaving a mission in progress, and Stay keeps the run", async ({ page }) => {
    await startMission(page, "intro-01");
    await run(page, "whoami");
    await page
      .getByRole("link", { name: /^Campaign/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Leave this mission?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Stay in the mission" }).click();
    await expect(page).toHaveURL(/\/missions\/intro-01$/);
    await expect(objectives(page)).toContainText("You're recruit!");
  });
});

test.describe("Terminal", () => {
  test("runs commands on the practice computer and offers the tour", async ({ page }) => {
    await page.goto("/terminal");
    const block = await run(page, "ls");
    await expect(block).toContainText("README.txt");
    await page.getByRole("button", { name: "Take the one-minute tour" }).click();
    await expect(page.getByRole("dialog", { name: "This is a terminal" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "This is a terminal" })).toHaveCount(0);
  });
});

test.describe("Sandbox", () => {
  test("switches to the small network, and the map lights up after a scan", async ({ page }) => {
    await page.goto("/sandbox");
    // The radio is inside its label, which is what a learner clicks, once the picker is ready.
    await expect(page.getByRole("radio", { name: /^Small network/ })).toBeEnabled();
    await page.locator("label").filter({ hasText: "Small network" }).click();
    await expect(page.getByRole("radio", { name: /^Small network/ })).toBeChecked();
    await expect(page.getByRole("region", { name: "Network map" })).toBeVisible();
    await run(page, "netscan 192.168.60.0/24");
    await expect(
      page
        .getByRole("region", { name: "Network map" })
        .getByRole("button", { name: /Found/ })
        .first(),
    ).toBeVisible();
  });
});

test.describe("Network visualizer", () => {
  test("shows what's found, as a drawing or a table, and a computer's details", async ({
    page,
  }) => {
    await startMission(page, "net-01");
    await run(page, "netscan 10.40.1.0/24");
    const map = page.getByRole("region", { name: "Network map" });
    const host = map.getByRole("button", { name: /^pos-01, 10\.40\.1\.10/ });
    await expect(host).toBeVisible();
    // Never says what's left to find.
    await expect(map).toContainText("keep scanning to find more");
    await host.click();
    await expect(page.getByRole("main")).toContainText("10.40.1.10");
    await map.getByRole("button", { name: "Table" }).click();
    await expect(map.getByRole("table", { name: /Computers you've found/ })).toContainText(
      "pos-01",
    );
  });
});

test.describe("Learning Center", () => {
  test("a lesson: the quiz explains its answer, and the practice terminal works", async ({
    page,
  }) => {
    await page.goto("/learn");
    await page.getByRole("link", { name: /^Finding your way around the file system/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Finding your way around the file system" }),
    ).toBeVisible();

    const quiz = page.getByRole("region", { name: "Which of these is a full path to a file?" });
    await quiz.locator("label").filter({ hasText: "/home/recruit/todo.txt" }).click();
    await quiz.getByRole("button", { name: "Check my answer" }).click();
    await expect(quiz).toContainText(/right|yes|correct/i);

    // The practice terminal's code loads after the page (prompt 11.3); it must still work.
    const block = await run(page, "pwd");
    await expect(block).toContainText("/home/recruit");
  });

  test("the glossary filters as you type", async ({ page }) => {
    await page.goto("/learn/glossary");
    await page.getByRole("searchbox", { name: "Search the glossary" }).fill("port");
    await expect(page.getByRole("main")).toContainText(/numbered door|port/i);
  });

  test("the command manual has every command's page", async ({ page }) => {
    await page.goto("/learn/commands");
    await expect(page.getByRole("main")).toContainText("netscan");
    await expect(page.getByRole("main")).toContainText("whoami");
  });

  test("⌘K / Ctrl+K searches lessons, words and commands from anywhere", async ({ page }) => {
    await page.goto("/campaign");
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Search the app" });
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox").fill("ports and services");
    await expect(palette.getByRole("option", { name: /Ports and services/ }).first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/learn\/net-ports$/);
  });
});

test.describe("AI mentor", () => {
  test("gives the hint written for the step, free, when the model isn't there", async ({
    page,
  }) => {
    await startMission(page, "net-01");
    await objectives(page).getByRole("button", { name: "Show me a hint" }).first().click();
    const panel = page.getByRole("dialog", { name: /Noor/ });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Hints are free");
    await expect(panel).toContainText("Before you look at other computers");
  });

  test("an over-limit request (429) still gets the written hint, never an error", async ({
    page,
  }) => {
    await page.route("**/api/mentor/**", (route) =>
      route.fulfill({ status: 429, body: "Too many requests" }),
    );
    await startMission(page, "net-01");
    await objectives(page).getByRole("button", { name: "Show me a hint" }).first().click();
    const panel = page.getByRole("dialog", { name: /Noor/ });
    await expect(panel).toContainText("Before you look at other computers");
    await expect(panel).not.toContainText(/error|went wrong|429/i);
  });

  test("the reference drawer opens over the workspace without touching the terminal", async ({
    page,
  }) => {
    await startMission(page, "net-01");
    await run(page, "ifconfig");
    await page.getByRole("button", { name: "Reference" }).click();
    await page.getByRole("button", { name: "Close the reference" }).click();
    await expect(page.getByRole("region", { name: "Command: ifconfig" })).toBeVisible();
    await expect(objectives(page)).toContainText("Done:");
  });
});

test.describe("Settings and privacy", () => {
  test("a setting applies at once, survives a reload, and Reset puts it back", async ({ page }) => {
    await page.goto("/settings");
    const beginner = page.getByRole("switch", { name: "Show beginner help in the terminal" });
    await expect(beginner).toBeChecked();
    // The switch is inside its row's label, which is what a learner clicks.
    await page.locator("label").filter({ hasText: "Show beginner help in the terminal" }).click();
    await expect(beginner).not.toBeChecked();
    await page.reload();
    await expect(
      page.getByRole("switch", { name: "Show beginner help in the terminal" }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "Reset settings" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "back to how they started" }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Show beginner help in the terminal" }),
    ).toBeChecked();
  });

  test("What we store says exactly what's kept, and that nothing uses cookies", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "What we store" })).toBeVisible();
    for (const heading of [
      "Your settings",
      "Anonymous counts",
      "Never stored, anywhere",
      "No cookies",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});

test.describe("Errors and missing pages", () => {
  test("an address that isn't a page says so kindly, and offers somewhere to go", async ({
    page,
  }) => {
    const response = await page.goto("/missions/no-such-mission");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "There's no page at this address" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Start your first mission" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome to the team" }),
    ).toBeVisible();
  });
});

test("@mobile the terminal works on a phone", async ({ page }) => {
  await page.goto("/terminal");
  const block = await run(page, "whoami");
  await expect(block).toContainText("recruit");
  await expect(prompt(page)).toBeVisible();
});
