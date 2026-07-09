import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { Icon } from "./icon";

import "./dialog.css";

/**
 * Dialog / Sheet primitive (ADR-0007, decision C1 = build now).
 *
 * DS convention: components with non-trivial a11y are SCAFFOLDED from the Radix
 * wiring (via the shadcn CLI's Radix source) and then RESKINNED with the `tf-*`
 * token CSS — never the shadcn Tailwind-utility skin. Radix owns focus-trap,
 * Escape-to-close and focus-return (FR-016); this module only adds the brand skin
 * and a ≥44×44px close control. First product consumer arrives at E2 (catálogo);
 * the T072 test proves the a11y contract as delivered DS library surface.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export type DialogVariant = "center" | "sheet";
export type SheetSide = "right" | "left" | "bottom";

export interface DialogContentProps extends ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** `center` = modal dialog; `sheet` = edge-anchored panel. */
  variant?: DialogVariant;
  /** Sheet anchor edge (ignored for `center`). */
  side?: SheetSide;
  /** Render the built-in ≥44×44px close control. */
  showClose?: boolean;
  closeLabel?: string;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  {
    variant = "center",
    side = "right",
    showClose = true,
    closeLabel = "Fechar",
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const cls = [
    "tf-dialog",
    variant === "sheet" && "tf-dialog--sheet",
    variant === "sheet" && `tf-dialog--sheet-${side}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="tf-dialog__overlay" />
      <DialogPrimitive.Content ref={ref} className={cls} {...rest}>
        {children}
        {showClose && (
          <DialogPrimitive.Close className="tf-dialog__x" aria-label={closeLabel}>
            <Icon name="x" size={18} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export const DialogTitle = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className = "", ...rest }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={["tf-dialog__title", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className = "", ...rest }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={["tf-dialog__desc", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});

// Sheet surface — same Radix primitive, `sheet` skin (edge-anchored panel).
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;

export const SheetContent = forwardRef<HTMLDivElement, Omit<DialogContentProps, "variant">>(
  function SheetContent(props, ref) {
    return <DialogContent ref={ref} variant="sheet" {...props} />;
  },
);
