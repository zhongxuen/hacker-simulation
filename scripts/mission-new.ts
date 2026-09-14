/**
 * pnpm mission:new <slug>
 *
 * Scaffolds a new mission: src/content/missions/<slug>.yaml, which validates and plays to the end
 * as it is, with every piece of copy marked TODO, and its playthrough in
 * src/content/missions/playthroughs/<slug>.yaml. The guide is md-files/authoring-missions.md.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CONTENT_ID_PATTERN } from "@/content/schemas/ids";
import { MISSIONS_DIR, parseMissionSource, PLAYTHROUGHS_DIR } from "@/features/missions/server";
import { missionTemplate, playthroughTemplate } from "./lib/mission-template";

const slug = process.argv[2];
const where = (path: string) => relative(process.cwd(), path);

if (slug === undefined || slug.startsWith("-")) {
  console.error("Give the new mission's id, like: pnpm mission:new web-01");
  process.exit(1);
}
if (!CONTENT_ID_PATTERN.test(slug)) {
  console.error(
    `"${slug}" can't be a mission id. Use lowercase letters, digits and single hyphens, like web-01.`,
  );
  process.exit(1);
}

const missionPath = join(MISSIONS_DIR, `${slug}.yaml`);
const playthroughPath = join(PLAYTHROUGHS_DIR, `${slug}.yaml`);
if (existsSync(missionPath)) {
  console.error(`${where(missionPath)} already exists. Pick another id, or edit that file.`);
  process.exit(1);
}

const source = missionTemplate(slug);
// The template must always validate: if this throws, the template is broken, not the author.
parseMissionSource(source, `${slug}.yaml`);

writeFileSync(missionPath, source);
mkdirSync(PLAYTHROUGHS_DIR, { recursive: true });
if (!existsSync(playthroughPath)) writeFileSync(playthroughPath, playthroughTemplate(slug));

console.log(`Created ${where(missionPath)}`);
console.log(`Created ${where(playthroughPath)}`);
console.log("");
console.log("Next:");
console.log("  1. Replace every TODO. md-files/authoring-missions.md walks through each field.");
console.log(`  2. pnpm mission:validate ${slug}   checks the file, with readable errors`);
console.log(
  `  3. pnpm mission:play ${slug}       plays it from the playthrough and prints the transcript`,
);
console.log(`  4. Open http://localhost:3000/missions/${slug} with pnpm dev running.`);
