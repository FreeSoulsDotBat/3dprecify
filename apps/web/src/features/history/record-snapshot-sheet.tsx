import { useMemo, useState, type FormEvent } from "react";

import type { FrozenSnapshotPayload, MoneyString } from "@/entities/history/frozen-payload";
import { syncToastFor } from "@/entities/history/sync-toast";
import { useRecordSnapshot } from "@/entities/history/use-history";
import { useEntitlement } from "@/entities/user/use-entitlement";
import {
    type SnapshotIn,
    type SnapshotInHeadlineBasis,
    type SnapshotInKind,
} from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";
import {
    Button,
    Field,
    Icon,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
    toast,
} from "@/shared/ui";

import "./record-snapshot-sheet.css";

// ⚠ @doc DEC-013 — sem premium ATIVO o botão não existe (devolve `null`), e o portão é a
//   última palavra do SERVIDOR: entitlement em cache, nunca flag de cliente.

const t = messages.history;

/** What the surface hands over: its kind, and how to freeze what is currently on screen. */
export interface RecordSource {
    kind: RecordableKind;
    /** Called at RECORD time (Sheet open), never at render — it captures the displayed values. */
    freeze: () => FrozenSnapshotPayload;
}

export function RecordSnapshotButton({
    source,
    disabled = false,
}: {
    source: RecordSource;
    disabled?: boolean;
}) {
    const { data } = useEntitlement();
    const entitled = data?.status === "active";
    const [open, setOpen] = useState(false);

    // Owner decision, 2026-07-13: without an ACTIVE premium the button does not exist — it is not a
    // greyed-out affordance and not a teaser trigger. The free calculator stays LITERALLY untouched
    // (SC-109 of spec 005, and SC-507/512 of this one), so a seller who came to price a piece is
    // never sold to mid-task. The honest door lives on the Histórico tab, where someone is actually
    // asking about history. `useEntitlement` is the SERVER's last word (persisted, T011b) — never a
    // client-held flag, and never assumed on silence.
    if (!entitled) return null;

    return (
        <>
            <Button variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
                <Icon name="save" size={18} />
                {t.saveAction}
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
                {/* Mounted only while open, so `freeze()` runs against the values on screen right now. */}
                {open && (
                    <SheetContent>
                        <RecordForm source={source} onDone={() => setOpen(false)} />
                    </SheetContent>
                )}
            </Sheet>
        </>
    );
}

// 019/PR-E (T135) — esta gaveta NÃO grava orçamento, e a barreira é de TIPO, não de `if`.
//
// O orçamento nasce no construtor (`quote-builder.tsx`), que monta N itens, aplica desconto no
// total e congela pelo `buildQuotePayload`. Aqui se grava o que está NA TELA da Calculadora: uma
// peça ou um kit, na base que o vendedor escolhe. Estreitar os dois tipos abaixo faz o compilador
// recusar `kind: "QUOTE"` / `headlineBasis: "PRECO_ORCAMENTO"` nesta superfície — um `if` que
// alguém remova por engano não reabriria o caminho, porque o caminho não existe no tipo.
type RecordableKind = Exclude<SnapshotInKind, "QUOTE">;
type RecordableBasis = Exclude<SnapshotInHeadlineBasis, "PRECO_ORCAMENTO">;

const BASIS_LABEL: Record<RecordableBasis, string> = {
    PRECO_VAREJO: t.basisRetail,
    PRECO_ATACADO: t.basisWholesale,
};

function RecordForm({ source, onDone }: { source: RecordSource; onDone: () => void }) {
    // Frozen ONCE, when the Sheet opened. `useState(initializer)` runs the initializer exactly once at
    // mount — and `RecordForm` mounts only while `open` — so a parent re-render that hands down a new
    // `source` object can never re-capture the on-screen values (review PR-A, minor). `useMemo([source])`
    // did re-freeze on that new identity, breaking the "freeze at open" invariant the test now pins.
    const [payload] = useState(() => source.freeze());
    const quotedAt = useMemo(() => new Date(), []);

    const record = useRecordSnapshot();
    const [label, setLabel] = useState("");
    const [validity, setValidity] = useState("");
    const [basis, setBasis] = useState<RecordableBasis>("PRECO_VAREJO");

    // As DUAS bases que esta gaveta oferece — e só elas: um documento de orçamento (cujo total mora
    // em `totals.precoOrcamento`) não produz candidato nenhum aqui, então não há o que gravar.
    const candidates = (
        [
            ["PRECO_VAREJO", payload.totals.precoVarejo],
            ["PRECO_ATACADO", payload.totals.precoAtacado],
        ] as [RecordableBasis, MoneyString | undefined][]
    ).filter((c): c is [RecordableBasis, MoneyString] => !!c[1]);

    const total = candidates.find(([b]) => b === basis)?.[1];

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        if (!total) return;

        const body: SnapshotIn = {
            // Minted at RECORD time. Minting it at SEND time would regenerate after an app restart and
            // DUPLICATE the record — the whole exactly-once guarantee rests on this id being stable.
            clientSnapshotId: crypto.randomUUID(),
            kind: source.kind,
            // Blank ⇒ NULL, never "" — an empty string is a label the seller never wrote.
            label: label.trim() || null,
            quoteValidityDays: validity.trim() ? Number(validity) : null,
            // The DEVICE's clock — the date the seller made the claim (FR-528, integrity limit accepted).
            deviceQuotedAt: quotedAt.toISOString(),
            deviceUtcOffsetMinutes: -quotedAt.getTimezoneOffset(),
            modelVersion: payload.modelVersion,
            headlineTotal: total,
            headlineBasis: basis,
            payload: payload as unknown as SnapshotIn["payload"],
        };

        let outcome;
        try {
            outcome = await record.mutateAsync(body);
        } catch {
            // The device could not KEEP the record. Nothing was sent and nothing is queued, so the Sheet
            // stays open with the values intact — the seller has not lost their quote, and we do not
            // pretend they saved it.
            toast(t.saveDeviceFailed, { tone: "danger" });
            return;
        }

        onDone();
        const aviso = syncToastFor(outcome.syncState);
        toast(aviso.message, { tone: aviso.tone });
    }

    return (
        <form className="tf-record" onSubmit={(e) => void onSubmit(e)}>
            <SheetTitle>{t.saveSheetTitle}</SheetTitle>
            <SheetDescription>{t.saveSheetIntro}</SheetDescription>

            <Field label={t.labelField} hint={t.labelHint}>
                {({ id, ...aria }) => (
                    <div className="tf-inputwrap">
                        <input
                            id={id}
                            {...aria}
                            className="tf-input"
                            type="text"
                            maxLength={120}
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                        />
                    </div>
                )}
            </Field>

            {/* Not a TTL: nothing ever expires the record — this is the validity the seller PROMISED. */}
            <Field label={t.validityField}>
                {({ id, ...aria }) => (
                    <div className="tf-inputwrap">
                        <input
                            id={id}
                            {...aria}
                            className="tf-input"
                            type="number"
                            min={1}
                            max={3650}
                            inputMode="numeric"
                            value={validity}
                            onChange={(e) => setValidity(e.target.value)}
                        />
                        <span className="tf-record__unit">{t.validityUnit}</span>
                    </div>
                )}
            </Field>

            <fieldset className="tf-record__basis">
                <legend>{t.basisField}</legend>
                {candidates.map(([value, amount]) => (
                    <label key={value} className="tf-record__option">
                        <input
                            type="radio"
                            name="headline-basis"
                            value={value}
                            checked={basis === value}
                            onChange={() => setBasis(value)}
                        />
                        <span>{BASIS_LABEL[value]}</span>
                        <strong>{formatBRL(Number(amount))}</strong>
                    </label>
                ))}
            </fieldset>

            {/* The date is shown BEFORE it is recorded — it is part of the claim, not a side effect. */}
            <p className="tf-record__date">
                {t.quotedAt.replace("{data}", quotedAt.toLocaleDateString("pt-BR"))}
            </p>

            <Button type="submit" disabled={!total || record.isPending}>
                {t.saveSheetSubmit}
            </Button>
        </form>
    );
}
