import * as PopoverPrimitive from "@radix-ui/react-popover";
import { type ReactNode, useRef, useState } from "react";

import { Icon } from "./icon";

import "./info-tip.css";

export interface InfoTipProps {
  /** Accessible name for the trigger button, e.g. "Sobre os custos da peça". */
  label: string;
  /** Explanatory content shown inside the popover. */
  children: ReactNode;
  /** Preferred popover side (Radix flips it on collision). Default `top`. */
  side?: "top" | "right" | "bottom" | "left";
}

// Hover-to-open is a progressive enhancement for real pointer devices only — touch and
// keyboard always use tap/click + Escape/outside-click (owned by Radix). The click path
// works everywhere, so content is never gated behind hover.
function prefersHover(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

/**
 * InfoTip (ADR-0007 Radix-wired `tf-*`). An accessible icon-button that reveals a short
 * explanation of what/how a section calculates. Radix Popover owns the a11y contract
 * (labelled trigger, Escape + outside-click to close, focus handling); this module adds
 * the brand skin and a hover affordance on pointer devices. Non-modal: it never traps
 * focus or blocks the page underneath.
 */
export function InfoTip({ label, children, side = "top" }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [canHover] = useState(prefersHover);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 016/PR-C homologação (R3) — Escape closes the popover while the pointer never moved off the
  // trigger; Radix then unmounts the content, and the browser reads "what's under the cursor
  // changed" as a fresh `mouseenter` on the trigger, so the hover handler below reopened it
  // immediately — the exact key the seller just pressed undoing itself. This ref makes Escape WIN:
  // hover stays suppressed until the pointer genuinely leaves (`onMouseLeave` below clears it).
  const suppressHover = useRef(false);

  // A short close delay bridges the gap between the trigger and the floated content so
  // moving the mouse across it doesn't flicker the popover shut.
  const hoverProps = canHover
    ? {
        onMouseEnter: () => {
          if (suppressHover.current) return;
          clearTimeout(closeTimer.current);
          setOpen(true);
        },
        onMouseLeave: () => {
          suppressHover.current = false;
          closeTimer.current = setTimeout(() => setOpen(false), 80);
        },
      }
    : undefined;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        type="button"
        className="tf-infotip__trigger"
        aria-label={label}
        {...hoverProps}
      >
        <Icon name="info" size={16} />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="tf-infotip__content"
          side={side}
          align="center"
          sideOffset={6}
          collisionPadding={12}
          onEscapeKeyDown={() => {
            suppressHover.current = true;
            setOpen(false);
          }}
          {...hoverProps}
        >
          {children}
          <PopoverPrimitive.Arrow className="tf-infotip__arrow" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
