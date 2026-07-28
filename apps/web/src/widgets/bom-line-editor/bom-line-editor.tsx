import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import {
  captionText,
  FieldGroup,
  MarketplaceSection,
  OtherCostsSection,
  PriceResults,
} from "@/features/calculator/calculator-form";
import { computeFromForm } from "@/features/calculator/calculator-model";
import {
  type CalcFormValues,
  calculatorResolver,
  defaultOtherCost,
  LABOR_FIELDS,
  MANDATORY_FIELDS,
  type MarketplaceId,
  MARKUP_FIELDS,
  type Modality,
  MODALITY_OPTIONS,
  OPTIONAL_FIELDS,
} from "@/features/calculator/calculator-schema";
import type { ProductOut } from "@/shared/api/generated";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { spineForMarketplace } from "@/features/calculator/fee-prefill";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Card, Field, Icon, Select } from "@/shared/ui";

// 008/T005 — the expanded BOM line editor (research R7): the widgets layer is the sanctioned
// home for this cross-feature composite — it may import `features/calculator` (FSD: widgets →
// feature), which `features/bom` may not. It hosts ONE RHF form per line and mounts the
// calculator's piece form VERBATIM (ux §1.3 — same sections, same fields, same validation), plus
// the in-line "Usar produto salvo" picker (§1.2-C). Values lift to the page on every change so a
// collapsed (unmounted) line keeps its state; the page recomputes the assembly via `composeBom`.

const t = messages.calculator;
const tb = messages.bom;

export interface BomLineEditorProps {
  /** The line's current values (page-owned; the editor is remounted via `key` on product bind). */
  values: CalcFormValues;
  onValuesChange: (values: CalcFormValues) => void;
  products: ProductOut[];
  /** Bound product id; "" = manual/ad-hoc. */
  productId: string;
  onBindProduct: (id: string) => void;
  /** True when a bound line's fields were edited after binding (ux §1.4 honesty seal). */
  adjusted: boolean;
}

export function BomLineEditor({
  values,
  onValuesChange,
  products,
  productId,
  onBindProduct,
  adjusted,
}: BomLineEditorProps) {
  const { control, watch, setValue } = useForm<CalcFormValues>({
    defaultValues: values,
    resolver: calculatorResolver,
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "channels" });
  const {
    fields: otherCostFields,
    append: appendOtherCost,
    remove: removeOtherCost,
  } = useFieldArray({ control, name: "otherCosts" });

  // Lift every change to the page (the composer owns line state so collapsed lines persist).
  useEffect(() => {
    const sub = watch((v) => onValuesChange(v as CalcFormValues));
    return () => sub.unsubscribe();
  }, [watch, onValuesChange]);

  const { catalog, source, refreshFailed, refreshing, refetch: retryCatalog } = useFeeCatalog();
  const current = watch();
  const {
    result,
    channels: channelOutcomes,
    otherCostErrors,
  } = computeFromForm(current, { catalog, source, now: Date.now() });

  const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) => {
    const first = (MODALITY_OPTIONS[marketplace][0]?.value ?? "") as Modality;
    setValue(`channels.${index}.modality`, first);
  };

  const boundProduct = products.find((p) => p.id === productId);
  const sealTemplate = adjusted ? tb.fromCatalogAdjusted : tb.fromCatalog;
  const productOptions = [
    { value: "", label: tb.manual },
    ...products.map((p) => ({ value: p.id, label: p.name })),
  ];

  // ux §1.3 secondary disclosure — label composed from the existing section titles (no new copy).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedLabel = [
    t.sections.optional,
    t.sections.labor,
    t.outrosCustos.title,
    t.sections.marketplace,
  ].join(" · ");

  return (
    <div className="flex flex-col gap-3">
      {/* In-line catalog picker (§1.2-C): a line is ad-hoc by default; binding a saved product
          pre-fills the SAME editable fields (live values — the reference stores no price). */}
      {products.length > 0 && (
        <Card padding="md" className="flex flex-col gap-2">
          <Field label={tb.useProduct} tightLabel>
            {(p) => (
              <Select
                {...p}
                options={productOptions}
                value={productId}
                onChange={(e) => onBindProduct(e.target.value)}
              />
            )}
          </Field>
          {boundProduct && (
            <p style={captionText}>{sealTemplate.replace("{nome}", boundProduct.name)}</p>
          )}
        </Card>
      )}

      {/* The calculator body — identical sections, identical engine (SC-402 lineage). The
          mandatory costs + markup stay visible; the secondary sections collapse under ONE
          disclosure (ux §1.3, T006b nit #2) so only the line being tuned pays the height.
          Collapsing UNMOUNTS the sections but RHF keeps their VALUES, and both the resolver and
          computeFromForm run over values — a collapsed bad fee still errors/rolls up honestly. */}
      <FieldGroup
        control={control}
        title={t.sections.inputs}
        info={t.sectionInfo.inputs}
        fields={MANDATORY_FIELDS}
      />
      <FieldGroup
        control={control}
        title={t.sections.markup}
        info={t.sectionInfo.markup}
        fields={MARKUP_FIELDS}
      />

      <button
        type="button"
        className="flex min-h-11 items-center gap-2 text-left text-sm text-[var(--text-muted)]"
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((open) => !open)}
      >
        <Icon name={advancedOpen ? "chevron-up" : "chevron-down"} size={16} aria-hidden />
        <span>{advancedLabel}</span>
      </button>

      {advancedOpen && (
        <div className="flex flex-col gap-3">
          <FieldGroup
            control={control}
            title={t.sections.optional}
            info={t.sectionInfo.optional}
            hint={t.sections.optionalHint}
            fields={OPTIONAL_FIELDS}
          />
          <FieldGroup
            control={control}
            title={t.sections.labor}
            info={t.sectionInfo.labor}
            fields={LABOR_FIELDS}
          />
          <OtherCostsSection
            control={control}
            fields={otherCostFields}
            errors={otherCostErrors}
            onAppend={() => appendOtherCost(defaultOtherCost())}
            onRemove={removeOtherCost}
          />
          <MarketplaceSection
            control={control}
            values={current}
            fields={fields}
            channelOutcomes={channelOutcomes}
            included={current.includeMarketplace !== false}
            onToggleInclude={(next) => setValue("includeMarketplace", next)}
            onAppend={append}
            onRemove={remove}
            onMarketplaceChange={handleMarketplaceChange}
            refreshFailed={refreshFailed}
            refreshing={refreshing}
            onRetryCatalog={retryCatalog}
            spineFor={(m) => spineForMarketplace(catalog, m)}
          />
        </div>
      )}

      {result ? (
        <PriceResults result={result} values={current} />
      ) : (
        <Alert tone="danger">{t.invalidNote}</Alert>
      )}
    </div>
  );
}
