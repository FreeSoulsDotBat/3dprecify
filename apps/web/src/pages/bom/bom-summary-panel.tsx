import type { BomResult, PriceInput } from "@3dprecify/pricing-core";

import { freezeBomResult, type FrozenProvenance } from "@/entities/history/frozen-payload";
import { AssemblySummary } from "@/features/bom/assembly-summary";
import type { UiSkippedChannel } from "@/features/bom/channel-rollup";
import { RecordSnapshotButton } from "@/features/history/record-snapshot-sheet";
import type { Materialization } from "@/shared/api/generated";
import { type PremiumGate } from "@/shared/billing/premium-gate";
import { TeaserUpgrade } from "@/shared/billing/teaser-upgrade";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button, Field } from "@/shared/ui";

import type { KitSaveLine } from "./kit-save";

const t = messages.bom;

/** The frozen-kit-lines shape `RecordSnapshotButton`'s `freeze()` closes over (009/T010). */
interface FrozenKitLine {
    input: PriceInput;
    quantity: number;
    name: string | null;
}

// 019/Polish — the right column of `tf-kits-grid` (summary + record + save form), moved verbatim
// out of `bom-page.tsx`'s render (no behavior change) once the page itself passed ~450 lines after
// the earlier extractions.

export function BomSummaryPanel({
    bom,
    uiSkipped,
    excludedLineCount,
    isWide,
    frozenKitLines,
    kitProvenance,
    kitName,
    onKitNameChange,
    saveError,
    lapsed,
    gate,
    onSave,
    saving,
    materializations,
    saveLines,
    onViewKits,
}: {
    bom: BomResult;
    uiSkipped: UiSkippedChannel[];
    excludedLineCount: number;
    isWide: boolean;
    frozenKitLines: FrozenKitLine[];
    kitProvenance: FrozenProvenance | null;
    kitName: string;
    onKitNameChange: (name: string) => void;
    saveError: string | null;
    lapsed: boolean;
    gate: PremiumGate;
    onSave: () => void;
    saving: boolean;
    materializations: Materialization[] | null;
    saveLines: KitSaveLine[];
    onViewKits: () => void;
}) {
    return (
        <div className="tf-kits-grid__aside">
            {/* ux §1.7/G4: AssemblySummary pins only its COMPACT total as the bottom bar (the
                channel rollup scrolls in normal flow) — so the sticky lives inside it, not here.
                018/US3: no desktop a barra do rodapé some e o resumo vira a coluna da direita. */}
            <AssemblySummary
                bom={bom}
                uiSkipped={uiSkipped}
                excludedLineCount={excludedLineCount}
                variant={isWide ? "column" : "pinned"}
            />

            {/* 009/T010 — record the kit as a quote (Q2: kits are recordable from PR-A). This is NOT
              the kit save: saving a kit puts a LIVE, recomputing thing in the catalog; recording a
              snapshot freezes what the seller quoted TODAY. The two coexist deliberately. Only the
              lines that reached the total are frozen — a kit quote itemizes its pieces (SC-515),
              and an excluded line has no numbers to itemize. */}
            <div className="flex justify-center">
                <RecordSnapshotButton
                    disabled={frozenKitLines.length === 0}
                    source={{
                        kind: "KIT",
                        // catalogVersion is fee-catalog provenance (I2/Option A). Mirror the SINGLE rule:
                        // null unless a line actually priced a channel from the catalog. Every line shares
                        // the same catalog, so the first non-null line version is the kit's.
                        freeze: () =>
                            freezeBomResult(
                                frozenKitLines,
                                bom,
                                kitProvenance,
                                frozenKitLines.find((l) => l.input.catalogVersion != null)?.input
                                    .catalogVersion ?? null,
                            ),
                    }}
                />
            </div>

            {/* Save (§1.9). No optimistic fake: the toast and the catalog summary below appear only
              after a real 2xx from the server, which is also the entitlement boundary. */}
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] p-4">
                <Field label={t.kitName} required>
                    {(p) => (
                        <div className="tf-inputwrap">
                            <input
                                {...p}
                                type="text"
                                className="tf-input"
                                placeholder={t.kitNamePlaceholder}
                                value={kitName}
                                onChange={(e) => onKitNameChange(e.target.value)}
                            />
                        </div>
                    )}
                </Field>
                {/* While lapsed, a refused save is the EXPECTED answer, not a failure — the rest of
                the lapse surface is calm and this must not be the one red thing on it. */}
                {saveError && <Alert tone={lapsed ? "info" : "danger"}>{saveError}</Alert>}
                {/* 019/PR-B (T046, detalhe 3/prancheta 32b/32e): a frase fica ACIMA da linha de
                  botões (não cabe ao lado do Salvar a 390px) — e é o convite único desta tela
                  enquanto há ≥1 linha (o vazio didático perde o dele, `teaser` default true não
                  aparece aqui porque não há vazio). `unknown` nunca chega aqui (T046 detalhe 4) —
                  os gates de topo da página seguram nesse estado antes do composer montar; ainda
                  assim o `gate !== "active"` do botão abaixo cobre esse caso por segurança. */}
                {gate !== "active" && gate !== "unknown" && (
                    <>
                        <p
                            data-testid="premium-footer-note"
                            className="text-sm text-[var(--text-body)]"
                        >
                            {messages.premiumTeaser.saveIsPartOfPremium}
                        </p>
                        <TeaserUpgrade
                            variant="secondary"
                            price={false}
                            signedOut={gate === "signed-out"}
                            label={
                                gate === "lapsed" ? messages.billing.reactivateAction : undefined
                            }
                        />
                    </>
                )}
                {/* 019/PR-B (T107): a barreira é a AUSÊNCIA do handler, não só o `disabled`. */}
                <Button
                    onClick={gate === "active" ? onSave : undefined}
                    disabled={gate !== "active" || saving}
                >
                    {saving ? t.saving : t.save}
                </Button>

                {materializations && (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium">{t.savedTitle}</p>
                        <ul className="flex flex-col gap-1">
                            {materializations.map((m) => {
                                const name = saveLines[m.position]?.pieceName ?? "";
                                const copy =
                                    m.action === "created" ? t.savedCreated : t.savedReferenced;
                                return (
                                    <li
                                        key={m.position}
                                        className="text-sm text-[var(--text-muted)]"
                                    >
                                        {copy.replace("{nome}", name)}
                                    </li>
                                );
                            })}
                        </ul>
                        {/* The reference wins over the values typed here — say it, never let the seller
                    discover it by finding different numbers on reopen (ADR-0017 §3). */}
                        {materializations.some((m) => m.action === "referenced") && (
                            <Alert tone="info">{t.savedSuperseded}</Alert>
                        )}
                        <Button variant="secondary" onClick={onViewKits}>
                            {t.viewKits}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
