import type { FsEntrySpec } from "@/sim/types";
import type { SandboxScenario } from "./types";

const README = `Welcome to the Range, Candlewright's practice lab.

This is your own practice computer, range-ws-01. Nothing here can
break for real: if anything goes wrong, press Reset machine.

Some things to try:
  ls              list what's in this folder
  cd documents    go into the documents folder
  cat notes.txt   read a file
  ls -a           find the hidden files
  help            see every command

There's a hidden note somewhere in your home folder. Can you find it?
`;

const FILES: readonly FsEntrySpec[] = [
  { path: "/etc/motd", content: "Welcome to range-ws-01. Practice freely: this machine resets.\n" },
  { path: "/home/recruit/README.txt", content: README },
  {
    path: "/home/recruit/notes.txt",
    content:
      "Day 1 on the Range\n- Learn to look around with ls and cd\n- Read files with cat, less, head and tail\n- Ask Noor anything\n",
  },
  {
    path: "/home/recruit/documents/plan.txt",
    content: "Training plan\n1. Linux basics\n2. Permissions\n3. Networks\n4. Logs\n",
  },
  {
    path: "/home/recruit/documents/meeting-notes.txt",
    content:
      "Team meeting, Monday\nTheo: every test needs a signed letter first. No letter, no test.\nKit: the coffee machine is now called coffee-01.\nIdris: logs don't lie, they mumble.\n",
  },
  {
    path: "/home/recruit/documents/old/draft.txt",
    content: "An old draft. Nothing to see here... or is there?\n",
  },
  {
    path: "/home/recruit/scripts/backup.sh",
    content:
      "#!/bin/bash\n# Copies the documents folder somewhere safe.\ncp -r ~/documents /tmp/backup\n",
    mode: "755",
  },
  {
    path: "/home/recruit/.bashrc",
    content:
      "# Settings for your shell. Lines starting with # are comments.\nexport EDITOR=nano\nalias ll='ls -l'\n",
  },
  {
    path: "/home/recruit/.hidden-note",
    content:
      "You found the hidden note! Files whose names start with a dot don't show up in a plain ls.\nSecret: SIM{dot-files-hide-in-plain-sight}\n",
    mode: "600",
  },
  { path: "/home/recruit/logs", target: "/var/log" },
  { path: "/home/kit/lunch.txt", content: "sandwich-01\n" },
  {
    path: "/var/log/syslog",
    content:
      "2026-03-02T08:00:01Z INFO cron[311]: daily practice reset finished\n2026-03-02T08:30:12Z INFO systemd[1]: Started session 3 of user recruit\n2026-03-02T08:45:40Z WARN disk[88]: /tmp is 60% full\n",
  },
  {
    path: "/var/log/auth.log",
    content:
      "2026-03-02T08:30:10Z INFO sshd[901]: Accepted password for recruit from 192.168.60.10 port 50122\n2026-03-02T08:41:03Z WARN sshd[944]: Failed password for kit from 192.168.60.21 port 40011\n2026-03-02T08:41:09Z INFO sshd[944]: Accepted password for kit from 192.168.60.21 port 40011\n",
    group: "adm",
    mode: "640",
  },
  { path: "/tmp/scratch.txt", content: "Anyone can write in /tmp.\n", owner: "kit", mode: "666" },
];

export const SINGLE_COMPUTER: SandboxScenario = {
  id: "sandbox-single",
  title: "Single computer",
  description: "One practice computer with folders and files to explore. The best place to start.",
  tryThis: [
    { command: "ls", why: "See what's in your home folder" },
    { command: "cat README.txt", why: "Read the welcome note" },
    { command: "cd documents", why: "Step into a folder" },
    { command: "ls -la", why: "Find hidden files and their permissions" },
  ],
  showMap: false,
  seed: 6001,
  scenario: {
    id: "sandbox-single",
    network: {
      subnets: [{ cidr: "192.168.60.0/24", name: "The Range" }],
      hosts: [
        {
          id: "range-ws-01",
          hostname: "range-ws-01.range.candlewright.example",
          interfaces: [{ ip: "192.168.60.10", subnet: "192.168.60.0/24" }],
          os: { family: "linux", name: "Linux", version: "6.8" },
          services: [{ port: 22, protocol: "tcp", name: "ssh", product: "sshd", version: "9.6" }],
          users: [
            { name: "recruit", uid: 1000, groups: ["adm"] },
            { name: "kit", uid: 1001 },
          ],
          fs: { entries: FILES },
        },
      ],
    },
    session: { host: "range-ws-01", user: "recruit" },
    flags: [{ id: "hidden-note", token: "SIM{dot-files-hide-in-plain-sight}" }],
  },
};
