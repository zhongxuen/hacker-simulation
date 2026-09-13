import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No database, no accounts, no saved progress (standing decision in
 * md-files/00-overview-and-improvements.md; md-files/03-app-state-and-privacy.md). Adding a
 * database client, an auth library, or database credentials needs a new phase with its own
 * design, not a quiet dependency.
 */

const ROOT = join(import.meta.dirname, "../..");

const BANNED_PACKAGES = [
  /^@supabase\//,
  /^@?prisma(\/|$)/,
  /^drizzle-orm$/,
  /^(pg|postgres|mysql2?|sqlite3|better-sqlite3|mongodb|mongoose|redis|ioredis)$/,
  /^@neondatabase\//,
  /^@planetscale\//,
  /^@vercel\/(postgres|kv)$/,
  /^@upstash\/redis$/,
  /^firebase(-admin)?$/,
  /^next-auth$/,
  /^@auth\//,
  /^@clerk\//,
  /^better-auth$/,
  /^lucia$/,
];

const BANNED_ENV = /^\s*(DATABASE_URL|POSTGRES_\w+|SUPABASE_\w+|MONGODB_URI|REDIS_URL)\s*=/m;

describe("no database, no accounts", () => {
  it("has no database client or auth library in package.json", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Record<
      string,
      Record<string, string> | undefined
    >;
    const dependencies = ["dependencies", "devDependencies", "optionalDependencies"].flatMap(
      (field) => Object.keys(pkg[field] ?? {}),
    );
    expect(
      dependencies.filter((name) => BANNED_PACKAGES.some((pattern) => pattern.test(name))),
    ).toEqual([]);
  });

  it("has no database credentials in any .env file", () => {
    const envFiles = readdirSync(ROOT).filter((name) => name.startsWith(".env"));
    expect(
      envFiles.filter((name) => BANNED_ENV.test(readFileSync(join(ROOT, name), "utf8"))),
    ).toEqual([]);
  });
});
