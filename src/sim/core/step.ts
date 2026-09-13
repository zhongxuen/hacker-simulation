/**
 * The engine's only entry point:
 *
 *   step(state, cmd, ctx) => { state, output, events, exitCode }
 *
 * It never mutates its inputs, never reads real time or randomness, and never evaluates anything
 * the learner typed as code: the first word is looked up in the tool registry, and the tool is a
 * plain function over data.
 */
import { defaultRegistry } from "../tools";
import { renderHelp } from "../tools/help";
import { failure, formatArgv, success } from "./output";
import { freezeInDev } from "./freeze";
import { createRng, deriveSeed } from "./rng";
import type { ExecCommand, SimCommand, SimContext, SimEvent, SimResult, SimState } from "./types";

export function step(state: SimState, cmd: SimCommand, ctx: SimContext): SimResult {
  const now = ctx.now(); // exactly once per step, so a stepping clock stays in sync with commands
  switch (cmd.type) {
    case "exec":
      return freezeInDev(exec(state, cmd, ctx, now));
  }
}

function exec(state: SimState, cmd: ExecCommand, ctx: SimContext, now: number): SimResult {
  const [name, ...args] = cmd.argv;
  // An empty line does nothing and doesn't count as a command.
  if (name === undefined || name.trim() === "") return success(state, []);

  const tick = state.tick + 1;
  const base: SimState = { ...state, tick };
  const tool = (ctx.registry ?? defaultRegistry).get(name);
  let result: SimResult;
  if (!tool) {
    result = failure(name, { code: "UNKNOWN_COMMAND", command: name }, base);
  } else if (asksForHelp(args)) {
    result = success(base, renderHelp(tool.name, tool.help), [
      { type: "help.viewed", command: tool.name },
    ]);
  } else {
    const rng = createRng(deriveSeed(state.seed, tick));
    result = tool.run(args, base, {
      rng,
      now,
      tick,
      ...(cmd.stdin !== undefined && { stdin: cmd.stdin }),
    });
  }
  return finish(result, name, formatArgv(cmd.argv));
}

/** Every tool supports `--help`, handled here so no tool can forget it. A `--` ends options. */
function asksForHelp(args: readonly string[]): boolean {
  const help = args.indexOf("--help");
  const end = args.indexOf("--");
  return help !== -1 && (end === -1 || help < end);
}

/** Adds the events every command gets: errors it reported, flags it revealed, and that it ran. */
function finish(result: SimResult, command: string, line: string): SimResult {
  const events: SimEvent[] = [...result.events];
  for (const output of result.output) {
    if (output.error) events.push({ type: "command.error", command, ...output.error });
  }

  // A flag counts as found when its token appears anywhere in the output, from any tool.
  let { state } = result;
  const text = result.output.map((output) => output.text).join("\n");
  const found = state.flags.filter(
    (flag) => !state.flagsFound.includes(flag.id) && text.includes(flag.token),
  );
  if (found.length > 0) {
    state = { ...state, flagsFound: [...state.flagsFound, ...found.map((flag) => flag.id)] };
    for (const flag of found) events.push({ type: "flag.found", flagId: flag.id });
  }

  events.push({ type: "command.run", command, line, exitCode: result.exitCode });
  return { state, output: result.output, events, exitCode: result.exitCode };
}
