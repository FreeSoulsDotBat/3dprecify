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
import {
  captionText,
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
  defaultCalcValues,
  defaultOtherCost,
  LABOR_FIELDS,
  MANDATORY_FIELDS,
  type MarketplaceId,
  MARKUP_FIELDS,
  type Modality,
  MODALITY_OPTIONS,
  OPTIONAL_FIELDS,
} from "@/features/calculator/calculator-schema";
import { formToProductIn, productToForm } from "@/features/calculator/product-mapping";
import { apiErrorMessage } from "@/shared/api/error-messages";
import { ApiError } from "@/shared/api/transport";
import { useFeeCatalog } from "@/shared/fee-catalog";
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

const t = messages.calculator;
const pf = messages.productForm;
const catalogo = messages.catalogo;

function honestWriteError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 0 ? catalogo.offlineWriteBlocked : apiErrorMessage(err);
  }
  return catalogo.offlineWriteBlocked;
}

export function ProdutoPage({ productId }: { productId?: string }) {
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
      setValue(field as "costPerRoll" | "rollWeightKg" | "wasteGrams", value);
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
    channels: channelOutcomes,
    otherCostErrors,
  } = computeFromForm(values, { catalog, source, now: Date.now() });

  const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) => {
    const first = (MODALITY_OPTIONS[marketplace][0]?.value ?? "") as Modality;
    setValue(`channels.${index}.modality`, first);
  };

  // Degraded reference state (US6-4): editing a product whose link was severed.
  const degradedFilament = Boolean(editing) && initial?.filamentId === "" && filamentId === "";
  const degradedPrinter = Boolean(editing) && initial?.printerId === "" && printerId === "";

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
      void navigate({ to: "/catalogo" });
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
    { value: "", label: degradedFilament ? pf.manualOption : t.catalogPicker.placeholder },
    ...filaments.map((f) => ({ value: f.id, label: f.name })),
  ];
  const printerOptions = [
    { value: "", label: degradedPrinter ? pf.manualOption : t.catalogPicker.placeholder },
    ...printers.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={title} />

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
        <Button loading={create.isPending || update.isPending} onClick={() => void handleSave()}>
          {pf.saveProduct}
        </Button>
        {submitError && <Alert tone="danger">{submitError}</Alert>}
      </Card>

      {/* Degraded reference (US6-4): calm info, values stay editable below. */}
      {degradedFilament && <Alert tone="info">{pf.degradedFilament}</Alert>}
      {degradedPrinter && <Alert tone="info">{pf.degradedPrinter}</Alert>}

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

      {/* The calculator body — identical sections, identical engine (SC-305 on this surface too). */}
      <FieldGroup
        control={control}
        title={t.sections.inputs}
        info={t.sectionInfo.inputs}
        fields={MANDATORY_FIELDS}
      />
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
      <FieldGroup
        control={control}
        title={t.sections.markup}
        info={t.sectionInfo.markup}
        fields={MARKUP_FIELDS}
      />

      {result ? (
        <PriceResults result={result} values={values} />
      ) : (
        <Alert tone="danger">{t.invalidNote}</Alert>
      )}

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
      />
    </section>
  );
}
