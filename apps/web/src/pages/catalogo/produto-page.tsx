import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import {
  useCreateProduct,
  useFilaments,
  usePrinters,
  useProducts,
  useUpdateProduct,
} from "@/entities/catalog/use-catalog";
import { freezePriceResult } from "@/entities/history/frozen-payload";
import {
  captionText,
  CostsSection,
  FieldGroup,
  gridCard,
  MarketplaceSection,
  OtherCostsSection,
  PriceResults,
  sectionLabel,
} from "@/features/calculator/calculator-form";
import { computeFromForm } from "@/features/calculator/calculator-model";
import { filamentToCalcFields, printerToCalcFields } from "@/features/calculator/catalog-prefill";
import {
  type CalcFormValues,
  calculatorResolver,
  COST_FIELDS,
  defaultCalcValues,
  defaultOtherCost,
  LABOR_AND_FINISH_FIELDS,
  type MarketplaceId,
  MARKUP_FIELDS,
  slotResetOnMarketplaceChange,
} from "@/features/calculator/calculator-schema";
import { formToProductIn, productToForm } from "@/features/calculator/product-mapping";
import { buildScenarioConfig } from "@/features/calculator/scenario-bridge";
import { RecordSnapshotButton, type RecordSource } from "@/features/history/record-snapshot-sheet";
import { SaveScenarioSheet } from "@/features/scenarios/save-scenario-sheet";
import { honestWriteError } from "@/shared/api/error-messages";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { spineForMarketplace } from "@/features/calculator/fee-prefill";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button, Card, Field, Select, Spinner, toast } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

// US6/T030 — the product create/edit FULL PAGE route (ux §1.6b): the calculator body + a name +
// the two catalog pickers, over the SAME RHF control and the SAME `computeFromForm` as Calcular.
// NO stored price exists anywhere: every number on this page is recomputed live at the current
// PRICING_MODEL_VERSION (FR-310/FR-313). Reopening a DEGRADED product (its reference was
// deleted) shows a calm info alert, the picker at "— Manual —", and the last-known values as
// ordinary editable inputs (US6-4) — never blank, never broken. Saving is honest: a real toast
// only after a real 2xx; a failure keeps the page open with a specific pt-BR line.
//
// 013/FB-02 (ux-catalog §3): a lapsed premium keeps every read (FR-409) but freezes writes — a
// native `<fieldset disabled>` inerts the name field, the pickers and the whole calculator body in
// one place, with the reactivation line replacing Salvar. Visible and honest from first render,
// never a fail-at-save surprise. `readOnly` is passed in by CatalogoPage (the same server-informed
// `useEntitlement()` read it already makes for its other tabs) rather than re-derived here.
// RecordSnapshotButton/SaveScenarioSheet already self-gate on `active` only, so they need no extra
// handling.

const t = messages.calculator;
const pf = messages.productForm;
const catalogo = messages.catalogo;

export function ProdutoPage({
  productId,
  readOnly: lapsed = false,
}: {
  productId?: string;
  /** Premium lapsed (013/FB-02): presentation only — the server's write-time gate is unchanged
   *  (Constitution IV). */
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const products = useProducts();
  const { items: filaments } = useFilaments();
  const { items: printers } = usePrinters();
  const create = useCreateProduct();
  const update = useUpdateProduct();

  const editing = productId ? products.items.find((p) => p.id === productId) : undefined;
  const initial = useMemo(() => (editing ? productToForm(editing) : null), [editing]);

  const { control, watch, setValue, reset } = useForm<CalcFormValues>({
    defaultValues: initial?.values ?? defaultCalcValues,
    resolver: calculatorResolver,
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "channels" });
  const {
    fields: otherCostFields,
    append: appendOtherCost,
    remove: removeOtherCost,
  } = useFieldArray({ control, name: "otherCosts" });

  const [name, setName] = useState(initial?.name ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [filamentId, setFilamentId] = useState(initial?.filamentId ?? "");
  const [printerId, setPrinterId] = useState(initial?.printerId ?? "");
  const [filamentMaterial, setFilamentMaterial] = useState(initial?.filamentMaterial ?? null);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  // The product list can arrive AFTER mount (online read) — apply the loaded product once per id,
  // never clobbering in-progress edits on unrelated refetches.
  const appliedRef = useRef<string | null>(initial ? (productId ?? null) : null);
  useEffect(() => {
    if (!initial || !productId || appliedRef.current === productId) return;
    appliedRef.current = productId;
    reset(initial.values);
    setName(initial.name);
    setFilamentId(initial.filamentId);
    setPrinterId(initial.printerId);
    setFilamentMaterial(initial.filamentMaterial);
  }, [initial, productId, reset]);

  const applyFilament = (id: string) => {
    setFilamentId(id);
    const picked = filaments.find((f) => f.id === id);
    if (!picked) return;
    setFilamentMaterial(picked.material ?? null);
    for (const [field, value] of Object.entries(filamentToCalcFields(picked))) {
      setValue(field as "costPerRoll" | "rollWeightKg", value);
    }
  };
  const applyPrinter = (id: string) => {
    setPrinterId(id);
    const picked = printers.find((p) => p.id === id);
    if (!picked) return;
    for (const [field, value] of Object.entries(printerToCalcFields(picked))) {
      setValue(
        field as
          "machineValue" | "machineLifetimeHours" | "avgPowerKw" | "maintenanceReservePerHour",
        value,
      );
    }
  };

  const { catalog, source, refreshFailed, refreshing, refetch: retryCatalog } = useFeeCatalog();
  const values = watch();
  const {
    result,
    input,
    channels: channelOutcomes,
    otherCostErrors,
  } = computeFromForm(values, { catalog, source, now: Date.now() });

  // US3/T019 — a snapshot recorded from THIS surface carries the product as its origin
  // (`provenance.kind = "PRODUCT"`), the one entry point the calculator cannot produce (it binds
  // filament/printer, never a product). Offered only on a SAVED product with a valid live price;
  // a new/unsaved product has no origin to capture yet. The gate on ACTIVE premium lives inside
  // `RecordSnapshotButton` (the server's last word), so it is not re-implemented here. `freeze`
  // runs at Sheet open, capturing the on-screen values exactly (never re-derived at send time).
  const recordSource: RecordSource | null =
    editing && result && input
      ? {
          kind: "SINGLE",
          freeze: () =>
            freezePriceResult(input, result, {
              kind: "PRODUCT",
              id: editing.id,
              name: editing.name,
            }),
        }
      : null;

  const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) => {
    // 014/T097 — modality AND category: the category belongs to the OLD marketplace's taxonomy.
    const next = slotResetOnMarketplaceChange(marketplace);
    setValue(`channels.${index}.modality`, next.modality);
    setValue(`channels.${index}.category`, next.category);
  };

  // An UNLINKED reference (US6-4 + K3): the product carries values with no live row behind them.
  // Two histories land here — a deletion severed the link, or a kit save materialized the product
  // with no links at all (ADR-0017) — and the data cannot tell them apart, deliberately: the state
  // and the remedy are identical. So the copy never claims a removal it cannot know happened.
  const manualFilament = Boolean(editing) && initial?.filamentId === "" && filamentId === "";
  const manualPrinter = Boolean(editing) && initial?.printerId === "" && printerId === "";

  // Derived from the LIVE picker state, so it clears the instant the seller links both — before
  // they even save (SC-412).
  const needsAttention = Boolean(editing) && (filamentId === "" || printerId === "");

  const handleSave = async () => {
    setSubmitError(undefined);
    const blankName = name.trim() === "";
    setNameError(blankName ? pf.nameRequired : undefined);
    const slotsValid =
      channelOutcomes.every((o) => Object.keys(o.errors).length === 0) &&
      otherCostErrors.every((e) => !e);
    // Create references SAVED items (FR-310); edit may keep a degraded ref as values (US6-4).
    const linksValid = editing ? true : filamentId !== "" && printerId !== "";
    if (blankName || !result || !slotsValid || !linksValid) {
      if (!blankName) setSubmitError(pf.saveInvalid);
      return;
    }
    const body = formToProductIn({
      name: name.trim(),
      filamentId,
      printerId,
      filamentMaterial,
      values,
    });
    try {
      if (editing) await update.mutateAsync({ id: editing.id, body });
      else await create.mutateAsync(body);
      toast(pf.savedProduct, { tone: "success" }); // real 2xx only
      void navigate({ to: "/catalogo", search: { tab: "products" } });
    } catch (err) {
      setSubmitError(honestWriteError(err));
    }
  };

  const title = editing || productId ? pf.editProduct : pf.newProduct;

  // Honest prerequisite (FR-310): creating a product needs a saved filament AND printer.
  if (!productId && (filaments.length === 0 || printers.length === 0)) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <PageHeader title={title} />
        <Alert tone="info">{pf.needRefs}</Alert>
        <Button variant="secondary" onClick={() => void navigate({ to: "/catalogo" })}>
          {pf.backToCatalog}
        </Button>
      </section>
    );
  }

  // Edit route: the list answered but this id isn't in it — honest not-found, never a blank form.
  if (productId && !editing) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <PageHeader title={title} />
        {products.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <Alert tone="info">{pf.notFound}</Alert>
            <Button variant="secondary" onClick={() => void navigate({ to: "/catalogo" })}>
              {pf.backToCatalog}
            </Button>
          </>
        )}
      </section>
    );
  }

  const filamentOptions = [
    { value: "", label: manualFilament ? pf.manualOption : t.catalogPicker.placeholder },
    ...filaments.map((f) => ({ value: f.id, label: f.name })),
  ];
  const printerOptions = [
    { value: "", label: manualPrinter ? pf.manualOption : t.catalogPicker.placeholder },
    ...printers.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <section className="tf-calc-page" data-testid="calc-content">
      <PageHeader title={title} />

      {/* K3: ONE calm, actionable state — the product has no live filament/printer behind it,
          whether a kit save materialized it that way or a deletion severed the links. It says
          what is true (nothing linked, values kept) and never invents a removal it cannot know
          happened. Clears live, the moment both pickers are set (SC-412). */}
      {needsAttention && (
        <Alert tone="info" title={messages.catalogo.needsAttention}>
          {pf.manualValuesKept}
        </Alert>
      )}

      {/* 013/FB-02 (ux-catalog §3): reads/recompute stay complete while lapsed (FR-409); only the
          write below is frozen — visibly and up front, never discovered at "Salvar". */}
      {lapsed && (
        <Alert tone="info" title={catalogo.lapsedTitle}>
          {catalogo.lapsedBody}
        </Alert>
      )}

      {/* `display:contents` keeps every child a direct flex item of the section above (same gap
          rhythm) while a NATIVE `disabled` fieldset inerts every input/select/button nested inside
          — with zero per-field prop threading. Name/save + the catalog-ref pickers stay full width,
          above the two-column grid (they identify the product, not price it). */}
      <fieldset disabled={lapsed} className="contents">
        {/* Name + save — the page's header action (ux §1.6b). */}
        <Card padding="md" className="flex flex-col gap-3">
          <Field label={pf.nameLabel} required error={nameError}>
            {(p) => (
              <div className="tf-inputwrap">
                <input
                  {...p}
                  type="text"
                  className="tf-input"
                  placeholder={pf.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
          </Field>
          {!lapsed && (
            <Button
              loading={create.isPending || update.isPending}
              onClick={() => void handleSave()}
            >
              {pf.saveProduct}
            </Button>
          )}
          {submitError && <Alert tone="danger">{submitError}</Alert>}
          {lapsed && (
            <Alert tone="info" title={catalogo.reactivateTitle}>
              {catalogo.reactivateBody}
            </Alert>
          )}
        </Card>

        {/* The catalog refs — same picker as Calcular; picking pre-fills the editable fields. */}
        <Card padding="md" className="flex flex-col gap-3">
          <p style={sectionLabel}>{t.catalogPicker.title}</p>
          <p style={captionText}>{t.catalogPicker.hint}</p>
          <div style={gridCard}>
            <Field label={t.catalogPicker.filament} tightLabel>
              {(p) => (
                <Select
                  {...p}
                  options={filamentOptions}
                  value={filamentId}
                  onChange={(e) => applyFilament(e.target.value)}
                />
              )}
            </Field>
            <Field label={t.catalogPicker.printer} tightLabel>
              {(p) => (
                <Select
                  {...p}
                  options={printerOptions}
                  value={printerId}
                  onChange={(e) => applyPrinter(e.target.value)}
                />
              )}
            </Field>
          </div>
        </Card>
      </fieldset>

      {/* 016/PR-B (US4/T015) — same two-column split as Calcular (SC-305: identical body,
          identical layout). Costs on the left, markup + marketplace channel editing on the
          right; each column's own `disabled` fieldset preserves the lapsed-premium freeze
          exactly as before (FB-02), just scoped per column instead of one big wrapper. */}
      <div className="tf-calc-grid">
        <div className="tf-calc-grid__col">
          <fieldset disabled={lapsed} className="contents">
            {/* 016/PR-C (US6/US7/US8/US9) — see calcular-page.tsx: SAME body, SAME components,
                so this route stays byte-identical to Calcular (SC-305). */}
            <CostsSection control={control} fields={COST_FIELDS} />
            <FieldGroup
              control={control}
              title={t.sections.labor}
              info={t.sectionInfo.labor}
              fields={LABOR_AND_FINISH_FIELDS}
            />
            <OtherCostsSection
              control={control}
              fields={otherCostFields}
              errors={otherCostErrors}
              onAppend={() => appendOtherCost(defaultOtherCost())}
              onRemove={removeOtherCost}
            />
          </fieldset>
        </div>
        <div className="tf-calc-grid__col">
          <fieldset disabled={lapsed} className="contents">
            <FieldGroup
              control={control}
              title={t.sections.markup}
              info={t.sectionInfo.markup}
              fields={MARKUP_FIELDS}
            />
            <MarketplaceSection
              control={control}
              values={values}
              fields={fields}
              channelOutcomes={channelOutcomes}
              included={values.includeMarketplace !== false}
              onToggleInclude={(next) => setValue("includeMarketplace", next)}
              onAppend={append}
              onRemove={remove}
              onMarketplaceChange={handleMarketplaceChange}
              refreshFailed={refreshFailed}
              refreshing={refreshing}
              onRetryCatalog={retryCatalog}
              spineFor={(m) => spineForMarketplace(catalog, m)}
            />
          </fieldset>
        </div>
      </div>

      <div className="tf-calc-footer">
        {result ? (
          <PriceResults result={result} values={values} channelOutcomes={channelOutcomes} />
        ) : (
          <Alert tone="danger">{t.invalidNote}</Alert>
        )}

        {/* Record the on-screen price as a frozen snapshot, tagged with this product as its
            origin (US3/T019). Present only for a premium seller on a saved product with a valid
            live price. */}
        {recordSource && <RecordSnapshotButton source={recordSource} />}

        {/* 010/T021b (E5, PR-B) — save a scenario referencing THIS saved product (closes FR-606a
            on the UI side): `buildScenarioConfig`'s `productRef` captures `costBasis.kind =
            "PRODUCT"` instead of AD_HOC, so the D3/D6 lifecycle (T011 server re-snapshot, T022
            read-time resolve) applies on reopen. Offered only on a SAVED product with a valid
            live price — a new/unsaved product has no id to reference yet (mirrors `recordSource`
            above). */}
        {editing && result && input && (
          <div className="flex justify-center">
            <SaveScenarioSheet
              source={{
                buildConfig: () =>
                  buildScenarioConfig({
                    values,
                    channelOutcomes,
                    parsedInput: input,
                    productRef: { id: editing.id, name: editing.name },
                  }),
                basisLabel: `${editing.name} (${messages.scenarios.basisKindProduct})`,
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
