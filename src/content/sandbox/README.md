# src/content/sandbox

The sandbox's practice machines (`/sandbox`): engine scenarios with no objectives, each a `SandboxScenario` with a title, a one-line beginner description, a few commands worth trying first, and whether to show the network map. They're all set on the Range, Candlewright's practice lab (`range.candlewright.example`, `192.168.60.0/24`, from the story bible's world facts), where every machine is a practice copy that resets.

Adding one: a file here exporting a `SandboxScenario`, and one line in `index.ts`. `tests/unit/sandbox-scenarios.test.ts` builds every scenario with the engine and runs its suggested commands.

Never import here: anything except `@/content` and `@/sim/types`. Keep every name fictional and every address in a reserved range.
