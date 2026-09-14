import { describe, expect, it } from "vitest";
import {
  MAX_ENTRY_OUTPUT_CHARS,
  MAX_LINE_CHARS,
  MAX_OUTPUT_LINES,
  MAX_TRANSCRIPT_COMMANDS,
} from "@/features/mentor/transcript";
import { parseMentorHintRequest } from "@/features/mentor/schema";

/**
 * The mentor request schema and its caps (md-files/10-ai-mentor.md, prompt 10.1). The transcript is
 * untrusted, so the schema re-applies the same caps the browser applied, and rejects malformed
 * bodies (which the client then treats as a fallback).
 */

const valid = {
  missionId: "net-01",
  objectiveId: "check-doors",
  tier: 1,
  transcript: [{ input: "netscan 10.40.1.0/24", output: "4 hosts up" }],
};

describe("parseMentorHintRequest", () => {
  it("accepts a well-formed request", () => {
    const result = parseMentorHintRequest(valid);
    expect(result.ok).toBe(true);
    expect(result.request?.missionId).toBe("net-01");
    expect(result.request?.tier).toBe(1);
  });

  it("defaults a missing transcript to empty", () => {
    const result = parseMentorHintRequest({ ...valid, transcript: undefined });
    expect(result.ok).toBe(true);
    expect(result.request?.transcript).toEqual([]);
  });

  it("rejects an unknown tier", () => {
    expect(parseMentorHintRequest({ ...valid, tier: 4 }).ok).toBe(false);
    expect(parseMentorHintRequest({ ...valid, tier: 0 }).ok).toBe(false);
  });

  it("rejects a missing or malformed id", () => {
    expect(parseMentorHintRequest({ ...valid, missionId: "" }).ok).toBe(false);
    expect(parseMentorHintRequest({ ...valid, objectiveId: "Bad Id!" }).ok).toBe(false);
    expect(parseMentorHintRequest({ ...valid, missionId: undefined }).ok).toBe(false);
  });

  it("rejects unknown fields (strict object)", () => {
    expect(parseMentorHintRequest({ ...valid, sneaky: "extra" }).ok).toBe(false);
  });

  it("keeps only the last N commands", () => {
    const transcript = Array.from({ length: MAX_TRANSCRIPT_COMMANDS + 8 }, (_, i) => ({
      input: `command-${i}`,
      output: "ok",
    }));
    const result = parseMentorHintRequest({ ...valid, transcript });
    expect(result.request?.transcript).toHaveLength(MAX_TRANSCRIPT_COMMANDS);
    // The newest commands are the ones kept.
    expect(result.request?.transcript.at(-1)?.input).toBe(`command-${MAX_TRANSCRIPT_COMMANDS + 7}`);
  });

  it("truncates long command lines and output", () => {
    const result = parseMentorHintRequest({
      ...valid,
      transcript: [
        {
          input: "x".repeat(MAX_LINE_CHARS + 500),
          output: Array.from({ length: MAX_OUTPUT_LINES + 30 }, () => "y".repeat(400)).join("\n"),
        },
      ],
    });
    const entry = result.request?.transcript[0];
    expect(entry).toBeDefined();
    expect(entry?.input.length ?? 0).toBeLessThanOrEqual(MAX_LINE_CHARS + 1); // + ellipsis
    expect(entry?.output.split("\n").length ?? 0).toBeLessThanOrEqual(MAX_OUTPUT_LINES);
    expect(entry?.output.length ?? 0).toBeLessThanOrEqual(MAX_ENTRY_OUTPUT_CHARS + 1);
  });

  it("rejects an absurdly large transcript array before capping", () => {
    const transcript = Array.from({ length: 5000 }, () => ({ input: "x", output: "y" }));
    expect(parseMentorHintRequest({ ...valid, transcript }).ok).toBe(false);
  });
});
