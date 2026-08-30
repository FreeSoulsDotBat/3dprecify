import * as SwitchPrimitive from "@radix-ui/react-switch";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import "./switch.css";

/**
 * Switch primitive (T059, ADR-0007 Radix-skinned). Radix owns the a11y contract
 * (`role="switch"`, `aria-checked`, keyboard); this module only adds the `tf-*` skin
 * and guarantees a ≥44×44px hit area (INV-2) — the visible track is centred inside
 * the larger touch target. Always labelled by the caller (`aria-label` /
 * `aria-labelledby`); it renders no text of its own.
 */
export type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { className = "", ...rest },
  ref,
) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={["tf-switch", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <span className="tf-switch__track" aria-hidden="true">
        <SwitchPrimitive.Thumb className="tf-switch__thumb" />
      </span>
    </SwitchPrimitive.Root>
  );
});
