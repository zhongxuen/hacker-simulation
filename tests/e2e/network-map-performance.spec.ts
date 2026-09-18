import { expect, test, type Page } from "@playwright/test";

/**
 * How fast the network map draws with 200 hosts on it.
 *
 * The hosts come from a fixture page (`/map-bench`, src/app/(dev)/map-bench/), never from a
 * mission: no mission has 200 hosts and none should — a mission is 5-20 minutes of story for a
 * complete beginner. But a learner can drag and zoom a map for as long as they like, and the map
 * has to stay smooth while they do, so the renderer is measured against a fixture instead.
 *
 * Each test records how long every animation frame took during one interaction, then checks the
 * slow end of that spread (p90) against a budget and prints the numbers, so a regression shows up
 * as a number that moved, not just a red test.
 *
 * Frames are counted with requestAnimationFrame: a callback runs once per frame the browser paints,
 * so the gaps between callbacks are the frame times. Work that blocks the main thread stretches
 * those gaps, which is exactly what a slow renderer does to a drag.
 */

/** Everything is measured at this size, so numbers from different runs compare. */
const HOSTS = 200;

/**
 * The budget, in milliseconds per frame, at the slow end (p90).
 *
 * Frames come at the display's rate, so on a 60 Hz screen a frame time is 16.7 ms, or 33.3 ms when
 * one was dropped, or 50 ms when two were — there are no values in between. A p90 of 25 ms
 * therefore means something exact: more than one frame in ten was dropped. It sits between the two
 * steps deliberately, so it can't be crept past.
 *
 * Measured here on a desktop Chromium: pan and zoom hold 16.7 ms (60 fps); the reveal holds
 * 16.8 ms once the entrance animations are bounded (MAX_POPPING_NODES in topology-graph.tsx).
 * Before that bound, the reveal measured p90 33.4 ms and 44 fps — which this budget catches and a
 * looser one would not.
 *
 * If a change pushes a number over this, fix the renderer. Raising the budget hides the thing the
 * test exists to catch.
 */
const FRAME_BUDGET_MS = 25;

/** Frames are only worth reading if enough of them were recorded. */
const MIN_FRAMES = 20;

interface FrameStats {
  readonly frames: number;
  readonly p50: number;
  readonly p90: number;
  readonly worst: number;
  readonly fps: number;
}

declare global {
  interface Window {
    __frameTimes?: number[];
    __stopFrames?: () => number[];
  }
}

/** Starts recording frame times in the page. Anything before this call is ignored. */
async function startRecording(page: Page): Promise<void> {
  await page.evaluate(() => {
    const times: number[] = [];
    let previous = performance.now();
    let running = true;
    const tick = (now: number) => {
      times.push(now - previous);
      previous = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__frameTimes = times;
    window.__stopFrames = () => {
      running = false;
      return times;
    };
  });
}

function summarise(times: readonly number[]): FrameStats {
  // The first two gaps span the setup call and the frame the interaction started on, which measure
  // the test harness rather than the map.
  const measured = [...times.slice(2)].sort((a, b) => a - b);
  const at = (fraction: number) =>
    measured[Math.min(measured.length - 1, Math.floor(measured.length * fraction))] ?? 0;
  const total = measured.reduce((sum, value) => sum + value, 0);
  return {
    frames: measured.length,
    p50: at(0.5),
    p90: at(0.9),
    worst: measured[measured.length - 1] ?? 0,
    fps: total > 0 ? (measured.length / total) * 1000 : 0,
  };
}

/** Stops recording and reports. The numbers are printed whether the test passes or fails. */
async function report(page: Page, what: string): Promise<FrameStats> {
  const times = await page.evaluate(() => window.__stopFrames?.() ?? []);
  const stats = summarise(times);
  const ms = (value: number) => `${value.toFixed(1)} ms`;
  const line =
    `network map @ ${HOSTS} hosts — ${what}: ` +
    `${stats.frames} frames, median ${ms(stats.p50)}, p90 ${ms(stats.p90)}, ` +
    `worst ${ms(stats.worst)}, ${stats.fps.toFixed(1)} fps ` +
    `(budget: p90 under ${FRAME_BUDGET_MS} ms)`;
  console.log(line);
  await test.info().attach(`frame-rate-${what.replaceAll(/\W+/g, "-")}`, {
    body: JSON.stringify({ what, hosts: HOSTS, budgetMs: FRAME_BUDGET_MS, ...stats }, null, 2),
    contentType: "application/json",
  });
  return stats;
}

function expectSmooth(stats: FrameStats, what: string): void {
  expect(stats.frames, `too few frames to judge ${what}`).toBeGreaterThanOrEqual(MIN_FRAMES);
  expect(
    stats.p90,
    `${what}: p90 frame took ${stats.p90.toFixed(1)} ms, over the ${FRAME_BUDGET_MS} ms budget. ` +
      "Fix the renderer rather than the budget.",
  ).toBeLessThanOrEqual(FRAME_BUDGET_MS);
}

/** Opens the bench and waits until the map has drawn every host it was asked for. */
async function openBench(page: Page, shown: number): Promise<void> {
  await page.goto(`/map-bench?hosts=${HOSTS}&shown=${shown}`);
  await expect(page.locator(`[data-bench-shown="${shown}"]`)).toBeVisible();
  await expect(page.getByRole("group", { name: "Network map" })).toBeVisible();
  await expect(page.locator("[data-host-id]")).toHaveCount(shown);
}

// Only against the server this config starts: a deployment doesn't serve the bench (see
// src/app/(dev)/dev-only.ts), and frame times off a shared network mean nothing anyway.
test.describe("network map frame rate", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "the bench is not served by a deployment");
  test.skip(({ browserName }) => browserName !== "chromium", "measured on one engine only");

  test("stays smooth while panning 200 hosts", async ({ page }) => {
    await openBench(page, HOSTS);
    const map = page.getByRole("group", { name: "Network map" });
    const box = (await map.boundingBox())!;
    const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await page.mouse.move(middle.x, middle.y);
    await page.mouse.down();
    await startRecording(page);
    // A drag across the map in small steps, the way a hand moves: each step is a pointermove the
    // renderer has to answer within a frame.
    for (let step = 1; step <= 60; step += 1) {
      await page.mouse.move(middle.x - step * 4, middle.y + Math.sin(step / 6) * 40);
    }
    const stats = await report(page, "pan");
    await page.mouse.up();

    expectSmooth(stats, "panning");
  });

  test("stays smooth while zooming 200 hosts", async ({ page }) => {
    await openBench(page, HOSTS);
    const map = page.getByRole("group", { name: "Network map" });
    const box = (await map.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await startRecording(page);
    for (let step = 0; step < 24; step += 1) {
      await page.mouse.wheel(0, step < 12 ? -120 : 120);
    }
    const stats = await report(page, "zoom");

    expectSmooth(stats, "zooming");
  });

  test("stays smooth while 200 hosts appear at once", async ({ page }) => {
    // The worst reveal there is: a handful of hosts on the map, then every other one arrives in a
    // single update, each with its entrance animation.
    await openBench(page, 8);

    await startRecording(page);
    await page.getByRole("button", { name: "Reveal all" }).click();
    await expect(page.locator(`[data-bench-shown="${HOSTS}"]`)).toBeVisible();
    await expect(page.locator("[data-host-id]")).toHaveCount(HOSTS);
    // Let the entrance animations run, so the frames that draw them are counted too.
    await page.waitForTimeout(1000);
    const stats = await report(page, "reveal");

    expectSmooth(stats, "revealing");
  });
});
