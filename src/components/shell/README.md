# src/components/shell

The app shell that every page in `src/app/(app)` renders inside: the sidebar ("Start here" button, section links, "What we store" link, collapse toggle), the mobile menu drawer, the top bar (section title, mission-progress slot, SIMULATED marker, search button), the command palette (⌘K / Ctrl+K), and the main content region with its skip link. Also `SectionPlaceholder` for pages that aren't built yet.

- Section names, routes, subtitles and search keywords come from `src/lib/app-sections.ts`; the "Start here" destination from `src/lib/next-step.ts`.
- The mission-progress slot is empty until a mission page renders `ShowMissionProgress` (phase 06).
- `leave-guard.tsx` — while a page renders `<LeaveGuard when>` (a mission run in progress), clicks on links to other pages and command-palette navigation ask "Leave this mission?" first, and the browser's own leave-page prompt guards reloads and closing the tab. Same-page links are never interrupted. There are no accounts, XP or levels, so the top bar has no profile or score.
- The command palette's shortcut ignores key presses that something else already handled (`event.defaultPrevented`), so a focused terminal can keep Ctrl+K for itself.
- The sidebar's collapsed state is the `sidebarCollapsed` setting (`src/lib/settings`), read through `useSidebarCollapsed`. `SettingsBootScript` (rendered in the root layout) applies saved settings to `<html>` before first paint. Style the collapsed rail with the `rail:` variant from `src/styles/globals.css`.
- The bottom of the sidebar links to "What we store" (`/privacy`), so it's one click from every app page.
- Built from `src/components/ui` primitives and tokens. Nothing here reads mission data itself.

Never import here: features, `src/app`, `src/sim`, or `src/content`.
