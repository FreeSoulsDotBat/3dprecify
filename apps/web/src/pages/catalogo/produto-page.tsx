import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import {
    observationKey,
    useObservePrices,
    usePriceObservations,
} from "@/entities/catalog/price-observations";
import {
    useCreateProduct,
    useFilaments,
    useFixProductPrice,
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
import {
    applyFilamentFields,
    applyPrinterFields,
} from "@/features/calculator/catalog-prefill-apply";
import {
    type CalcFormValues,
    calculatorResolver,
    COST_FIELDS,
    defaultCalcValues,
    defaultOtherCost,
    LABOR_AND_FINISH_FIELDS,
    type MarketplaceId,
    MARKUP_FIELDS,
} from "@/features/calculator/calculator-schema";
import { applyMarketplaceChange } from "@/features/calculator/marketplace-change";
import { formToProductIn, productToForm } from "@/features/calculator/product-mapping";
import { buildScenarioConfig } from "@/features/calculator/scenario-bridge";
import { PremiumFooterNote, PremiumInviteCta } from "@/features/catalog/catalog-controls";
import { productPriceOverFixed } from "@/features/catalog/product-price-state";
import { RecordSnapshotButton, type RecordSource } from "@/features/history/record-snapshot-sheet";
import { SaveScenarioSheet } from "@/features/scenarios/save-scenario-sheet";
import { honestWriteError } from "@/shared/api/error-messages";
import { type PremiumGate } from "@/shared/billing/premium-gate";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { spineForMarketplace } from "@/features/calculator/fee-prefill";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { formatDayMonthPtBr } from "@/shared/lib/format-date";
import { NAME_MAX, nameNormKey } from "@/shared/lib/name-norm";
import { Alert, Button, Card, Field, PriceHero, Select, Spinner, toast } from "@/shared/ui";
import { Frozen } from "@/shared/ui/frozen";
import { PageHeader } from "@/widgets/page-header/page-header";

// US6/T030 — the product create/edit FULL PAGE route (ux §1.6b): the calculator body + a name +
// the two catalog pickers, over the SAME RHF control and the SAME `computeFromForm` as Calcular.
// NO stored price exists anywhere: every number on this page is recomputed live at the current
// PRICING_MODEL_VERSION (FR-310/FR-313). Reopening a DEGRADED product (its reference was
// deleted) shows a calm info alert, the picker at "— Manual —", and the last-known values as
// ordinary editable inputs (US6-4) — never blank, never broken. Saving is honest: a real toast
// only after a real 2xx; a failure keeps the page open with a specific pt-BR line.
//
// 019/PR-B (T045, ux-catalog §3 + prancheta 32b/32e/32f) — reads/recompute keep working for EVERY
// gate (FR-409); only writes freeze. Fora de `active` os três `<fieldset>` viram `<Frozen>` (nunca
// só um `disabled` isolado), Salvar some do rodapé de sempre e vira "Salvar"/"Salvar alterações"
// SEMPRE renderizado (`type="button" disabled`), e o rodapé ganha a frase + o convite único —
// mesma regra do FilamentForm/PrinterForm (`PremiumFooterNote`/`PremiumInviteCta`, sem duplicar a
// lógica). `gate` chega pronto de CatalogoPage (o mesmo `premiumGate()` que os quatro painéis
// leem) em vez de um `readOnly` binário — 013/FB-02 só cobria `lapsed`; um `never-subscribed` que
// abrisse esta URL direto via `?produto=` via chegava com o formulário VIVO (bug fechado aqui).
// RecordSnapshotButton/SaveScenarioSheet já se auto-gateiam em `active`, sem mudança.

const t = messages.calculator;
const pf = messages.productForm;
const catalogo = messages.catalogo;
const cf = messages.catalogForm;

/** 019/PR-B (T045) — `active` num `<fieldset>` normal, fora dele um `<Frozen>` (mesma regra nos
 *  três blocos do formulário: identidade, custos, mercado). Extraído das três IIFEs anônimas que
 *  decidiam a mesma coisa no JSX — a árvore DOM de cada sítio fica idêntica. */
function EditableSection({ active, children }: { active: boolean; children: ReactNode }) {
    return active ? (
        <fieldset className="contents">{children}</fieldset>
    ) : (
        <Frozen className="contents" data-testid="catalog-form-frozen">
            {children}
        </Frozen>
    );
}

/** 019/PR-D (T076, prancheta 17g) — os quatro estados do cabeçalho: fixado > parado > mudou > sem
 *  mudança (a MESMA ordem do 16f/17c: fixado é escolha, parado é impedimento, os dois nunca se
 *  confundem). Extraída das três variáveis `headerLabel`/`headerValue`/`headerCaption` que repetiam
 *  a mesma árvore de decisão — os ternários aqui são os MESMOS, sem simplificação semântica. */
function productHeaderState({
    isFixed,
    needsAttention,
    fixedPriceValue,
    savedObservation,
    todayPrice,
    priceChanged,
    sellerFixedAt,
}: {
    isFixed: boolean;
    needsAttention: boolean;
    fixedPriceValue: number | undefined;
    savedObservation: { observedPrice: number; observedAt: string } | undefined;
    todayPrice: number | undefined;
    priceChanged: boolean;
    sellerFixedAt: string | null | undefined;
}): { label: string; value: number | undefined; caption: string | undefined } {
    const label = isFixed
        ? catalogo.fixedByYou
        : needsAttention
          ? catalogo.stoppedPrice
          : catalogo.suggestedRetail;
    const value = isFixed
        ? fixedPriceValue
        : needsAttention
          ? savedObservation?.observedPrice
          : todayPrice;
    const caption =
        isFixed && sellerFixedAt && todayPrice !== undefined
            ? catalogo.capFixed
                  .replace("{data}", formatDayMonthPtBr(sellerFixedAt))
                  .replace("{hoje}", formatBRL(todayPrice))
            : needsAttention && savedObservation
              ? catalogo.capStopped.replace(
                    "{data}",
                    formatDayMonthPtBr(savedObservation.observedAt),
                )
              : priceChanged && savedObservation
                ? catalogo.capRecalculated.replace(
                      "{valor}",
                      formatBRL(savedObservation.observedPrice),
                  )
                : !isFixed && !needsAttention && savedObservation
                  ? catalogo.capUnchanged.replace(
                        "{data}",
                        formatDayMonthPtBr(savedObservation.observedAt),
                    )
                  : undefined;
    return { label, value, caption };
}

export function ProdutoPage({
    productId,
    gate,
}: {
    productId?: string;
    /** Os cinco estados (`shared/billing/premium-gate`) — só `active` fica editável. */
    gate: PremiumGate;
}) {
    const active = gate === "active";
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
        applyFilamentFields(setValue, picked);
    };
    const applyPrinter = (id: string) => {
        setPrinterId(id);
        const picked = printers.find((p) => p.id === id);
        if (!picked) return;
        applyPrinterFields(setValue, picked);
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

    // 019/Polish — shared with calcular-page.tsx and bom-line-editor.tsx (`marketplace-change.ts`);
    // this site does NOT pass `shouldValidate` (B2, registered divergence — unchanged here).
    const handleMarketplaceChange = (index: number, marketplace: MarketplaceId) =>
        applyMarketplaceChange(setValue, catalog, index, marketplace);

    // An UNLINKED reference (US6-4 + K3): the product carries values with no live row behind them.
    // Two histories land here — a deletion severed the link, or a kit save materialized the product
    // with no links at all (ADR-0017) — and the data cannot tell them apart, deliberately: the state
    // and the remedy are identical. So the copy never claims a removal it cannot know happened.
    const manualFilament = Boolean(editing) && initial?.filamentId === "" && filamentId === "";
    const manualPrinter = Boolean(editing) && initial?.printerId === "" && printerId === "";

    // Derived from the LIVE picker state, so it clears the instant the seller links both — before
    // they even save (SC-412).
    const needsAttention = Boolean(editing) && (filamentId === "" || printerId === "");

    // 019/PR-D (T076, prancheta 17g) — os quatro estados do cabeçalho: fixado > parado > mudou >
    // sem mudança (a MESMA ordem do 16f/17c: fixado é escolha, parado é impedimento, os dois nunca
    // se confundem). `editing` é o produto salvo — um produto NOVO não tem observação nem fixação.
    const { byKey: observationsByKey } = usePriceObservations();
    const savedObservation = editing
        ? observationsByKey.get(observationKey("PRODUCT", editing.id))
        : undefined;
    const isFixed = editing?.sellerFixedPrice != null;
    const fixedPriceValue = isFixed ? Number(editing!.sellerFixedPrice) : undefined;
    const todayPrice = result?.precoVarejo;
    const priceChanged =
        !isFixed &&
        !needsAttention &&
        savedObservation !== undefined &&
        todayPrice !== undefined &&
        Math.round(savedObservation.observedPrice * 100) !== Math.round(todayPrice * 100);

    const {
        label: headerLabel,
        value: headerValue,
        caption: headerCaption,
    } = productHeaderState({
        isFixed,
        needsAttention,
        fixedPriceValue,
        savedObservation,
        todayPrice,
        priceChanged,
        sellerFixedAt: editing?.sellerFixedAt,
    });

    // 17c — custo hoje > fixado: o aviso de ATENÇÃO (spec US5 AC3 vence a 17c, que desenha info) +
    // "Voltar a acompanhar o custo". A escrita (fixar/desfixar) só existe quando `active` — a
    // barreira de sempre é a AUSÊNCIA do handler, nunca um 2º gate.
    const overFixed = editing !== undefined && productPriceOverFixed(editing, todayPrice);
    const fixPrice = useFixProductPrice();
    const { observe: observeThis } = useObservePrices();
    const handleUnfix = () => {
        if (!editing) return;
        fixPrice.mutate({ id: editing.id, sellerFixedPrice: null });
    };
    // 16b·2 — "Manter {valor}" fixa no preço ANTERIOR (a observação salva); "Aceitar novo preço"
    // atualiza a observação para o preço de hoje, sem fixar nada (a conta segue livre).
    const handleKeepPrice = () => {
        if (!editing || !savedObservation) return;
        fixPrice.mutate({
            id: editing.id,
            sellerFixedPrice: savedObservation.observedPrice.toFixed(2),
        });
    };
    const handleAcceptNewPrice = () => {
        if (!editing || todayPrice === undefined) return;
        observeThis([{ subjectKind: "PRODUCT", subjectId: editing.id, precoVarejo: todayPrice }]);
    };

    const handleSave = async () => {
        setSubmitError(undefined);
        const trimmedName = name.trim();
        const blankName = trimmedName === "";
        // 019/PR-D (T068/T076, achado do coordenador) — o mesmo intercepto do 17b/17d, agora no
        // formulário do produto: nome repetido recusa ANTES do submit (nunca um POST/PUT que o
        // servidor resolveria em silêncio com um sufixo — a recusa aqui é intencional, não a mesma
        // regra do servidor). A lista carregada É a referência de unicidade; o próprio id sai da
        // comparação (editar um produto sem mudar o nome não pode se recusar sozinho).
        const nameConflict =
            !blankName &&
            products.items.some(
                (p) => p.id !== editing?.id && nameNormKey(p.name) === nameNormKey(trimmedName),
            );
        setNameError(blankName ? pf.nameRequired : nameConflict ? cf.nameConflict : undefined);
        const slotsValid =
            channelOutcomes.every((o) => Object.keys(o.errors).length === 0) &&
            otherCostErrors.every((e) => !e);
        // Create references SAVED items (FR-310); edit may keep a degraded ref as values (US6-4).
        const linksValid = editing ? true : filamentId !== "" && printerId !== "";
        if (blankName || nameConflict || !result || !slotsValid || !linksValid) {
            if (!blankName && !nameConflict) setSubmitError(pf.saveInvalid);
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
                        <Button
                            variant="secondary"
                            onClick={() => void navigate({ to: "/catalogo" })}
                        >
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

            {/* 019/PR-D (T076, prancheta 17g) — a tira do cabeçalho: um preço grande e uma legenda que
          muda de conteúdo, nunca de posição. Só para um produto SALVO — um novo/não-salvo não tem
          observação nem fixação para descrever ainda. */}
            {editing && headerValue !== undefined && (
                <PriceHero
                    label={headerLabel}
                    value={headerValue}
                    caption={headerCaption}
                    size="md"
                />
            )}

            {/* 17c — custo hoje > fixado: a spec (US5 AC3) vence o desenho (que pinta info) — este é o
          `tone="warning"` que a spec pede. Escrever (desfixar) só existe quando `active`. */}
            {overFixed && todayPrice !== undefined && (
                <Alert
                    tone="warning"
                    data-testid="product-fixed-over-alert"
                    action={
                        active ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleUnfix}
                                loading={fixPrice.isPending}
                            >
                                {catalogo.unfix}
                            </Button>
                        ) : undefined
                    }
                >
                    {catalogo.fixedOverNote
                        .replace("{hoje}", formatBRL(todayPrice))
                        .replace("{diff}", formatBRL(todayPrice - fixedPriceValue!))}
                </Alert>
            )}

            {/* 16b·2 — quando o preço mudou desde a última observação e ninguém fixou nada ainda: as
          duas escolhas, lado a lado. */}
            {active && priceChanged && savedObservation && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="secondary"
                        onClick={handleKeepPrice}
                        loading={fixPrice.isPending}
                    >
                        {catalogo.keepPrice.replace(
                            "{valor}",
                            formatBRL(savedObservation.observedPrice),
                        )}
                    </Button>
                    <Button onClick={handleAcceptNewPrice}>{catalogo.acceptNewPrice}</Button>
                </div>
            )}

            {/* K3: ONE calm, actionable state — the product has no live filament/printer behind it,
          whether a kit save materialized it that way or a deletion severed the links. It says
          what is true (nothing linked, values kept) and never invents a removal it cannot know
          happened. Clears live, the moment both pickers are set (SC-412). */}
            {needsAttention && (
                <Alert tone="info" title={messages.catalogo.needsAttention}>
                    {pf.manualValuesKept}
                </Alert>
            )}

            {/* `display:contents` keeps every child a direct flex item of the section above (same gap
          rhythm). `active` fica num `<fieldset>` normal; fora dele veste `<Frozen>` (`tf-frozen`,
          T045) — inerta cada input/select nested inside, sem thread de prop por campo. Name + os
          pickers ficam full width, acima da grade de duas colunas (identificam o produto, não o
          precificam). O botão Salvar saiu daqui (T045): mora no rodapé abaixo, sempre visível. */}
            <EditableSection active={active}>
                <Card padding="md" className="flex flex-col gap-3">
                    <Field
                        label={pf.nameLabel}
                        required
                        error={nameError}
                        hint={cf.nameCounter
                            .replace("{n}", String(name.length))
                            .replace("{max}", String(NAME_MAX))}
                    >
                        {(p) => (
                            <div className="tf-inputwrap">
                                <input
                                    {...p}
                                    type="text"
                                    className="tf-input"
                                    placeholder={pf.namePlaceholder}
                                    value={name}
                                    maxLength={NAME_MAX}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        // A recusa é do CAMPO, então some assim que deixar de ser verdade — não
                                        // espera o próximo Salvar (mesma disciplina do 17b·2).
                                        setNameError(undefined);
                                    }}
                                />
                            </div>
                        )}
                    </Field>
                    {/* 17b·2 — a dica some quando o erro NÃO é "nome repetido" (o `Field` compartilhado
              só mostra hint OU erro; a dica de apoio do conflito é uma segunda linha própria,
              simultânea ao erro, como o desenho pede). */}
                    {nameError === cf.nameConflict && (
                        <p style={captionText}>{cf.nameConflictHint}</p>
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
            </EditableSection>

            {/* 019/PR-B (T045) — rodapé: a frase + o convite (mesmo elemento do vazio didático,
          FR-1906) fora de `active`, e Salvar SEMPRE visível — `disabled` fora de `active`, nunca um
          fail-at-save surpresa. */}
            {!active && <PremiumFooterNote gate={gate} />}
            <div className={active ? "flex justify-end" : "flex justify-between gap-2"}>
                {!active && <PremiumInviteCta gate={gate} />}
                <Button
                    type="button"
                    disabled={!active}
                    loading={create.isPending || update.isPending}
                    onClick={active ? () => void handleSave() : undefined}
                >
                    {pf.saveProduct}
                </Button>
            </div>
            {submitError && <Alert tone="danger">{submitError}</Alert>}

            {/* 016/PR-B (US4/T015) — same two-column split as Calcular (SC-305: identical body,
          identical layout). Costs on the left, markup + marketplace channel editing on the
          right; each column freezes independently. 019/PR-B (T045): `active` usa `<fieldset>`
          normal, fora dele `<Frozen>` — mesma regra do bloco de identidade acima. */}
            <div className="tf-calc-grid">
                <div className="tf-calc-grid__col">
                    <EditableSection active={active}>
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
                    </EditableSection>
                </div>
                <div className="tf-calc-grid__col">
                    <EditableSection active={active}>
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
                            catalog={catalog}
                            // 016/US11 (T048) — the product page mounts only behind the catalog's OWN
                            // page-level entitlement gate (`catalogo-page.tsx`), so a channel slot here is
                            // always premium already.
                            entitled
                            signedOut={false}
                        />
                    </EditableSection>
                </div>
            </div>

            <div className="tf-calc-footer">
                {result ? (
                    <PriceResults
                        result={result}
                        values={values}
                        channelOutcomes={channelOutcomes}
                    />
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
