/**
 * hashid: names a hash format from its shape (length, characters, and prefix). It identifies only:
 * there is no cracking, guessing, or lookup of any kind.
 */
import { failure, plural, splitLines, stdout, success } from "../core/output";
import { sessionFs } from "../core/session";
import type { OutputLine, SimEvent } from "../core/types";
import { readFile } from "../fs/ops";
import { optionValue, parseArgs } from "./args";
import type { Tool } from "./types";

const NAME = "hashid";
const MAX_HASH_LENGTH = 512;
const MAX_ENTRIES = 50;

export interface HashFormat {
  /** Stable id, used in `hash.identified` events: "md5", "bcrypt", "sha512-crypt", ... */
  readonly id: string;
  readonly name: string;
  readonly note: string;
}

const FAST = "fast: fine for checking files, too fast for storing passwords";
const BROKEN = "fast, and broken for security use: never safe for passwords";
const fast = (id: string, name: string, note = FAST): HashFormat => ({ id, name, note });

const PREFIXED: readonly { pattern: RegExp; format: HashFormat }[] = [
  {
    pattern: /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/,
    format: { id: "bcrypt", name: "bcrypt", note: "slow and salted: built for storing passwords" },
  },
  {
    pattern: /^\$argon2(id|i|d)\$/,
    format: {
      id: "argon2",
      name: "Argon2",
      note: "slow, salted, memory-hungry: a modern choice for passwords",
    },
  },
  {
    pattern: /^\$y\$/,
    format: {
      id: "yescrypt",
      name: "yescrypt",
      note: "slow and salted: the default on many current Linux systems",
    },
  },
  {
    pattern: /^\$6\$/,
    format: {
      id: "sha512-crypt",
      name: "SHA-512 crypt",
      note: "salted, many rounds: common in Linux /etc/shadow",
    },
  },
  {
    pattern: /^\$5\$/,
    format: { id: "sha256-crypt", name: "SHA-256 crypt", note: "salted, many rounds" },
  },
  {
    pattern: /^\$1\$/,
    format: {
      id: "md5-crypt",
      name: "MD5 crypt",
      note: "salted but old: too fast by today's standards",
    },
  },
];

const BY_HEX_LENGTH: Readonly<Record<number, readonly HashFormat[]>> = {
  8: [
    {
      id: "crc32",
      name: "CRC32",
      note: "a checksum, not a password hash: it only catches accidental changes",
    },
  ],
  32: [
    fast("md5", "MD5", BROKEN),
    fast(
      "ntlm",
      "NTLM",
      "fast and unsalted: how some Windows systems store passwords, and weak protection",
    ),
    fast("md4", "MD4", BROKEN),
  ],
  40: [fast("sha1", "SHA-1", BROKEN)],
  56: [fast("sha224", "SHA-224"), fast("sha3-224", "SHA3-224")],
  64: [fast("sha256", "SHA-256"), fast("sha3-256", "SHA3-256")],
  96: [fast("sha384", "SHA-384")],
  128: [fast("sha512", "SHA-512"), fast("sha3-512", "SHA3-512")],
};

export interface Identification {
  /** Plain description of the input's shape. */
  readonly shape: string;
  /** Candidates, most likely first. Empty when nothing matches. */
  readonly formats: readonly HashFormat[];
}

export function identifyHash(value: string): Identification {
  for (const { pattern, format } of PREFIXED) {
    if (pattern.test(value))
      return {
        shape: `${value.length} characters, starts with "${value.slice(0, value.indexOf("$", 1) + 1)}"`,
        formats: [format],
      };
  }
  if (/^[0-9a-f]+$/i.test(value)) {
    const shape = `${value.length} characters, hexadecimal (0-9 and a-f)`;
    const candidates = BY_HEX_LENGTH[value.length] ?? [];
    // Windows tools usually print NTLM hashes in capitals, so capitals make NTLM the best guess.
    const ntlmFirst = value.length === 32 && value === value.toUpperCase() && /[A-F]/.test(value);
    const formats = ntlmFirst
      ? [...candidates.filter((f) => f.id === "ntlm"), ...candidates.filter((f) => f.id !== "ntlm")]
      : candidates;
    return { shape, formats };
  }
  return { shape: `${value.length} characters`, formats: [] };
}

/** One value to identify, with where it came from. */
interface Entry {
  readonly value: string;
  readonly label?: string;
}

/** Password fields that mean "no hash here" in a shadow-style file. */
function lockedMeaning(value: string): string | undefined {
  if (value === "") return "empty: this account has NO password";
  if (value === "*" || value.startsWith("!"))
    return "locked: this account can't log in with a password";
  return undefined;
}

/** A line like "alex:$6$...:20514:0:99999:7:::" gives its second field, labelled with the user. */
function entryFromLine(line: string): Entry {
  const fields = line.split(":");
  if (fields.length >= 3 && /^[a-z_][a-z0-9_-]*$/.test(fields[0] as string)) {
    return { value: fields[1] as string, label: `user ${fields[0]}` };
  }
  return { value: line.trim() };
}

export const hashid: Tool = {
  name: NAME,
  help: {
    oneLiner: "look at a scrambled password (a hash) and name the method that made it.",
    usage: ["hashid <hash>", "hashid --file <file>"],
    description: [
      "Computers shouldn't store your password itself. They store a hash: a scrambled fingerprint of it, made by a one-way recipe. When you log in, the computer hashes what you typed and compares the two fingerprints.",
      "There are many hash recipes, and each leaves a recognisable shape: a certain length, certain characters, or a label at the start like $6$. hashid reads that shape and tells you which recipes fit, most likely first.",
      "Some recipes mix a random extra value, called a salt, into each password before scrambling it. Then two people with the same password still get different hashes. hashid's notes say which recipes are salted.",
      "It only identifies. It never tries to turn a hash back into a password.",
    ],
    options: [
      {
        flags: "-f, --file <file>",
        text: "Identify every hash in a file, one per line. Understands /etc/shadow-style lines.",
      },
      { flags: "--help", text: "Show this help." },
    ],
    examples: [
      {
        command: "hashid 9b1f3c2e7a4d5b6c8e0f1a2b3c4d5e6f",
        text: "Name the format of a 32-character hash.",
      },
      { command: "hashid --file hashes.txt", text: "Check every hash in a file." },
    ],
    concept: [
      "Knowing the recipe tells a defender how well passwords are protected. Fast recipes like MD5 let an attacker who steals the file try billions of guesses per second. Slow, salted recipes like bcrypt make each guess expensive, which is why they're used for passwords.",
      "Real password files belong to their owners. Your team only examines hashes from systems it's authorized to test, like this practice network.",
    ],
  },

  run(args, state, ctx) {
    const parsed = parseArgs(args, [{ names: ["-f", "--file"], key: "file", takesValue: true }]);
    if (!parsed.ok) return failure(NAME, parsed.error, state);
    const file = optionValue(parsed.value, "file");

    let entries: Entry[];
    if (file !== undefined) {
      const { vfs, ctx: fsCtx } = sessionFs(state, ctx.now);
      const content = readFile(vfs, fsCtx, file);
      if (!content.ok) return failure(NAME, content.error, state);
      entries = splitLines(content.value)
        .filter((line) => line.trim())
        .map(entryFromLine);
    } else if (parsed.value.positionals.length > 0) {
      entries = parsed.value.positionals.map((value) => ({ value }));
    } else if (ctx.stdin !== undefined) {
      entries = splitLines(ctx.stdin)
        .filter((line) => line.trim())
        .map(entryFromLine);
    } else {
      return failure(NAME, { code: "MISSING_ARGUMENT", argument: "hash" }, state);
    }
    const tooLong = entries.find((entry) => entry.value.length > MAX_HASH_LENGTH);
    if (tooLong) {
      return failure(
        NAME,
        {
          code: "BAD_ARGUMENT",
          argument: "hash",
          value: `${tooLong.value.slice(0, 16)}...`,
          reason: "too-long",
        },
        state,
      );
    }

    const output: OutputLine[] = [
      stdout("hashid (simulated) · names hash formats by their shape · never cracks them"),
    ];
    const events: SimEvent[] = [];
    for (const entry of entries.slice(0, MAX_ENTRIES)) {
      output.push(
        stdout(""),
        stdout(
          entry.label ? `${entry.label}: ${abbreviate(entry.value)}` : abbreviate(entry.value),
        ),
      );
      const locked = lockedMeaning(entry.value);
      if (locked !== undefined) {
        output.push(stdout(`  ${locked}`));
        events.push({ type: "hash.identified", format: entry.value === "" ? "empty" : "locked" });
        continue;
      }
      const { shape, formats } = identifyHash(entry.value);
      output.push(stdout(`  ${shape}`));
      const [best, ...others] = formats;
      if (!best) {
        output.push(
          stdout(
            "  No known format matches. It may be plain text, encoded data, or a format hashid doesn't know.",
          ),
        );
      } else {
        output.push(stdout(`  Most likely: ${best.name} (${best.note})`));
        if (others.length)
          output.push(stdout(`  Also possible: ${others.map((format) => format.name).join(", ")}`));
      }
      events.push({ type: "hash.identified", format: best?.id ?? "unknown" });
    }
    if (entries.length > MAX_ENTRIES) {
      output.push(
        stdout(""),
        stdout(`...and ${plural(entries.length - MAX_ENTRIES, "more line")} not shown`),
      );
    }
    if (entries.length === 0) output.push(stdout(""), stdout("(no hashes found)"));
    return success(state, output, events);
  },
};

const abbreviate = (value: string) =>
  value === "" ? '""' : value.length > 72 ? `${value.slice(0, 69)}...` : value;
