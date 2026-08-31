// The calculator FORM BODY, extracted verbatim from calcular-page (T030). Both Calcular and the
// product full-page route (ux §1.6b — "a product form is essentially the calculator + a name +
// two catalog refs") mount these sections over the SAME RHF control + the SAME computeFromForm,
// so the SC-305 byte-identity anchor holds on both surfaces by construction. Pure extraction:
// no behavior change, no new primitives.
//
// 019-polish (readability split) — this file is now a BARREL: every component/style object here
// used to be defined verbatim in this file; each was MOVED (not rewritten) into
// `form-atoms/`, `form-molecules/`, `form-organisms/` or `form-logic/`, grouped by atomic-design
// granularity. Every consumer (pages/widgets/tests) keeps importing from
// "@/features/calculator/calculator-form" unchanged — this re-exports the exact same public
// symbols as before the split.

import "./calculator-form.css";

export { gridCard, sectionLabel, captionText } from "./form-atoms/form-styles";
export { SectionTitle } from "./form-atoms/section-title";

export { ControlledField } from "./form-molecules/controlled-field";
export { TimeHmField } from "./form-molecules/time-hm-field";

export { CostsSection } from "./form-organisms/costs-section";
export { FieldGroup } from "./form-organisms/field-group";
export { MachineCostFields } from "./form-organisms/machine-cost-fields";
export { MarketplaceSection } from "./form-organisms/marketplace-section";
export { PriceResults } from "./form-organisms/price-results";
export { OtherCostsSection } from "./form-organisms/other-costs-section";
