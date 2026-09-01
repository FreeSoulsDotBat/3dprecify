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

// @doc DEC-089 — RHF + Zod donos da entrada; preço e detalhamento de UMA passada síncrona do
//   `computeFromForm`. Sem persistência e sem paywall nesta tela.

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
    // @doc DEC-025 — avisa antes de sair; `isDirty` é o gatilho: quem não mexeu nada não vê nada.
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

    // ⚠ @doc DEC-115 — o cenário reaberto É a calculadora populada, e o "alterado" compara
    //   ASSINATURA tirada logo após carregar/salvar — nunca um re-render.
    const [loadedScenario, setLoadedScenario] = useState<{
        id: string;
        name: string;
        note: string | null;
        costBasis: ResolvedCostBasisMeta | null;
        config: ScenarioConfig;
        /** @doc DEC-115 — declaração de campo aposentado num reabrir ESCALAR; `null` no caso comum
         *  e numa base KIT (a dela é derivada no render). */
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
        // ⚠ @doc DEC-115 — `getValues()` lê a store do RHF SINCRONAMENTE: os `setValue` acima já
        //   commitaram, então esta baseline tem a forma exata da comparação viva.
        setCleanSignature(computeFormSignature(getValues()));
    };

    // ⚠ @doc DEC-116 — só para conta autenticada COM itens (o fluxo manual grátis fica intocado),
    //   e escolher PRÉ-PREENCHE: os campos seguem editáveis, nunca travados.
    const sessionStatus = useSessionStore((s) => s.status);
    const filamentsList = useFilaments();
    const printersList = usePrinters();

    // @doc DEC-116 — o affordance renderiza DESABILITADO e VISÍVEL, nunca escondido e nunca um
    //   salvamento falso; só sobre um estado POSITIVAMENTE conhecido como não-premium.
    const entitlement = useEntitlement();
    const signedOut = sessionStatus !== "authenticated";
    const showTeaserSlot = signedOut || entitlement.data?.status === "none";

    // ⚠ @doc DEC-117 — `active` ONLY: checando ou em erro degrada para NÃO habilitado. Nunca
    //   presuma premium; o servidor segue sendo a autoridade e isto só decide o que a UI OFERECE.
    const marketplaceEntitled = entitlement.data?.status === "active";

    // @doc DEC-117 — o catálogo NUNCA bloqueia: semente e store respondem offline, e uma
    //   atualização que falhou vira retentativa não-bloqueante, nunca um muro de erro.
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

    // ⚠ @doc DEC-115 — a assinatura é recomputada FRESCA a cada render: um `useMemo` sobre
    //   `values.channels` era o BUG, não uma micro-otimização que valesse manter.
    const formSignature = computeFormSignature(values);
    const dirty =
        loadedScenario !== null && cleanSignature !== null && cleanSignature !== formSignature;

    // @doc DEC-119 — procedência INFORMATIVA apenas, nunca fonte de valor e nunca relida no
    //   congelamento. `null` fora de um cenário: grava sem procedência, como antes.
    const scenarioProvenance: FrozenProvenance | null = loadedScenario
        ? { kind: "SCENARIO", id: loadedScenario.id, name: loadedScenario.name }
        : null;

    // @doc DEC-091 — trocar o marketplace zera a modalidade e apaga só os campos que sumiram da
    //   tela. Este é o ÚNICO sítio que passa `shouldValidate: true` (divergência registrada).
    const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) =>
        applyMarketplaceChange(setValue, catalog, index, marketplace);

    // @doc DEC-118 — o único gate: acima do corte a lista monta AO LADO; abaixo, a gaveta.
    const isWide = useIsWide();
    const scenariosGate = premiumGate(entitlement.data, { status: sessionStatus });
    const scenariosLapsed = entitlement.data?.status === "lapsed";

    // @doc DEC-118 — na coluna larga não existe gaveta para fechar: o `onClose` rola ao topo.
    const wideMainRef = useRef<HTMLDivElement | null>(null);
    // @doc DEC-118 — na coluna larga o botão não abre nada: rola e foca a lista sempre visível.
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
                        // ⚠ @doc DEC-119 — base PRODUCT/KIT mantém a REFERÊNCIA: o servidor
                        //   re-fotografa o `lastKnown` da linha viva, nunca um palpite do cliente.
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

    // ⚠ @doc DEC-118 — a `.tf-calc-page` continua o ÚNICO filho de `.tf-shell__main`: o teste de
    //   largura lê `.tf-shell__main > section`, e um wrapper por fora quebraria a medição.
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
