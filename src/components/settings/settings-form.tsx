"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cx } from "@/lib/cx";
import {
  resetSettings,
  updateSettings,
  useSettings,
  type ReducedMotionOverride,
  type Settings,
} from "@/lib/settings";

const MOTION_OPTIONS: ReadonlyArray<{
  value: ReducedMotionOverride;
  label: string;
  detail: string;
}> = [
  {
    value: "system",
    label: "Match my device",
    detail: "Follows your device's own setting for less motion.",
  },
  {
    value: "reduce",
    label: "Fewer animations",
    detail: "Nothing moves or flashes. Celebrations still show, standing still.",
  },
  {
    value: "full",
    label: "All animations",
    detail: "Plays every effect, even if your device asks for less motion.",
  },
];

/** Keyboard focus on a control that's visually hidden inside a label shows on the label. */
const LABEL_FOCUS_RING =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring";

type Notice = "unsaved" | "reset" | "reset-unsaved" | null;

const NOTICE_TEXT: Readonly<Record<Exclude<Notice, null>, string>> = {
  unsaved:
    "This browser isn't letting us save settings, so they'll go back to how they started when you reload the page. Everything else works the same.",
  reset: "Your settings are back to how they started.",
  "reset-unsaved":
    "Your settings are back to how they started. This browser isn't letting us save settings, so that's how they'll stay.",
};

/**
 * The /settings page's controls. Every change applies at once and is saved in this browser
 * through src/lib/settings; with storage blocked it still applies until the page is reloaded,
 * and a line underneath says so.
 */
export function SettingsForm() {
  const settings = useSettings();
  const [notice, setNotice] = useState<Notice>(null);

  const change = (changes: Partial<Settings>) => {
    setNotice(updateSettings(changes) ? null : "unsaved");
  };

  return (
    <div className="space-y-6">
      <SettingCard
        title="Sidebar"
        description="The menu on the left. Changes wide screens only: on a phone it opens from the menu button instead."
      >
        <Switch
          checked={settings.sidebarCollapsed}
          onChange={(checked) => change({ sidebarCollapsed: checked })}
          label="Keep the sidebar small"
          detail="Shrinks it to a column of icons, so missions get more room. Point at an icon to see its name."
        />
      </SettingCard>

      <SettingCard
        title="Animations"
        description="Ticks, sparkles and other moving effects. Turning them down never hides anything."
      >
        <RadioGroup
          legend="How much should move on screen?"
          value={settings.reducedMotionOverride}
          options={MOTION_OPTIONS}
          onChange={(value) => change({ reducedMotionOverride: value })}
        />
      </SettingCard>

      <SettingCard
        title="Start fresh"
        description="Puts every setting on this page back to how it started."
      >
        <Button
          variant="secondary"
          onClick={() => setNotice(resetSettings() ? "reset" : "reset-unsaved")}
        >
          Reset settings
        </Button>
      </SettingCard>

      <p role="status" className="min-h-6 text-base leading-7 text-secondary">
        {notice && NOTICE_TEXT[notice]}
      </p>
    </div>
  );
}

function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card as="section" padding="lg">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 leading-7 text-secondary">{description}</p>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function Switch({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail: string;
}) {
  const id = useId();

  return (
    <label
      className={cx(
        "flex cursor-pointer items-start justify-between gap-6 rounded-lg border border-subtle bg-surface-overlay p-4 hover:border-strong",
        LABEL_FOCUS_RING,
      )}
    >
      <span className="min-w-0">
        <span className="block font-medium text-primary">{label}</span>
        <span id={`${id}-detail`} className="mt-1 block text-sm leading-6 text-secondary">
          {detail}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={`${id}-detail`}
        className="peer sr-only"
      />
      {/* The track and its knob. The knob is the track's ::after, coloured with currentColor. */}
      <span
        aria-hidden="true"
        className={cx(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full border border-strong bg-surface-raised text-muted",
          "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-surface-base",
          "after:absolute after:top-1 after:left-1 after:size-4.5 after:rounded-full after:bg-current",
          "after:transition-transform after:fx-duration-fast after:ease-(--ease-standard) peer-checked:after:translate-x-5",
        )}
      />
    </label>
  );
}

function RadioGroup<Value extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string; detail: string }>;
  onChange: (value: Value) => void;
}) {
  const name = useId();

  return (
    <fieldset>
      <legend className="mb-3 font-medium text-primary">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "flex cursor-pointer gap-3 rounded-lg border border-subtle bg-surface-overlay p-4 hover:border-strong",
              "has-checked:border-accent has-checked:bg-accent-subtle",
              LABEL_FOCUS_RING,
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            {/* The radio's dot: a ring, filled when chosen. */}
            <span
              aria-hidden="true"
              className="mt-1 grid size-4.5 shrink-0 place-items-center rounded-full border-2 border-strong peer-checked:border-accent peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-accent"
            />
            <span className="min-w-0">
              <span className="block font-medium text-primary">{option.label}</span>
              <span className="mt-1 block text-sm leading-6 text-secondary">{option.detail}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
