import { describe, expect, it } from "vitest";
import { errorCodes, fixtureState, run, testContext, text } from "../__fixtures__/harness";
import { step } from "../core/step";
import { identifyHash } from "./hashid";

const best = (value: string) => identifyHash(value).formats[0]?.id;

describe("identifyHash", () => {
  it("names formats by length and characters", () => {
    expect(best("9b1f3c2e7a4d5b6c8e0f1a2b3c4d5e6f")).toBe("md5");
    expect(best("7A3E9C1F5B8D2E4A6C0F9B3D5E7A1C8F")).toBe("ntlm");
    expect(best("a".repeat(40))).toBe("sha1");
    expect(best("b".repeat(64))).toBe("sha256");
    expect(best("c".repeat(128))).toBe("sha512");
    expect(best("deadbeef")).toBe("crc32");
  });

  it("names salted formats by their prefix", () => {
    expect(best(`$2b$12$${"a".repeat(53)}`)).toBe("bcrypt");
    expect(best("$6$salt$abc")).toBe("sha512-crypt");
    expect(best("$y$j9T$salt$abc")).toBe("yescrypt");
    expect(best("$argon2id$v=19$m=65536,t=3,p=4$abc$def")).toBe("argon2");
    expect(best("$1$salt$abc")).toBe("md5-crypt");
  });

  it("admits when nothing matches", () => {
    expect(identifyHash("hello world").formats).toEqual([]);
    expect(identifyHash("abc").formats).toEqual([]);
  });
});

describe("hashid", () => {
  it("prints the likely format and alternatives, and never claims to crack", () => {
    const result = run(fixtureState(), "hashid", "9b1f3c2e7a4d5b6c8e0f1a2b3c4d5e6f");
    expect(text(result)).toContain("Most likely: MD5");
    expect(text(result)).toContain("Also possible: NTLM, MD4");
    expect(text(result)).toContain("never cracks them");
    expect(result.events[0]).toEqual({ type: "hash.identified", format: "md5" });
  });

  it("reads shadow-style lines from a file, flagging empty and locked passwords", () => {
    const result = run(fixtureState(), "hashid", "--file", "hashes.txt");
    expect(text(result)).toContain('user guest: ""');
    expect(text(result)).toContain("this account has NO password");
    expect(text(result)).toContain("locked: this account can't log in");
    expect(
      result.events
        .filter((e) => e.type === "hash.identified")
        .map((e) => "format" in e && e.format),
    ).toEqual(["md5-crypt", "empty", "ntlm", "locked"]);
  });

  it("respects file permissions", () => {
    expect(errorCodes(run(fixtureState(), "hashid", "--file", "/etc/shadow"))).toEqual(["EACCES"]);
  });

  it("reads piped input", () => {
    const result = step(
      fixtureState(),
      { type: "exec", argv: ["hashid"], stdin: `${"b".repeat(64)}\n` },
      testContext(),
    );
    expect(text(result)).toContain("Most likely: SHA-256");
  });

  it("needs something to identify, and caps what it accepts", () => {
    expect(errorCodes(run(fixtureState(), "hashid"))).toEqual(["MISSING_ARGUMENT"]);
    expect(errorCodes(run(fixtureState(), "hashid", "a".repeat(600)))).toEqual(["BAD_ARGUMENT"]);
  });
});
