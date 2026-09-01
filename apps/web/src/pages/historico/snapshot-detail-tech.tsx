import { Link } from "@tanstack/react-router";

import {
    type FrozenBreakdown,
    type FrozenSnapshotPayload,
} from "@/entities/history/frozen-payload";
import { formatFrozenBRL } from "@/entities/history/history-format";
import { type OriginTarget } from "@/entities/history/origin";
import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow, Card } from "@/shared/ui";

// 019/Polish — moved verbatim out of snapshot-detail-page.tsx.

const t = messages.historico;
const tr = messages.calculator.results;

/** SOMENTE as linhas gravadas. A row the payload does not carry is simply not here (FR-507). */
export function Breakdown({ breakdown }: { breakdown: FrozenBreakdown }) {
    const rows: [string, string | undefined][] = [
        [tr.material, breakdown.material],
        [tr.energy, breakdown.energy],
        [tr.machine, breakdown.machine],
        [tr.failure, breakdown.falha],
        [tr.finishing, breakdown.finishing],
        [tr.labor, breakdown.labor],
    ];
    const present = rows.filter((r): r is [string, string] => !!r[1]);
    const others = breakdown.otherCosts ?? [];
    if (present.length === 0 && others.length === 0) return null;

    return (
        <div className="flex flex-col gap-1">
            <h2 className="tf-historico__section">{t.breakdown}</h2>
            {present.map(([label, value]) => (
                <BreakdownRow key={label} label={label} value={formatFrozenBRL(value)} />
            ))}
            {others.map((cost, i) => (
                <BreakdownRow
                    key={`other-${i}`}
                    label={cost.name ?? messages.calculator.outrosCustos.lineFallback}
                    value={formatFrozenBRL(cost.value)}
                />
            ))}
        </div>
    );
}

/** The date and the formula version, labelled (A29 / FR-506) — plus the two-shelf rule in plain
 *  words, because the seller has every reason to expect the number to have moved, and it did not.
 *  The "abrir origem" affordance (T019) appears ONLY when `origin` resolved: a captured name whose
 *  id no longer exists shows its name but offers no link — never a "produto excluído" claim. */
export function TechnicalSheet({
    payload,
    origin,
}: {
    payload: FrozenSnapshotPayload;
    origin: OriginTarget | null;
}) {
    return (
        <Card className="tf-historico__tech">
            <h2 className="tf-historico__section">{t.techTitle}</h2>
            <span className="tf-historico__meta">
                {t.modelVersionLine.replace("{versao}", payload.modelVersion)}
            </span>
            {/* The CAPTURED name — what the thing was called THEN. It always shows; it is part of the
          frozen document, not a live lookup. */}
            {payload.provenance && (
                <span className="tf-historico__meta">
                    {t.originLine.replace("{nome}", payload.provenance.name)}
                </span>
            )}
            {/* Resolved at read time: present iff the origin still exists. Its ABSENCE is silent — the
          two-shelf rule means a gone origin is not a problem the seller has (FR-503). */}
            {origin?.kind === "PRODUCT" && (
                <Link
                    to="/catalogo"
                    search={{ produto: origin.id }}
                    className="tf-historico__origin-link"
                >
                    {t.openProduct}
                </Link>
            )}
            {origin?.kind === "KIT" && (
                <Link to="/kits" search={{ id: origin.id }} className="tf-historico__origin-link">
                    {t.openKit}
                </Link>
            )}
            <p className="tf-historico__meta">{t.frozenExplainer}</p>
            {/* FR-528, owner decision F2: the snapshot ASSERTS its date; it does not pretend the date was
          VERIFIED. One muted line, here and nowhere else. */}
            <span className="tf-historico__meta">{t.deviceClockNote}</span>
        </Card>
    );
}
