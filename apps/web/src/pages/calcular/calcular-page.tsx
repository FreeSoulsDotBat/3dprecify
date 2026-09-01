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

            {/* ⚠ @doc DEC-120 — a promessa vivia a 97% da altura da página, 4,6 telas de rolagem,
                e a primeira dobra dizia o OPOSTO. A menção a Premium não saiu, só mudou de hora. */}
            <p style={{ ...captionText, textAlign: "center" }}>{t.freemiumNote}</p>

            {/* @doc DEC-121 — entrada NAV-LIKE, visível para todos: a porta honesta. */}
            <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleScenariosNavClick}>
                    <Icon name="boxes" size={16} aria-hidden /> {messages.scenarios.navEntry}
                </Button>
            </div>
            {/* @doc DEC-121 — a gaveta só monta estreito; no largo a lista já está ao lado. */}
            {!isWide && (
                <ScenariosListSheet
                    open={scenariosOpen}
                    onOpenChange={setScenariosOpen}
                    onOpenScenario={openScenario}
                />
            )}

            {/* @doc DEC-121 — sem data em lugar nenhum: a simulação é viva, nunca datada. */}
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

            {/* ⚠ @doc DEC-122 — aviso PERSISTENTE e não toast: um toast some, e a pergunta "por que
                este número mudou?" não some junto. */}
            {loadedScenario?.discardedNotice && (
                <Alert tone="info">{loadedScenario.discardedNotice}</Alert>
            )}

            {/* ⚠ @doc DEC-123 — base KIT: rollup só-leitura aqui, e os campos abaixo ficam como
                estavam. O vendedor edita as LINHAS por "Abrir origem", nunca aqui. */}
            {loadedScenario && loadedScenario.config.costBasis.kind === "KIT" && (
                <>
                    {/* @doc DEC-122 — gêmeo do KIT: agrega o descarte UMA vez. */}
                    <KitDiscardedNotice config={loadedScenario.config} ctx={catalogCtx} />
                    <KitBasisSummary
                        config={loadedScenario.config}
                        refName={loadedScenario.costBasis?.ref?.name ?? loadedScenario.name}
                        ctx={catalogCtx}
                    />
                </>
            )}

            {/* ⚠ @doc DEC-123 — congela o rollup do PRÓPRIO KIT, que é o que está na tela; o botão
                de gravar ESCALAR é suprimido, para não haver uma segunda oferta errada. */}
            {loadedScenario && loadedScenario.config.costBasis.kind === "KIT" && (
                <KitScenarioRecordButton loadedScenario={loadedScenario} ctx={catalogCtx} />
            )}

            {/* ⚠ @doc DEC-124 — nunca dois CTAs de compra na mesma tela: o teaser do picker ficava
                visível ATRÁS do overlay, com o próprio "Assinar". */}
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

            {/* @doc DEC-125 — duas colunas do desktop para cima; o total num rodapé único, sempre
                por ÚLTIMO, para ser lido depois de toda entrada que o alimenta. */}
            {/* ⚠ @doc DEC-125 — o gate ocupa a grade INTEIRA: confinado a uma coluna ele deixava
                1.671px de buraco medidos a 1440px. O caminho premium é byte-idêntico. */}
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
