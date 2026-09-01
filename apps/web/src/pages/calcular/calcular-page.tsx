import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { type ScenarioConfig } from "@/entities/scenario/config-document";
import {
    readResolvedCostBasis,
    type ResolvedCostBasisMeta,
} from "@/entities/scenario/resolved-basis";
import { useFilaments, usePrinters } from "@/entities/catalog/use-catalog";
import { type FrozenProvenance } from "@/entities/history/frozen-payload";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { captionText, sectionLabel } from "@/features/calculator/calculator-form";
import { computeFromForm } from "@/features/calculator/calculator-model";
import { computeFormSignature } from "@/features/calculator/form-signature";
import { KitBasisSummary } from "@/features/calculator/kit-basis-summary";
import { applyMarketplaceChange } from "@/features/calculator/marketplace-change";
import {
    applyScenarioConfig,
    buildScenarioConfig,
    discardedFieldNotice,
} from "@/features/calculator/scenario-bridge";
import {
    type CalcFieldName,
    type CalcFormValues,
    calculatorResolver,
    defaultCalcValues,
    defaultOtherCost,
    type MarketplaceId,
} from "@/features/calculator/calculator-schema";
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
import { Alert, Button, Card, Icon } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import { CalculatorFooter, CalculatorGrid } from "./calcular-page-body";
import { CatalogPickerCard } from "./catalog-picker-card";
import { KitDiscardedNotice, KitScenarioRecordButton } from "./calcular-page-kit-blocks";

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
    // stale ML "Clássico" never lingers on a Shopee slot; also blanks exactly the fee fields the
    // NEW marketplace's plan does not show (016/US11, T044 homologação PR-E, RA5 — measured: R$50
    // "Frete" on ML → Amazon left freightCost invisible but still discounting the líquido by −R$50).
    // 019/Polish — shared with produto-page.tsx and bom-line-editor.tsx (`marketplace-change.ts`);
    // this is the ONE call site that passes `shouldValidate: true` (B2, registered divergence).
    const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) =>
        applyMarketplaceChange(setValue, catalog, index, marketplace);

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

    // 019/Polish — `<MarketplaceSection>` rendered twice below with the same ~16 props (only the
    // wrapper + `channelOutcomes` differ between the premium and free-gate branches); one shared
    // props object, spread at each call site. DOM output unchanged.
    const marketplaceSectionProps = {
        control,
        values,
        fields,
        included: values.includeMarketplace !== false,
        onToggleInclude: (next: boolean) => setValue("includeMarketplace", next),
        onAppend: append,
        onRemove: remove,
        onMarketplaceChange: handleMarketplaceChange,
        refreshFailed: catalogRefreshFailed,
        refreshing: catalogRefreshing,
        onRetryCatalog: retryCatalog,
        spineFor: (m: MarketplaceId) => spineForMarketplace(catalog, m),
        catalog,
        entitled: marketplaceEntitled,
        signedOut,
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
                    <KitDiscardedNotice config={loadedScenario.config} ctx={catalogCtx} />
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

            <CatalogPickerCard
                sessionStatus={sessionStatus}
                filamentsList={filamentsList}
                printersList={printersList}
                setValue={setValue}
            />

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
            <CalculatorGrid
                control={control}
                marketplaceEntitled={marketplaceEntitled}
                otherCostFields={otherCostFields}
                otherCostErrors={otherCostErrors}
                onAppendOtherCost={() => appendOtherCost(defaultOtherCost())}
                onRemoveOtherCost={removeOtherCost}
                marketplaceSectionProps={marketplaceSectionProps}
                channelOutcomes={channelOutcomes}
            />

            <CalculatorFooter
                result={result}
                values={values}
                channelOutcomes={channelOutcomes}
                marketplaceEntitled={marketplaceEntitled}
                input={input}
                loadedScenario={loadedScenario}
                scenarioProvenance={scenarioProvenance}
            />
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
