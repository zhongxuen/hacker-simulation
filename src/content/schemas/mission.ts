import { z } from "zod";
import { SIM_EVENT_TYPES, type ScenarioSpec, type SimEvent, type SimEventType } from "@/sim/types";
import { CAST_IDS } from "../cast";
import { SKILL_IDS } from "../skills";
import { CONTENT_ID_PATTERN, ContentIdSchema, uniqueIds } from "./ids";

/**
 * The mission schema (md-files/06-mission-system.md, "Mission schema" and prompt 06.1).
 *
 * A mission is one YAML file in src/content/missions: story, scenario, objectives, hints and
 * debrief, all as data. Objective checks are declarative, never functions, so a mission can be
 * validated here, replayed in tests, evaluated in the browser, and written by a non-programmer.
 *
 * What this file checks: the shape of every field, the beginner rules (a hook, 2–4 learning goals,
 * 3–6 main objectives, a `why` and `success` line on each, a time cap per difficulty), and the
 * ethics fields (`briefing.authorization`, `debrief.ethicsNote`, `debrief.defensiveTakeaway`),
 * which are required so the ethics layer stays real. What it leaves to others: whether the
 * scenario builds (the engine's `createInitialState`, run by the mission loader, since content
 * can't import the engine's runtime), whether lesson ids resolve (`findDeadReferences` in
 * src/content/references.ts), and anything across missions (the loader).
 *
 * Every object is strict, so a typo like `hnits:` fails with "Did you mean "hints"?" instead of
 * being silently ignored. Use `parseMission` for problems written for authors.
 */

// ---------------------------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------------------------

export const MISSION_DIFFICULTIES = ["intro", "easy", "medium", "hard"] as const;

export type MissionDifficulty = (typeof MISSION_DIFFICULTIES)[number];

/** The longest a mission of each difficulty may take, in minutes. Missions fit one sitting. */
export const MISSION_MINUTES_MAX: Readonly<Record<MissionDifficulty, number>> = {
  intro: 10,
  easy: 15,
  medium: 25,
  hard: 30,
};

/** Main (non-optional) objectives per mission: small steps, frequent wins (design rule 4). */
export const MAIN_OBJECTIVES_MIN = 3;
export const MAIN_OBJECTIVES_MAX = 6;

/** "You'll learn…" bullets per mission, mirrored one-for-one by the debrief's whatYouLearned. */
export const LEARNING_GOALS_MIN = 2;
export const LEARNING_GOALS_MAX = 4;

/** A seed is a 32-bit unsigned whole number, like the engine's RNG uses. */
export const MISSION_SEED_MAX = 4_294_967_295;

// ---------------------------------------------------------------------------------------------
// Messages written for authors
// ---------------------------------------------------------------------------------------------

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Edit distance where swapping two neighbouring letters counts as one edit. */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => rows[i]?.[j] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      const row = rows[i];
      if (row) row[j] = best;
    }
  }
  return at(a.length, b.length);
}

/** The known name closest to `name`, if it's close enough to be a likely typo. */
function closestName(name: string, known: readonly string[]): string | undefined {
  const lower = name.toLowerCase();
  let best: { name: string; distance: number } | undefined;
  for (const candidate of known) {
    const distance = editDistance(lower, candidate.toLowerCase());
    if (distance < (best?.distance ?? Number.POSITIVE_INFINITY))
      best = { name: candidate, distance };
  }
  const allowed = lower.length <= 4 ? 1 : 2;
  return best && best.distance <= allowed ? best.name : undefined;
}

function unknownFieldMessage(key: string, known: readonly string[]): string {
  const suggestion = closestName(key, known);
  return suggestion
    ? `Unknown field "${key}". Did you mean "${suggestion}"?`
    : `Unknown field "${key}". The fields allowed here are: ${known.join(", ")}.`;
}

const EXPECTED: Readonly<Record<string, string>> = {
  string: "text",
  number: "a number",
  int: "a whole number",
  boolean: "true or false",
  array: "a list",
  tuple: "a list",
  object: "a group of fields",
  record: "a group of fields",
};

function describeValue(input: unknown): string {
  if (input === null) return "an empty value";
  if (Array.isArray(input)) return "a list";
  if (typeof input === "string")
    return `the text "${input.length > 40 ? `${input.slice(0, 40)}…` : input}"`;
  if (typeof input === "number") return `the number ${input}`;
  if (typeof input === "boolean") return `${input}`;
  if (typeof input === "object") return "a group of fields";
  return typeof input;
}

/**
 * Plain-English messages for the problems every field can have. Schemas that know more (which
 * field is missing and what belongs there) set their own message, which wins over this one.
 */
export const authorErrorMap: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type": {
      if (issue.input === undefined) return "Missing: add this field.";
      const quoteHint =
        issue.expected === "string" && typeof issue.input !== "object"
          ? " Put it in quotes so YAML keeps it as text."
          : "";
      return `Should be ${EXPECTED[issue.expected] ?? issue.expected}, not ${describeValue(issue.input)}.${quoteHint}`;
    }
    case "too_small": {
      const minimum = Number(issue.minimum);
      if (issue.origin === "array") {
        return issue.exact
          ? `Should have exactly ${plural(minimum, "item")}.`
          : `Add at least ${plural(minimum, "item")}.`;
      }
      if (issue.origin === "string") {
        return minimum <= 1 ? "Can't be empty." : `Write at least ${minimum} characters.`;
      }
      return issue.inclusive === false
        ? `Should be more than ${minimum}.`
        : `Should be ${minimum} or more.`;
    }
    case "too_big": {
      const maximum = Number(issue.maximum);
      if (issue.origin === "array") {
        return issue.exact
          ? `Should have exactly ${plural(maximum, "item")}.`
          : `Keep it to ${plural(maximum, "item")} or fewer.`;
      }
      if (issue.origin === "string") return `Keep it to ${maximum} characters or fewer.`;
      return issue.inclusive === false
        ? `Should be less than ${maximum}.`
        : `Should be ${maximum} or less.`;
    }
    case "invalid_value": {
      const options = issue.values.map(String).join(", ");
      return issue.input === undefined
        ? `Missing: add one of: ${options}.`
        : `"${String(issue.input)}" isn't allowed here. Use one of: ${options}.`;
    }
    default:
      return undefined;
  }
};

/**
 * Params for a schema whose missing value deserves more than "Missing: add this field": `what`
 * finishes "Missing: add …". Every other problem falls through to authorErrorMap.
 */
const required = (what: string) => ({
  error: (issue: { readonly input?: unknown }) =>
    issue.input === undefined ? `Missing: add ${what}.` : undefined,
});

/**
 * A strict group of fields: unknown keys fail (with a "did you mean" for typos), and a missing
 * group says what belongs there. `what` finishes "Missing: add …".
 */
function strict<T extends z.core.$ZodLooseShape>(shape: T, what: string) {
  const known = Object.keys(shape);
  return z.strictObject(shape, {
    error: (issue) => {
      if (issue.code === "unrecognized_keys") {
        return issue.keys.map((key) => unknownFieldMessage(key, known)).join(" ");
      }
      if (issue.code === "invalid_type") {
        return issue.input === undefined
          ? `Missing: add ${what}.`
          : `Should be ${what}, written as a group of \`name: value\` lines, not ${describeValue(issue.input)}.`;
      }
      return undefined;
    },
  });
}

/** Required, non-blank text. `what` finishes "Missing: add …". */
function text(what: string) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? `Missing: add ${what}.`
          : `Should be text (${what}), not ${describeValue(issue.input)}.`,
    })
    .trim()
    .min(1, `Can't be empty: add ${what}.`);
}

/** Like `text`, on a single line. */
const oneLine = (what: string) =>
  text(what).refine((value) => !/[\r\n]/.test(value), "Keep it to one line.");

/**
 * An octal permission mode: 3 or 4 octal digits. YAML reads an unquoted `644` as a number, which
 * is accepted and turned back into "644", but `044` would lose its leading zero, so the house rule
 * is to put modes in quotes.
 */
const OctalModeSchema = z
  .union([z.string(), z.number()], {
    error: 'Write the mode as 3 or 4 octal digits in quotes, like "644".',
  })
  .transform(String)
  .pipe(
    z
      .string()
      .regex(
        /^[0-7]{3,4}$/,
        'Write the mode as 3 or 4 octal digits (0-7) in quotes, like "644" or "044".',
      ),
  );

/** A version number, which YAML would read as a number unless it's quoted. */
const VersionSchema = z.string({
  error: (issue) =>
    issue.input === undefined
      ? 'Missing: add the version, in quotes, like "9.6".'
      : 'Put the version in quotes, like "9.6", so YAML keeps it as text.',
});

// ---------------------------------------------------------------------------------------------
// Story beats and events
// ---------------------------------------------------------------------------------------------

const SpeakerSchema = z.enum(CAST_IDS, {
  error: (issue) =>
    issue.input === undefined
      ? `Missing: add the speaker, one of: ${CAST_IDS.join(", ")}.`
      : `"${String(issue.input)}" isn't in the cast. Use one of: ${CAST_IDS.join(", ")} (see md-files/story-bible.md).`,
});

const EventTypeSchema = z.enum(SIM_EVENT_TYPES, {
  error: (issue) =>
    issue.input === undefined
      ? `Missing: add the event type, one of: ${SIM_EVENT_TYPES.join(", ")}.`
      : `"${String(issue.input)}" isn't an event the engine sends. Use one of: ${SIM_EVENT_TYPES.join(", ")}.`,
});

type KeysOf<T> = T extends unknown ? keyof T : never;
type EventFields<T extends SimEventType> = Exclude<KeysOf<Extract<SimEvent, { type: T }>>, "type">;

/**
 * The fields each event carries, so a `match` on a misspelt field (`hostid` for `hostId`) fails
 * here instead of silently never matching. The type keeps every name honest against the engine's
 * SimEvent, and requires an entry for every event type, so a new engine event can't skip it.
 */
export const EVENT_MATCH_FIELDS: { readonly [T in SimEventType]: readonly EventFields<T>[] } = {
  "command.run": ["command", "line", "exitCode"],
  "command.error": [
    "command",
    "code",
    "path",
    "detail",
    "value",
    "flag",
    "argument",
    "reason",
    "target",
    "port",
    "expected",
    "found",
    "user",
    "topic",
  ],
  "help.viewed": ["command"],
  "host.discovered": ["hostId", "ip", "via"],
  "service.discovered": ["hostId", "ip", "port", "protocol", "service", "via"],
  "service.fingerprinted": ["hostId", "port", "product", "version"],
  "scan.completed": ["target", "hostsUp", "openPorts", "portScan"],
  "web.probed": ["hostId", "port", "path", "status"],
  "file.read": ["hostId", "path"],
  "file.changed": ["hostId", "path", "change"],
  "log.queried": ["hostId", "path", "matched"],
  "hash.identified": ["format"],
  "flag.found": ["flagId"],
};

/** Field values an event must have: `{ hostId: backup-01 }`. Compared with strict equality. */
const EventMatchSchema = z.record(
  z.string().min(1),
  z.union([z.string(), z.number(), z.boolean()], {
    error: "Match values are text, a number, or true/false.",
  }),
);

export type EventMatch = z.output<typeof EventMatchSchema>;

function checkMatchFields(
  value: { readonly event: SimEventType; readonly match?: EventMatch | undefined },
  ctx: z.RefinementCtx,
): void {
  const fields: readonly string[] | undefined = EVENT_MATCH_FIELDS[value.event];
  if (!fields || !value.match) return;
  for (const key of Object.keys(value.match)) {
    if (fields.includes(key)) continue;
    const suggestion = closestName(key, fields);
    ctx.addIssue({
      code: "custom",
      path: ["match", key],
      message: `${value.event} events have no field "${key}".${suggestion ? ` Did you mean "${suggestion}"?` : ""} Its fields are: ${fields.join(", ")}.`,
    });
  }
}

const ObjectiveTriggerSchema = strict(
  { objective: ContentIdSchema },
  "the id of the objective that plays this beat",
);

const EventTriggerSchema = strict(
  { event: EventTypeSchema, match: EventMatchSchema.optional() },
  "the event that plays this beat",
).superRefine(checkMatchFields);

const TRIGGER_HINT =
  "Use start, complete, { objective: <objective id> }, or { event: <event type>, match: { … } }.";

/** The union's own message is vague, so re-check against the option the author was going for. */
function triggerProblem(input: unknown): string {
  if (input === undefined) return `Missing: say when this beat plays. ${TRIGGER_HINT}`;
  if (isRecord(input)) {
    const option =
      "event" in input ? EventTriggerSchema : "objective" in input ? ObjectiveTriggerSchema : null;
    const first = option?.safeParse(input, { error: authorErrorMap }).error?.issues[0];
    if (first) {
      const path = first.path.map(String).join(".");
      return path === "" ? first.message : `${path}: ${first.message}`;
    }
    const unknown = Object.keys(input).filter(
      (key) => !["objective", "event", "match"].includes(key),
    );
    if (option === null && unknown.length > 0) {
      return `${unknown.map((key) => unknownFieldMessage(key, ["objective", "event", "match"])).join(" ")} ${TRIGGER_HINT}`;
    }
  }
  return `${describeValue(input)} isn't a trigger. ${TRIGGER_HINT}`;
}

const BeatTriggerSchema = z.union(
  [z.literal("start"), z.literal("complete"), ObjectiveTriggerSchema, EventTriggerSchema],
  {
    error: (issue) => (issue.code === "invalid_union" ? triggerProblem(issue.input) : undefined),
  },
);

/**
 * A character line shown during play (md-files/story-bible.md): when the mission starts or
 * completes, when an objective is ticked, or when the engine sends a matching event (`match`
 * narrows it, like "on discovering backup-01").
 */
const StoryBeatSchema = strict(
  {
    on: BeatTriggerSchema,
    speaker: SpeakerSchema,
    text: text("what the character says"),
  },
  "a story beat (on, speaker, text)",
);

export type BeatTrigger = z.output<typeof BeatTriggerSchema>;
export type StoryBeat = z.output<typeof StoryBeatSchema>;

// ---------------------------------------------------------------------------------------------
// Objective checks
// ---------------------------------------------------------------------------------------------

/** Answers compare trimmed, case-insensitive, with any run of spaces counted as one space. */
export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Ticks when the engine has sent an event of this type whose fields equal every `match` value. */
const EventCheckSchema = strict(
  {
    kind: z.literal("event"),
    event: EventTypeSchema,
    match: EventMatchSchema.optional(),
  },
  "an event check",
).superRefine(checkMatchFields);

const AnswerChoiceSchema = strict(
  {
    text: text("the choice, as the learner sees it on a button"),
    /** Shown when the learner picks this choice. Required on choices that aren't accepted. */
    reply: strict(
      { speaker: SpeakerSchema, text: text("what they say") },
      "a reply (speaker, text)",
    ).optional(),
  },
  "a choice (text, and a reply for choices that aren't accepted)",
);

/**
 * Ticks when the learner submits an accepted answer for this objective (compared with
 * `normalizeAnswer`). With `choices`, the runner shows buttons instead of a text box: a choice
 * that isn't accepted shows its reply and lets the learner pick again. Answers ship in the client
 * bundle on purpose (improvement #3): nothing is recorded, so peeking only spoils your own mission.
 */
const AnswerCheckSchema = strict(
  {
    kind: z.literal("answer"),
    accept: z.array(text("an accepted answer")).min(1, "Add at least one accepted answer."),
    choices: z
      .array(AnswerChoiceSchema)
      .min(2, "Give the learner at least two choices.")
      .optional(),
  },
  "an answer check",
).superRefine((check, ctx) => {
  if (!check.choices) return;
  const seen = new Map<string, number>();
  check.choices.forEach((choice, index) => {
    const key = normalizeAnswer(choice.text);
    if (seen.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["choices", index, "text"],
        message: `Two choices say "${choice.text}". Make each choice different.`,
      });
    }
    seen.set(key, index);
  });
  const accepted = new Set(check.accept.map(normalizeAnswer));
  check.accept.forEach((answer, index) => {
    if (!seen.has(normalizeAnswer(answer))) {
      ctx.addIssue({
        code: "custom",
        path: ["accept", index],
        message: `"${answer}" isn't one of the choices. With choices, every accepted answer must be a choice's text.`,
      });
    }
  });
  check.choices.forEach((choice, index) => {
    if (!accepted.has(normalizeAnswer(choice.text)) && !choice.reply) {
      ctx.addIssue({
        code: "custom",
        path: ["choices", index, "reply"],
        message:
          "This choice isn't accepted, so it needs a reply: a character explains what would happen, and the learner picks again.",
      });
    }
  });
});

/**
 * What must be true about a file. Every field given must hold. `exists` defaults to true.
 * Modes are octal: `mode` is exact ("600"), `modeIncludes` bits must be set, `modeExcludes` bits
 * must be clear ("044": group and others can't read). `readableBy` uses the engine's real
 * permission rules for that user, including search permission on every folder above the file.
 * `contains` and `notContains` need a regular file.
 */
const FilePredicateSchema = strict(
  {
    exists: z.boolean().optional(),
    type: z.enum(["file", "dir", "symlink"]).optional(),
    mode: OctalModeSchema.optional(),
    modeIncludes: OctalModeSchema.optional(),
    modeExcludes: OctalModeSchema.optional(),
    owner: z.string().min(1).optional(),
    group: z.string().min(1).optional(),
    contains: z.string().min(1).optional(),
    notContains: z.string().min(1).optional(),
    readableBy: z.string().min(1).optional(),
    notReadableBy: z.string().min(1).optional(),
  },
  "the predicate: what must be true about the file",
).superRefine((predicate, ctx) => {
  const given = Object.entries(predicate)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  if (given.length === 0) {
    ctx.addIssue({
      code: "custom",
      message:
        "Say what must be true about the file: exists, type, mode, modeIncludes, modeExcludes, owner, group, contains, notContains, readableBy or notReadableBy.",
    });
  }
  if (predicate.exists === false && given.length > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["exists"],
      message:
        "exists: false can't be combined with other fields: a file that isn't there has no mode, owner or content.",
    });
  }
  if (predicate.modeIncludes !== undefined && predicate.modeExcludes !== undefined) {
    const overlap =
      Number.parseInt(predicate.modeIncludes, 8) & Number.parseInt(predicate.modeExcludes, 8);
    if (overlap !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["modeExcludes"],
        message: "modeIncludes and modeExcludes ask for the same bits, so this can never be true.",
      });
    }
  }
});

/** Ticks when a file on a machine matches the predicate. `host` defaults to the learner's own. */
const FileStateCheckSchema = strict(
  {
    kind: z.literal("fileState"),
    path: z.string().regex(/^\//, 'Use an absolute path, starting with "/".'),
    host: z.string().min(1).optional(),
    predicate: FilePredicateSchema,
  },
  "a file check",
);

/**
 * Ticks when a command the learner ran matches `pattern`, a JavaScript regular expression searched
 * (not anchored) in the command line as typed. Only commands that succeeded (exit code 0) count,
 * unless `anyExitCode` is true.
 */
const CommandRunCheckSchema = strict(
  {
    kind: z.literal("commandRun"),
    pattern: z
      .string()
      .min(1)
      .refine((pattern) => {
        try {
          new RegExp(pattern);
          return true;
        } catch {
          return false;
        }
      }, "This isn't a regular expression JavaScript can read. Check the brackets and backslashes."),
    anyExitCode: z.boolean().optional(),
  },
  "a command check",
);

export type EventCheck = z.output<typeof EventCheckSchema>;
export type AnswerChoice = z.output<typeof AnswerChoiceSchema>;
export type AnswerCheck = z.output<typeof AnswerCheckSchema>;
export type FilePredicate = z.output<typeof FilePredicateSchema>;
export type FileStateCheck = z.output<typeof FileStateCheckSchema>;
export type CommandRunCheck = z.output<typeof CommandRunCheckSchema>;

/** `all`: every check inside must hold. `any`: at least one must. */
export interface CheckGroup {
  kind: "all" | "any";
  of: ObjectiveCheck[];
}

export interface CheckGroupInput {
  kind: "all" | "any";
  of: ObjectiveCheckInput[];
}

/** How an objective is checked: declarative data, never a function. */
export type ObjectiveCheck =
  EventCheck | AnswerCheck | FileStateCheck | CommandRunCheck | CheckGroup;

/** An objective check as written in the file (modes may still be numbers). */
export type ObjectiveCheckInput =
  | z.input<typeof EventCheckSchema>
  | z.input<typeof AnswerCheckSchema>
  | z.input<typeof FileStateCheckSchema>
  | z.input<typeof CommandRunCheckSchema>
  | CheckGroupInput;

export const OBJECTIVE_CHECK_KINDS = [
  "event",
  "answer",
  "fileState",
  "commandRun",
  "all",
  "any",
] as const satisfies readonly ObjectiveCheck["kind"][];

export const ObjectiveCheckSchema: z.ZodType<ObjectiveCheck, ObjectiveCheckInput> = z.lazy(() =>
  z.discriminatedUnion(
    "kind",
    [
      EventCheckSchema,
      AnswerCheckSchema,
      FileStateCheckSchema,
      CommandRunCheckSchema,
      CheckGroupSchema,
    ],
    {
      error: (issue) => {
        if (issue.input === undefined) return "Missing: add a check that says when this is done.";
        if (issue.code === "invalid_union") {
          const kind = isRecord(issue.input) ? issue.input.kind : undefined;
          return kind === undefined
            ? `Start the check with kind: one of ${OBJECTIVE_CHECK_KINDS.join(", ")}.`
            : `"${String(kind)}" isn't a kind of check. Use one of: ${OBJECTIVE_CHECK_KINDS.join(", ")}.`;
        }
        if (issue.code === "invalid_type") {
          return `A check is a group of fields starting with kind (${OBJECTIVE_CHECK_KINDS.join(", ")}), not ${describeValue(issue.input)}.`;
        }
        return undefined;
      },
    },
  ),
);

const CheckGroupSchema = strict(
  {
    kind: z.enum(["all", "any"]),
    of: z.array(ObjectiveCheckSchema).min(1, "Put at least one check inside."),
  },
  "a group of checks",
);

// ---------------------------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------------------------

/**
 * One step of the mission. `optional` marks a bonus objective; `hidden` a secret, which is always
 * optional (the output sets `optional: true`) and stays off the list until it's found.
 */
const ObjectiveSchema = strict(
  {
    id: ContentIdSchema,
    description: text("what to do, starting with a verb"),
    why: text("one line on why this step matters"),
    success: text("the celebration line shown when it's done"),
    check: ObjectiveCheckSchema,
    optional: z.boolean().optional(),
    hidden: z.boolean().default(false),
  },
  "an objective",
)
  .superRefine((objective, ctx) => {
    if (objective.hidden && objective.optional === false) {
      ctx.addIssue({
        code: "custom",
        path: ["optional"],
        message: "Hidden objectives are always optional. Remove optional: false.",
      });
    }
  })
  .transform(({ optional, ...objective }) => ({
    ...objective,
    optional: objective.hidden || optional === true,
  }));

export type Objective = z.output<typeof ObjectiveSchema>;

/** Three tiers per objective: a nudge, then the idea, then a near-answer. */
const HINT_TIERS_MESSAGE =
  "Write exactly three hints, in order: a nudge, then the idea, then a near-answer.";

const HintTiersSchema = z.tuple(
  [
    text("the first hint: a nudge"),
    text("the second hint: the idea"),
    text("the third hint: a near-answer"),
  ],
  {
    error: (issue) =>
      issue.code === "too_small" || issue.code === "too_big" || issue.code === "invalid_type"
        ? HINT_TIERS_MESSAGE
        : undefined,
  },
);

// ---------------------------------------------------------------------------------------------
// The scenario that seeds the engine
// ---------------------------------------------------------------------------------------------

const NetworkInterfaceSchema = strict(
  { ip: z.string().min(1), subnet: z.string().min(1) },
  "a network interface (ip and subnet)",
);

const OsProfileSchema = strict(
  {
    family: z.enum(["linux", "windows", "bsd", "macos", "embedded", "other"]),
    name: z.string().min(1),
    version: VersionSchema.optional(),
  },
  "the operating system (family and name)",
);

const HeadersSchema = z.record(z.string().min(1), z.string());

const HttpPageSchema = strict(
  {
    status: z.number().int().min(100).max(599),
    title: z.string().optional(),
    body: z.string().optional(),
    headers: HeadersSchema.optional(),
  },
  "a web page (status, and optionally title, body, headers)",
);

const ServiceSchema = strict(
  {
    port: z.number().int(),
    protocol: z.enum(["tcp", "udp"]),
    name: z.string().min(1),
    product: z.string().min(1),
    version: VersionSchema,
    banner: z.string().optional(),
    reachableFrom: z.array(z.string().min(1)).optional(),
    http: strict(
      { headers: HeadersSchema.optional(), pages: z.record(z.string(), HttpPageSchema) },
      "the web pages this service answers with",
    ).optional(),
  },
  "a service",
);

const UserSpecSchema = strict(
  {
    name: z.string().min(1),
    uid: z.number().int().min(0),
    group: z.string().min(1).optional(),
    groups: z.array(z.string().min(1)).optional(),
    home: z.string().min(1).optional(),
    shell: z.string().min(1).optional(),
    passwordHash: z.string().min(1).optional(),
  },
  "a user (name and uid)",
);

const GroupSpecSchema = strict(
  { name: z.string().min(1), gid: z.number().int().min(1).optional() },
  "a group (name)",
);

const FsEntrySpecSchema = strict(
  {
    path: z.string().regex(/^\//, 'Use an absolute path, starting with "/".'),
    type: z.enum(["file", "dir", "symlink"]).optional(),
    content: z.string().optional(),
    target: z.string().optional(),
    owner: z.string().min(1).optional(),
    group: z.string().min(1).optional(),
    mode: OctalModeSchema.optional(),
    mtime: z.string().min(1).optional(),
  },
  "a file entry",
);

const HostSpecSchema = strict(
  {
    id: z.string().min(1),
    hostname: z.string().min(1),
    interfaces: z.array(NetworkInterfaceSchema).min(1, "Give the host at least one interface."),
    os: OsProfileSchema,
    services: z.array(ServiceSchema).optional(),
    reachableFrom: z.array(z.string().min(1)).optional(),
    respondsToPing: z.boolean().optional(),
    fs: strict(
      {
        base: z.enum(["linux", "empty"]).optional(),
        entries: z.array(FsEntrySpecSchema).optional(),
      },
      "a filesystem",
    ).optional(),
    users: z.array(UserSpecSchema).optional(),
    groups: z.array(GroupSpecSchema).optional(),
  },
  "a host",
);

/**
 * The engine's ScenarioSpec as mission data, plus the run's `seed`. `id` defaults to the mission
 * id. Deep checks (reserved address ranges, file owners that exist, a session host with a
 * filesystem) are the engine's: the mission loader builds every scenario with createInitialState.
 */
const ScenarioDefinitionSchema = strict(
  {
    id: ContentIdSchema.optional(),
    seed: z
      .number()
      .int()
      .min(0)
      .max(MISSION_SEED_MAX, `The seed is a whole number from 0 to ${MISSION_SEED_MAX}.`),
    startTime: z.string().min(1).optional(),
    network: strict(
      {
        subnets: z
          .array(
            strict({ cidr: z.string().min(1), name: z.string().min(1).optional() }, "a subnet"),
          )
          .optional(),
        hosts: z.array(HostSpecSchema).min(1, "Add at least one host."),
      },
      "the network (hosts, and optionally named subnets)",
    ),
    session: strict(
      {
        host: z.string().min(1),
        user: z.string().min(1),
        cwd: z.string().min(1).optional(),
        env: z.record(z.string().min(1), z.string()).optional(),
      },
      "where the learner starts (host and user)",
    ),
    knownHosts: z.array(z.string().min(1)).optional(),
    flags: z
      .array(strict({ id: z.string().min(1), token: z.string().min(1) }, "a flag (id and token)"))
      .optional(),
  },
  "the scenario: the machines and network the mission runs on, and a seed",
);

export type ScenarioDefinition = z.output<typeof ScenarioDefinitionSchema>;

// ---------------------------------------------------------------------------------------------
// The mission
// ---------------------------------------------------------------------------------------------

/** A mission id or slug, with a clearer message when it's missing. */
const missionIdSchema = (what: string) =>
  z
    .string(required(what))
    .regex(
      CONTENT_ID_PATTERN,
      "Use lowercase letters, digits and single hyphens, like `linux-01`.",
    );

export const MissionSchema = strict(
  {
    /** Stable and never reused. Must match the file name: `linux-01` lives in `linux-01.yaml`. */
    id: missionIdSchema("the id: the file name without .yaml, like `linux-01`"),
    /** The URL: /missions/<slug>. */
    slug: missionIdSchema("the slug: the mission's address, as in /missions/<slug>"),
    /** Bump when objectives change; replay tests key on it. */
    version: z.number(required("the version: 1 for a new mission")).int().min(1),
    title: text("the mission's name").max(80, "Keep the title to 80 characters or fewer."),
    difficulty: z.enum(
      MISSION_DIFFICULTIES,
      required(`the difficulty, one of: ${MISSION_DIFFICULTIES.join(", ")}`),
    ),
    estimatedMinutes: z
      .number(required("estimatedMinutes: about how long the mission takes, in minutes"))
      .int()
      .min(1),
    /** Skills practised: shown in the debrief, and used to filter the mission list. */
    skills: z
      .array(
        z.enum(SKILL_IDS),
        required(`the skills the mission practises, from: ${SKILL_IDS.join(", ")}`),
      )
      .min(1, "Tag at least one skill the mission practises.")
      .refine(
        (skills) => new Set(skills).size === skills.length,
        "Each skill may appear only once.",
      ),
    /** Mission ids shown as "Best after: …". A suggestion, never a lock. */
    prerequisites: uniqueIds(ContentIdSchema).default([]),
    /** One line that makes a beginner want to click. */
    hook: oneLine("the hook: one line from the story that makes a beginner want to click"),
    /** "You'll learn…": plain-language bullets. */
    learningGoals: z
      .array(
        text("a learning goal"),
        required(
          `the learning goals: ${LEARNING_GOALS_MIN} to ${LEARNING_GOALS_MAX} plain-language lines on what the learner will learn`,
        ),
      )
      .min(
        LEARNING_GOALS_MIN,
        `Write ${LEARNING_GOALS_MIN} to ${LEARNING_GOALS_MAX} learning goals.`,
      )
      .max(
        LEARNING_GOALS_MAX,
        `Write ${LEARNING_GOALS_MIN} to ${LEARNING_GOALS_MAX} learning goals.`,
      ),
    /** Lesson ids for every concept the mission needs. Checked against the lessons in CI. */
    concepts: uniqueIds(ContentIdSchema).default([]),
    briefing: strict(
      {
        scenario: text("the situation: who asked for help, and why"),
        role: text("who the learner is playing"),
        authorization: text(
          "the authorization: who gave written permission, and exactly what's in scope",
        ),
      },
      "the briefing (scenario, role, authorization)",
    ),
    story: z
      .array(StoryBeatSchema, required("the story: character lines that play during the mission"))
      .min(1, "Add at least one story beat."),
    scenario: ScenarioDefinitionSchema,
    objectives: z
      .array(
        ObjectiveSchema,
        required(
          `the objectives: ${MAIN_OBJECTIVES_MIN} to ${MAIN_OBJECTIVES_MAX} main steps, each with a check`,
        ),
      )
      .min(1, "Add the mission's objectives."),
    /** Three hint tiers for every objective that isn't hidden, keyed by objective id. */
    hints: z.record(
      z.string(),
      HintTiersSchema,
      required("the hints: three for every objective except hidden ones, under its id"),
    ),
    debrief: strict(
      {
        summary: text("the summary: what the learner did in this episode"),
        /** Mirrors learningGoals, one line each, in the past tense. */
        whatYouLearned: z
          .array(
            text("a line of what the learner learned"),
            required("whatYouLearned: one line in the past tense for each learning goal"),
          )
          .min(LEARNING_GOALS_MIN)
          .max(LEARNING_GOALS_MAX),
        ethicsNote: text(
          "the ethics note: what this would do in the real world, who it would affect, and what makes it OK here",
        ),
        defensiveTakeaway: text("the defensive takeaway: how a defender would stop this"),
        nextTease: oneLine("the next tease: a one-line story hook for the next mission"),
        furtherReading: uniqueIds(ContentIdSchema).default([]),
      },
      "the debrief (summary, whatYouLearned, ethicsNote, defensiveTakeaway, nextTease)",
    ),
    /**
     * Start the terminal's guided first-run tour with this mission (phase 05 beginner mode). A
     * flag in the data, so no component ever branches on a mission id.
     */
    guidedTour: z.boolean().default(false),
  },
  "a mission",
).superRefine((mission, ctx) => {
  const problem = (path: PropertyKey[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });

  const cap = MISSION_MINUTES_MAX[mission.difficulty];
  if (mission.estimatedMinutes > cap) {
    problem(
      ["estimatedMinutes"],
      `${mission.difficulty} missions take ${cap} minutes or less, so they fit one sitting. Split this one into two missions.`,
    );
  }

  if (mission.prerequisites.includes(mission.id)) {
    problem(["prerequisites"], "A mission can't be its own prerequisite.");
  }

  if (mission.debrief.whatYouLearned.length !== mission.learningGoals.length) {
    problem(
      ["debrief", "whatYouLearned"],
      `Write one line for each learning goal: there are ${plural(mission.learningGoals.length, "goal")} and ${plural(mission.debrief.whatYouLearned.length, "line")} here.`,
    );
  }

  const objectiveIds = new Set<string>();
  mission.objectives.forEach((objective, index) => {
    if (objectiveIds.has(objective.id)) {
      problem(["objectives", index, "id"], `Two objectives have the id "${objective.id}".`);
    }
    objectiveIds.add(objective.id);
  });

  const main = mission.objectives.filter((objective) => !objective.optional).length;
  if (main < MAIN_OBJECTIVES_MIN || main > MAIN_OBJECTIVES_MAX) {
    problem(
      ["objectives"],
      `A mission has ${MAIN_OBJECTIVES_MIN} to ${MAIN_OBJECTIVES_MAX} main objectives (not optional or hidden); this one has ${main}. Small steps, frequent wins.`,
    );
  }

  for (const key of Object.keys(mission.hints)) {
    if (!objectiveIds.has(key)) {
      const suggestion = closestName(key, [...objectiveIds]);
      problem(
        ["hints", key],
        `There's no objective with the id "${key}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
      );
    }
  }
  for (const objective of mission.objectives) {
    if (!objective.hidden && !Object.hasOwn(mission.hints, objective.id)) {
      problem(
        ["hints"],
        `Add three hints for the objective "${objective.id}". Every objective except hidden ones needs them.`,
      );
    }
  }

  mission.story.forEach((beat, index) => {
    if (
      typeof beat.on === "object" &&
      "objective" in beat.on &&
      !objectiveIds.has(beat.on.objective)
    ) {
      problem(
        ["story", index, "on", "objective"],
        `There's no objective with the id "${beat.on.objective}".`,
      );
    }
  });
});

/** A mission as written in its file. */
export type MissionInput = z.input<typeof MissionSchema>;

/** A mission after validation, with defaults filled in and hidden objectives marked optional. */
export type Mission = z.output<typeof MissionSchema>;

// ---------------------------------------------------------------------------------------------
// Parsing with readable problems
// ---------------------------------------------------------------------------------------------

/**
 * Where a problem is, for an author: `objectives[find-note].why`, `story[3].text`. List items
 * with an id are named by it; other positions count from 1.
 */
export function formatIssuePath(path: readonly PropertyKey[], data: unknown): string {
  let out = "";
  let node: unknown = data;
  for (const segment of path) {
    if (typeof segment === "number") {
      const item: unknown = Array.isArray(node) ? node[segment] : undefined;
      const id = isRecord(item) && typeof item.id === "string" && item.id !== "" ? item.id : null;
      out += id === null ? `[${segment + 1}]` : `[${id}]`;
      node = item;
    } else {
      const key = String(segment);
      out += out === "" ? key : `.${key}`;
      node = isRecord(node) && Object.hasOwn(node, key) ? node[key] : undefined;
    }
  }
  return out;
}

export type MissionParseResult =
  | { readonly success: true; readonly mission: Mission }
  | { readonly success: false; readonly problems: readonly string[] };

/** Validates mission data (already read from YAML), listing every problem as `path: message`. */
export function parseMission(data: unknown): MissionParseResult {
  const result = MissionSchema.safeParse(data, { error: authorErrorMap });
  if (result.success) return { success: true, mission: result.data };
  return {
    success: false,
    problems: result.error.issues.map((issue) => {
      const path = formatIssuePath(issue.path, data);
      return path === "" ? issue.message : `${path}: ${issue.message}`;
    }),
  };
}

/**
 * The engine's ScenarioSpec for a mission: its scenario without the seed, with the mission id as
 * the scenario id unless it sets its own. Build the starting state with
 * `createInitialState(toScenarioSpec(mission), mission.scenario.seed)`.
 *
 * The return type is also the compile-time proof that the schema above still matches the engine's
 * ScenarioSpec: if the engine's spec changes shape, this stops compiling.
 */
export function toScenarioSpec(mission: Pick<Mission, "id" | "scenario">): ScenarioSpec {
  const { id, seed, ...spec } = mission.scenario;
  void seed; // the seed goes to createInitialState, not into the spec
  return { ...spec, id: id ?? mission.id };
}
