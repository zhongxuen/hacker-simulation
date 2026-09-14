import { describe, expect, it } from "vitest";
import {
  MAX_ENTRY_OUTPUT_CHARS,
  MAX_LINE_CHARS,
  MAX_OUTPUT_LINES,
  MAX_TRANSCRIPT_COMMANDS,
  REVIEW_TRANSCRIPT_LIMITS,
} from "@/features/mentor/transcript";
import {
  parseMentorExplainRequest,
  parseMentorHintRequest,
  parseMentorReviewRequest,
} from "@/features/mentor/schema";

/**
 * The mentor request schemas and their caps (md-files/10-ai-mentor.md, prompts 10.1, 10.3, 10.4). The transcript is
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

describe("parseMentorExplainRequest (prompt 10.3)", () => {
  const line = {
    missionId: "net-01",
    objectiveId: "check-doors",
    subject: { kind: "output", command: "ls", text: "notes.txt", scope: "line", error: false },
    transcript: [],
  };

  it("accepts a line, a whole result, or a glossary word, with the objective optional", () => {
    expect(parseMentorExplainRequest(line).ok).toBe(true);
    const { objectiveId: _unused, ...withoutObjective } = line;
    void _unused;
    expect(parseMentorExplainRequest(withoutObjective).ok).toBe(true);
    expect(
      parseMentorExplainRequest({ ...line, subject: { kind: "term", termId: "port" } }).ok,
    ).toBe(true);
  });

  it("rejects anything else: an unknown kind, a term by name, extra fields", () => {
    expect(parseMentorExplainRequest({ ...line, subject: { kind: "shell", text: "x" } }).ok).toBe(
      false,
    );
    expect(
      parseMentorExplainRequest({ ...line, subject: { kind: "term", termId: "Port Numbers!" } }).ok,
    ).toBe(false);
    expect(
      parseMentorExplainRequest({
        ...line,
        subject: { kind: "term", termId: "port", definition: "trust me" },
      }).ok,
    ).toBe(false);
  });

  it("caps what the learner pointed at like a transcript entry", () => {
    const result = parseMentorExplainRequest({
      ...line,
      subject: {
        ...line.subject,
        command: "c".repeat(MAX_LINE_CHARS + 300),
        text: Array.from({ length: MAX_OUTPUT_LINES + 30 }, () => "z".repeat(400)).join("\n"),
        scope: "output",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.request.subject.kind !== "output") return;
    expect(result.request.subject.command.length).toBeLessThanOrEqual(MAX_LINE_CHARS + 1);
    expect(result.request.subject.text.split("\n").length).toBeLessThanOrEqual(MAX_OUTPUT_LINES);
    expect(result.request.subject.text.length).toBeLessThanOrEqual(MAX_ENTRY_OUTPUT_CHARS + 1);
  });
});

describe("parseMentorReviewRequest (prompt 10.4)", () => {
  const review = {
    missionId: "net-01",
    completed: ["find-yourself", "check-doors"],
    hintsOpened: { "check-doors": 2 },
    minutes: 11.5,
    resets: 0,
    commandCount: 14,
    transcript: [],
  };

  it("accepts the run as ids and counts, and nothing else", () => {
    expect(parseMentorReviewRequest(review).ok).toBe(true);
    expect(parseMentorReviewRequest({ ...review, minutes: null }).ok).toBe(true);
    expect(parseMentorReviewRequest({ ...review, hintsOpened: { "check-doors": 9 } }).ok).toBe(
      false,
    );
    expect(parseMentorReviewRequest({ ...review, objectiveWords: ["x"] }).ok).toBe(false);
    expect(parseMentorReviewRequest({ ...review, completed: ["Not An Id"] }).ok).toBe(false);
  });

  it("keeps more of the run than a hint does, with less of each output", () => {
    const transcript = Array.from({ length: 60 }, (_, i) => ({
      input: `command-${i}`,
      output: "line\n".repeat(30),
    }));
    const result = parseMentorReviewRequest({ ...review, transcript });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.transcript.length).toBeGreaterThan(MAX_TRANSCRIPT_COMMANDS);
    expect(result.request.transcript.length).toBeLessThanOrEqual(REVIEW_TRANSCRIPT_LIMITS.commands);
    for (const entry of result.request.transcript) {
      expect(entry.output.split("\n").length).toBeLessThanOrEqual(
        REVIEW_TRANSCRIPT_LIMITS.outputLines,
      );
    }
  });
});
