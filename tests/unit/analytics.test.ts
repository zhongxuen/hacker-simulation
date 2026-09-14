import { describe, expect, it } from "vitest";
import {
  createMissionRun,
  mainObjectives,
  usageEventsBetween,
  type MissionRunState,
} from "@/features/missions";
import { getMissionById } from "@/features/missions/server";
import {
  asksNotToTrack,
  entryKind,
  FIRST_TICK_BUCKETS,
  firstTickBucket,
  stripQuery,
  trackUsage,
  usageCountsAllowed,
} from "@/lib/analytics";

/**
 * The anonymous usage counts (md-files/11-testing-security-deployment.md, prompt 11.4b;
 * md-files/metrics.md). What each change to a run sends, that nothing but ids and coarse buckets
 * ever leaves, and that nothing is sent on the server. The browser side (Do Not Track and the
 * setting) is in tests/components/usage-analytics.test.tsx.
 */

const NET = getMissionById("net-01")!;
const run = (overrides: Partial<MissionRunState> = {}): MissionRunState => ({
  ...createMissionRun(),
  ...overrides,
});

describe("usageEventsBetween", () => {
  it("counts a start when the briefing turns into the workspace", () => {
    expect(usageEventsBetween(NET, run(), run({ phase: "workspace" }))).toEqual([
      { name: "Mission started", props: { mission: "net-01" } },
    ]);
  });

  it("counts each new tick once, by id", () => {
    const before = run({ phase: "workspace", completed: ["find-yourself"] });
    const after = run({
      phase: "workspace",
      completed: ["find-yourself", "map-staff", "knock-knock"],
    });
    expect(usageEventsBetween(NET, before, after)).toEqual([
      { name: "Objective ticked", props: { mission: "net-01", objective: "map-staff" } },
      { name: "Objective ticked", props: { mission: "net-01", objective: "knock-knock" } },
    ]);
    expect(usageEventsBetween(NET, after, after)).toEqual([]);
  });

  it("counts every hint tier opened, with the step and the tier", () => {
    const before = run({ phase: "workspace", hintsShown: { "check-doors": 1 } });
    const after = run({ phase: "workspace", hintsShown: { "check-doors": 3, "map-staff": 1 } });
    expect(usageEventsBetween(NET, before, after)).toEqual([
      { name: "Hint opened", props: { step: "net-01/check-doors", tier: 2 } },
      { name: "Hint opened", props: { step: "net-01/check-doors", tier: 3 } },
      { name: "Hint opened", props: { step: "net-01/map-staff", tier: 1 } },
    ]);
  });

  it("counts a completion once, when the last main objective ticks", () => {
    const main = mainObjectives(NET).map((objective) => objective.id);
    const before = run({ phase: "workspace", completed: main.slice(0, -1) });
    const after = run({ phase: "workspace", completed: main });
    expect(usageEventsBetween(NET, before, after)).toContainEqual({
      name: "Mission completed",
      props: { mission: "net-01" },
    });
    const later = run({ phase: "debrief", completed: [...main, "knock-knock"] });
    expect(
      usageEventsBetween(NET, after, later).filter((event) => event.name === "Mission completed"),
    ).toEqual([]);
  });

  it("sends nothing for a restart (a new attempt starts from its own briefing)", () => {
    const finished = run({ phase: "debrief", completed: ["find-yourself"] });
    expect(usageEventsBetween(NET, finished, createMissionRun(1))).toEqual([]);
  });

  it("never carries anything a learner typed: every property is an id, a tier or a bucket", () => {
    const typed = run({
      phase: "workspace",
      completed: ["write-finding"],
      answers: { "write-finding": ["Telnet on port 23, my-secret-words"] },
      notes: { "backup-01": "my-secret-note" },
      hintsShown: { "write-finding": 2 },
    });
    const events = usageEventsBetween(NET, run(), typed);
    const values = events.flatMap((event) => Object.values(event.props));
    expect(JSON.stringify(events)).not.toContain("secret");
    const objectiveIds = new Set(NET.objectives.map((objective) => objective.id));
    for (const value of values) {
      if (typeof value === "number") expect([1, 2, 3]).toContain(value);
      else
        expect(value === "net-01" || objectiveIds.has(value) || value.startsWith("net-01/")).toBe(
          true,
        );
    }
    // Every event fits Vercel's limit of two properties per custom event.
    for (const event of events) expect(Object.keys(event.props).length).toBeLessThanOrEqual(2);
  });
});

describe("the buckets and checks", () => {
  it("puts a time since landing in a coarse bucket, never an exact number", () => {
    expect(firstTickBucket(0)).toBe("under 30s");
    expect(firstTickBucket(45_000)).toBe("30s-1m");
    expect(firstTickBucket(119_999)).toBe("1-2m");
    expect(firstTickBucket(120_000)).toBe("2-3m");
    expect(firstTickBucket(3_600_000)).toBe("over 10m");
    expect(new Set(FIRST_TICK_BUCKETS.map((_, index) => index)).size).toBe(7);
  });

  it("says whether a visit began on the landing page", () => {
    expect(entryKind("/")).toBe("home");
    expect(entryKind("/missions/intro-01")).toBe("other");
  });

  it("honours Do Not Track and Global Privacy Control", () => {
    expect(asksNotToTrack({ doNotTrack: "1" })).toBe(true);
    expect(asksNotToTrack({ globalPrivacyControl: true })).toBe(true);
    expect(asksNotToTrack({ doNotTrack: null }, { doNotTrack: "1" })).toBe(true);
    expect(asksNotToTrack({ doNotTrack: "0", globalPrivacyControl: false })).toBe(false);
    expect(asksNotToTrack(undefined)).toBe(false);
  });

  it("strips query strings and fragments from page addresses", () => {
    expect(stripQuery("https://app.test/learn/net-ports?from=palette#ports")).toBe(
      "https://app.test/learn/net-ports",
    );
    expect(stripQuery("/campaign")).toBe("/campaign");
  });

  it("sends nothing on the server", () => {
    expect(usageCountsAllowed()).toBe(false);
    expect(() =>
      trackUsage({ name: "Mission started", props: { mission: "net-01" } }),
    ).not.toThrow();
  });
});
