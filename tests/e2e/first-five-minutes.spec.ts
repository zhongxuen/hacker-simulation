import { expect, test } from "@playwright/test";
import { objectives, prompt } from "./helpers";

/**
 * The first five minutes (md-files/00-overview-and-improvements.md, improvement #13;
 * md-files/11-testing-security-deployment.md, "Testing strategy"): land on the home page, press
 * Start, read a three-line briefing, type a first command, and see the first objective tick with a
 * line that names what you did. It must take a handful of actions, with no sign-up and nothing to
 * read first, and the whole path must fit well inside the two-minute target.
 *
 * Runs on a desktop and on a phone (@mobile).
 */
test("@mobile land, press Start, type a first command, and see the first tick in a handful of actions", async ({
  page,
}) => {
  let actions = 0;
  const act = async (step: () => Promise<void>) => {
    actions += 1;
    await step();
  };
  const startedAt = Date.now();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Hacker Simulation" })).toBeVisible();
  // The simulation framing is there from the very first screen.
  await expect(page.getByText("Nothing here touches a real computer.")).toBeVisible();

  // 1. The one clear Start button.
  await act(() => page.getByRole("link", { name: "Start your first mission" }).click());
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to the team" })).toBeVisible();
  await expect(page.getByText("Your written permission")).toBeVisible();

  // 2. Start mission.
  await act(() => page.getByRole("button", { name: "Start mission" }).click());
  await expect(prompt(page)).toBeVisible({ timeout: 20_000 });

  // 3. The terminal tour's first card says what a terminal is; Next points at the prompt.
  const tour = page.getByRole("dialog", { name: "This is a terminal" });
  await expect(tour).toBeVisible();
  await act(() => tour.getByRole("button", { name: /^Next/ }).click());
  await expect(page.getByRole("dialog", { name: "Your first command" })).toBeVisible();

  // 4. Type the first command.
  await act(async () => {
    await prompt(page).fill("whoami");
    await prompt(page).press("Enter");
  });

  // The objective ticks with a specific success line.
  await expect(objectives(page)).toContainText("You're recruit!");
  const seconds = (Date.now() - startedAt) / 1000;
  test.info().annotations.push({
    type: "first-five-minutes",
    description: `${actions} actions, ${seconds.toFixed(1)} s of machine time from landing to the first tick`,
  });
  expect(actions).toBeLessThanOrEqual(5);
  // A learner reads as they go, so their time is longer than this; the app's own part must be small.
  expect(seconds).toBeLessThan(60);
});

test("the first page asks for nothing: no sign-up, no cookie banner, no cookies", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Start your first mission" })).toBeVisible();
  await expect(page.getByText(/sign up|sign in|log in|create an account/i)).toHaveCount(0);
  await page.getByRole("link", { name: "Start your first mission" }).click();
  await expect(page.getByRole("button", { name: "Start mission" })).toBeVisible();
  expect(await context.cookies()).toEqual([]);
});
