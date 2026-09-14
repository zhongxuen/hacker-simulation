/**
 * pnpm mission:validate [id...]
 *
 * Checks one mission, several, or all of them, and lists every problem in words an author can act
 * on: the YAML and schema, the scenario (the engine builds it), ids across the catalog, lesson
 * links, the voice-and-tone banned words, the playthrough (it must play to the end), and any TODO
 * left from the template. Exits with 1 if anything must be fixed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { missionCopy } from "@/content/mission-copy";
import type { Mission } from "@/content/schemas/mission";
import { findBannedWords } from "@/content/voice";
import { verifyPlaythrough } from "@/features/missions";
import {
  buildMissionCatalog,
  loadPlaythrough,
  MissionSourceError,
  MISSIONS_DIR,
  parseMissionSource,
} from "@/features/missions/server";

const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const files = readdirSync(MISSIONS_DIR)
  .filter((name) => name.endsWith(".yaml"))
  .sort();

const parsed = new Map<string, Mission>();
const problems = new Map<string, string[]>();
const warnings = new Map<string, string[]>();
const add = (map: Map<string, string[]>, file: string, line: string) =>
  map.set(file, [...(map.get(file) ?? []), line]);

for (const file of files) {
  try {
    parsed.set(file, parseMissionSource(readFileSync(join(MISSIONS_DIR, file), "utf8"), file));
  } catch (error) {
    if (!(error instanceof MissionSourceError)) throw error;
    for (const problem of error.problems) add(problems, file, problem);
  }
}

// Checks across missions: unique ids and slugs, prerequisites that exist and don't loop.
try {
  buildMissionCatalog([...parsed].map(([fileName, mission]) => ({ fileName, mission })));
} catch (error) {
  if (!(error instanceof MissionSourceError)) throw error;
  for (const problem of error.problems) add(problems, error.fileName, problem);
}

// Lesson ids are their file names (the lesson loader enforces it). Reading the names keeps this
// script clear of the MDX compiler, which only loads as an ES module.
const lessonIds = new Set(
  readdirSync(join(process.cwd(), "src", "content", "lessons"))
    .filter((name) => name.endsWith(".mdx"))
    .map((name) => name.slice(0, -".mdx".length)),
);

for (const [file, mission] of parsed) {
  for (const id of mission.concepts) {
    if (!lessonIds.has(id)) add(problems, file, `concepts: there's no lesson with the id "${id}".`);
  }
  for (const id of mission.debrief.furtherReading) {
    if (!lessonIds.has(id)) {
      add(problems, file, `debrief.furtherReading: there's no lesson with the id "${id}".`);
    }
  }
  for (const { path, text } of missionCopy(mission)) {
    for (const word of findBannedWords(text)) {
      add(
        problems,
        file,
        `${path}: "${word}" is on the banned list in md-files/voice-and-tone.md.`,
      );
    }
  }
  const playthrough = (() => {
    try {
      return loadPlaythrough(mission.id);
    } catch (error) {
      if (!(error instanceof MissionSourceError)) throw error;
      for (const problem of error.problems) add(problems, file, `playthrough: ${problem}`);
      return null;
    }
  })();
  if (playthrough === undefined) {
    add(
      problems,
      file,
      `There's no playthrough. Add src/content/missions/playthroughs/${mission.id}.yaml (pnpm mission:new writes one).`,
    );
  } else if (playthrough) {
    for (const problem of verifyPlaythrough(mission, playthrough).problems) {
      add(problems, file, `playthrough: ${problem}`);
    }
  }
  const todos = readFileSync(join(MISSIONS_DIR, file), "utf8")
    .split("\n")
    .flatMap((line, index) => (/\bTODO\b/.test(line) ? [index + 1] : []));
  if (todos.length > 0) {
    add(
      warnings,
      file,
      `${todos.length} TODO${todos.length === 1 ? "" : "s"} left, on line${todos.length === 1 ? "" : "s"} ${todos.join(", ")}. CI won't ship a mission with a TODO in it.`,
    );
  }
}

const selected = files.filter((file) => {
  if (wanted.length === 0) return true;
  const id = file.slice(0, -".yaml".length);
  const mission = parsed.get(file);
  return wanted.includes(id) || (mission !== undefined && wanted.includes(mission.slug));
});
const unknown = wanted.filter(
  (id) => !files.some((file) => file === `${id}.yaml` || parsed.get(file)?.slug === id),
);
for (const id of unknown) {
  console.log(`✗ ${id}: there's no mission with that id or slug in src/content/missions.`);
}

let failed = unknown.length > 0;
for (const file of selected) {
  const fileProblems = problems.get(file) ?? [];
  const fileWarnings = warnings.get(file) ?? [];
  const todoOnly = fileProblems.length === 0 && fileWarnings.length > 0;
  console.log(`${fileProblems.length > 0 ? "✗" : todoOnly ? "!" : "✓"} ${file}`);
  for (const problem of fileProblems) console.log(`    - ${problem}`);
  for (const warning of fileWarnings) console.log(`    ! ${warning}`);
  if (fileProblems.length > 0 || fileWarnings.length > 0) failed = true;
}

console.log("");
console.log(
  failed
    ? "Some missions need fixing. Each line above says where the problem is and what to change."
    : `All ${selected.length} ${selected.length === 1 ? "mission is" : "missions are"} valid and play to the end.`,
);
process.exit(failed ? 1 : 0);
