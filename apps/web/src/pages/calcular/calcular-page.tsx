import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { useFilaments, usePrinters } from "@/entities/catalog/use-catalog";
import { freezePriceResult } from "@/entities/history/frozen-payload";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { RecordSnapshotButton } from "@/features/history/record-snapshot-sheet";
import {
  captionText,
  FieldGroup,
  gridCard,
  MarketplaceSection,
  OtherCostsSection,
  PriceResults,
  sectionLabel,
} from "@/features/calculator/calculator-form";
import { PremiumTeaserDialog } from "@/features/catalog/premium-teaser";
import { computeFromForm } from "@/features/calculator/calculator-model";
import { filamentToCalcFields, printerToCalcFields } from "@/features/calculator/catalog-prefill";
import { applyScenarioConfig, buildScenarioConfig } from "@/features/calculator/scenario-bridge";
import {
  type CalcFieldName,
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
import { SaveScenarioSheet } from "@/features/scenarios/save-scenario-sheet";
import { ScenariosListSheet } from "@/features/scenarios/scenarios-list-sheet";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Button, Card, Field, Icon, Select } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

// E1 calculator screen. RHF (form state) + Zod (calculatorResolver) own the pt-BR inputs; the price +
// breakdown come from one synchronous computeFromForm pass over the canonical pricing-core engine
// (recompute on every change, deterministic, offline — FR-036/FR-039). 004-US1 = a correct retail +
// wholesale price (PriceHero); 004-US2 = the transparent per-line breakdown that visibly sums to
// custo_total + the markup derivation (BreakdownRow); 004-US4 = the optional labor cost. The 005
// multi-channel expansion layers on top: multi-channel marketplace gross-up + honesty seals (US1/US2),
// non-blocking offline catalog refresh (US3), the "Incluir marketplaces no preço" visibility toggle
// (US4), and the itemized "Outros custos" named sub-costs slot (US5). No persistence / paywall (US6).
// The section components live in features/calculator/calculator-form (T030) — the product full-page
// route mounts the SAME body, keeping SC-305 identical on both surfaces.

const t = messages.calculator;

export function CalcularPage() {
  const { control, watch, setValue } = useForm<CalcFormValues>({
    defaultValues: defaultCalcValues,
    resolver: calculatorResolver,
    mode: "onChange",
  });
  const {
    fields,
    append,
    remove,
    replace: replaceChannels,
  } = useFieldArray({
    control,
    name: "channels",
  });
  const {
    fields: otherCostFields,
    append: appendOtherCost,
    remove: removeOtherCost,
    replace: replaceOtherCosts,
  } = useFieldArray({ control, name: "otherCosts" });

  // 010/T014 (E5, PR-A US2) — reopening a scenario loads its config INTO this same form (the
  // reopened scenario IS the calculator, populated — ux §4). `loadedScenario` only drives the
  // minimal context bar (name + the live-recompute promise); PR-B (T023/T026/T029) adds
  // "Duplicar"/"Salvar alterações"/rename/close-with-unsaved-changes on top of this seam.
  const [loadedScenario, setLoadedScenario] = useState<{ id: string; name: string } | null>(null);
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const openScenario = (config: ScenarioConfig, meta: { id: string; name: string }) => {
    const patch = applyScenarioConfig(config);
    for (const [field, value] of Object.entries(patch.scalars)) {
      setValue(field as CalcFieldName, value);
    }
    setValue("includeMarketplace", patch.includeMarketplace);
    replaceChannels(patch.channels);
    replaceOtherCosts(patch.otherCosts);
    setLoadedScenario(meta);
  };

  // US5 (E2/T024) — the catalog pickers. Rendered ONLY for authenticated accounts WITH saved
  // items, so the free manual flow is untouched (SC-310); the read hooks are uid-gated and
  // answer from the offline cache after one online load (Q2). Picking pre-fills via setValue —
  // fields stay ordinary editable inputs (pre-fill, never lock; byte-identity by construction,
  // SC-305/catalog-prefill.ts).
  const sessionStatus = useSessionStore((s) => s.status);
  const { items: filaments } = useFilaments();
  const { items: printers } = usePrinters();
  const [pickedFilamentId, setPickedFilamentId] = useState("");
  const [pickedPrinterId, setPickedPrinterId] = useState("");
  const applyFilament = (id: string) => {
    setPickedFilamentId(id);
    const picked = filaments.find((f) => f.id === id);
    if (!picked) return;
    for (const [field, value] of Object.entries(filamentToCalcFields(picked))) {
      setValue(field as "costPerRoll" | "rollWeightKg" | "wasteGrams", value);
    }
  };
  const applyPrinter = (id: string) => {
    setPickedPrinterId(id);
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
  const showFilamentPicker = sessionStatus === "authenticated" && filaments.length > 0;
  const showPrinterPicker = sessionStatus === "authenticated" && printers.length > 0;

  // US7 (T032): free/signed-out users meet a VISIBLE "usar do catálogo" affordance whose tap
  // opens the honest teaser — never a broken picker, never a fake save. Rendered only on a
  // POSITIVELY known non-premium state; the manual calculator is untouched either way (SC-310).
  const entitlement = useEntitlement();
  const signedOut = sessionStatus !== "authenticated";
  const showTeaserSlot = signedOut || entitlement.data?.status === "none";
  const [teaserOpen, setTeaserOpen] = useState(false);

  // The fee catalog (served → persisted store → bundled seed) pre-fills covered channels + drives the
  // honesty seal. It NEVER blocks: seed/store always answer offline, and every price stays local. A
  // failed online refresh is surfaced as a non-blocking retry (US3), never an error wall.
  const {
    catalog,
    source,
    refreshFailed: catalogRefreshFailed,
    refreshing: catalogRefreshing,
    refetch: retryCatalog,
  } = useFeeCatalog();

  const values = watch();
  const {
    result,
    input,
    channels: channelOutcomes,
    otherCostErrors,
  } = computeFromForm(values, {
    catalog,
    source,
    now: Date.now(),
  });

  // Switching a slot's marketplace resets its modality to that market's default (or none), so a
  // stale ML "Clássico" never lingers on a Shopee slot.
  const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) => {
    const first = (MODALITY_OPTIONS[marketplace][0]?.value ?? "") as Modality;
    setValue(`channels.${index}.modality`, first);
  };

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} className="tf-page-header--center" />

      {/* 010/T013 (E5) — "Meus cenários" is a NAV-LIKE entry, not a save button: it sits with the
          page title (never inside the results block) and is VISIBLE for everyone, incl. free/
          signed-out (the SC-109-safe honest door, ux §0.1/§2.2/§11-F1/F2). */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setScenariosOpen(true)}>
          <Icon name="boxes" size={16} aria-hidden /> {messages.scenarios.navEntry}
        </Button>
      </div>
      <ScenariosListSheet
        open={scenariosOpen}
        onOpenChange={setScenariosOpen}
        onOpenScenario={openScenario}
      />

      {/* The "cenário carregado" context bar (ux §4.1) — NO date anywhere, ever (§0.2): the
          subtitle states the LIVE promise instead. PR-A minimal: name + "Fechar cenário" only;
          "Duplicar"/"Salvar alterações" are PR-B (T023/T026/T029). */}
      {loadedScenario && (
        <Card padding="sm" className="flex items-center justify-between gap-3">
          <div>
            <p style={sectionLabel}>
              {messages.scenarios.loadedLabel.replace("{nome}", loadedScenario.name)}
            </p>
            <p style={captionText}>{messages.scenarios.loadedLive}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLoadedScenario(null)}>
            {messages.scenarios.closeScenario}
          </Button>
        </Card>
      )}

      {showTeaserSlot && (
        <Card padding="md" className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setTeaserOpen(true)}>
            {t.catalogPicker.title}
          </Button>
          <p style={{ ...captionText, textAlign: "center" }}>
            {messages.apiError.entitlementRequired}
          </p>
          <PremiumTeaserDialog
            open={teaserOpen}
            onOpenChange={setTeaserOpen}
            signedOut={signedOut}
          />
        </Card>
      )}

      {(showFilamentPicker || showPrinterPicker) && (
        <Card padding="md" className="flex flex-col gap-3">
          <p style={sectionLabel}>{t.catalogPicker.title}</p>
          <p style={captionText}>{t.catalogPicker.hint}</p>
          <div style={gridCard}>
            {showFilamentPicker && (
              <Field label={t.catalogPicker.filament} tightLabel>
                {(p) => (
                  <Select
                    {...p}
                    options={[
                      { value: "", label: t.catalogPicker.placeholder },
                      ...filaments.map((f) => ({ value: f.id, label: f.name })),
                    ]}
                    value={pickedFilamentId}
                    onChange={(e) => applyFilament(e.target.value)}
                  />
                )}
              </Field>
            )}
            {showPrinterPicker && (
              <Field label={t.catalogPicker.printer} tightLabel>
                {(p) => (
                  <Select
                    {...p}
                    options={[
                      { value: "", label: t.catalogPicker.placeholder },
                      ...printers.map((pr) => ({ value: pr.id, label: pr.name })),
                    ]}
                    value={pickedPrinterId}
                    onChange={(e) => applyPrinter(e.target.value)}
                  />
                )}
              </Field>
            )}
          </div>
        </Card>
      )}

      {/* Top→bottom: (1) mandatory costs → (2) optional adjustments → (3) markup →
          (4) breakdown → (5) suggested prices. The user enters costs and sees how the
          number is built before the final retail/wholesale takeaway closes the screen. */}
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

      {/* (6) Marketplace — one slot per channel (add/remove); each channel's grossed-up anúncio +
          líquido for varejo e atacado are read together below in "Preços por canal" (US1). */}
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
        refreshFailed={catalogRefreshFailed}
        refreshing={catalogRefreshing}
        onRetryCatalog={retryCatalog}
      />

      {/* 010/T010 (E5, PR-A US1) — "Salvar cenário": PREMIUM-ONLY inline, directly below "Preços
          por canal" (ux §2.1), beside the existing freemium caption. `SaveScenarioSheet` mirrors
          `RecordSnapshotButton` and returns null without an active entitlement — the free
          calculator stays byte-untouched (SC-109), the honest door is "Meus cenários" above. */}
      <div className="flex justify-center">
        <SaveScenarioSheet
          source={{
            disabled: !result || !input,
            buildConfig: () => buildScenarioConfig({ values, channelOutcomes, parsedInput: input }),
            basisLabel: messages.scenarios.basisKindAdhoc,
          }}
        />
      </div>

      {/* 009/T010 — record what you are quoting (US1). Below the results, beside the freemium note:
          the offer sits exactly where the value is. Owner decision Q15 (2026-07-13): the button is
          PREMIUM-ONLY and simply ABSENT otherwise — no teaser trigger here (`RecordSnapshotButton`
          returns null), so the free calculator stays literally untouched (SC-109 / SC-507 / SC-512).
          The honest door is the Histórico tab. */}
      {result && input && (
        <div className="flex justify-center">
          <RecordSnapshotButton
            source={{ kind: "SINGLE", freeze: () => freezePriceResult(input, result, null) }}
          />
        </div>
      )}

      <p style={{ ...captionText, textAlign: "center" }}>{t.freemiumNote}</p>
    </section>
  );
}
