/**
 * The built-in tool list: the simulated security tools, then the Linux command set. Adding a tool
 * takes two files: the tool itself, and one line here (or, for a Linux command, one line in
 * commands/index.ts).
 */
import { LINUX_COMMANDS } from "./commands";
import { hashid } from "./hashid";
import { logview } from "./logview";
import { netscan } from "./netscan";
import { createRegistry } from "./registry";
import type { Tool } from "./types";
import { webprobe } from "./webprobe";

export const SECURITY_TOOLS: readonly Tool[] = [netscan, webprobe, logview, hashid];

export const BUILTIN_TOOLS: readonly Tool[] = [...SECURITY_TOOLS, ...LINUX_COMMANDS];

export const defaultRegistry = createRegistry(BUILTIN_TOOLS);
