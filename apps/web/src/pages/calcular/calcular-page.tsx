import { useRef, useState } from "react";
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
    CostsSection,
    FieldGroup,
    gridCard,
    MarketplaceSection,
    OtherCostsSection,
    PriceResults,
    sectionLabel,
} from "@/features/calculator/calculator-form";
import { type CatalogContext, computeFromForm } from "@/features/calculator/calculator-model";
import { filamentToCalcFields, printerToCalcFields } from "@/features/calculator/catalog-prefill";
import { feeFieldsToBlankOnMarketplaceChange } from "@/features/calculator/channel-field-plan";
import { KitBasisSummary } from "@/features/calculator/kit-basis-summary";
import {
    applyScenarioConfig,
    buildScenarioConfig,
    computeScenarioKitChannels,
    discardedFieldNotice,
} from "@/features/calculator/scenario-bridge";
import {
    CALC_FIELD_NAMES,
    type CalcFieldName,
    type CalcFormValues,
    calculatorResolver,
    COST_FIELDS,
    defaultCalcValues,
    defaultOtherCost,
    LABOR_AND_FINISH_FIELDS,
    type ChannelFieldName,
    type MarketplaceId,
    MARKUP_FIELDS,
    slotResetOnMarketplaceChange,
} from "@/features/calculator/calculator-schema";
import { SaveScenarioSheet } from "@/features/scenarios/save-scenario-sheet";
import { ScenarioContextBar } from "@/features/scenarios/scenario-context-bar";
import {
    ScenariosList,
    ScenariosListSheet,
    scenarioOpenArgs,
} from "@/features/scenarios/scenarios-list-sheet";
import { premiumGate } from "@/shared/billing/premium-gate";
import { PremiumTeaser } from "@/shared/billing/premium-teaser";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { spineForMarketplace } from "@/features/calculator/fee-prefill";
import { useAvisoDeSaida } from "@/features/calculator/aviso-de-saida";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useIsWide } from "@/shared/lib/use-is-wide";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Button, Card, Field, Icon, Select } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import "@/features/scenarios/scenarios-wide.css";

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
    const {
        control,
        watch,
        getValues,
        setValue,
        formState: { isDirty },
    } = useForm<CalcFormValues>({
        defaultValues: defaultCalcValues,
        resolver: calculatorResolver,
        mode: "onChange",
    });
    // Homologação automatizada (CF-001-LEIGO-E) — recarregar apagava o que o vendedor digitou sem
    // dizer nada, e recarregar é o reflexo de quem acha que a tela travou. `isDirty` é o gatilho
    // certo: quem não mexeu em nada não tem o que perder e não vê diálogo nenhum.
    useAvisoDeSaida(isDirty);
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
        /** 016/T036 (US10, FR-913) — the retired-field declaration for a SCALAR reopen (AD_HOC/PRODUCT).
         *  `null` on a document with nothing retired (the common case) or on a KIT basis (its own
         *  declaration is derived at render time from `computeScenarioKitChannels`, below). */
        discardedNotice: string | null;
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
        setLoadedScenario({
            ...meta,
            costBasis: readResolvedCostBasis(config),
            config,
            discardedNotice: discardedFieldNotice(patch.discarded),
        });
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
    const filamentsList = useFilaments();
    const printersList = usePrinters();
    const { items: filaments } = filamentsList;
    const { items: printers } = printersList;
    const [pickedFilamentId, setPickedFilamentId] = useState("");
    const [pickedPrinterId, setPickedPrinterId] = useState("");
    const applyFilament = (id: string) => {
        setPickedFilamentId(id);
        const picked = filaments.find((f) => f.id === id);
        if (!picked) return;
        for (const [field, value] of Object.entries(filamentToCalcFields(picked))) {
            setValue(field as "costPerRoll" | "rollWeightKg", value, {
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
                    | "machineValue"
                    | "machineLifetimeHours"
                    | "avgPowerKw"
                    | "maintenanceReservePerHour",
                value,
                { shouldValidate: true },
            );
        }
    };
    const showFilamentPicker = sessionStatus === "authenticated" && filaments.length > 0;
    const showPrinterPicker = sessionStatus === "authenticated" && printers.length > 0;
    // 016/T072-A8 — a genuine READ FAILURE with no cache (never "you have none yet", which is
    // silent on purpose): `isError` already excludes the entitlement gate (a free/lapsed account's
    // 403 is not a failure to explain here — that account never had catalog access to lose). Only
    // fires when there is nothing to show at all — a `stale`-but-served list already renders its
    // own honest "may be outdated" state inside the picker's own card (US5/T024).
    const catalogPickerLoadError =
        sessionStatus === "authenticated" &&
        ((filamentsList.isError && filamentsList.error?.code !== "ENTITLEMENT_REQUIRED") ||
            (printersList.isError && printersList.error?.code !== "ENTITLEMENT_REQUIRED"));

    // 016/US1 (T005/T007): free/signed-out users meet the unified premium teaser — the affordance
    // itself renders DISABLED and VISIBLE (US1-AC3, the one named exception), never hidden and
    // never a fake save. Rendered only on a POSITIVELY known non-premium state; the manual
    // calculator is untouched either way (SC-310).
    const entitlement = useEntitlement();
    const signedOut = sessionStatus !== "authenticated";
    const showTeaserSlot = signedOut || entitlement.data?.status === "none";

    // 016/US11 (T048, FR-915) — the free calculator's marketplace switch. `active` ONLY — a
    // checking/error read (`entitlement.data` undefined, or `stale`) degrades to "not entitled", the
    // same honest guard every other premium surface already uses (`use-entitlement.ts`'s own
    // docstring: never assume premium). Server remains the authority (ADR-0012); this only decides
    // what the UI OFFERS.
    const marketplaceEntitled = entitlement.data?.status === "active";

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
        // 014/T097 — modality AND category: the category belongs to the OLD marketplace's taxonomy.
        const next = slotResetOnMarketplaceChange(marketplace);
        setValue(`channels.${index}.modality`, next.modality, { shouldValidate: true });
        setValue(`channels.${index}.category`, next.category, { shouldValidate: true });
        // 016/PR-F (US17, FR-926) — sellerProfile/volumoso são PER MARKETPLACE, mesma razão da categoria.
        setValue(`channels.${index}.sellerType`, next.sellerType, { shouldValidate: true });
        setValue(`channels.${index}.highVolume`, next.highVolume, { shouldValidate: true });
        setValue(`channels.${index}.surcharges`, next.surcharges, { shouldValidate: true });
        // 016/US11 (T044 homologação PR-E, bloqueador RA5) — blank exactly the fee fields the NEW
        // marketplace's plan does not show; a field the new plan still shows keeps its value. Closes
        // the render/value pair: a hidden field can no longer keep charging (measured: R$50 "Frete" on
        // ML → Amazon left freightCost invisible but still discounting the líquido by −R$50).
        for (const [field, value] of Object.entries(
            feeFieldsToBlankOnMarketplaceChange(catalog, marketplace),
        )) {
            setValue(`channels.${index}.${field as ChannelFieldName}` as const, value, {
                shouldValidate: true,
            });
        }
    };

    // 019/PR-F (T095, DECISÃO 2 — ADR-0031 §Emenda 2) — o único gate: acima do corte, "Minhas
    // simulações" monta ao lado da calculadora (a coluna larga de `/calcular`, prancheta 20g); abaixo,
    // a gaveta de sempre. `gate`/`lapsed` são a MESMA leitura que `ScenariosListSheet` já fazia por
    // conta própria — computados aqui só para o hospedeiro largo, que monta `ScenariosList` direto.
    const isWide = useIsWide();
    const scenariosGate = premiumGate(entitlement.data, { status: sessionStatus });
    const scenariosLapsed = entitlement.data?.status === "lapsed";

    // A referência da coluna PRINCIPAL (não a lista) — o "Fazer um cálculo" do vazio didático e o
    // "Limpar busca" sem resultado, dentro de `ScenariosList`, chamam `onClose` esperando fechar uma
    // gaveta; na coluna larga não existe gaveta para fechar, então o mesmo callback rola de volta ao
    // topo da calculadora (o mesmo destino que "Fazer um cálculo" já significa: já se está em
    // `/calcular`).
    const wideMainRef = useRef<HTMLDivElement | null>(null);
    // A referência da lista — o botão "Minhas simulações" do cabeçalho, na coluna larga, não abre
    // nada: rola/foca a lista que já está sempre visível ao lado (decisão do dono, prancheta 20g:
    // "a lista está sempre visível ao lado").
    const wideAsideRef = useRef<HTMLElement | null>(null);
    const handleScenariosNavClick = () => {
        if (isWide) {
            wideAsideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            wideAsideRef.current?.focus();
        } else {
            setScenariosOpen(true);
        }
    };

    const pageInner = (
        <>
            <PageHeader title={t.title} className="tf-page-header--center" />

            {/* 015/A8 ([F11a-003], decisão do dono 2026-08-03) — a promessa SOBE para a primeira dobra.
          Medido na homologação: a frase vivia como último elemento da página, a 3.413px de 3.529 —
          **97% da altura**, 4,6 telas de rolagem a 360px. A primeira dobra continha exatamente uma
          afirmação de valor, e era a oposta: "Salvar faz parte do Premium." Quem abria e desistia
          antes de rolar levava a mensagem contrária à que o produto quer dar.
          A menção a Premium NÃO foi removida — ela é a outra metade da verdade, e a frase abaixo diz
          as duas coisas na mesma linha. O que mudou foi só QUANDO ela é lida. */}
            <p style={{ ...captionText, textAlign: "center" }}>{t.freemiumNote}</p>

            {/* 010/T013 (E5) — "Meus cenários" is a NAV-LIKE entry, not a save button: it sits with the
          page title (never inside the results block) and is VISIBLE for everyone, incl. free/
          signed-out (the SC-109-safe honest door, ux §0.1/§2.2/§11-F1/F2). */}
            <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleScenariosNavClick}>
                    <Icon name="boxes" size={16} aria-hidden /> {messages.scenarios.navEntry}
                </Button>
            </div>
            {/* 019/PR-F (T095) — a gaveta SÓ monta estreito: a coluna larga já tem `ScenariosList` sempre
          visível ao lado (abaixo), e montar as duas seria a duplicata que a T092 provou impossível
          no hospedeiro de teste — aqui é o hospedeiro real. */}
            {!isWide && (
                <ScenariosListSheet
                    open={scenariosOpen}
                    onOpenChange={setScenariosOpen}
                    onOpenScenario={openScenario}
                />
            )}

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
                        const built = buildScenarioConfig({
                            values,
                            channelOutcomes,
                            parsedInput: input,
                        });
                        if (!built) return null;
                        const storedBasis = loadedScenario.config.costBasis;
                        // A PRODUCT/KIT basis keeps its REFERENCE — Calcular has no scalar form for a KIT line
                        // (T024 owns the kit rollup, read-only here) and the server re-snapshots a PRODUCT's
                        // `lastKnown` from the live row on every save anyway (T011) — never overwritten with a
                        // client-derived guess. AD_HOC uses the freshly built ad-hoc basis (the edited inputs).
                        return storedBasis.kind === "AD_HOC"
                            ? built
                            : { ...built, costBasis: storedBasis };
                    }}
                    onClose={() => setLoadedScenario(null)}
                    onRenamed={(name) => setLoadedScenario((s) => (s ? { ...s, name } : s))}
                    onSavedChanges={() => setCleanSignature(formSignature)}
                    onDuplicated={(config, meta) => openScenario(config, meta)}
                />
            )}

            {/* 016/T036 (US10, FR-913) — a scalar (AD_HOC/PRODUCT) simulation saved before pricing-core
          4.0.0 still carries a retired leaf (today only `wasteGrams`). The recompute below already
          excludes it (the engine refuses the key); this PERSISTENT info notice — not a toast — says
          why, for as long as the simulation stays open (role=status via Alert tone="info"). */}
            {loadedScenario?.discardedNotice && (
                <Alert tone="info">{loadedScenario.discardedNotice}</Alert>
            )}

            {/* 010/T024 (Q12) — a KIT-basis scenario has no scalar form to hydrate (multi-piece); its
          OWN read-only per-marketplace rollup renders here instead of populating the fields below
          (which stay whatever they were before the reopen — the seller edits a kit's LINES via
          "Abrir origem", never here). */}
            {loadedScenario && loadedScenario.config.costBasis.kind === "KIT" && (
                <>
                    {/* 016/T036 — the KIT twin of the notice above: `computeScenarioKitChannels` already
              strips any retired leaf line-by-line (never `ok:false` for that reason alone) and
              rolls the discard up ONCE, deduped, across every line. */}
                    {(() => {
                        const notice = discardedFieldNotice(
                            computeScenarioKitChannels(loadedScenario.config, catalogCtx)
                                ?.discarded ?? [],
                        );
                        return notice ? <Alert tone="info">{notice}</Alert> : null;
                    })()}
                    <KitBasisSummary
                        config={loadedScenario.config}
                        refName={loadedScenario.costBasis?.ref?.name ?? loadedScenario.name}
                        ctx={catalogCtx}
                    />
                </>
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

            {/* 016/T010-A3 — com a folha de Simulações aberta, o teaser do picker ficava visível atrás
          do overlay com a SUA linha de preço e o SEU "Assinar": dois CTAs de compra na mesma tela,
          a classe que o E6/T038-D4 já consertou uma vez (a guarda antiga morreu junto com o
          componente deletado nesta fatia — esta é a reposição dela). */}
            {showTeaserSlot && !scenariosOpen && (
                <Card padding="md" className="flex flex-col gap-2">
                    <PremiumTeaser
                        feature="CATALOG_PICKER"
                        signedOut={signedOut}
                        disabledAffordance={
                            <Button variant="secondary" disabled>
                                {t.catalogPicker.title}
                            </Button>
                        }
                    />
                </Card>
            )}

            {/* 016/T072-A8 — the picker card simply VANISHED on a real read failure with no cache (empty
          `items`, indistinguishable from "you have none yet"). This is the honest replacement:
          shown only when there IS a failure to explain, never for a genuinely empty catalog. */}
            {!showFilamentPicker && !showPrinterPicker && catalogPickerLoadError && (
                <Card padding="md" className="flex flex-col gap-3">
                    <Alert tone="danger" title={t.catalogPicker.loadError}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                                filamentsList.refetch();
                                printersList.refetch();
                            }}
                        >
                            {t.catalogPicker.retry}
                        </Button>
                    </Alert>
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
                                            ...filaments.map((f) => ({
                                                value: f.id,
                                                label: f.name,
                                            })),
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
                                            ...printers.map((pr) => ({
                                                value: pr.id,
                                                label: pr.name,
                                            })),
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

            {/* 016/PR-B (US4/T015) — the input sections split into two columns from the desktop
          breakpoint up (single column, today's order, at 360/390): costs on the left, markup +
          marketplace channel editing on the right. The total/"Como chegamos no preço" — now
          fused with "Preços por canal" (US5) — stays a single footer spanning both, always LAST
          (T015 — "o total centralizado ao final"), so it reads after every input that feeds it,
          channels included. */}
            {/* 016/US11 (T044 homologação PR-E, R3) — a coluna direita não fica mais confinada ao
          tamanho do GATE quando a conta é grátis. Medido: 850px de coluna direita (o gate, 205px
          de altura, mais o markup) contra 2.521px de coluna esquerda a 1440px — 1.671px de buraco,
          o gate substituiu um bloco de coluna inteira sem redistribuir nada. `otherCosts` migra
          para a direita (ao lado de markup) quando não-entitulado, e o gate ocupa a largura TOTAL
          da grade (span 2) na posição da seção — nunca confinado a uma coluna curta. O caminho
          PREMIUM é byte-idêntico ao de antes (mesmo JSX, mesma ordem, `tf-calc-grid__full` nunca
          renderiza) — sem regressão nas guardas de geometria existentes. */}
            <div className="tf-calc-grid">
                <div className="tf-calc-grid__col">
                    {/* 016/PR-C (US6/US7/US8/US9) — "Custos da peça" now carries the fused
              MANDATORY+OPTIONAL fields, the h+min time input and the machine-cost question; the
              old separate "Ajustes opcionais" section is gone (US9-AC2). */}
                    <CostsSection control={control} fields={COST_FIELDS} />
                    <FieldGroup
                        control={control}
                        title={t.sections.labor}
                        info={t.sectionInfo.labor}
                        fields={LABOR_AND_FINISH_FIELDS}
                    />
                    {marketplaceEntitled && (
                        <OtherCostsSection
                            control={control}
                            fields={otherCostFields}
                            errors={otherCostErrors}
                            onAppend={() => appendOtherCost(defaultOtherCost())}
                            onRemove={removeOtherCost}
                        />
                    )}
                </div>
                <div className="tf-calc-grid__col">
                    <FieldGroup
                        control={control}
                        title={t.sections.markup}
                        info={t.sectionInfo.markup}
                        fields={MARKUP_FIELDS}
                    />
                    {!marketplaceEntitled && (
                        <OtherCostsSection
                            control={control}
                            fields={otherCostFields}
                            errors={otherCostErrors}
                            onAppend={() => appendOtherCost(defaultOtherCost())}
                            onRemove={removeOtherCost}
                        />
                    )}
                    {/* (6) Marketplace — one slot per channel (add/remove); each channel's grossed-up
              anúncio + líquido for varejo e atacado are read together in the footer's "Como
              chegamos no preço" (US1, fused per US5). PREMIUM keeps this nested here, exactly
              where it always was — the free GATE moves out below instead (R3). */}
                    {marketplaceEntitled && (
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
                            spineFor={(m) => spineForMarketplace(catalog, m)}
                            catalog={catalog}
                            entitled={marketplaceEntitled}
                            signedOut={signedOut}
                        />
                    )}
                </div>
                {!marketplaceEntitled && (
                    <div className="tf-calc-grid__full">
                        <MarketplaceSection
                            control={control}
                            values={values}
                            fields={fields}
                            channelOutcomes={[]}
                            included={values.includeMarketplace !== false}
                            onToggleInclude={(next) => setValue("includeMarketplace", next)}
                            onAppend={append}
                            onRemove={remove}
                            onMarketplaceChange={handleMarketplaceChange}
                            refreshFailed={catalogRefreshFailed}
                            refreshing={catalogRefreshing}
                            onRetryCatalog={retryCatalog}
                            spineFor={(m) => spineForMarketplace(catalog, m)}
                            catalog={catalog}
                            entitled={marketplaceEntitled}
                            signedOut={signedOut}
                        />
                    </div>
                )}
            </div>

            <div className="tf-calc-footer">
                {result ? (
                    <PriceResults
                        result={result}
                        values={values}
                        channelOutcomes={marketplaceEntitled ? channelOutcomes : []}
                    />
                ) : (
                    <Alert tone="danger">{t.invalidNote}</Alert>
                )}

                {/* 010/T010 (E5, PR-A US1) — "Salvar cenário": PREMIUM-ONLY inline, directly below "Preços
            por canal" (ux §2.1), beside the existing freemium caption. `SaveScenarioSheet` mirrors
            `RecordSnapshotButton` and returns null without an active entitlement — the free
            calculator stays byte-untouched (SC-109), the honest door is "Meus cenários" above. */}
                <div className="flex justify-center">
                    <SaveScenarioSheet
                        source={{
                            disabled: !result || !input,
                            buildConfig: () =>
                                buildScenarioConfig({
                                    values,
                                    channelOutcomes,
                                    parsedInput: input,
                                }),
                            basisLabel: messages.scenarios.basisKindAdhoc,
                        }}
                    />
                </div>

                {/* 009/T010 — record what you are quoting (US1). Below the results, beside the freemium
            note: the offer sits exactly where the value is. Owner decision Q15 (2026-07-13): the
            button is PREMIUM-ONLY and simply ABSENT otherwise — no teaser trigger here
            (`RecordSnapshotButton` returns null), so the free calculator stays literally untouched
            (SC-109 / SC-507 / SC-512). The honest door is the Histórico tab.
            010/T036 (E5, PR-C, US7) — suppressed while a KIT-basis scenario is loaded: these
            calculator fields are NOT what is on screen then (`KitBasisSummary`'s own rollup is),
            so freezing them would record numbers the seller never saw; its own record button
            lives with the rollup above. An AD_HOC/PRODUCT-basis scenario reuses this SAME button
            — its provenance is simply `scenarioProvenance` instead of `null` ("originou-se do
            cenário X"). */}
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
            </div>
        </>
    );

    // 019/PR-F (T095, DECISÃO 2) — ≥1280px o hospedeiro é a PRÓPRIA `.tf-calc-page`: o corpo de
    // sempre (`pageInner`, byte-idêntico ao ramo estreito abaixo) vira a coluna principal, e
    // "Minhas simulações" (`ScenariosList`, extraída na T092) monta ao lado, sempre visível
    // (prancheta 20g). `.tf-calc-page` continua sendo o ÚNICO filho de `.tf-shell__main`
    // (`widthRatio()` em `pages-desktop-width.spec.ts`/T093 lê `.tf-shell__main > section` — um
    // wrapper por fora quebraria essa leitura), então o `tf-scenarios-wide` mora DENTRO da section.
    if (isWide) {
        return (
            <section className="tf-calc-page" data-testid="calc-content">
                <div className="tf-scenarios-wide">
                    <div className="tf-scenarios-wide__main" ref={wideMainRef}>
                        {pageInner}
                    </div>
                    <aside
                        ref={wideAsideRef}
                        tabIndex={-1}
                        className="tf-card tf-scenarios-wide__aside"
                        aria-label={messages.scenarios.listTitle}
                        data-testid="scenarios-wide-aside"
                    >
                        <p style={sectionLabel}>{messages.scenarios.listTitle}</p>
                        <p style={captionText}>{messages.scenarios.listSubtitle}</p>
                        <ScenariosList
                            gate={scenariosGate}
                            lapsed={scenariosLapsed}
                            teaser={false}
                            onClose={() =>
                                wideMainRef.current?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                })
                            }
                            onOpenScenario={(item) => {
                                const { config, meta } = scenarioOpenArgs(item);
                                openScenario(config, meta);
                            }}
                        />
                    </aside>
                </div>
            </section>
        );
    }

    return (
        <section className="tf-calc-page" data-testid="calc-content">
            {pageInner}
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
