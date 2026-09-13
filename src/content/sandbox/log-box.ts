import type { SandboxScenario } from "./types";

const README = `This practice computer keeps lots of logs: files where programs
write down what happened, one line per event.

Some things to try:
  ls /var/log                         see which logs there are
  tail /var/log/auth.log              the latest sign-in events
  grep Failed /var/log/auth.log       only the failed sign-ins
  grep Failed /var/log/auth.log | wc -l          count them
  grep Failed /var/log/auth.log | cut -d' ' -f9 | sort | uniq -c
                                      which address failed, and how often

Who kept failing to sign in, and when did they stop?
`;

/** Builds a burst of failed sign-ins, then one that works: the story these logs tell. */
function authLog(): string {
  const lines = [
    "2026-03-01T21:58:02Z INFO sshd[700]: Accepted password for idris from 192.168.60.12 port 50001",
    "2026-03-01T22:05:44Z INFO sshd[702]: Disconnected from user idris 192.168.60.12 port 50001",
  ];
  const users = ["admin", "root", "backup", "admin", "test", "root"];
  for (let i = 0; i < 24; i++) {
    const second = String(10 + i * 2).padStart(2, "0");
    const user = users[i % users.length] as string;
    lines.push(
      `2026-03-01T23:14:${second}Z WARN sshd[${900 + i}]: Failed password for ${user} from 192.168.60.77 port ${41000 + i * 3}`,
    );
  }
  lines.push(
    "2026-03-01T23:15:02Z ERROR sshd[924]: Too many authentication failures for root from 192.168.60.77",
    "2026-03-01T23:15:40Z WARN sshd[925]: Failed password for kit from 192.168.60.21 port 40011",
    "2026-03-01T23:15:47Z INFO sshd[925]: Accepted password for kit from 192.168.60.21 port 40011",
    "2026-03-02T07:59:30Z INFO sshd[980]: Accepted publickey for recruit from 192.168.60.10 port 52210",
  );
  return `${lines.join("\n")}\n`;
}

const ACCESS_LOG = [
  '192.168.60.10 - - [02/Mar/2026:08:01:12 +0000] "GET / HTTP/1.1" 200 1532 "-" "Mozilla/5.0"',
  '192.168.60.77 - - [01/Mar/2026:23:10:01 +0000] "GET /admin HTTP/1.1" 401 210 "-" "curl-like/1.0"',
  '192.168.60.77 - - [01/Mar/2026:23:10:02 +0000] "GET /backup.zip HTTP/1.1" 404 196 "-" "curl-like/1.0"',
  '192.168.60.77 - - [01/Mar/2026:23:10:03 +0000] "GET /.env HTTP/1.1" 404 196 "-" "curl-like/1.0"',
  '192.168.60.77 - - [01/Mar/2026:23:10:04 +0000] "GET /robots.txt HTTP/1.1" 200 34 "-" "curl-like/1.0"',
  '192.168.60.21 - - [02/Mar/2026:08:20:44 +0000] "GET /schedule HTTP/1.1" 200 4410 "-" "Mozilla/5.0"',
].join("\n");

const SYSLOG = [
  "2026-03-01T22:00:00Z INFO cron[311]: nightly backup started",
  "2026-03-01T22:04:12Z INFO backup[312]: nightly backup finished: 1,204 files",
  "2026-03-01T23:15:03Z WARN guard[410]: blocked 192.168.60.77 for 10 minutes after repeated failures",
  "2026-03-02T06:00:00Z INFO cron[311]: log rotation finished",
].join("\n");

export const LOG_BOX: SandboxScenario = {
  id: "sandbox-logs",
  title: "Log-analysis box",
  description: "A computer full of logs to read and search. Find out who kept failing to sign in.",
  tryThis: [
    { command: "ls /var/log", why: "See which logs there are" },
    { command: "tail /var/log/auth.log", why: "Read the latest sign-in events" },
    { command: "grep Failed /var/log/auth.log | wc -l", why: "Count the failed sign-ins" },
    { command: "cat README.txt", why: "Read the hints for this box" },
  ],
  showMap: false,
  seed: 6003,
  scenario: {
    id: "sandbox-logs",
    startTime: "2026-03-02T09:00:00Z",
    network: {
      subnets: [{ cidr: "192.168.60.0/24", name: "The Range" }],
      hosts: [
        {
          id: "range-log-01",
          hostname: "range-log-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.60", subnet: "192.168.60.0/24" }],
          os: { family: "linux", name: "Linux", version: "6.8" },
          services: [
            { port: 22, protocol: "tcp", name: "ssh", product: "sshd", version: "9.6" },
            { port: 514, protocol: "udp", name: "syslog", product: "logd", version: "8.2" },
          ],
          users: [
            { name: "recruit", uid: 1000, groups: ["adm"] },
            { name: "idris", uid: 1002 },
          ],
          fs: {
            entries: [
              { path: "/home/recruit/README.txt", content: README },
              { path: "/var/log/auth.log", content: authLog(), group: "adm", mode: "640" },
              {
                path: "/var/log/web/access.log",
                content: `${ACCESS_LOG}\n`,
                group: "adm",
                mode: "640",
              },
              { path: "/var/log/syslog", content: `${SYSLOG}\n` },
              {
                path: "/var/log/secure-archive.log",
                content: "root only: older sign-ins\n",
                mode: "600",
              },
              {
                path: "/var/log/.analyst-note",
                content:
                  "Idris here. If you found this, you read the logs closely. The address that kept failing, 192.168.60.77, isn't one of the team's machines. That goes in the report. SIM{logs-mumble-but-never-lie}\n",
                owner: "idris",
                mode: "644",
              },
            ],
          },
        },
      ],
    },
    session: { host: "range-log-01", user: "recruit" },
    flags: [{ id: "analyst-note", token: "SIM{logs-mumble-but-never-lie}" }],
  },
};
