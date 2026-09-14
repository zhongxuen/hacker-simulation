import { getGlossaryEntry } from "@/content/glossary";
import type { GlossaryEntry } from "@/content/schemas/glossary";
import type { Mission } from "@/content/schemas/mission";
import type { HintPrompt } from "./prompt-builder";
import {
  buildExplainSystemPrompt,
  buildExplainUserMessage,
  EXPLAIN_PROMPT_VERSION,
  type ExplainPromptInput,
} from "./prompts/explain.v1";
import { renderTranscript, selectionBlock, terminalBlock } from "./prompts/noor.v1";
import type { ExplainSubject } from "./protocol";
import type { MentorTranscript } from "./transcript";

/**
 * Builds exactly what is sent to the model for one "Explain this" request (md-files/10-ai-mentor.md,
 * prompt 10.3). Pure and unit-tested, like the hint prompt. The model gets the mission's title and
 * difficulty, the step the learner is on (its description only), a glossary definition when a word
 * is asked about, and the learner's terminal as delimited data. It never gets a hint, an objective's
 * check or success line, the scenario's ground truth, the story, or the debrief: explaining the
 * learner's own screen needs none of them.
 */

export type BuildExplainPromptResult =
  | { readonly ok: true; readonly prompt: HintPrompt }
  | { readonly ok: false; readonly problem: "unknown_term" };

export interface ExplainPromptRequest {
  readonly objectiveId?: string;
  readonly subject: ExplainSubject;
  readonly transcript: MentorTranscript;
}

export function buildExplainPrompt(
  mission: Mission,
  request: ExplainPromptRequest,
  getTerm: (id: string) => GlossaryEntry | undefined = getGlossaryEntry,
): BuildExplainPromptResult {
  // The step the learner is on, for context. A hidden or unknown id adds none (a secret's words
  // stay out of the prompt until the learner has found it and moved on).
  const objective = mission.objectives.find(
    (candidate) => candidate.id === request.objectiveId && !candidate.hidden,
  );

  const { subject } = request;
  let promptSubject: ExplainPromptInput["subject"];
  let selection: string | undefined;
  if (subject.kind === "term") {
    const entry = getTerm(subject.termId);
    if (!entry) return { ok: false, problem: "unknown_term" };
    promptSubject = {
      kind: "term",
      term: { term: entry.term, short: entry.short, long: entry.long },
    };
  } else if (subject.scope === "line") {
    promptSubject = { kind: "line", error: subject.error };
    selection = selectionBlock(`From the command: $ ${subject.command}\nThe line: ${subject.text}`);
  } else {
    promptSubject = { kind: "output" };
    selection = selectionBlock(
      `$ ${subject.command}\n${subject.text.trim() === "" ? "(no output)" : subject.text}`,
    );
  }

  const system = buildExplainSystemPrompt({
    difficulty: mission.difficulty,
    missionTitle: mission.title,
    ...(objective && { objectiveDescription: objective.description }),
    subject: promptSubject,
  });
  const content = buildExplainUserMessage({
    ...(selection !== undefined && { selection }),
    terminal: terminalBlock(renderTranscript(request.transcript)),
  });

  return {
    ok: true,
    prompt: { version: EXPLAIN_PROMPT_VERSION, system, messages: [{ role: "user", content }] },
  };
}
