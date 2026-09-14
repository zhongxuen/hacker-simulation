"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { buttonClassName } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

export interface ExportMenuProps {
  onPicture: () => void;
  onData: () => void;
}

/**
 * The map toolbar's Export button: a short menu to save the map as a picture (PNG) or as data
 * (JSON). Arrow keys move through it, Enter picks, Escape closes and puts focus back on the button.
 */
export function ExportMenu({ onPicture, onData }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const items = [
    { id: "png", label: "Save as a picture (PNG)", onSelect: onPicture },
    { id: "json", label: "Save as data (JSON)", onSelect: onData },
  ];

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!buttonRef.current?.parentElement?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      itemRefs.current[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName({ variant: "ghost", size: "sm" })}
      >
        <DownloadIcon />
        Export
        <span aria-hidden="true" className="text-xs">
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Export the map"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-40 mt-1 w-60 animate-fade-in rounded-lg border border-strong bg-surface-overlay p-1 shadow-xl"
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
                item.onSelect();
              }}
              className={cx(
                "block w-full rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-surface-raised focus:bg-surface-raised focus:outline-2 focus:outline-focus-ring",
              )}
            >
              {item.label}
            </button>
          ))}
          <p className="px-3 pt-1 pb-2 text-xs leading-5 text-muted">
            Both are marked as simulated. Nothing leaves your device.
          </p>
        </div>
      )}
    </div>
  );
}
