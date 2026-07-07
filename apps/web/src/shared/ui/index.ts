// Truth's Forge UI primitives (typed TSX rebuild of the Claude Design system).
// This is the ONLY permitted barrel in the app (ADR-0007 / A38) — no internal
// barrels elsewhere. DS batch-1 for the 4-tab shell lives here.

// ---- Refactored 001 primitives (contract-only, no visual rewrite) ----
export { Field } from "./field";
export type { FieldProps, FieldRenderProps } from "./field";

export { NumberField, parseDecimal, formatDecimal } from "./number-field";
export type { NumberFieldProps, NumberFieldSize } from "./number-field";

export { Select } from "./select";
export type { SelectProps, SelectOption } from "./select";

export { Card } from "./card";
export type { CardProps, CardVariant, CardPadding } from "./card";

export { PriceHero } from "./price-hero";
export type { PriceHeroProps, PriceHeroTone } from "./price-hero";

export { BreakdownRow } from "./breakdown-row";
export type { BreakdownRowProps, BreakdownEmphasis } from "./breakdown-row";

// ---- Added batch-1 primitives (pure tf-*) ----
export { Button } from "./button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./button";

export { Icon } from "./icon";
export type { IconProps, IconName } from "./icon";

export { Logo } from "./logo";
export type { LogoProps, LogoVariant } from "./logo";

export { Grafismo } from "./grafismo";
export type { GrafismoProps, GrafismoName } from "./grafismo";

export { Spinner } from "./spinner";
export type { SpinnerProps, SpinnerSize } from "./spinner";

export { Badge } from "./badge";
export type { BadgeProps, BadgeTone } from "./badge";

export { Alert } from "./alert";
export type { AlertProps, AlertTone } from "./alert";

export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";

export { InfoTip } from "./info-tip";
export type { InfoTipProps } from "./info-tip";

export { Toaster, toast, useToastStore } from "./toast";
export type { ToastTone, ToastItem } from "./toast";

// ---- Added batch-1 primitives (Radix-skinned) ----
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "./dialog";
export type { DialogContentProps, DialogVariant, SheetSide } from "./dialog";

export { Switch } from "./switch";
export type { SwitchProps } from "./switch";

// ---- Theme store (shared UI state) ----
export { useThemeStore, applyInitialTheme, THEME_STORAGE_KEY } from "./theme-store";
export type { Theme } from "./theme-store";
