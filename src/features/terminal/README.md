# src/features/terminal

The browser terminal (phase 05): a thin, accessible renderer over the engine, plus the beginner layer. It contains no command implementations and no simulation logic: every command runs in the engine (`src/sim/tools`), through `step`.

- `parser/` — text to a syntax tree (quoting, escapes, `$VAR`, `~`, pipes, redirection, `&&`, `||`, `;`, comments) with typed parse errors and their column; `toShellCommand` lowers it to the engine's `ShellCommand`. Pure data, never evaluated. `context.ts` finds the word under the cursor for completion.
- `session/` — `terminal-session.ts`, the session as pure data (engine state, the run for replay, the screen buffer with scrollback) and every change to it; `ansi.ts` turns colour codes into spans once, when a line arrives.
- `hooks/use-terminal-session.ts` — the React bridge: `submit`, `interrupt`, `clear`, `reset`, `snapshot`, `history`, `prompt`, plus the completion and suggestion helpers the prompt uses. Nothing is stored anywhere.
- `beginner/` — explainer copy for every engine and parse error code (`explain-error.ts`, test-enforced), "did you mean" and command aliases (`suggest.ts`), Tab completion and ghost text (`autocomplete.ts`), "What just happened?" (`what-happened.ts`), the guided tour (`tour.ts`), and the cheat sheet's groups.
- `a11y/announce.ts` — what the live region reads after each command; long output is summarised.
- `components/` — `Terminal` (header with the SIMULATED badge, Help menu, Copy transcript, Reset machine; the output log; chips; the prompt), `OutputBlock`, `PromptInput` (a real input over a mirror that draws the block cursor and ghost text), `TerminalTour`, `ShortcutsDialog`, `CommandCheatSheet`. Components import nothing from `@/sim` at runtime (a test checks).

Public API: `index.ts` only. Never import here: another feature's internals.
