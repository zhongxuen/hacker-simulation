# src/content/campaigns

Campaigns as data (phase 08): chapters with their story framing, and the recommended mission order. There are no unlock rules: every mission is open from the start, and the order only decides where "Start here" and "Next mission" point.

- `main.ts` — `MAIN_CAMPAIGN`, validated by `CampaignSchema` (`src/content/schemas/campaign.ts`) on import. Chapter lines use speaker ids from `src/content/cast.ts`.
- `index.ts` — `CAMPAIGNS` and the pure helpers: `nextMission(campaign, missionId)` (chapter order, across chapter boundaries), `bestAfter(missionId, missions)` (from a mission's `prerequisites`), `chapterOf`, `startHereMissionId`, `campaignMissionIds`, and `campaignProblems` (mission ids that don't exist, run by `tests/unit/campaigns.test.ts`).

To add a chapter: write its missions first, then add a chapter with a `narrative`, one to three cast `lines`, and the mission ids in order. Every name stays fictional (`md-files/story-bible.md`).

Never import here: features or engine internals. Only `@/content` and `@/sim/types`.
