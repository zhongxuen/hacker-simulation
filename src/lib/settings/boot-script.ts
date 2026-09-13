import { REDUCED_MOTION_OVERRIDES } from "./schema";
import { SETTINGS_STORAGE_KEY } from "./store";

const MOTION_ATTRIBUTE_VALUES = REDUCED_MOTION_OVERRIDES.filter((value) => value !== "system");

/**
 * A tiny inline script that applies the saved settings to <html> before first paint, so a
 * collapsed sidebar never flashes open and reduced motion is on from the first frame. It does what
 * applySettingsToElement (document.ts) does, in plain ES5, and swallows every error: with blocked
 * storage or bad JSON the page starts on defaults.
 *
 * Render it once, at the top of <body> in the root layout (SettingsBootScript in
 * src/components/shell). Import it from this file rather than the settings index, so a server
 * component doesn't pull in the useSettings hook.
 */
export const SETTINGS_BOOT_SCRIPT = [
  "try{",
  `var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)}));`,
  "var r=document.documentElement;",
  'if(s&&s.sidebarCollapsed===true)r.dataset.sidebar="collapsed";',
  `if(s&&${JSON.stringify(MOTION_ATTRIBUTE_VALUES)}.indexOf(s.reducedMotionOverride)>=0)`,
  "r.dataset.motion=s.reducedMotionOverride",
  "}catch(e){}",
].join("");
