/**
 * pnpm mission:play <id> [--script <file>] [--run "<command>"]... [--answer <objective>=<text>]...
 *
 * Plays a mission headlessly, through the same terminal session code and run reducer as the
 * browser, and prints the transcript: every command with its output, every tick with its success
 * line, and every story beat. With no options it plays the mission's playthrough
 * (src/content/missions/playthroughs/<id>.yaml) and checks it; with --run and --answer it plays
 * those steps instead, in order, for trying things out. Exits with 1 if the playthrough's checks
 * fail.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Playthrough, PlaythroughStep } from "@/content/schemas/playthrough";
import { formatPlaythrough, playMission, verifyPlaythrough } from "@/features/missions";
import {
  getMission,
  getMissionById,
  loadPlaythrough,
  MissionSourceError,
  parsePlaythroughSource,
} from "@/features/missions/server";

const args = process.argv.slice(2);
const id = args.find((arg, index) => !arg.startsWith("-") && !args[index - 1]?.startsWith("--"));
if (id === undefined) {
  console.error('Give the mission to play, like: pnpm mission:play net-01 (or add --run "ls").');
  process.exit(1);
}

let mission;
try {
  mission = getMissionById(id) ?? getMission(id);
} catch (error) {
  if (!(error instanceof MissionSourceError)) throw error;
  console.error(`${error.message}\n\nFix the mission first: pnpm mission:validate ${id}`);
  process.exit(1);
}
if (!mission) {
  console.error(`There's no mission with the id or slug "${id}" in src/content/missions.`);
  process.exit(1);
}

const steps: PlaythroughStep[] = [];
let scriptPath: string | undefined;
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  const value = args[index + 1];
  if (arg === "--run" && value !== undefined) {
    steps.push({ run: value });
    index++;
  } else if (arg === "--answer" && value !== undefined) {
    const [objective = "", ...text] = value.split("=");
    steps.push({ objective, answer: text.join("="), accepted: true });
    index++;
  } else if (arg === "--reset") {
    steps.push({ reset: true });
  } else if (arg === "--script" && value !== undefined) {
    scriptPath = value;
    index++;
  }
}

if (steps.length > 0) {
  // Trying things out: play the steps given, and show what happened.
  console.log(formatPlaythrough(mission, playMission(mission, steps)));
  process.exit(0);
}

let playthrough: Playthrough | undefined;
try {
  playthrough = scriptPath
    ? parsePlaythroughSource(readFileSync(scriptPath, "utf8"), basename(scriptPath))
    : loadPlaythrough(mission.id);
} catch (error) {
  if (!(error instanceof MissionSourceError)) throw error;
  console.error(error.message);
  process.exit(1);
}
if (!playthrough) {
  console.error(
    `${mission.id} has no playthrough yet. Add src/content/missions/playthroughs/${mission.id}.yaml, or pass steps with --run "<command>".`,
  );
  process.exit(1);
}

const { result, problems } = verifyPlaythrough(mission, playthrough);
console.log(formatPlaythrough(mission, result));
if (problems.length > 0) {
  console.log("\nThe playthrough didn't go as written:");
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}
console.log("\nThe playthrough went exactly as written.");
