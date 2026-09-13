import { z } from "zod";

/**
 * The learner's settings: the only thing the app remembers between visits
 * (md-files/03-app-state-and-privacy.md). Settings change how the app looks and behaves, never
 * what a learner has done: no mission data, scores or progress ever go in here.
 *
 * To add a setting (phase 05 beginner mode, 07 graph/table view, 08 terminal theme, 10 nudge
 * chip), add one field below with a `.catch()` default. Nothing else changes: reads validate each
 * field on its own, so a value saved by an older version, or edited by hand, falls back to its
 * default without touching the others. If the setting has to show before first paint, also teach
 * the boot script (boot-script.ts) to apply it.
 */
const ReducedMotionOverrideSchema = z.enum(["system", "reduce", "full"]);

export const SETTINGS_SHAPE = {
  /** The desktop sidebar is collapsed to an icon rail. */
  sidebarCollapsed: z.boolean().catch(false),
  /**
   * Decorative motion: "system" follows the device's reduce-motion setting, "reduce" turns it off,
   * "full" keeps it on even when the device asks for less. Applied as data-motion on <html>
   * (src/styles/motion.css).
   */
  reducedMotionOverride: ReducedMotionOverrideSchema.catch("system"),
} as const;

export const SettingsSchema = z.object(SETTINGS_SHAPE);

export type Settings = z.infer<typeof SettingsSchema>;

export type ReducedMotionOverride = Settings["reducedMotionOverride"];

export const REDUCED_MOTION_OVERRIDES: readonly ReducedMotionOverride[] =
  ReducedMotionOverrideSchema.options;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(SettingsSchema.parse({}));

/**
 * Settings from anything: parsed JSON, a partial update, or garbage. Each known field is validated
 * on its own and falls back to its default; unknown keys are dropped. Never throws.
 */
export function parseSettings(raw: unknown): Readonly<Settings> {
  const input: Record<string, unknown> =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  // z.object strips unknown keys, and each field's .catch() replaces a bad value with its default.
  return Object.freeze(SettingsSchema.parse(input));
}

/** Whether two settings objects hold the same values. */
export function sameSettings(a: Readonly<Settings>, b: Readonly<Settings>): boolean {
  return (Object.keys(SETTINGS_SHAPE) as (keyof Settings)[]).every((key) => a[key] === b[key]);
}
