import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import {
  readResolvedCostBasis,
  type ResolvedCostBasisMeta,
} from "@/entities/scenario/resolved-basis";
import { useFilaments, usePrinters } from "@/entities/catalog/use-catalog";
import {
  freezeBomResult,
  freezePriceResult,
  type FrozenProvenance,
} from "@/entities/history/frozen-payload";
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
import { type CatalogContext, computeFromForm } from "@/features/calculator/calculator-model";
import { filamentToCalcFields, printerToCalcFields } from "@/features/calculator/catalog-prefill";
import { KitBasisSummary } from "@/features/calculator/kit-basis-summary";
import {
  applyScenarioConfig,
  buildScenarioConfig,
  computeScenarioKitChannels,
} from "@/features/calculator/scenario-bridge";
import {
  CALC_FIELD_NAMES,
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
import { ScenarioContextBar } from "@/features/scenarios/scenario-context-bar";
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

/**
 * Defect A fix (coordinator, 2026-07-20, T030 e2e finding) — the "unsaved changes" signature,
 * EXACTLY the subset `applyScenarioConfig` patches: the 17 scalar `CalcFieldName`s (were MISSING
 * entirely — a scalar edit never flipped `dirty`) + `includeMarketplace` + `channels` (incl.
 * `feeOverrides`) + `otherCosts`. Computed FRESH on every call from the CURRENT values, never
 * memoized against a `values.channels`/`values.otherCosts` array reference — RHF's `watch()` does
 * not guarantee a new array reference on a nested array-ITEM edit (a `channels.0.commissionPct`
 * change can mutate in place), so a `useMemo([values.channels])` silently never recomputed (the
 * confirmed e2e repro: an override edit moved the price 34,33→61,80 on screen while `dirty` stayed
 * false). `JSON.stringify` over ~20 short fields is cheap enough to run on every render.
 */
function computeFormSignature(values: CalcFormValues): string {
  const scalars: Partial<Record<CalcFieldName, string>> = {};
  for (const name of CALC_FIELD_NAMES) scalars[name] = values[name];
  return JSON.stringify({
    scalars,
    includeMarketplace: values.includeMarketplace,
    channels: values.channels,
    otherCosts: values.otherCosts,
  });
}

export function CalcularPage() {
  const { control, watch, getValues, setValue } = useForm<CalcFormValues>({
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

  // 010/T014+T023+T029 (E5, PR-A US2 + PR-B US3/US6) — reopening a scenario loads its config INTO
  // this same form (the reopened scenario IS the calculator, populated — ux §4). `costBasis` is the
  // SERVER-resolved D3/D6 decision (`readResolvedBasis` off the fresh list-item config) — the same
  // recompute path already re-resolves non-overridden fee slots live (VR-604, T014's suite). `note`
  // rides along so "Salvar alterações" (PUT) never erases it. `KIT` basis has no scalar form to
  // hydrate (T024 owns its own read-only rollup below); `dirty` compares against a signature taken
  // right after load/save, so an edit AFTER that point — never a re-render — flips the badge.
  const [loadedScenario, setLoadedScenario] = useState<{
    id: string;
    name: string;
    note: string | null;
    costBasis: ResolvedCostBasisMeta | null;
    config: ScenarioConfig;
  } | null>(null);
  const [cleanSignature, setCleanSignature] = useState<string | null>(null);
  const [scenariosOpen, setScenariosOpen] = useState(false);

  const openScenario = (
    config: ScenarioConfig,
    meta: { id: string; name: string; note: string | null },
  ) => {
    const patch = applyScenarioConfig(config);
    for (const [field, value] of Object.entries(patch.scalars)) {
      setValue(field as CalcFieldName, value, { shouldValidate: true });
    }
    setValue("includeMarketplace", patch.includeMarketplace, { shouldValidate: true });
    replaceChannels(patch.channels);
    replaceOtherCosts(patch.otherCosts);
    setLoadedScenario({ ...meta, costBasis: readResolvedCostBasis(config), config });
    // `getValues()` reads RHF's internal store SYNCHRONOUSLY — the `setValue`/`replace*` calls
    // above already committed to it (React's render batching is irrelevant here), so this baseline
    // is the exact same `computeFormSignature` shape the live comparison below uses. A KIT basis
    // never sets a scalar patch (T024 owns its own read-only surface), so its scalars simply carry
    // over whatever the form already held — self-consistent, never a false "dirty".
    setCleanSignature(computeFormSignature(getValues()));
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
      setValue(field as "costPerRoll" | "rollWeightKg" | "wasteGrams", value, {
        shouldValidate: true,
      });
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
        { shouldValidate: true },
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

  const catalogCtx = { catalog, source, now: Date.now() };
  const values = watch();
  const {
    result,
    input,
    channels: channelOutcomes,
    otherCostErrors,
  } = computeFromForm(values, catalogCtx);

  // 010/T023/T029 — the loaded scenario's "unsaved changes" signal: `computeFormSignature` taken
  // right after load/save is the baseline; any later edit changes the LIVE signature and flips the
  // badge + enables "Salvar alterações" (Defect A fix: recomputed FRESH every render from `values`
  // — `watch()` already re-renders on any field change including a nested array-ITEM edit, so this
  // needs no memoization; a `useMemo([values.channels])` was the bug, not a micro-opt worth keeping).
  const formSignature = computeFormSignature(values);
  const dirty =
    loadedScenario !== null && cleanSignature !== null && cleanSignature !== formSignature;

  // 010/T036 (E5, PR-C, US7) — the E4 bridge's provenance: informational ONLY (id + the name AS
  // LOADED), never a value source, never re-read at freeze time (the record button's `freeze()`
  // closure captures this same reference). `null` when nothing is loaded — an ad-hoc calculation
  // outside a scenario keeps recording with no provenance at all, exactly as before US7.
  const scenarioProvenance: FrozenProvenance | null = loadedScenario
    ? { kind: "SCENARIO", id: loadedScenario.id, name: loadedScenario.name }
    : null;

  // Switching a slot's marketplace resets its modality to that market's default (or none), so a
  // stale ML "Clássico" never lingers on a Shopee slot.
  const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) => {
    const first = (MODALITY_OPTIONS[marketplace][0]?.value ?? "") as Modality;
    setValue(`channels.${index}.modality`, first, { shouldValidate: true });
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
          subtitle states the LIVE promise instead. T023 adds the D3/D6 honest caption + "Abrir
          origem"; T029 adds Renomear/Duplicar/"Salvar alterações"/the unsaved-changes badge. */}
      {loadedScenario && (
        <ScenarioContextBar
          scenario={loadedScenario}
          costBasis={loadedScenario.costBasis}
          dirty={dirty}
          lapsed={entitlement.data?.status === "lapsed"}
          buildCurrentConfig={() => {
            const built = buildScenarioConfig({ values, channelOutcomes, parsedInput: input });
            if (!built) return null;
            const storedBasis = loadedScenario.config.costBasis;
            // A PRODUCT/KIT basis keeps its REFERENCE — Calcular has no scalar form for a KIT line
            // (T024 owns the kit rollup, read-only here) and the server re-snapshots a PRODUCT's
            // `lastKnown` from the live row on every save anyway (T011) — never overwritten with a
            // client-derived guess. AD_HOC uses the freshly built ad-hoc basis (the edited inputs).
            return storedBasis.kind === "AD_HOC" ? built : { ...built, costBasis: storedBasis };
          }}
          onClose={() => setLoadedScenario(null)}
          onRenamed={(name) => setLoadedScenario((s) => (s ? { ...s, name } : s))}
          onSavedChanges={() => setCleanSignature(formSignature)}
          onDuplicated={(config, meta) => openScenario(config, meta)}
        />
      )}

      {/* 010/T024 (Q12) — a KIT-basis scenario has no scalar form to hydrate (multi-piece); its
          OWN read-only per-marketplace rollup renders here instead of populating the fields below
          (which stay whatever they were before the reopen — the seller edits a kit's LINES via
          "Abrir origem", never here). */}
      {loadedScenario && loadedScenario.config.costBasis.kind === "KIT" && (
        <KitBasisSummary
          config={loadedScenario.config}
          refName={loadedScenario.costBasis?.ref?.name ?? loadedScenario.name}
          ctx={catalogCtx}
        />
      )}

      {/* 010/T036 (E5, PR-C, US7) — the E4 bridge for a KIT-basis scenario: the displayed
          computation here is `KitBasisSummary`'s OWN rollup, NOT the (stale, untouched) single-piece
          calculator fields below — so this freezes `computeScenarioKitChannels`'s own `frozenLines`/
          `bom` directly (the SAME rollup the seller is looking at), never the scalar form. The
          ordinary SINGLE record button (below) is suppressed while a KIT scenario is loaded, so there
          is never a second, wrong "Salvar no histórico" offering to freeze the untouched fields. */}
      {loadedScenario && loadedScenario.config.costBasis.kind === "KIT" && (
        <KitScenarioRecordButton loadedScenario={loadedScenario} ctx={catalogCtx} />
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
          The honest door is the Histórico tab.
          010/T036 (E5, PR-C, US7) — suppressed while a KIT-basis scenario is loaded: these calculator
          fields are NOT what is on screen then (`KitBasisSummary`'s own rollup is), so freezing them
          would record numbers the seller never saw; its own record button lives with the rollup
          above. An AD_HOC/PRODUCT-basis scenario reuses this SAME button — its provenance is simply
          `scenarioProvenance` instead of `null` ("originou-se do cenário X"). */}
      {result && input && loadedScenario?.config.costBasis.kind !== "KIT" && (
        <div className="flex justify-center">
          <RecordSnapshotButton
            source={{
              kind: "SINGLE",
              freeze: () => freezePriceResult(input, result, scenarioProvenance),
            }}
          />
        </div>
      )}

      <p style={{ ...captionText, textAlign: "center" }}>{t.freemiumNote}</p>
    </section>
  );
}

/**
 * 010/T036 (E5, PR-C, US7) — the KIT-basis twin of the SINGLE record button above, freezing
 * `computeScenarioKitChannels`'s OWN rollup (the exact numbers `KitBasisSummary` renders) via
 * `freezeBomResult` — the SAME E4 freeze function `bom-page.tsx`'s kit composer already uses (US1,
 * no new snapshot machinery). Renders nothing when the rollup has no priceable line yet (mirrors the
 * kit composer's own `disabled={frozenKitLines.length === 0}`, but as an absence rather than a dead
 * disabled state, since `RecordSnapshotButton` itself decides visibility on entitlement).
 */
function KitScenarioRecordButton({
  loadedScenario,
  ctx,
}: {
  loadedScenario: { id: string; name: string; config: ScenarioConfig };
  ctx: CatalogContext;
}) {
  const rollup = computeScenarioKitChannels(loadedScenario.config, ctx);
  if (!rollup?.bom) return null;
  const bom = rollup.bom;

  const provenance: FrozenProvenance = {
    kind: "SCENARIO",
    id: loadedScenario.id,
    name: loadedScenario.name,
  };

  return (
    <div className="flex justify-center">
      <RecordSnapshotButton
        source={{
          kind: "KIT",
          // catalogVersion mirrors the kit composer's own rule (I2/Option A): every line shares the
          // same catalog, so the first non-null line version is the kit's; `null` when every line
          // priced with manual fees only.
          freeze: () =>
            freezeBomResult(
              rollup.frozenLines,
              bom,
              provenance,
              rollup.frozenLines.find((l) => l.input.catalogVersion != null)?.input
                .catalogVersion ?? null,
            ),
        }}
      />
    </div>
  );
}
