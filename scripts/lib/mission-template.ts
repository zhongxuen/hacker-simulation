/**
 * The starting files `pnpm mission:new <slug>` writes: a mission that already validates and plays
 * to the end, with every piece of copy marked TODO for the author to replace, and a playthrough
 * that completes it. See md-files/authoring-missions.md for how to fill it in.
 *
 * Pure string building, so tests/unit/mission-toolkit.test.ts can prove the template validates
 * without writing anything.
 */

/** A seed from the slug, so two new missions don't start with the same one. */
export function seedFor(slug: string): number {
  let hash = 2166136261;
  for (const char of slug) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function missionTemplate(slug: string): string {
  return `# ${slug}: a new mission. Replace every TODO, then run \`pnpm mission:validate ${slug}\`
# and \`pnpm mission:play ${slug}\`. The guide is md-files/authoring-missions.md.
id: ${slug}
slug: ${slug}
version: 1
title: "TODO: the mission's name, in sentence case"
difficulty: easy # intro (up to 10 min), easy (15), medium (25), hard (30)
estimatedMinutes: 10
skills: [linux] # from: linux, networking, web, crypto, forensics, blue-team
prerequisites: [] # mission ids shown as "Best after", never a lock
hook: "TODO: one line from the story that makes a beginner want to click"
learningGoals:
  - "TODO: what the learner will learn, in plain words"
  - "TODO: a second thing they'll learn"
concepts: [] # lesson ids for every idea the mission needs
briefing:
  scenario: >-
    TODO: who asked for help, and why. Re-introduce the cast in a line: "Noor Halvorsen, your
    mentor at Candlewright Security, ..."
  role: "TODO: who the learner is playing, like: You're Candlewright's newest recruit, signed in as \`recruit\`."
  authorization: >-
    TODO: who gave written permission, and exactly what's in scope. Signed: Theo Ashgrove, team
    lead.
story:
  - on: start
    speaker: mentor-noor
    text: "TODO: the first line of the episode, from a character."
  - on: { objective: read-the-note }
    speaker: teammate-kit
    text: "TODO: a character reacts when the note is read."
  - on: complete
    speaker: mentor-noor
    text: "TODO: a closing line that names what the learner did."
scenario:
  seed: ${seedFor(slug)}
  startTime: "2026-03-02T09:00:00Z"
  network:
    subnets:
      - { cidr: 192.168.60.0/24, name: The Range }
    hosts:
      - id: range-ws-01
        hostname: range-ws-01.range.candlewright.example
        interfaces:
          - { ip: 192.168.60.10, subnet: 192.168.60.0/24 }
        os: { family: linux, name: Linux, version: "6.8" }
        users:
          - { name: recruit, uid: 1000 }
        fs:
          entries:
            - path: /home/recruit/note.txt
              content: |
                TODO: what the learner finds in the note.
            - path: /home/recruit/.hidden-note
              mode: "600"
              content: |
                TODO: a secret for the curious.
  session: { host: range-ws-01, user: recruit }
objectives:
  - id: look-around
    description: Look around your home folder with \`ls\`
    why: "TODO: one line on why this step matters."
    success: "TODO: You {did the specific thing}! {Why it matters}."
    check: { kind: event, event: command.run, match: { command: ls, exitCode: 0 } }
  - id: read-the-note
    description: Read the note in your home folder
    why: "TODO: one line on why this step matters."
    success: "TODO: a specific celebration line."
    check: { kind: event, event: file.read, match: { path: /home/recruit/note.txt } }
  - id: make-a-call
    description: "TODO: a decision, starting with a verb"
    why: "TODO: one line on why this step matters."
    success: "TODO: a specific celebration line."
    check:
      kind: answer
      accept: ["TODO: the right choice"]
      choices:
        - text: "TODO: the right choice"
        - text: "TODO: a tempting wrong choice"
          reply:
            speaker: teammate-theo
            text: "TODO: what would happen in the real world, then: pick again."
  - id: read-the-manual
    name: Curious Cat
    description: Read the manual page for \`ls\`
    why: Every command comes with instructions, and reading them is a real skill.
    success: "TODO: a specific celebration line."
    optional: true
    check: { kind: event, event: help.viewed, match: { command: ls } }
  - id: find-the-secret
    name: "TODO Secret"
    description: Find the hidden note
    why: Files whose names start with a dot don't show up in a plain \`ls\`.
    success: "TODO: a specific celebration line."
    hidden: true
    check: { kind: event, event: file.read, match: { path: /home/recruit/.hidden-note } }
hints:
  look-around:
    - "TODO: a nudge that doesn't name the command"
    - "TODO: the idea, with the command"
    - "TODO: a near-answer: Type \`ls\` and press Enter."
  read-the-note:
    - "TODO: a nudge"
    - "TODO: the idea"
    - "TODO: a near-answer"
  make-a-call:
    - "TODO: a nudge"
    - "TODO: the idea"
    - "TODO: a near-answer"
  read-the-manual:
    - Commands can explain themselves.
    - "\`man\` opens a command's manual page."
    - Type \`man ls\`.
debrief:
  summary: "TODO: what the learner did in this episode, in one or two sentences."
  whatYouLearned:
    - "TODO: the first learning goal, in the past tense"
    - "TODO: the second learning goal, in the past tense"
  ethicsNote: >-
    TODO: what this would do in the real world, who it would affect, and what makes it OK here
    (permission, a practice setup, or what professionals do). No humour, no threats.
  defensiveTakeaway: "TODO: how a defender would stop this."
  nextTease: "TODO: a one-line story hook for the next mission."
  furtherReading: []
`;
}

export function playthroughTemplate(slug: string): string {
  return `# The scripted run \`pnpm mission:play ${slug}\` and CI use to check ${slug} still completes.
# Steps: run: <command>, answer: <text> with objective: <id>, or reset: true. Add ticks: [ids] to a
# step to check what it ticks.
mission: ${slug}
description: "TODO: what this playthrough shows."
steps:
  - run: ls
    ticks: [look-around]
  - run: cat note.txt
    ticks: [read-the-note]
  - answer: "TODO: a tempting wrong choice"
    objective: make-a-call
    accepted: false
  - answer: "TODO: the right choice"
    objective: make-a-call
    ticks: [make-a-call]
  - run: man ls
    ticks: [read-the-manual]
  - run: cat .hidden-note
    ticks: [find-the-secret]
expect:
  complete: true
  objectives: [look-around, read-the-note, make-a-call, read-the-manual, find-the-secret]
`;
}
