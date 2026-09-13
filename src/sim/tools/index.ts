/**
 * The built-in tool list. Adding a tool takes exactly two files: the tool itself, and one line
 * here.
 */
import { hashid } from "./hashid";
import { logview } from "./logview";
import { netscan } from "./netscan";
import { createRegistry } from "./registry";
import type { Tool } from "./types";
import { webprobe } from "./webprobe";

export const BUILTIN_TOOLS: readonly Tool[] = [netscan, webprobe, logview, hashid];

export const defaultRegistry = createRegistry(BUILTIN_TOOLS);
