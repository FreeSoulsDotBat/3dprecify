import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { computeFromForm } from "@/features/calculator/calculator-model";
import {
    applyFilamentFields,
    applyPrinterFields,
} from "@/features/calculator/catalog-prefill-apply";
import {
    type CalcFormValues,
    calculatorResolver,
    defaultCalcValues,
    defaultOtherCost,
    type MarketplaceId,
} from "@/features/calculator/calculator-schema";
import { applyMarketplaceChange } from "@/features/calculator/marketplace-change";
import { formToProductIn, productToForm } from "@/features/calculator/product-mapping";
import { PremiumFooterNote, PremiumInviteCta } from "@/features/catalog/catalog-controls";
import { productPriceOverFixed } from "@/features/catalog/product-price-state";
import { type RecordSource } from "@/features/history/record-snapshot-sheet";
import { honestWriteError } from "@/shared/api/error-messages";
import { type PremiumGate } from "@/shared/billing/premium-gate";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { spineForMarketplace } from "@/features/calculator/fee-prefill";
import { messages } from "@/shared/i18n/messages.pt-br";
import { nameNormKey } from "@/shared/lib/name-norm";
import { Alert, Button, Spinner, toast } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import { ProductFooter, ProductFormGrid } from "./produto-page-body";
import { ProductPriceHeader, productHeaderState } from "./produto-page-header";
import { ProductIdentitySection } from "./produto-page-identity-section";

// ⚠ @doc DEC-023 — nenhum preço é guardado: tudo recomputa vivo. Só a ESCRITA congela fora de
//   `active`, e o `gate` vem pronto da página — um `readOnly` binário já deixou passar
//   `never-subscribed` com o formulário vivo.

const t = messages.calculator;
const pf = messages.productForm;
const cf = messages.catalogForm;

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

            <ProductPriceHeader
                editing={editing}
                headerLabel={headerLabel}
                headerValue={headerValue}
                headerCaption={headerCaption}
                overFixed={overFixed}
                todayPrice={todayPrice}
                fixedPriceValue={fixedPriceValue}
                active={active}
                onUnfix={handleUnfix}
                unfixLoading={fixPrice.isPending}
                priceChanged={priceChanged}
                savedObservation={savedObservation}
                onKeepPrice={handleKeepPrice}
                onAcceptNewPrice={handleAcceptNewPrice}
                keepPriceLoading={fixPrice.isPending}
                needsAttention={needsAttention}
            />

            {/* `display:contents` keeps every child a direct flex item of the section above (same gap
          rhythm). `active` fica num `<fieldset>` normal; fora dele veste `<Frozen>` (`tf-frozen`,
          T045) — inerta cada input/select nested inside, sem thread de prop por campo. Name + os
          pickers ficam full width, acima da grade de duas colunas (identificam o produto, não o
          precificam). O botão Salvar saiu daqui (T045): mora no rodapé abaixo, sempre visível. */}
            <ProductIdentitySection
                active={active}
                name={name}
                onNameChange={(value) => {
                    setName(value);
                    // A recusa é do CAMPO, então some assim que deixar de ser verdade — não
                    // espera o próximo Salvar (mesma disciplina do 17b·2).
                    setNameError(undefined);
                }}
                nameError={nameError}
                filamentId={filamentId}
                onFilamentChange={applyFilament}
                printerId={printerId}
                onPrinterChange={applyPrinter}
                filamentOptions={filamentOptions}
                printerOptions={printerOptions}
            />

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
            <ProductFormGrid
                active={active}
                control={control}
                otherCostFields={otherCostFields}
                otherCostErrors={otherCostErrors}
                onAppendOtherCost={() => appendOtherCost(defaultOtherCost())}
                onRemoveOtherCost={removeOtherCost}
                marketplaceSectionProps={{
                    control,
                    values,
                    fields,
                    included: values.includeMarketplace !== false,
                    onToggleInclude: (next) => setValue("includeMarketplace", next),
                    onAppend: append,
                    onRemove: remove,
                    onMarketplaceChange: handleMarketplaceChange,
                    refreshFailed,
                    refreshing,
                    onRetryCatalog: retryCatalog,
                    spineFor: (m) => spineForMarketplace(catalog, m),
                    catalog,
                    // 016/US11 (T048) — the product page mounts only behind the catalog's OWN
                    // page-level entitlement gate (`catalogo-page.tsx`), so a channel slot here is
                    // always premium already.
                    entitled: true,
                    signedOut: false,
                }}
                channelOutcomes={channelOutcomes}
            />

            <ProductFooter
                result={result}
                values={values}
                channelOutcomes={channelOutcomes}
                recordSource={recordSource}
                editing={editing}
                input={input}
            />
        </section>
    );
}
