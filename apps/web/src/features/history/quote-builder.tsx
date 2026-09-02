import { useMemo, useRef, useState } from "react";

import {
    computeQuote,
    type QuoteDiscountMode,
    type QuoteLineInput,
    type QuoteResult,
} from "@3dprecify/pricing-core";

import type { FrozenProvenance } from "@/entities/history/frozen-payload";
import { buildQuotePayload } from "@/entities/history/frozen-payload";
import { syncToastFor } from "@/entities/history/sync-toast";
import { useRecordSnapshot } from "@/entities/history/use-history";
import type {
    BomOut,
    ProductOut,
    SnapshotIn,
    SnapshotInHeadlineBasis,
} from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { parseDecimal } from "@/shared/lib/decimal-ptbr";
import { formatDatePtBr } from "@/shared/lib/format-date";
import { useOnline } from "@/shared/lib/use-online";
import { toast } from "@/shared/ui";

import {
    itemId,
    itemName,
    type QuoteCatalogItem,
    type QuoteLineInputResult,
} from "./quote-catalog-item";
import { QuoteItemPicker } from "./quote-item-picker";
import { QuoteReview } from "./quote-review";

// `QuoteCatalogItem`/`QuoteLineInputResult`/`itemId`/`itemName`/`itemBaseTotal` moram em
// `quote-catalog-item.ts` — os dois passos extraídos (`quote-item-picker.tsx`/`quote-review.tsx`)
// e este orquestrador precisam do MESMO vocabulário sem formar um ciclo de import entre si.
// Reexportados aqui para não quebrar quem já importava daqui (o teste, `historico-page.tsx`,
// `quote-line-input.ts`).
export {
    itemBaseTotal,
    type QuoteCatalogItem,
    type QuoteLineInputResult,
} from "./quote-catalog-item";

// @doc DEC-011 — `features/history` não importa `calculator` nem `bom`: a PAGE injeta
//   `toLineInput` e este arquivo só SOMA o que já veio pronto.

const th = messages.history;

const DAY_MS = 86_400_000;
/** Default do campo "Válido até" — o mesmo número que a prancheta 18e usa no exemplo ("15 dias,
 *  contados de hoje"); editável, nunca imposto (research/ADR-0034 §2, Q7: é TEXTO, não estado). */
const DEFAULT_VALIDITY_DAYS = "15";

export interface QuoteBuilderProps {
    products: ProductOut[];
    kits: BomOut[];
    /** T125 (ADR-0033) — o construtor NÃO lê observação de preço (esse vocabulário é só do
     *  recálculo do Catálogo); a data de "preço parado desde" vem de quando o REGISTRO do produto
     *  mudou pela última vez, uma por id — só isso, deliberadamente menos rico que o Catálogo. */
    observations?: ReadonlyMap<string, { observedAt: string }>;
    /** A PONTE com o Catálogo (decisão de fronteira acima) — chamada uma vez por item do catálogo. */
    toLineInput: (item: QuoteCatalogItem) => QuoteLineInputResult | null;
    onSent: (clientSnapshotId: string) => void;
}

/** As DUAS posições que precisavam repriçar com desconto e recair no orçamento SEM desconto quando
 *  o desconto não é um `computeQuote` válido (ex.: um dígito transitório enquanto o vendedor
 *  digita) — nunca deixa a tela quebrar sobre uma entrada em trânsito. */
function computeQuoteWithDiscountFallback(
    lines: QuoteLineInput[],
    discount: { mode: QuoteDiscountMode; value: number },
): QuoteResult {
    try {
        return computeQuote({ lines, discount });
    } catch {
        return computeQuote({ lines });
    }
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
    const quoteResult: QuoteResult = useMemo(
        () =>
            computeQuoteWithDiscountFallback(picked.flatLines, {
                mode: discountMode,
                value: discountNum,
            }),
        [picked.flatLines, discountMode, discountNum],
    );

    const validityN = Math.max(1, Math.floor(parseDecimal(validityDays) || 0));
    const validUntilLabel = formatDatePtBr(new Date(Date.now() + validityN * DAY_MS).toISOString());

    async function handleSend() {
        if (!online || sendingRef.current || sentRef.current) return;
        sendingRef.current = true;
        setSending(true);
        try {
            const discount = { mode: discountMode, value: discountNum };
            const result = computeQuoteWithDiscountFallback(picked.flatLines, discount);
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
            const notice = syncToastFor(outcome.syncState);
            toast(notice.message, { tone: notice.tone });
        } finally {
            sendingRef.current = false;
            setSending(false);
        }
    }

    if (step === "select") {
        return (
            <QuoteItemPicker
                clientLabel={clientLabel}
                onClientLabelChange={setClientLabel}
                query={query}
                onQueryChange={setQuery}
                filtered={filtered}
                resultById={resultById}
                selected={selected}
                onToggle={toggle}
                onQtyChange={setQty}
                observations={observations}
                grossTotal={quoteResult.grossTotal}
                onContinue={() => setStep("review")}
            />
        );
    }

    // ── Revisão (18d + 18e num passo só — ver decisão de fidelidade no topo do arquivo) ────────────
    return (
        <QuoteReview
            selected={selected}
            items={items}
            resultById={resultById}
            perItemRange={picked.perItemRange}
            quoteResult={quoteResult}
            discountMode={discountMode}
            onDiscountModeChange={setDiscountMode}
            discountValue={discountValue}
            onDiscountValueChange={setDiscountValue}
            discountNum={discountNum}
            validityDays={validityDays}
            onValidityDaysChange={setValidityDays}
            validityN={validityN}
            validUntilLabel={validUntilLabel}
            online={online}
            sending={sending}
            sent={sent}
            onBack={() => setStep("select")}
            onSend={() => void handleSend()}
        />
    );
}
