import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// Lints in-memory snippets as if they lived at `filePath`, so the boundary rules in
// eslint.config.mjs stay proven without committing any violating file.
let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd: process.cwd() });
  // The first lint loads the config, plugins and import resolver; pay that cost once, here.
  await eslint.lintText("export {};\n", { filePath: "src/sim/core/warmup.ts" });
}, 60_000);

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? "fatal");
}

describe("src/sim boundaries", () => {
  const simFile = "src/sim/core/boundary-probe.ts";

  it("rejects React and Next.js imports", async () => {
    expect(await ruleIdsFor(simFile, 'import React from "react";\nexport { React };\n')).toContain(
      "no-restricted-imports",
    );
    expect(
      await ruleIdsFor(simFile, 'import Link from "next/link";\nexport { Link };\n'),
    ).toContain("no-restricted-imports");
  });

  it("rejects Node I/O imports", async () => {
    expect(
      await ruleIdsFor(
        simFile,
        'import { readFileSync } from "node:fs";\nexport { readFileSync };\n',
      ),
    ).toContain("no-restricted-imports");
  });

  it("rejects imports from the rest of src", async () => {
    expect(
      await ruleIdsFor(simFile, 'import RootLayout from "@/app/layout";\nexport { RootLayout };\n'),
    ).toContain("import/no-restricted-paths");
  });

  it("rejects real time and randomness", async () => {
    const ids = await ruleIdsFor(
      simFile,
      "export const roll = () => Math.random() + Date.now() + new Date().getTime();\n",
    );
    expect(ids.filter((id) => id === "no-restricted-properties")).toHaveLength(2);
    expect(ids).toContain("no-restricted-syntax");
  });

  it("allows imports from inside src/sim", async () => {
    expect(await ruleIdsFor(simFile, 'export type {} from "@/sim/types";\n')).toEqual([]);
  });
});

describe("src/content boundaries", () => {
  const contentFile = "src/content/missions/boundary-probe.ts";

  it("allows @/sim/types", async () => {
    expect(await ruleIdsFor(contentFile, 'export type {} from "@/sim/types";\n')).toEqual([]);
  });

  it("rejects anything else in src", async () => {
    expect(
      await ruleIdsFor(
        contentFile,
        'import RootLayout from "@/app/layout";\nexport { RootLayout };\n',
      ),
    ).toContain("import/no-restricted-paths");
  });
});
