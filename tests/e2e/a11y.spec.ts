import { readdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { objectives, run, startMission } from "./helpers";

/**
 * Accessibility on every route (md-files/remaining.md, Part 2, "Security posture": axe in
 * Playwright, every route, zero serious or critical violations), and the states a learner
 * spends most time in: a mission's workspace with the map, the mentor's panel, the debrief, the
 * search palette. Every lesson and every mission is checked, read from their folders so a new
 * one is covered without anyone remembering to add it.
 *
 * axe finds what a machine can: missing names, contrast, roles, structure. It can't say whether a
 * page makes sense with a screen reader; that's A7 in md-files/remaining.md, which a person does.
 */

const LESSONS = readdirSync(join(process.cwd(), "src", "content", "lessons"))
  .filter((name) => name.endsWith(".mdx"))
  .map((name) => `/learn/${name.replace(/\.mdx$/, "")}`);

/** Read from the mission files, so a new mission is checked without anyone remembering to add it. */
const MISSIONS = readdirSync(join(process.cwd(), "src", "content", "missions"))
  .filter((name) => name.endsWith(".yaml"))
  .map((name) => `/missions/${name.replace(/\.yaml$/, "")}`);

const ROUTES = [
  "/",
  "/privacy",
  "/campaign",
  "/missions",
  ...MISSIONS,
  "/sandbox",
  "/terminal",
  "/network",
  "/learn",
  "/learn/glossary",
  "/learn/commands",
  "/settings",
  "/this-page-does-not-exist",
  ...LESSONS,
];

/** The app's pages, which all carry the SIMULATED marker in the top bar. */
const APP_ROUTES = ROUTES.filter(
  (route) => !["/", "/privacy", "/this-page-does-not-exist"].includes(route),
);

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      where: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    }));
}

test.describe.configure({ mode: "parallel" });

for (const route of ROUTES) {
  test(`axe: ${route} has no serious or critical violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test.describe("states inside a mission", () => {
  test("axe: the workspace, with the terminal, the map and output", async ({ page }) => {
    await startMission(page, "net-01");
    await run(page, "ifconfig");
    await run(page, "netscan 10.40.1.0/24");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: the mentor's panel with a hint, and the reference drawer", async ({ page }) => {
    await startMission(page, "net-01");
    await objectives(page).getByRole("button", { name: "Show me a hint" }).first().click();
    await expect(page.getByRole("dialog", { name: /Noor/ })).toContainText("Before you look");
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole("button", { name: "Reference", exact: true }).click();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: the debrief", async ({ page }) => {
    await startMission(page, "intro-01");
    await run(page, "whoami");
    await run(page, "ls");
    await run(page, "cat scope-letter.txt");
    await page.getByRole("button", { name: "Wait for Roz to sign the letter" }).click();
    await page
      .getByRole("button", { name: "Every computer on the Range, 192.168.60.0/24", exact: true })
      .click();
    await page.getByRole("button", { name: "See your debrief" }).click();
    await expect(page.getByRole("main")).toContainText("Welcome to the team");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("axe: the search palette, open with results", async ({ page }) => {
    await page.goto("/learn");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Search the app" }).getByRole("combobox").fill("port");
    await expect(page.getByRole("option").first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe("the simulation framing", () => {
  for (const route of APP_ROUTES.filter(
    (route) => !route.startsWith("/learn/") || route === "/learn/glossary",
  )) {
    test(`${route} shows the SIMULATED marker, and nothing can dismiss it`, async ({ page }) => {
      await page.goto(route);
      const marker = page.getByRole("banner").getByRole("button", { name: "Simulated" });
      await expect(marker).toBeVisible();
      await page.keyboard.press("Escape");
      await marker.click();
      await page.keyboard.press("Escape");
      await expect(marker).toBeVisible();
    });
  }

  test("every terminal and the map carry their own SIMULATED marker", async ({ page }) => {
    await startMission(page, "net-01");
    await expect(
      page.getByRole("region", { name: "Terminal" }).getByRole("button", { name: "Simulated" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Network map" }).getByRole("button", { name: "Simulated" }),
    ).toBeVisible();
  });
});
