// Truth's Forge UI primitives (typed TSX rebuild of the Claude Design system).
// First batch covers the walking-skeleton calculator; more land at E1.
export { Field } from "./field";
export type { FieldProps, FieldRenderProps } from "./field";

export { NumberField, parseDecimal, formatDecimal } from "./number-field";
export type { NumberFieldProps, NumberFieldSize } from "./number-field";

export { Card } from "./card";
export type { CardProps, CardVariant, CardPadding } from "./card";

export { PriceHero } from "./price-hero";
export type { PriceHeroProps, PriceHeroTone } from "./price-hero";

export { BreakdownRow } from "./breakdown-row";
export type { BreakdownRowProps, BreakdownEmphasis } from "./breakdown-row";
