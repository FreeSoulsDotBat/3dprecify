import { useMemo, useRef, useState } from "react";

import {
    computeQuote,
    type QuoteDiscountMode,
    type QuoteLineInput,
    type QuoteResult,
} from "@3dprecify/pricing-core";

import type { FrozenProvenance } from "@/entities/history/frozen-payload";
import { buildQuotePayload } from "@/entities/history/frozen-payload";
import { useRecordSnapshot } from "@/entities/history/use-history";
import type {
    BomOut,
    FilamentOut,
    PrinterOut,
    ProductOut,
    SnapshotIn,
    SnapshotInHeadlineBasis,
} from "@/shared/api/generated";
import type { FeeCatalog } from "@/shared/fee-catalog/fee-catalog";
import type { CatalogSource } from "@/shared/fee-catalog/use-fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL, parseDecimal } from "@/shared/lib/decimal-ptbr";
import { formatDatePtBr, formatDayMonthPtBr } from "@/shared/lib/format-date";
import { useOnline } from "@/shared/lib/use-online";
import {
    Alert,
    Aviso,
    BreakdownRow,
    Button,
    Card,
    Field,
    Icon,
    NumberField,
    Select,
    toast,
} from "@/shared/ui";

// 019/PR-E (T088, US16/US17/US18-retirada, ADR-0034) — O CONSTRUTOR de orçamento (18b→18d→18e).
//
// DECISÃO DE FRONTEIRA (Princípio VIII, precedente T124 da PR-D): `features/history` não importa
// `features/calculator` nem `features/bom` (eslint-boundaries). Quem sabe transformar um PRODUCT/
// KIT do Catálogo num `PriceInput` é a PAGE (`pages/historico/quote-line-input.ts`), que injeta
// `toLineInput`. Este arquivo só sabe SOMAR o que já veio pronto — nenhuma linha aqui chama
// `computeFromForm`.
//
// DECISÃO DE FIDELIDADE (registrada, não inventada): a prancheta desenha 18d (desconto/piso) e 18e
// (diálogo "Enviar congela") como DUAS pranchetas separadas. O contrato T083 pede as DUAS num único
// passo de revisão — "Válido até" já visível ANTES de qualquer confirmação adicional, e um único
// clique em "Enviar" grava (sem uma segunda tomada de decisão). A leitura do total, do piso e da
// validade JÁ NA TELA, antes do clique, é a confirmação — não existe uma segunda camada de diálogo
// Radix aqui. Registrado para o design revisar; não é um desvio silencioso.
//
// 18d·2 ("Aperta, mas passa" — sobra positiva mas pequena) FICOU DE FORA: a prancheta não decide o
// limiar (quantos % é "aperta"), e a T088 pede para NÃO inventar regra de dinheiro. Só os dois
// estados com limiar decidido entram: sobra normal (linha apagada) e abaixo do custo (aviso, Q10).
//
// Ícones do "conjunto curado" que a prancheta cita: `check`/`share-2` JÁ estavam no bundle estático
// (`public/brand/icons/lucide`) e entraram no mapa inline (`shared/ui/icon.tsx`) nesta tarefa.
// `percent`/`minus`/`user`/`folder` NÃO estão no bundle — não inventados; o campo de desconto usa o
// sufixo textual do `NumberField` (%, R$) em vez de um ícone, e `lock` (18e) não existe → `Aviso`
// já usa `info` por padrão (mesma troca que o resto do 019 já fez noutras pranchetas).

const t = messages.quote;
const th = messages.historico;
const tb = messages.bom;

const DAY_MS = 86_400_000;
/** Default do campo "Válido até" — o mesmo número que a prancheta 18e usa no exemplo ("15 dias,
 *  contados de hoje"); editável, nunca imposto (research/ADR-0034 §2, Q7: é TEXTO, não estado). */
const DEFAULT_VALIDITY_DAYS = "15";

export type QuoteCatalogItem =
    { kind: "PRODUCT"; product: ProductOut } | { kind: "KIT"; kit: BomOut };

/** O que a PAGE devolve para cada item do catálogo: as linhas já resolvidas pelo motor (sem
 *  `channels` — venda DIRETA, Q6), de onde vieram (para o documento congelado), se alguma peça do
 *  kit está degradada (D6) e se o item está PARADO (K3) e não pode ser orçado hoje. */
export interface QuoteLineInputResult {
    lines: QuoteLineInput[];
    origin: FrozenProvenance | null;
    degraded: boolean;
    stopped: boolean;
}

export interface QuoteBuilderProps {
    products: ProductOut[];
    kits: BomOut[];
    /** Não usados no PREÇO (o motor já recebeu tudo resolvido via `toLineInput`) — mantidos na
     *  assinatura pela simetria do contrato (T088); nada aqui os lê. */
    filaments: FilamentOut[];
    printers: PrinterOut[];
    catalog: FeeCatalog;
    source: CatalogSource;
    /** T125 (ADR-0033) — o construtor NÃO lê observação de preço (esse vocabulário é só do
     *  recálculo do Catálogo); a data de "preço parado desde" vem de quando o REGISTRO do produto
     *  mudou pela última vez, uma por id — só isso, deliberadamente menos rico que o Catálogo. */
    observations?: ReadonlyMap<string, { observedAt: string }>;
    /** A PONTE com o Catálogo (decisão de fronteira acima) — chamada uma vez por item do catálogo. */
    toLineInput: (item: QuoteCatalogItem) => QuoteLineInputResult | null;
    onSent: (clientSnapshotId: string) => void;
}

function itemId(item: QuoteCatalogItem): string {
    return item.kind === "PRODUCT" ? item.product.id : item.kit.id;
}
function itemName(item: QuoteCatalogItem): string {
    return item.kind === "PRODUCT" ? item.product.name : item.kit.name;
}

export function QuoteBuilder({
    products,
    kits,
    observations = new Map(),
    toLineInput,
    onSent,
}: QuoteBuilderProps) {
    const online = useOnline();
    const record = useRecordSnapshot();

    const [step, setStep] = useState<"select" | "review">("select");
    const [query, setQuery] = useState("");
    const [clientLabel, setClientLabel] = useState("");
    // id → quantidade digitada (string, pt-BR); presença na tabela = item escolhido (18b).
    const [selected, setSelected] = useState<Map<string, string>>(new Map());
    const [discountMode, setDiscountMode] = useState<QuoteDiscountMode>("PCT");
    const [discountValue, setDiscountValue] = useState("0");
    const [validityDays, setValidityDays] = useState(DEFAULT_VALIDITY_DAYS);
    const [sending, setSending] = useState(false);
    // Guarda de reentrância SÍNCRONA (T083 "dois cliques = uma requisição"): um mock que resolve no
    // mesmo microtask pode fazer `setSending(true)`→`setSending(false)` colapsarem num commit só do
    // React antes do segundo clique — o `ref` não depende de render nenhum para valer.
    const sendingRef = useRef(false);
    // Uma vez que UM envio terminou com sucesso, esta tela não manda outro — reenviar o MESMO
    // orçamento revisado é a ação de duplicar/reabrir, não a de clicar Enviar de novo (o "dois
    // cliques" do T083 cobre também o caso em que a 1ª chamada já terminou antes do 2º clique: um
    // mock que resolve no mesmo microtask drenaria a guarda de `sending` sozinho).
    const sentRef = useRef(false);
    const [sent, setSent] = useState(false);

    const items: QuoteCatalogItem[] = useMemo(
        () => [
            ...products.map((product): QuoteCatalogItem => ({ kind: "PRODUCT", product })),
            ...kits.map((kit): QuoteCatalogItem => ({ kind: "KIT", kit })),
        ],
        [products, kits],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((it) => itemName(it).toLowerCase().includes(q));
    }, [items, query]);

    // Uma chamada por item do catálogo — nunca por linha do motor (a PAGE já fez a conta pesada).
    const resultById = useMemo(() => {
        const map = new Map<string, QuoteLineInputResult | null>();
        for (const it of items) map.set(itemId(it), toLineInput(it));
        return map;
    }, [items, toLineInput]);

    function toggle(item: QuoteCatalogItem) {
        const id = itemId(item);
        const result = resultById.get(id);
        // PARADO (K3): não entra. Não há o que orçar de um preço que não recalcula hoje (18b).
        if (!result || result.stopped) return;
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(id)) next.delete(id);
            else next.set(id, "1");
            return next;
        });
    }

    function setQty(id: string, raw: string) {
        setSelected((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.set(id, raw);
            return next;
        });
    }

    // As linhas do motor, achatadas (kit = N linhas, produto = 1), multiplicadas pela quantidade que
    // o vendedor escolheu — e a origem de CADA linha resultante, na MESMA ordem (T133): um kit repete
    // a MESMA origem por linha, porque o vendedor vendeu o kit, não cada peça avulsa.
    const picked = useMemo(() => {
        const flatLines: QuoteLineInput[] = [];
        const origins: (FrozenProvenance | null)[] = [];
        const perItemRange = new Map<string, { start: number; end: number }>();
        for (const [id, qtyRaw] of selected) {
            const result = resultById.get(id);
            if (!result) continue;
            const qty = Math.max(0, Math.floor(parseDecimal(qtyRaw) || 0));
            const start = flatLines.length;
            for (const line of result.lines) {
                flatLines.push({ ...line, quantity: line.quantity * qty });
                origins.push(result.origin);
            }
            perItemRange.set(id, { start, end: flatLines.length });
        }
        return { flatLines, origins, perItemRange };
    }, [selected, resultById]);

    const discountNum = (() => {
        const n = parseDecimal(discountValue);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    })();

    // Nunca deixa o total quebrar por um dígito transitório (ex.: um campo momentaneamente vazio
    // enquanto o vendedor digita): recai no orçamento SEM desconto, que é sempre um `computeQuote`
    // válido — a tela nunca lança sobre uma entrada em trânsito.
    const quoteResult: QuoteResult = useMemo(() => {
        try {
            return computeQuote({
                lines: picked.flatLines,
                discount: { mode: discountMode, value: discountNum },
            });
        } catch {
            return computeQuote({ lines: picked.flatLines });
        }
    }, [picked.flatLines, discountMode, discountNum]);

    const validityN = Math.max(1, Math.floor(parseDecimal(validityDays) || 0));
    const validUntilLabel = formatDatePtBr(new Date(Date.now() + validityN * DAY_MS).toISOString());

    async function handleSend() {
        if (!online || sendingRef.current || sentRef.current) return;
        sendingRef.current = true;
        setSending(true);
        try {
            const discount = { mode: discountMode, value: discountNum };
            let result: QuoteResult;
            try {
                result = computeQuote({ lines: picked.flatLines, discount });
            } catch {
                result = computeQuote({ lines: picked.flatLines });
            }
            const payload = buildQuotePayload(result, { lines: picked.origins, discount });
            const now = new Date();
            const body: SnapshotIn = {
                clientSnapshotId: crypto.randomUUID(),
                kind: "QUOTE",
                label: clientLabel.trim() || null,
                quoteValidityDays: validityN,
                deviceQuotedAt: now.toISOString(),
                deviceUtcOffsetMinutes: -now.getTimezoneOffset(),
                modelVersion: result.modelVersion,
                headlineTotal: payload.totals.precoOrcamento ?? "0.00",
                headlineBasis: "PRECO_ORCAMENTO" satisfies SnapshotInHeadlineBasis,
                payload: payload as unknown as SnapshotIn["payload"],
            };

            let outcome;
            try {
                outcome = await record.mutateAsync(body);
            } catch {
                // O aparelho não conseguiu nem GUARDAR o registro — nada foi enviado, nada está na fila.
                toast(th.saveDeviceFailed, { tone: "danger" });
                return;
            }
            sentRef.current = true;
            setSent(true);
            onSent(outcome.clientSnapshotId);
            if (outcome.syncState === "synced") toast(th.saved, { tone: "success" });
            else if (outcome.syncState === "pending") toast(th.syncPendingToast, { tone: "info" });
            else if (outcome.syncState === "blocked") toast(th.syncBlockedToast, { tone: "info" });
            else if (outcome.syncState === "unauthenticated") {
                toast(th.syncUnauthenticatedToast, { tone: "info" });
            } else toast(th.syncFailedToast, { tone: "danger" });
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
    }

    if (step === "select") {
        return (
            <div className="flex flex-col gap-3" data-testid="quote-builder">
                <Field label={t.clientLabel}>
                    {({ id, ...aria }) => (
                        <div className="tf-inputwrap">
                            <input
                                id={id}
                                {...aria}
                                className="tf-input"
                                type="text"
                                maxLength={120}
                                value={clientLabel}
                                onChange={(e) => setClientLabel(e.target.value)}
                            />
                        </div>
                    )}
                </Field>

                <div className="tf-inputwrap">
                    <Icon name="search" size={16} />
                    <input
                        className="tf-input"
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    {filtered.map((item) => {
                        const id = itemId(item);
                        const result = resultById.get(id);
                        const isSelected = selected.has(id);

                        if (result?.stopped) {
                            const product = item.kind === "PRODUCT" ? item.product : null;
                            const obs = product ? observations.get(product.id) : undefined;
                            const dataIso = obs?.observedAt ?? product?.updatedAt ?? "";
                            return (
                                <Card
                                    key={id}
                                    padding="sm"
                                    data-testid={`quote-line-${id}`}
                                    className="flex items-center gap-3 opacity-60"
                                >
                                    <Icon
                                        name="triangle-alert"
                                        size={16}
                                        className="text-[var(--warning-text)]"
                                    />
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm">{itemName(item)}</span>
                                        <span className="text-xs text-[var(--warning-text)]">
                                            {t.stoppedCannotQuote.replace(
                                                "{data}",
                                                formatDayMonthPtBr(dataIso),
                                            )}
                                        </span>
                                    </div>
                                </Card>
                            );
                        }

                        let baseTotal = 0;
                        if (result && result.lines.length > 0) {
                            try {
                                baseTotal = computeQuote({ lines: result.lines }).netTotal;
                            } catch {
                                baseTotal = 0;
                            }
                        }

                        return (
                            <Card
                                key={id}
                                padding="sm"
                                interactive
                                data-testid={`quote-line-${id}`}
                                onClick={() => toggle(item)}
                                className="flex items-center gap-3"
                            >
                                <Icon
                                    name={isSelected ? "check" : "plus"}
                                    size={16}
                                    className={
                                        isSelected
                                            ? "text-[var(--accent)]"
                                            : "text-[var(--text-muted)]"
                                    }
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-sm font-semibold">
                                        {itemName(item)}
                                    </span>
                                    <span className="text-xs text-[var(--text-muted)]">
                                        {item.kind === "KIT"
                                            ? t.kitLineMeta
                                                  .replace("{n}", selected.get(id) ?? "1")
                                                  .replace("{pecas}", String(item.kit.lines.length))
                                            : t.unitPriceMeta.replace(
                                                  "{valor}",
                                                  formatBRL(baseTotal),
                                              )}
                                    </span>
                                </div>
                                <span className="tf-tnum text-sm font-semibold">
                                    {formatBRL(baseTotal)}
                                </span>
                                {isSelected && (
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <NumberField
                                            size="sm"
                                            className="w-20"
                                            inputMode="numeric"
                                            data-testid={`quote-qty-${id}`}
                                            value={selected.get(id) ?? "1"}
                                            onChange={(e) => setQty(id, e.target.value)}
                                        />
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>

                <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] pt-3">
                    <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-xs text-[var(--text-muted)]">
                            {selected.size === 1
                                ? t.itemCountOne
                                : t.itemCount.replace("{n}", String(selected.size))}
                        </span>
                        <span className="tf-tnum text-base font-semibold">
                            {formatBRL(quoteResult.grossTotal)}
                        </span>
                    </div>
                    <Button disabled={selected.size === 0} onClick={() => setStep("review")}>
                        {t.continueAction}
                    </Button>
                </div>
            </div>
        );
    }

    // ── Revisão (18d + 18e num passo só — ver decisão de fidelidade no topo do arquivo) ────────────
    return (
        <div className="flex flex-col gap-4" data-testid="quote-builder">
            <Card padding="md" className="flex flex-col gap-2">
                {[...selected.entries()].map(([id]) => {
                    const item = items.find((it) => itemId(it) === id);
                    const result = resultById.get(id);
                    const range = picked.perItemRange.get(id);
                    if (!item || !result || !range) return null;
                    const itemLines = quoteResult.lines.slice(range.start, range.end);
                    const subtotal = itemLines.reduce((sum, l) => sum + l.subtotal, 0);
                    return (
                        <div
                            key={id}
                            data-testid={`quote-line-${id}`}
                            className="flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold">{itemName(item)}</span>
                                <span className="tf-tnum text-sm font-semibold">
                                    {formatBRL(subtotal)}
                                </span>
                            </div>
                            {/* Kit: cada peça aparece — a degradada (D6, ADR-0017 §6) com a legenda que o produto
                  já usa, nunca um erro ou um sumiço silencioso. */}
                            {item.kind === "KIT" &&
                                itemLines.map((l, i) => (
                                    <span key={i} className="text-xs text-[var(--text-muted)]">
                                        {l.name ?? tb.lineAdhoc} · {l.quantity} un.
                                    </span>
                                ))}
                        </div>
                    );
                })}
            </Card>

            <Card padding="md" className="flex flex-col gap-3">
                <Field label={t.discountLabel} tightLabel>
                    <div className="flex gap-2">
                        <Select
                            data-testid="quote-discount-mode"
                            value={discountMode}
                            onChange={(e) => setDiscountMode(e.target.value as QuoteDiscountMode)}
                            options={[
                                { value: "PCT", label: "%" },
                                { value: "AMOUNT", label: "R$" },
                            ]}
                        />
                        <NumberField
                            data-testid="quote-discount-value"
                            inputMode="decimal"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                        />
                    </div>
                </Field>

                <BreakdownRow
                    label={t.subtotal}
                    value={quoteResult.grossTotal}
                    data-testid="quote-gross"
                />
                {discountNum > 0 && (
                    <BreakdownRow
                        label={
                            discountMode === "PCT"
                                ? t.discountLine.replace("{pct}", discountValue)
                                : t.discountAmountLine
                        }
                        value={-quoteResult.discountAmount}
                        data-testid="quote-discount-amount"
                    />
                )}
                <BreakdownRow
                    label={t.total}
                    value={quoteResult.netTotal}
                    emphasis="total"
                    data-testid="quote-net"
                />
                {/* Sobra sobre o custo — SÓ a linha apagada (o limiar "aperta, mas passa" da 18d·2 não foi
            decidido, e T088 pede para não inventar regra de dinheiro; ver nota no topo). */}
                {!quoteResult.belowCost && (
                    <BreakdownRow
                        label={t.marginOverCost}
                        sublabel={t.marginOverCostSub.replace(
                            "{valor}",
                            formatBRL(quoteResult.costFloor),
                        )}
                        value={quoteResult.netTotal - quoteResult.costFloor}
                        emphasis="muted"
                        data-testid="quote-cost-floor"
                    />
                )}
                {/* Q10 (ADR-0034 §1.5) — avisa, nunca bloqueia. O Enviar continua vivo. */}
                {quoteResult.belowCost && (
                    <Alert tone="warning" data-testid="quote-below-cost">
                        {t.belowCost.replace(
                            "{valor}",
                            formatBRL(quoteResult.costFloor - quoteResult.netTotal),
                        )}
                    </Alert>
                )}
            </Card>

            {/* 18e — o cartão "Enviar congela este preço" é o PASSO final do construtor (a prancheta o
          desenha como cartão do fluxo, com Voltar | Enviar; não um modal por cima — leitura
          registrada em dod-evidence para a 2ª passada). O título e o "Total enviado" vêm dela. */}
            <Card padding="md" className="flex flex-col gap-3">
                <h2 className="tf-title text-[var(--text-strong)]">{t.sendTitle}</h2>
                <BreakdownRow
                    label={t.totalSent}
                    value={formatBRL(quoteResult?.netTotal ?? 0)}
                    prefix=""
                />
                <Field label={th.validityField}>
                    {({ id, ...aria }) => (
                        <NumberField
                            id={id}
                            {...aria}
                            unit={th.validityUnit}
                            inputMode="numeric"
                            min={1}
                            max={3650}
                            value={validityDays}
                            onChange={(e) => setValidityDays(e.target.value)}
                        />
                    )}
                </Field>

                <BreakdownRow
                    data-testid="quote-valid-until"
                    label={t.validUntil}
                    sublabel={t.validUntilSub.replace("{n}", String(validityN))}
                    value={validUntilLabel}
                    prefix=""
                />

                {/* 18e — "lock" não existe no conjunto curado; `Aviso` já usa `info` por padrão. */}
                <Aviso>{t.freezeNote.replace(/\{data\}/g, validUntilLabel)}</Aviso>
            </Card>

            <div className="flex flex-col gap-2">
                {!online && (
                    <p data-testid="quote-send-reason" className="text-sm text-[var(--text-muted)]">
                        {t.sendOffline}
                    </p>
                )}
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep("select")}>
                        {t.back}
                    </Button>
                    <Button
                        data-testid="quote-send"
                        disabled={!online || sending || sent || selected.size === 0}
                        loading={sending}
                        onClick={() => void handleSend()}
                    >
                        <Icon name="share-2" size={16} />
                        {t.send}
                    </Button>
                </div>
            </div>
        </div>
    );
}
