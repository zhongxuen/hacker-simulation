import { expect, test } from "@playwright/test";
import { run, startMission } from "./helpers";

/**
 * The app's own security and privacy, checked on the real production server
 * (md-files/11-testing-security-deployment.md, "Security review of this app"; prompt 11.2): the
 * headers on real responses, no Content Security Policy violation while a learner uses the app,
 * the mentor routes refusing other sites, and nothing about the learner left in the browser.
 */

const PAGES = ["/", "/campaign", "/missions/net-01", "/learn/net-ports", "/terminal", "/settings"];

test.describe("security headers", () => {
  for (const path of PAGES) {
    test(`${path} is sent with the security headers and a CSP without eval`, async ({
      request,
    }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      const csp = headers["content-security-policy"] ?? "";
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).not.toContain("unsafe-eval");
      expect(headers["strict-transport-security"]).toContain("max-age=");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["permissions-policy"]).toContain("camera=()");
      expect(headers["x-powered-by"]).toBeUndefined();
      expect(headers["set-cookie"]).toBeUndefined();
    });
  }

  test("the mentor routes send them too, and never cache an answer", async ({ request }) => {
    const response = await request.post("/api/mentor/hint", {
      data: { missionId: "net-01", objectiveId: "map-staff", tier: 1, transcript: [] },
    });
    expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });
});

test.describe("the mentor routes", () => {
  test("refuse a request from another site, before any model call", async ({ request }) => {
    const response = await request.post("/api/mentor/hint", {
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      data: { missionId: "net-01", objectiveId: "map-staff", tier: 1, transcript: [] },
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).toContain('"reason":"cross_site"');
  });

  test("refuse a body that isn't JSON, and one that's too large", async ({ request }) => {
    const plain = await request.post("/api/mentor/hint", {
      headers: { "content-type": "text/plain" },
      data: JSON.stringify({ missionId: "net-01", objectiveId: "map-staff", tier: 1 }),
    });
    expect(plain.status()).toBe(415);
    const huge = await request.post("/api/mentor/hint", {
      data: {
        missionId: "net-01",
        objectiveId: "map-staff",
        tier: 1,
        transcript: [{ input: "x", output: "y".repeat(40_000) }],
      },
    });
    expect(huge.status()).toBe(413);
  });

  test("answer GET with 405: there's nothing to read", async ({ request }) => {
    expect((await request.get("/api/mentor/hint")).status()).toBe(405);
  });
});

test("using the app breaks no Content Security Policy rule, and logs no errors", async ({
  page,
}) => {
  const problems: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __csp: string[] }).__csp ??= [];
      (window as unknown as { __csp: string[] }).__csp.push(
        `${event.violatedDirective} blocked ${event.blockedURI}`,
      );
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  await page.goto("/");
  await page.getByRole("link", { name: "Start your first mission" }).click();
  await page.getByRole("button", { name: "Start mission" }).click();
  await page.getByRole("button", { name: "Skip tour" }).click();
  await run(page, "whoami");
  await page.goto("/learn/linux-filesystem");
  await run(page, "pwd");
  await page.goto("/sandbox");
  await run(page, "ls");

  const violations = await page.evaluate(
    () => (window as unknown as { __csp?: string[] }).__csp ?? [],
  );
  expect(violations).toEqual([]);
  expect(problems).toEqual([]);
});

test("a whole mission leaves nothing about the learner in the browser", async ({
  page,
  context,
}) => {
  await startMission(page, "net-01");
  await run(page, "ifconfig");
  await run(page, "netscan 10.40.1.0/24");
  await page.getByRole("button", { name: /^pos-01/ }).click();
  await page.goto("/settings");
  await page.locator("label").filter({ hasText: "Keep the sidebar small" }).click();

  const stored = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: (await indexedDB.databases()).map((database) => database.name),
    caches: await caches.keys(),
    settings: localStorage.getItem("hacker-simulation:settings") ?? "",
  }));
  // Settings only: one key, holding display choices, and no mission, command or host in it.
  expect(stored.local).toEqual(["hacker-simulation:settings"]);
  expect(stored.settings).not.toMatch(/net-01|netscan|ifconfig|pos-01|10\.40\./);
  expect(stored.session).toEqual([]);
  expect(stored.databases).toEqual([]);
  expect(stored.caches).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});
