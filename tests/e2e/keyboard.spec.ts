import { expect, test, type Page } from "@playwright/test";
import { prompt } from "./helpers";

/**
 * Keyboard only, no mouse (md-files/00-overview-and-improvements.md, improvement #8; the Definition
 * of done in phases 02, 05 and 07): the shell has no focus traps, the sandbox can be played start
 * to finish with keys, and the network map is explored with the arrow keys. A human keyboard pass
 * is still on the launch checklist; these keep the basics from breaking.
 */

/** What has focus, in words a failure message can show. */
async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return "body";
    const label = (element as HTMLInputElement).labels?.[0]?.textContent;
    const name = (element.getAttribute("aria-label") ?? label ?? element.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return `${element.tagName.toLowerCase()} "${name}"`;
  });
}

/** Whether the focused element can be seen: something a sighted keyboard user can follow. */
async function focusIsVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return true;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
}

/** Presses Tab until `match` has focus, or gives up after `limit` presses. */
async function tabTo(page: Page, match: (description: string) => boolean, limit = 60) {
  for (let press = 0; press < limit; press += 1) {
    if (match(await focused(page))) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached the target; focus ended on ${await focused(page)}`);
}

test("the shell: skip link first, every stop visible, no trap, and Tab reaches the page", async ({
  page,
}) => {
  await page.goto("/campaign");
  await page.keyboard.press("Tab");
  expect(await focused(page)).toContain("Skip to main content");

  const stops: string[] = [];
  for (let press = 0; press < 40; press += 1) {
    await page.keyboard.press("Tab");
    stops.push(await focused(page));
    expect(await focusIsVisible(page), `focus on ${stops.at(-1)} can't be seen`).toBe(true);
  }
  // Focus keeps moving: no element holds it (a trap would repeat one stop over and over).
  expect(new Set(stops).size).toBeGreaterThan(15);
  // And it gets past the sidebar into the page itself.
  expect(stops.some((stop) => stop.includes("Start your first mission"))).toBe(true);

  // Shift+Tab walks back the same way.
  const before = await focused(page);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBe(before);
});

test("the skip link moves focus to the page's content", async ({ page }) => {
  await page.goto("/learn");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  // The next stop is inside the page, not the sidebar.
  const inMain = await page.evaluate(() => Boolean(document.activeElement?.closest("main")));
  expect(inMain).toBe(true);
});

test("the sandbox with keys only: pick a machine, scan, and explore the map", async ({ page }) => {
  await page.goto("/sandbox");
  await expect(page.getByRole("radio", { name: /^Small network/ })).toBeEnabled();

  // Tab to the machine picker, then the arrow keys choose within it, as with any radio group.
  await tabTo(page, (stop) => stop.startsWith('input "Single computer'));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /^Small network/ })).toBeChecked();

  // On to the prompt, and type.
  await tabTo(page, (stop) => stop.startsWith('input "Command, in'));
  await page.keyboard.type("netscan 192.168.60.0/24");
  await page.keyboard.press("Enter");
  const map = page.getByRole("region", { name: "Network map" });
  await expect(map.getByRole("button", { name: /Found/ }).first()).toBeVisible();

  // Leave the terminal the way it tells you to (Escape, then Tab), and reach the map.
  await page.keyboard.press("Escape");
  await tabTo(page, (stop) => /"[\w-]+, 192\.168\.60\.\d+/.test(stop), 80);
  // The arrow keys move to the nearest computer in that direction, so try each way until one does.
  const first = await focused(page);
  let second = first;
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    await page.keyboard.press(key);
    second = await focused(page);
    if (second !== first) break;
  }
  expect(second).not.toBe(first);
  expect(second).toMatch(/192\.168\.60\.\d+/);

  // Enter opens that computer's details.
  await page.keyboard.press("Enter");
  const host = /"([\w-]+), /.exec(second)?.[1] ?? "";
  await expect(page.getByRole("main")).toContainText(host);
  await expect(prompt(page)).toBeVisible();
});
