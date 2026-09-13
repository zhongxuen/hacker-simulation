"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { cx } from "@/lib/cx";

interface PromptInputProps {
  value: string;
  /** Where the cursor is: an index into `value`. */
  cursor: number;
  /** Faint text after the cursor that Tab accepts. Only shown with the cursor at the end. */
  ghost: string;
  onChange: (value: string, cursor: number) => void;
  onCursor: (cursor: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Accessible name and description. */
  label: string;
  describedBy?: string;
  disabled?: boolean;
}

/**
 * The command line you type into. It's a real <input>, so typing, selection, pasting, screen
 * readers and on-screen keyboards all work as usual. Its own text and caret are transparent: a
 * mirror underneath draws the same text with a terminal-style block cursor (which blinks, unless
 * motion is reduced) and the ghost suggestion.
 */
export function PromptInput({
  value,
  cursor,
  ghost,
  onChange,
  onCursor,
  onKeyDown,
  inputRef,
  label,
  describedBy,
  disabled,
}: PromptInputProps) {
  const [focused, setFocused] = useState(false);
  const mirrorRef = useRef<HTMLDivElement>(null);

  // Keep the mirror scrolled like the input when the line is wider than the box.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (input && mirror) mirror.scrollLeft = input.scrollLeft;
  });

  const before = value.slice(0, cursor);
  const under = value.slice(cursor, cursor + 1);
  const after = value.slice(cursor + 1);
  const showGhost = ghost !== "" && cursor === value.length;

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none overflow-hidden whitespace-pre"
      >
        {before}
        <span
          className={cx(
            "inline-block min-w-[1ch]",
            focused
              ? "animate-cursor-blink bg-accent text-surface-base"
              : "outline-1 -outline-offset-1 outline-accent",
          )}
        >
          {under || " "}
        </span>
        {after}
        {showGhost && <span className="text-term-dim">{ghost}</span>}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) =>
          onChange(event.target.value, event.target.selectionStart ?? event.target.value.length)
        }
        onSelect={(event) => {
          const target = event.currentTarget;
          if (target.selectionStart !== null) onCursor(target.selectionStart);
          if (mirrorRef.current) mirrorRef.current.scrollLeft = target.scrollLeft;
        }}
        onScroll={(event) => {
          if (mirrorRef.current) mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        onKeyDown={onKeyDown}
        className="absolute inset-0 w-full bg-transparent p-0 text-transparent caret-transparent outline-none selection:bg-accent/30"
      />
    </div>
  );
}
