import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { authoredHint } from "@/features/mentor";
import { MissionRunner, type MissionLinks } from "@/features/missions";
import { getMissionById } from "@/features/missions/server";

/**
 * The mission runner in a simulated browser (md-files/06-mission-system.md; prompt 11.3 split
 * everything after Start mission into a chunk that loads on demand). This is the first win a
 * beginner gets: briefing, Start mission, a first command, the first tick. It also proves the
 * mentor's promise under the rate limit: a 429 from /api/mentor/hint still shows the hint written
 * for that step, never an error (md-files/11, prompt 11.2).
 */

const LINKS: MissionLinks = { bestAfter: [], concepts: [], furtherReading: [], next: null };
const INTRO = getMissionById("intro-01")!;

async function startMission() {
  const user = userEvent.setup();
  render(<MissionRunner mission={INTRO} links={LINKS} />);
  expect(screen.getByRole("heading", { level: 1, name: INTRO.title })).toBeTruthy();
  // The briefing needs no terminal: the practice computer isn't on the page yet.
  expect(screen.queryByRole("textbox", { name: /^Command, in/ })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Start mission" }));
  const prompt = await screen.findByRole("textbox", { name: /^Command, in/ }, { timeout: 10_000 });
  return { user, prompt };
}

describe("MissionRunner", () => {
  it("goes from the briefing to a first objective tick in a few actions", async () => {
    const { user, prompt } = await startMission();
    const objectives = screen.getByRole("complementary", { name: "Mission objectives" });
    expect(within(objectives).getByText(/which account you're using/)).toBeTruthy();

    await user.type(prompt, "whoami{Enter}");
    // The success line names what they did (md-files/voice-and-tone.md, "Celebrate specifically").
    await waitFor(() => expect(objectives.textContent).toContain("You're recruit!"));
  });

  it("shows the authored hint when the mentor route is over its rate limit (429)", async () => {
    const fetch = vi.fn(async () => new Response("Too many requests", { status: 429 }));
    vi.stubGlobal("fetch", fetch);
    const { user } = await startMission();

    // The guided tour opens first on this mission; the hint button sits with the objective.
    const objectives = screen.getByRole("complementary", { name: "Mission objectives" });
    await user.click(within(objectives).getByRole("button", { name: "Show me a hint" }));

    const hint = authoredHint(INTRO, "whoami", 1);
    await waitFor(() => expect(document.body.textContent).toContain(hint.slice(0, 40)));
    expect(fetch).toHaveBeenCalledWith(
      "/api/mentor/hint",
      expect.objectContaining({ method: "POST" }),
    );
    expect(document.body.textContent).not.toMatch(/something went wrong|error/i);
  });
});
