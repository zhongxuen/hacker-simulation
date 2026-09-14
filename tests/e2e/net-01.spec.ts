import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { parse } from "yaml";
import { answer, objectives, onScreen, run, startMission } from "./helpers";

/**
 * The full net-01 playthrough in a real browser (md-files/11-testing-security-deployment.md,
 * "Testing strategy": "the full net-01 playthrough"). The steps are the mission's own playthrough
 * file, the same one CI plays headlessly (src/content/missions/playthroughs/net-01.yaml), typed
 * and clicked here the way a learner would: commands at the prompt, answers in the team chat,
 * wrong answers first where the playthrough takes them. Along the way the network map lights up,
 * and the run ends on the debrief with every objective, bonus and secret found.
 */

interface Step {
  readonly run?: string;
  readonly answer?: string;
  readonly objective?: string;
  readonly accepted?: boolean;
  readonly ticks?: readonly string[];
}

interface Objective {
  readonly id: string;
  readonly description: string;
  readonly name?: string;
  readonly optional?: boolean;
  readonly hidden?: boolean;
}

const CONTENT = join(process.cwd(), "src", "content", "missions");
const playthrough = parse(readFileSync(join(CONTENT, "playthroughs", "net-01.yaml"), "utf8")) as {
  steps: Step[];
  expect: { objectives: string[] };
};
const mission = parse(readFileSync(join(CONTENT, "net-01.yaml"), "utf8")) as {
  title: string;
  objectives: Objective[];
};
const byId = new Map(mission.objectives.map((objective) => [objective.id, objective]));

/** How the objectives list shows a ticked objective: "Done:", its name if it has one, its words. */
const doneLine = (objective: Objective) =>
  `Done: ${objective.name ? `${objective.name}: ` : ""}${onScreen(objective.description)}`;

test("net-01: map both networks, find telnet, report it, then the bonus and the secret", async ({
  page,
}) => {
  test.slow();
  await startMission(page, "net-01");
  const map = page.getByRole("region", { name: "Network map" });

  for (const step of playthrough.steps) {
    if (step.run !== undefined) await run(page, step.run);
    if (step.answer !== undefined) await answer(page, step.answer);

    for (const id of step.ticks ?? []) {
      const objective = byId.get(id)!;
      if (objective.hidden) continue; // A secret shows once found; the debrief checks it below.
      await expect(objectives(page)).toContainText(doneLine(objective));
    }
    if (step.answer !== undefined && step.accepted === false) {
      // A wrong turn never ends the run: the choice is still open, and no tick appeared.
      await expect(objectives(page)).not.toContainText(doneLine(byId.get(step.objective!)!));
    }
  }

  // The map shows what was found: the staff network, the servers, and backup-01's doors.
  await expect(map.getByRole("button", { name: /^backup-01, 10\.40\.2\.\d+/ })).toBeVisible();
  await map.getByRole("button", { name: "Table" }).click();
  await expect(map.getByRole("table", { name: /Computers you've found/ })).toContainText(
    "backup-01",
  );

  // Every main objective is done, so the debrief opens.
  await page.getByRole("button", { name: "See your debrief" }).click();
  const main = page.getByRole("main");
  await expect(main).toContainText(mission.title);
  for (const id of playthrough.expect.objectives) {
    const objective = byId.get(id)!;
    if (objective.name) await expect(main).toContainText(objective.name);
  }
});
