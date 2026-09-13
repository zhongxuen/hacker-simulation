# src/sim/tools

Simulated tools (`netscan`, `webprobe`, `logview`, `hashid`): pure functions `(args, state, ctx) => SimResult`. They get names distinct from real tools, output that is representative (never a byte-copy of a real tool), beginner-first `--help` text, and typed errors. Targets outside the reserved address ranges are refused as `OUT_OF_SCOPE`.

Adding a tool takes two files: the tool, and one line in `index.ts`. `listTools()` (`catalog.ts`, exported from `@/sim`) lists every registered tool's name and help one-liner without running anything, for cross-link checks and search.

Never import here: anything outside `src/sim`. These tools only ever act on the simulated network.
