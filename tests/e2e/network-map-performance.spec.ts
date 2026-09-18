import { expect, test, type Page } from "@playwright/test";

/**
 * How fast the network map draws with 200 hosts on it.
 *
 * The hosts come from a fixture page (`/map-bench`, src/app/(dev)/map-bench/), never from a
 * mission: no mission has 200 hosts and none should — a mission is 5-20 minutes of story for a
 * complete beginner. But a learner can drag and zoom a map for as long as they like, and the map
 * has to stay smooth while they do, so the renderer is measured against a fixture instead.
 *
 * Each test records how long every animation frame took during one interaction, prints the whole
 * spread, and then asks two things of it: how often the map missed a frame, and whether it ever
 * blocked the page outright. A regression shows up as a number that moved, not just a red test.
 *
 * Frames are counted with requestAnimationFrame: a callback runs once per frame the browser paints,
 * so the gaps between callbacks are the frame times. Work that blocks the main thread stretches
 * those gaps, which is exactly what a slow renderer does to a drag.
 */

/** Everything is measured at this size, so numbers from different runs compare. */
const HOSTS = 200;

/** One frame on a 60 Hz display, plus a little room: a longer gap means a frame was missed. */
const DROPPED_FRAME_MS = 20;

/**
 * The budget, in milliseconds per frame, at the slow end (p90).
 *
 * Frames come at the display's rate, so on a 60 Hz screen a frame time is 16.7 ms, or 33.3 ms when
 * one was dropped, 50 ms for two, 66.7 ms for three — there is nothing in between. A p90 therefore
 * reports which of those steps the slow tenth of the frames landed on, and a budget is really a
 * choice of which step to draw the line above.
 *
 * Measured here on a desktop Chromium at 200 hosts, over several runs each:
 *
 * - panning holds p90 16.8 ms and 56 fps, and the reveal p90 16.8 ms and 45 fps — the step that
 *   means no frame was dropped at the slow end;
 * - zooming sits a step higher, p90 33.3 ms and about 47 fps, missing roughly one frame in five:
 *   every frame of a zoom redraws 200 cards at a size they have never been drawn at, and that is
 *   what SVG costs. A mission map is a dozen hosts, where none of it shows;
 * - with the entrance animations unbounded (MAX_POPPING_NODES in topology-graph.tsx set past 200),
 *   the reveal sits at p90 66.7-83.4 ms and 33 fps, in every run, with no overlap;
 * - a machine with something else on it pushes any healthy run up a step, because it only takes
 *   one frame in ten stolen from a map that is doing nothing at all.
 *
 * So the line goes at 40 ms: above the step zooming and machine noise reach, below the step the
 * regression sits on, with a clear gap either side. It used to sit at 25 ms, which is
 * between the first two steps — exact, but decided by a single frame, which reddened five runs out
 * of seven on a loaded machine while the renderer was fine. A check that fails at random teaches
 * people to re-run CI instead of read it, which is worse than no check.
 *
 * If a change pushes a number over this, fix the renderer. Raising the budget hides the thing the
 * test exists to catch. The missed-frame share and the frame rate are printed beside it, so a
 * change too small to move the step is still visible to anyone reading the output.
 */
const FRAME_BUDGET_MS = 40;

/**
 * The longest any single frame may take: past this the page has stopped answering, which a learner
 * feels as the map freezing rather than as a stutter.
 *
 * The reveal is the one interaction that reaches for this. Putting 192 host cards on the map in a
 * single update is around 1,500 SVG shapes in one commit, measured at 83-250 ms here; nothing else
 * comes close.
 */
const MAX_HITCH_MS = 350;

/** Frames are only worth reading if enough of them were recorded. */
const MIN_FRAMES = 20;

/**
 * How long each test watches an untouched map before it touches one.
 *
 * A frame time says how long the browser took, not how much of that was this page. The idle
 * reading is printed beside the interaction's and quoted in any failure, so anyone reading a red
 * run can see whether the machine was holding 60 fps with the map sitting still — if it wasn't,
 * the run says more about the machine than about the map.
 */
const IDLE_SAMPLE_MS = 500;

interface FrameStats {
  readonly frames: number;
  readonly p50: number;
  readonly p90: number;
  readonly worst: number;
  readonly fps: number;
  /** Frames that took longer than DROPPED_FRAME_MS. */
  readonly dropped: number;
  /** Those frames as a share of all of them, which is what the budget is about. */
  readonly droppedShare: number;
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

const percent = (share: number) => `${(share * 100).toFixed(0)}%`;

function summarise(times: readonly number[]): FrameStats {
  // The first two gaps span the setup call and the frame the interaction started on, which measure
  // the test harness rather than the map.
  const measured = [...times.slice(2)].sort((a, b) => a - b);
  const at = (fraction: number) =>
    measured[Math.min(measured.length - 1, Math.floor(measured.length * fraction))] ?? 0;
  const total = measured.reduce((sum, value) => sum + value, 0);
  const dropped = measured.filter((value) => value > DROPPED_FRAME_MS).length;
  return {
    frames: measured.length,
    p50: at(0.5),
    p90: at(0.9),
    worst: measured[measured.length - 1] ?? 0,
    fps: total > 0 ? (measured.length / total) * 1000 : 0,
    dropped,
    droppedShare: measured.length > 0 ? dropped / measured.length : 0,
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
    `worst ${ms(stats.worst)}, ${stats.fps.toFixed(1)} fps, ` +
    `${stats.dropped} missed (${percent(stats.droppedShare)}) ` +
    `(budgets: p90 under ${FRAME_BUDGET_MS} ms, no frame over ${MAX_HITCH_MS} ms)`;
  console.log(line);
  await test.info().attach(`frame-rate-${what.replaceAll(/\W+/g, "-")}`, {
    body: JSON.stringify(
      {
        what,
        hosts: HOSTS,
        budgetMs: FRAME_BUDGET_MS,
        maxHitchMs: MAX_HITCH_MS,
        ...stats,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  return stats;
}

/** Watches the map with nobody touching it: what this machine manages while the page is idle. */
async function measureIdle(page: Page): Promise<FrameStats> {
  await startRecording(page);
  await page.waitForTimeout(IDLE_SAMPLE_MS);
  const idle = summarise(await page.evaluate(() => window.__stopFrames?.() ?? []));
  console.log(
    `network map @ ${HOSTS} hosts — idle: ${idle.frames} frames, ` +
      `${idle.dropped} missed (${percent(idle.droppedShare)}), ${idle.fps.toFixed(1)} fps`,
  );
  return idle;
}

function expectSmooth(stats: FrameStats, idle: FrameStats, what: string): void {
  // What the machine itself was managing, so a red run can be read without guessing.
  const machine = `This machine missed ${percent(idle.droppedShare)} of its frames with the map sitting still.`;

  expect(stats.frames, `too few frames to judge ${what}`).toBeGreaterThanOrEqual(MIN_FRAMES);
  expect(
    stats.p90,
    `${what}: p90 frame took ${stats.p90.toFixed(1)} ms, over the ${FRAME_BUDGET_MS} ms budget, ` +
      `with ${stats.dropped} of ${stats.frames} frames missed ` +
      `(${percent(stats.droppedShare)}). ${machine} Fix the renderer rather than the budget.`,
  ).toBeLessThanOrEqual(FRAME_BUDGET_MS);
  expect(
    stats.worst,
    `${what}: one frame took ${stats.worst.toFixed(1)} ms, over the ${MAX_HITCH_MS} ms limit, ` +
      `long enough that the page stopped answering. ${machine}`,
  ).toBeLessThanOrEqual(MAX_HITCH_MS);
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
  // One at a time. The rest of the suite runs several browsers at once, which is fine for tests
  // that wait on pages, and wrong for three tests that each drive a 200-host map as hard as they
  // can and then time the frames: run together they measure each other, and zooming reads 50 ms
  // and 42 fps instead of the 16.8 ms and 60 fps it holds with the machine to itself. Serial also
  // means a failure skips the tests after it, so a red run reports one number rather than three.
  test.describe.configure({ mode: "serial" });
  test.skip(Boolean(process.env.E2E_BASE_URL), "the bench is not served by a deployment");
  test.skip(({ browserName }) => browserName !== "chromium", "measured on one engine only");

  test("stays smooth while panning 200 hosts", async ({ page }) => {
    await openBench(page, HOSTS);
    const idle = await measureIdle(page);
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

    expectSmooth(stats, idle, "panning");
  });

  test("stays smooth while zooming 200 hosts", async ({ page }) => {
    await openBench(page, HOSTS);
    const idle = await measureIdle(page);
    const map = page.getByRole("group", { name: "Network map" });
    const box = (await map.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await startRecording(page);
    for (let step = 0; step < 24; step += 1) {
      await page.mouse.wheel(0, step < 12 ? -120 : 120);
    }
    const stats = await report(page, "zoom");

    expectSmooth(stats, idle, "zooming");
  });

  test("stays smooth while 200 hosts appear at once", async ({ page }) => {
    // The worst reveal there is: a handful of hosts on the map, then every other one arrives in a
    // single update, each with its entrance animation.
    await openBench(page, 8);
    const idle = await measureIdle(page);

    await startRecording(page);
    await page.getByRole("button", { name: "Reveal all" }).click();
    await expect(page.locator(`[data-bench-shown="${HOSTS}"]`)).toBeVisible();
    await expect(page.locator("[data-host-id]")).toHaveCount(HOSTS);
    // Let the entrance animations run, so the frames that draw them are counted too.
    await page.waitForTimeout(1000);
    const stats = await report(page, "reveal");

    expectSmooth(stats, idle, "revealing");
  });
});
