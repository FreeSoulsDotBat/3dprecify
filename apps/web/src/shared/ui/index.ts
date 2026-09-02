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
export type { ButtonProps, ButtonVariant, ButtonSize, ButtonWidth } from "./button";

export { Icon } from "./icon";
export type { IconProps, IconName } from "./icon";

export { Logo } from "./logo";
export type { LogoProps, LogoVariant } from "./logo";

export { Ornament } from "./ornament";
export type { OrnamentProps, OrnamentName } from "./ornament";

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

// ---- 018 — grupo segmentado (composição do padrão que vivia dentro de catalogo-page.tsx) ----
export { Segmented } from "./segmented";
export type { SegmentedProps, SegmentedOption } from "./segmented";

// ---- Theme store (shared UI state) ----
export { useThemeStore, applyInitialTheme, THEME_STORAGE_KEY } from "./theme-store";
export type { Theme } from "./theme-store";

// ---- 018 — preferência do menu recolhido (por aparelho, molde do theme-store) ----
export { useNavRailStore, NAV_RAIL_STORAGE_KEY } from "./nav-rail-store";

// 019/PR-A (ADR-0032) — os primitivos do porte do design.
export { Frozen } from "./frozen";
export type { FrozenProps } from "./frozen";

export { Plist } from "./plist";
export type { PlistProps, PlistItemData, PlistFlag, PlistFlagTone } from "./plist";

export { Table } from "./table";
export type { TableProps } from "./table";

export { TextField } from "./text-field";
export type { TextFieldProps } from "./text-field";
export { Notice } from "./notice";
export type { NoticeProps } from "./notice";
