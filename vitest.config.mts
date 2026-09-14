import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The test pyramid (md-files/11-testing-security-deployment.md, "Testing strategy"), as four
 * Vitest projects. `pnpm test` runs them all; each has its own script so CI can report them apart.
 *
 * - unit (Node): the engine in src/sim, the parser, the objective evaluator, settings, and every
 *   other piece of pure logic. Plain Node with no DOM, because the engine must run headless.
 * - content (Node): every mission, lesson, glossary word, campaign and theme validates, and no
 *   cross-reference is dead. Selected by file name below, so they share tests/unit's fixtures.
 * - integration (Node): the mentor route handlers end to end, with the Anthropic SDK mocked.
 * - components (jsdom): interactive components, rendered in a simulated browser and clicked.
 */
const CONTENT_TESTS = [
  "tests/unit/campaigns.test.ts",
  "tests/unit/content-references.test.ts",
  "tests/unit/glossary.test.ts",
  "tests/unit/lesson-content.test.ts",
  "tests/unit/lessons.test.ts",
  "tests/unit/mission-playthroughs.test.ts",
  "tests/unit/missions.loader.test.ts",
  "tests/unit/missions.schema.test.ts",
  "tests/unit/sandbox-scenarios.test.ts",
  "tests/unit/terminal-themes.test.ts",
];

// Coverage instrumentation slows code down several times over; the one timing test reads this.
const COVERAGE = process.argv.includes("--coverage");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Some tests walk the whole source tree or render every lesson. Alone they take a second or
    // two, but with every file running in parallel on a small CI machine (and slower again under
    // coverage) they can take far longer.
    testTimeout: 120_000,
    env: { COVERAGE: COVERAGE ? "1" : "" },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/mentor/**/*.test.ts"],
          exclude: CONTENT_TESTS,
        },
      },
      {
        extends: true,
        test: { name: "content", environment: "node", include: CONTENT_TESTS },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["tests/components/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.ts", "src/**/__fixtures__/**", "src/**/README.md"],
      reporter: ["text-summary", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      // What matters most is covered hardest (md-files/11, "high coverage, meaningful assertions"),
      // each gate a little under where it stands, so a drop fails CI. The engine is pure and
      // deterministic, so nearly all of it is reachable; the objective evaluator and the run
      // reducer decide every tick; settings are the only thing that touches storage; and the
      // mentor's request handling is the only code that runs on a server.
      thresholds: {
        "src/sim/**": { statements: 90, branches: 80, functions: 95, lines: 93 },
        "src/features/missions/evaluate.ts": {
          statements: 98,
          branches: 95,
          functions: 100,
          lines: 98,
        },
        "src/features/missions/run/mission-run.ts": {
          statements: 95,
          branches: 93,
          functions: 98,
          lines: 98,
        },
        "src/lib/settings/**": { statements: 98, branches: 93, functions: 98, lines: 98 },
        "src/features/mentor/{handler,explain-handler,review-handler,respond,schema}.ts": {
          statements: 88,
          branches: 80,
          functions: 80,
          lines: 94,
        },
      },
    },
  },
});
