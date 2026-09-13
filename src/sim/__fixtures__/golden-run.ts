/**
 * The golden run: a fixed command list against the fixture scenario. Its transcript and final
 * state are committed under golden/, and any change to either fails the golden test. It covers
 * every tool, success and failure, firewalls, symlinks, permissions, traversal, and flags.
 */
import type { Run, SimCommand } from "../types";
import { FIXTURE_SCENARIO, FIXTURE_SEED } from "./scenario";

const exec = (...argv: string[]): SimCommand => ({ type: "exec", argv });

export const GOLDEN_RUN: Run = {
  seed: FIXTURE_SEED,
  scenarioId: FIXTURE_SCENARIO.id,
  commands: [
    exec("netscan", "--help"),
    exec("netscan", "10.0.1.0/24"),
    exec("netscan", "10.0.1.20", "--ports", "common"),
    exec("netscan", "10.0.2.0/24", "-p", "common"),
    exec("netscan", "10.0.1.0/24", "-p", "9100", "--no-ping"),
    exec("netscan", "mystery-box"),
    exec("netscan", "portal.corp"),
    exec("netscan", "100.64.0.1"),
    exec("netscan", "10.0.0.0/8"),
    exec("netscan", "10.0.1.0/24", "--fast"),
    exec("webprobe", "10.0.1.20"),
    exec("webprobe", "web-01", "--path", "/admin"),
    exec("webprobe", "http://web-01.corp.example/old"),
    exec("webprobe", "10.0.1.20:22"),
    exec("webprobe", "10.0.1.20:8080"),
    exec("webprobe", "vault-01"),
    exec("webprobe", "10.0.2.40:5432"),
    exec("logview"),
    exec("logview", "/var/log/auth.log", "--grep", "failed"),
    exec("logview", "logs/syslog", "--level", "error", "--count"),
    exec("logview", "/var/log/private.log"),
    exec("logview", "/etc/shadow"),
    exec("logview", "/tmp/loop-a"),
    exec("logview", "/home/alex/todo.txt"),
    exec("logview", "../../../../home/recruit/.secret-note"),
    {
      type: "exec",
      argv: ["logview", "--grep", "ssh"],
      stdin: "cron ok\nsshd restarted\nssh key added\n",
    },
    exec("hashid", "9b1f3c2e7a4d5b6c8e0f1a2b3c4d5e6f"),
    exec("hashid", "$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0"),
    exec("hashid", "--file", "hashes.txt"),
    exec("hashid", "--file", "/etc/shadow"),
    exec("sl"),
    exec(),
  ],
};
