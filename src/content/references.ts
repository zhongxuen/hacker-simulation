/**
 * Cross-reference checking for learning content (md-files/09-learning-center.md, "Content model").
 *
 * Dead links are the standard failure mode of a docs system, so CI catches them rather than a
 * reader: every lesson prerequisite, related mission, related command and glossary term, every
 * glossary cross-link, and every mission `concepts` entry must point at something that exists.
 *
 * This is a pure function over plain lists, so the test that runs it decides where each catalog
 * comes from (lessons from src/content/lessons, commands from the engine's tool registry, and so
 * on) without src/content importing any of them.
 */

export interface LessonReferences {
  readonly id: string;
  readonly prerequisites: readonly string[];
  readonly relatedMissions: readonly string[];
  readonly relatedCommands: readonly string[];
  readonly glossaryTerms: readonly string[];
  /** Glossary ids used by <Term id="…"> in the lesson's body. */
  readonly termsInBody?: readonly string[];
}

export interface GlossaryReferences {
  readonly id: string;
  readonly relatedTerms: readonly string[];
  readonly relatedLessons: readonly string[];
}

export interface MissionReferences {
  readonly id: string;
  /** Lesson ids the mission teaches or relies on (phase 06). */
  readonly concepts: readonly string[];
}

export interface ContentCatalog {
  readonly lessons: readonly LessonReferences[];
  readonly glossary: readonly GlossaryReferences[];
  readonly missions: readonly MissionReferences[];
  /** Every command a learner can type: the engine's tools plus the terminal's own commands. */
  readonly commands: readonly string[];
}

export type ReferenceKind = "lesson" | "mission" | "command" | "glossary term";

export interface DeadReference {
  /** Where the reference is written: `lesson net-ports`, `glossary port`, `mission net-01`. */
  readonly source: string;
  /** The field holding it: `prerequisites`, `relatedTerms`, `<Term> in body`. */
  readonly field: string;
  readonly kind: ReferenceKind;
  /** The id that doesn't resolve. */
  readonly target: string;
}

/** Every reference in `catalog` that points at nothing, in catalog order. */
export function findDeadReferences(catalog: ContentCatalog): DeadReference[] {
  const known: Readonly<Record<ReferenceKind, ReadonlySet<string>>> = {
    lesson: new Set(catalog.lessons.map((lesson) => lesson.id)),
    mission: new Set(catalog.missions.map((mission) => mission.id)),
    command: new Set(catalog.commands),
    "glossary term": new Set(catalog.glossary.map((entry) => entry.id)),
  };

  const dead: DeadReference[] = [];
  const check = (
    source: string,
    field: string,
    kind: ReferenceKind,
    targets: readonly string[],
  ) => {
    for (const target of targets) {
      if (!known[kind].has(target)) dead.push({ source, field, kind, target });
    }
  };

  for (const lesson of catalog.lessons) {
    const source = `lesson ${lesson.id}`;
    check(source, "prerequisites", "lesson", lesson.prerequisites);
    check(source, "relatedMissions", "mission", lesson.relatedMissions);
    check(source, "relatedCommands", "command", lesson.relatedCommands);
    check(source, "glossaryTerms", "glossary term", lesson.glossaryTerms);
    check(source, "<Term> in body", "glossary term", [...new Set(lesson.termsInBody ?? [])]);
  }
  for (const entry of catalog.glossary) {
    const source = `glossary ${entry.id}`;
    check(source, "relatedTerms", "glossary term", entry.relatedTerms);
    check(source, "relatedLessons", "lesson", entry.relatedLessons);
  }
  for (const mission of catalog.missions) {
    check(`mission ${mission.id}`, "concepts", "lesson", mission.concepts);
  }

  return dead;
}

/** One line a content author can act on. */
export function describeDeadReference(reference: DeadReference): string {
  return `${reference.source} → ${reference.field}: no ${reference.kind} with id "${reference.target}"`;
}
