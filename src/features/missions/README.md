# src/features/missions

The mission runtime: loads mission files from `src/content/missions`, and works out which objectives are done. The runner UI (briefing, terminal, objectives, debrief) arrives in prompt 06.4.

- `index.ts` — client-safe: `evaluateObjectives(mission, state, events, answers)` (the one pure evaluator: completed objective ids, in objective order), `isMissionComplete`, `mainObjectives`, `missionProgress` (`{ done, total }` for the top bar's `ShowMissionProgress`).
- `server.ts` — server-only (reads files): `getMission(slug)`, `getMissionById(id)`, `listMissions({ skill, difficulty })`, `getMissionGraph()` (the "Best after" graph, never used for locking), `loadMissionCatalog(dir)`, `parseMissionSource`, and `MissionSourceError`. Cached in production, re-read on every call in development.
- `loader/` — `source.ts` checks one file (YAML, schema, id matches the file name, the engine builds the scenario, checks name real hosts, users and flags); `catalog.ts` checks across files (unique ids and slugs, prerequisites exist and don't loop) and orders missions by difficulty, then prerequisites, then title.
- `evaluate.ts` — the evaluator. It reports what holds now; the in-memory run (06.4) keeps the union of ticks, so a tick once earned stays.

Answers for `answer` checks ship with the mission in the client bundle on purpose (improvement #3 in `md-files/00-overview-and-improvements.md`): nothing is recorded, so peeking only spoils the learner's own mission. No mission state is ever written to browser storage.

Public API: `index.ts`, and `server.ts` for server code. Never import here: another feature's internals, or anything that stores state.
