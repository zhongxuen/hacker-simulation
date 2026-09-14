import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { PlaythroughSchema, type Playthrough } from "@/content/schemas/playthrough";
import { MISSIONS_DIR } from "./catalog";
import { MISSION_FILE_EXTENSION, MissionSourceError } from "./source";

/**
 * Playthroughs: scripted runs of each mission, in src/content/missions/playthroughs, one per
 * mission and named after it (`net-01.yaml`). Server only: it reads files.
 */

export const PLAYTHROUGHS_DIR = join(MISSIONS_DIR, "playthroughs");

/** Reads and validates one playthrough file. Throws a MissionSourceError listing the problems. */
export function parsePlaythroughSource(source: string, fileName: string): Playthrough {
  let data: unknown;
  try {
    data = parseYaml(source.replace(/^﻿/, ""));
  } catch (error) {
    throw new MissionSourceError(fileName, [
      `The file isn't valid YAML: ${(error as Error).message}`,
    ]);
  }
  const result = PlaythroughSchema.safeParse(data);
  if (!result.success) {
    throw new MissionSourceError(
      fileName,
      result.error.issues.map((issue) => {
        const path = issue.path
          .map((segment) =>
            typeof segment === "number" ? `[${segment + 1}]` : `.${String(segment)}`,
          )
          .join("")
          .replace(/^\./, "");
        return path === "" ? issue.message : `${path}: ${issue.message}`;
      }),
    );
  }
  const expected = fileName.slice(0, -MISSION_FILE_EXTENSION.length);
  if (result.data.mission !== expected) {
    throw new MissionSourceError(fileName, [
      `mission is "${result.data.mission}", but the file is named ${fileName}. Name it ${result.data.mission}${MISSION_FILE_EXTENSION}.`,
    ]);
  }
  return result.data;
}

/** The playthrough for a mission id, or undefined if it has none. */
export function loadPlaythrough(
  missionId: string,
  dir: string = PLAYTHROUGHS_DIR,
): Playthrough | undefined {
  const fileName = `${missionId}${MISSION_FILE_EXTENSION}`;
  const path = join(dir, fileName);
  if (!existsSync(path)) return undefined;
  return parsePlaythroughSource(readFileSync(path, "utf8"), fileName);
}

/** Every playthrough in `dir`, by file name order. */
export function loadPlaythroughs(dir: string = PLAYTHROUGHS_DIR): Playthrough[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(MISSION_FILE_EXTENSION))
    .sort()
    .map((fileName) => parsePlaythroughSource(readFileSync(join(dir, fileName), "utf8"), fileName));
}
