import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "@/components/settings/settings-form";
import { UsageAnalytics } from "@/components/shell/usage-analytics";
import { beforeSendUsage, reportFirstTick, trackUsage } from "@/lib/analytics";
import { getSettings, resetSettings, updateSettings } from "@/lib/settings";

/**
 * Anonymous usage counts in the browser (md-files/11-testing-security-deployment.md, prompts 11.4
 * and 11.4b): sent only when allowed, never when the browser asks not to be tracked or the learner
 * turned them off on /settings, and in that case the analytics scripts aren't even loaded.
 */

const vercel = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", async (original) => ({
  ...(await original<typeof import("@vercel/analytics")>()),
  track: vercel.track,
}));

function setDoNotTrack(value: string | null) {
  Object.defineProperty(window.navigator, "doNotTrack", { value, configurable: true });
}

const analyticsScripts = () =>
  [...document.querySelectorAll("script")].filter((script) =>
    /insights|speed-insights|vercel-scripts/.test(script.src),
  );

beforeEach(() => {
  vercel.track.mockClear();
  setDoNotTrack(null);
  resetSettings();
  for (const script of analyticsScripts()) script.remove();
});

afterEach(() => setDoNotTrack(null));

describe("trackUsage", () => {
  it("sends the event's name and properties when counts are allowed", () => {
    trackUsage({ name: "Objective ticked", props: { mission: "intro-01", objective: "whoami" } });
    expect(vercel.track).toHaveBeenCalledWith("Objective ticked", {
      mission: "intro-01",
      objective: "whoami",
    });
  });

  it("sends nothing when the browser asks not to be tracked", () => {
    setDoNotTrack("1");
    trackUsage({ name: "Mission started", props: { mission: "intro-01" } });
    expect(vercel.track).not.toHaveBeenCalled();
    expect(beforeSendUsage({ type: "pageview", url: "/campaign" })).toBeNull();
  });

  it("sends nothing when the learner turned counts off", () => {
    updateSettings({ usageCounts: false });
    trackUsage({ name: "Mission started", props: { mission: "intro-01" } });
    reportFirstTick();
    expect(vercel.track).not.toHaveBeenCalled();
    expect(beforeSendUsage({ type: "pageview", url: "/campaign" })).toBeNull();
  });

  it("strips query strings from page views it lets through", () => {
    expect(
      beforeSendUsage({ type: "pageview", url: "https://app.test/learn?q=ports#top" }),
    ).toEqual({
      type: "pageview",
      url: "https://app.test/learn",
    });
  });
});

describe("UsageAnalytics", () => {
  it("loads the analytics scripts on Vercel when counts are allowed", async () => {
    render(<UsageAnalytics enabled />);
    await waitFor(() => expect(analyticsScripts().length).toBeGreaterThan(0));
  });

  it("loads no analytics script at all under Do Not Track", async () => {
    setDoNotTrack("1");
    render(<UsageAnalytics enabled />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(analyticsScripts()).toEqual([]);
  });

  it("loads nothing off Vercel, where there are no analytics endpoints", async () => {
    render(<UsageAnalytics enabled={false} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(analyticsScripts()).toEqual([]);
  });
});

describe("the setting on /settings", () => {
  it("turns counts off and on, is saved like every setting, and Reset turns it back on", async () => {
    const user = userEvent.setup();
    render(<SettingsForm />);
    const toggle = screen.getByRole<HTMLInputElement>("switch", {
      name: "Send anonymous usage counts",
    });
    expect(toggle.checked).toBe(true);

    await user.click(toggle);
    expect(getSettings().usageCounts).toBe(false);
    expect(localStorage.getItem("hacker-simulation:settings")).toContain('"usageCounts":false');
    expect(toggle.checked).toBe(false);

    await user.click(screen.getByRole("button", { name: "Reset settings" }));
    expect(getSettings().usageCounts).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "Your settings are back to how they started.",
    );
  });
});
