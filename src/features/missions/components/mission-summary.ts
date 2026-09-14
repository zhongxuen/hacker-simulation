import type { Mission, MissionDifficulty } from "@/content/schemas/mission";
import type { Skill } from "@/content/skills";

/** What a mission card shows: enough to choose, nothing that spoils it. */
export interface MissionSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly hook: string;
  readonly difficulty: MissionDifficulty;
  readonly estimatedMinutes: number;
  readonly skills: readonly Skill[];
  readonly bestAfter: readonly string[];
}

/** A mission's card data. Answers and scenario stay out of the list page. */
export function summarizeMission(
  mission: Mission,
  titles: ReadonlyMap<string, string>,
): MissionSummary {
  return {
    id: mission.id,
    slug: mission.slug,
    title: mission.title,
    hook: mission.hook,
    difficulty: mission.difficulty,
    estimatedMinutes: mission.estimatedMinutes,
    skills: mission.skills,
    bestAfter: mission.prerequisites.map((id) => titles.get(id) ?? id),
  };
}
