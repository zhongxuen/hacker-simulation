# src/features/missions

The mission runtime: loads mission data from `src/content`, tracks objectives, and shows briefings and debriefs. Arrives in phase 06.

Public API: `index.ts` only. Never import here: another feature's internals, or answer keys (those stay server-side).
