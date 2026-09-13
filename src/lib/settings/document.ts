import type { Settings } from "./schema";

/**
 * Puts the settings that change the page's look onto <html>, where CSS reads them:
 * data-sidebar="collapsed" for the `rail:` variant (src/styles/globals.css), and
 * data-motion="reduce" | "full" for --motion-scale (src/styles/motion.css). "system" removes
 * data-motion, so the device's own reduce-motion setting decides.
 *
 * The boot script (boot-script.ts) does the same before first paint and must stay in step with
 * this: tests/unit/settings-boot-script.test.ts checks that they agree.
 */
export function applySettingsToElement(
  root: Pick<HTMLElement, "dataset">,
  settings: Readonly<Settings>,
): void {
  if (settings.sidebarCollapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;

  if (settings.reducedMotionOverride === "system") delete root.dataset.motion;
  else root.dataset.motion = settings.reducedMotionOverride;
}
