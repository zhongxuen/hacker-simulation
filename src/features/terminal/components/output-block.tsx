"use client";

import { memo, useId, useState, type CSSProperties } from "react";
import { FOCUS_RING } from "@/components/ui/focus-ring";
import { cx } from "@/lib/cx";
import { explainBlock } from "../beginner/what-happened";
import type { PromptInfo, TerminalBlock, TerminalLine } from "../session/terminal-session";
import { AnsiText, CopyText } from "./styled-text";

/** The prompt as a real shell shows it: user@host:folder$, in green and blue. */
export function PromptLabel({ prompt }: { prompt: PromptInfo }) {
  return (
    <>
      <span className="font-bold text-term-green">
        {prompt.user}@{prompt.host}
      </span>
      <span>:</span>
      <span className="font-bold text-term-blue">{prompt.cwd}</span>
      <span>{prompt.symbol}</span>
    </>
  );
}

/**
 * Lines keep their leading spaces, and wrapped lines line up under the first character after
 * them (a hanging indent), so indented output like a manual page stays readable when it wraps.
 */
function indentStyle(text: string): CSSProperties | undefined {
  const indent = /^ */.exec(text)?.[0].length ?? 0;
  return indent > 0 ? { paddingLeft: `${indent}ch`, textIndent: `-${indent}ch` } : undefined;
}

const TerminalLineView = memo(function TerminalLineView({ line }: { line: TerminalLine }) {
  if (line.kind === "explain") {
    return (
      <div
        className={cx(
          "pl-[4ch] -indent-[2ch] text-term-dim",
          line.pointer && "indent-0 text-term-yellow",
        )}
      >
        {!line.pointer && <span aria-hidden="true">↳ </span>}
        <CopyText text={line.text} />
      </div>
    );
  }
  if (line.kind === "note") {
    return (
      <div className="text-term-yellow">
        <span aria-hidden="true">* </span>
        {line.text}
      </div>
    );
  }
  return (
    <div className={cx(line.error && "text-term-red")} style={indentStyle(line.text)}>
      {line.spans.length === 0 ? " " : <AnsiText spans={line.spans} />}
    </div>
  );
});

interface OutputBlockProps {
  block: TerminalBlock;
  beginnerMode: boolean;
  /** The newest block keeps its "What just happened?" button in view. */
  latest: boolean;
  /**
   * Let the browser skip laying out this block while it's off screen. Off for the newest blocks,
   * which arrive below the view and must be measured for real before the output scrolls to them.
   */
  virtualize: boolean;
}

/**
 * One command and everything it printed. Off-screen blocks skip layout and painting
 * (content-visibility), so long sessions stay fast, while their text stays in the page for
 * screen readers and find-in-page.
 */
export const OutputBlock = memo(function OutputBlock({
  block,
  beginnerMode,
  latest,
  virtualize,
}: OutputBlockProps) {
  const [explaining, setExplaining] = useState(false);
  const panelId = useId();
  const lines = beginnerMode ? block.lines : block.lines.filter((line) => line.kind !== "explain");
  const rows = lines.length + 1;
  const canExplain = block.kind === "command" && block.input.trim() !== "";

  return (
    <section
      aria-label={
        block.kind === "command" ? `Command: ${block.input || "(empty line)"}` : "Terminal note"
      }
      className="group relative"
      style={
        virtualize
          ? { contentVisibility: "auto", containIntrinsicSize: `auto ${rows * 1.5}rem` }
          : undefined
      }
    >
      {block.kind === "command" && (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 break-words whitespace-pre-wrap">
            <PromptLabel prompt={block.prompt} /> {block.input}
          </p>
          {canExplain && (
            <button
              type="button"
              aria-expanded={explaining}
              aria-controls={panelId}
              onClick={() => setExplaining((open) => !open)}
              className={cx(
                "shrink-0 rounded px-1.5 font-sans text-xs leading-6 text-term-dim hover:text-term-fg",
                !latest &&
                  !explaining &&
                  "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                FOCUS_RING,
              )}
            >
              {explaining ? "Hide explanation" : "What just happened?"}
            </button>
          )}
        </div>
      )}
      {lines.map((line) => (
        <TerminalLineView key={line.id} line={line} />
      ))}
      {canExplain && explaining && <WhatHappenedPanel id={panelId} block={block} />}
    </section>
  );
});

function WhatHappenedPanel({ id, block }: { id: string; block: TerminalBlock }) {
  const explanation = explainBlock(block);
  return (
    <div
      id={id}
      className="my-2 rounded-md border-l-2 border-term-cyan py-1 pl-3 font-sans text-sm leading-6 text-term-fg"
    >
      <p className="font-semibold">What just happened</p>
      {explanation.steps.length > 0 && (
        <ul className="mt-1 space-y-1">
          {explanation.steps.map((step, i) => (
            <li key={i}>
              <code className="font-mono text-term-cyan">{step.name}</code>:{" "}
              <CopyText text={step.summary} />
              {step.details.length > 0 && (
                <ul className="mt-0.5 ml-4 list-disc text-term-dim marker:text-term-dim">
                  {step.details.map((detail, j) => (
                    <li key={j}>
                      <CopyText text={detail} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {explanation.joins.map((join, i) => (
        <p key={i} className="mt-1 text-term-dim">
          <CopyText text={join} />
        </p>
      ))}
      <div className="mt-1 space-y-0.5">
        {explanation.outcome.map((line, i) => (
          <p key={i}>
            <CopyText text={line} />
          </p>
        ))}
      </div>
      <p className="mt-1 text-term-dim">
        Want the full story? <CopyText text="Type `man` and the command's name." />
      </p>
    </div>
  );
}
