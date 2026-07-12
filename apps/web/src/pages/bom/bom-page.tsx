import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useRef, useState } from "react";

import { useCreateBom } from "@/entities/bom/use-bom";
import { useProducts } from "@/entities/catalog/use-catalog";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { AssemblySummary } from "@/features/bom/assembly-summary";
import { composeBom, type ComposerLine } from "@/features/bom/bom-compute";
import { BomLineCard } from "@/features/bom/bom-line-card";
import { BomTeaser } from "@/features/bom/bom-teaser";
import { computeFromForm } from "@/features/calculator/calculator-model";
import { type CalcFormValues, defaultCalcValues } from "@/features/calculator/calculator-schema";
import { productToForm } from "@/features/calculator/product-mapping";
import { honestWriteError } from "@/shared/api/error-messages";
import type { Materialization } from "@/shared/api/generated";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Button, EmptyState, Field, Icon, Spinner, toast } from "@/shared/ui";
import { BomLineEditor } from "@/widgets/bom-line-editor/bom-line-editor";
import { PageHeader } from "@/widgets/page-header/page-header";

import { defaultPieceName, type KitSaveLine, linesToBomIn, savesAsReference } from "./kit-save";

// 008/T005+T006 — the /kits page (module stays pages/bom, K1; research R7 wiring): the
// SERVER-INFORMED premium gate
// (ADR-0015 — the composer mounts only on an authoritative `GET /api/v1/entitlement`
// `status = active`, NEVER a local flag) around the BOM composer (US1). The page owns the line
// list; each line's editor is the calculator piece form hosted at the widgets layer; every money
// number comes from `computeFromForm` → `composeBom` (pricing-core) — the view sums nothing.
// Free/lapsed/signed-out surfaces are the honest US5 teaser (T008); the compute being offline is
// a SOFT boundary and nothing here implies otherwise (ADR-0015 honesty clause).

const t = messages.bom;

interface LineState {
  id: number;
  values: CalcFormValues;
  quantityRaw: string;
  /** Bound product id; "" = ad-hoc. Binding pre-fills `values` from the LIVE product (Q2). */
  productId: string;
  productName: string | null;
  /** Optional filament label carried from the bound product (kept so a materialized piece
   *  does not lose it). */
  filamentMaterial: string | null;
  /** A bound line's fields were edited after binding (drives the "ajustado por você" seal). */
  adjusted: boolean;
  /** The name this piece takes in the catalog when it materializes (K4). Empty = use the
   *  "Peça {n} · {kit}" pre-fill; the seller may override it. */
  pieceNameRaw: string;
}

/** Quantity is a finite integer ≥ 0 (contract); anything else marks the line invalid. */
function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

export function BomPage() {
  const sessionStatus = useSessionStore((s) => s.status);
  const entitlement = useEntitlement();

  // Session bootstrap is not "signed out" — a premium user must never flash the teaser (review
  // minor, 2026-07-11).
  if (sessionStatus === "loading") return <GateChecking />;
  if (sessionStatus !== "authenticated") return <BomGatePanel signedOut />;
  // The retry wall is ONLY for "no server answer at all". A failed BACKGROUND refetch keeps the
  // last server answer in `data` (React Query v5) — tearing the composer down there would destroy
  // every composed line (review major, 2026-07-11); the guard stays server-informed on the
  // last-known response (the ux §0.1 offline-active row depends on exactly that).
  if (entitlement.isError && !entitlement.data) {
    return (
      <GateShell>
        <Alert tone="info">{t.guardError}</Alert>
        <Button variant="secondary" onClick={() => void entitlement.refetch()}>
          {t.guardRetry}
        </Button>
      </GateShell>
    );
  }
  if (!entitlement.data) return <GateChecking />;
  if (entitlement.data.status !== "active") return <BomGatePanel signedOut={false} />;
  return <BomComposer staleEntitlement={entitlement.isError} />;
}

/** Shared page shell for every gate state (one PageHeader, no drift between branches). */
function GateShell({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} />
      {children}
    </section>
  );
}

function GateChecking() {
  return (
    <GateShell>
      <div className="flex flex-col items-center gap-2 py-8">
        <Spinner />
        <p className="text-sm text-[var(--text-muted)]">{t.guardChecking}</p>
      </div>
    </GateShell>
  );
}

/** Free/lapsed/signed-out door — the honest US5 teaser (T008). PR-A note: lapsed lands here
 *  because no saved kits can exist yet; PR-B splits lapsed into the read-only saved list
 *  (FR-409 reconciliation flagged in ux §3 — an owner call recorded for the PR-B slice). */
function BomGatePanel({ signedOut }: { signedOut: boolean }) {
  return (
    <GateShell>
      <BomTeaser signedOut={signedOut} />
    </GateShell>
  );
}

function BomComposer({ staleEntitlement }: { staleEntitlement: boolean }) {
  const products = useProducts();
  const { catalog, source } = useFeeCatalog();
  const navigate = useNavigate();
  const createBom = useCreateBom();
  const [lines, setLines] = useState<LineState[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [kitName, setKitName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [materializations, setMaterializations] = useState<Materialization[] | null>(null);
  const nextId = useRef(1);

  // One computeFromForm pass per line (the SAME parse the calculator uses — R7 seam), then the
  // canonical assembly over the exact PriceInputs. Invalid lines (bad field OR bad qty) pass a
  // null input: excluded from the total, captioned on the card — never a silent zero.
  const ctx = { catalog, source, now: Date.now() };
  const outcomes = lines.map((l) => computeFromForm(l.values, ctx));
  const composerLines: ComposerLine[] = lines.map((l, i) => {
    const qty = parseQuantity(l.quantityRaw);
    return { input: qty === null ? null : outcomes[i].input, quantity: qty ?? 0 };
  });
  const { bom, lineResults } = composeBom(composerLines);

  // T006b top nit (ux §1.7): a FORM-invalid channel slot is rejected by the per-slot validation
  // BEFORE the engine, so it can never reach `skippedLines` — count those per marketplace (on
  // lines that otherwise compute; a fully-invalid line already carries its own caption) and let
  // the rollup surface them honestly. Counts are per LINE, aligned with the engine's rule
  // (review, 2026-07-11): a line counts as skipped for a marketplace only when EVERY one of its
  // slots there is invalid — a line that still summed is never "sem preço". Counts only — no
  // money leaves pricing-core.
  const uiSkippedCounts = new Map<string | null, number>();
  lines.forEach((l, i) => {
    if (parseQuantity(l.quantityRaw) === null || !outcomes[i].ok) return;
    const lineFlags = new Map<string | null, { ok: boolean; bad: boolean }>();
    outcomes[i].channels.forEach((slot, j) => {
      const marketplace = l.values.channels[j]?.marketplace ?? null;
      const flags = lineFlags.get(marketplace) ?? { ok: false, bad: false };
      if (Object.keys(slot.errors).length > 0) flags.bad = true;
      else flags.ok = true;
      lineFlags.set(marketplace, flags);
    });
    lineFlags.forEach((flags, marketplace) => {
      if (flags.bad && !flags.ok) {
        uiSkippedCounts.set(marketplace, (uiSkippedCounts.get(marketplace) ?? 0) + 1);
      }
    });
  });
  const uiSkipped = [...uiSkippedCounts].map(([marketplace, count]) => ({ marketplace, count }));

  const addLine = () => {
    const id = nextId.current++;
    setLines((prev) => [
      ...prev,
      {
        id,
        values: structuredClone(defaultCalcValues),
        quantityRaw: "1",
        productId: "",
        productName: null,
        filamentMaterial: null,
        adjusted: false,
        pieceNameRaw: "",
      },
    ]);
    setExpandedId(id);
  };

  const updateLine = (id: number, patch: Partial<LineState>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const bindProduct = (id: number, productId: string) => {
    if (productId === "") {
      // Unbind → the line stays editable with its current values ("— Manual —", ux §1.2-C).
      updateLine(id, { productId: "", productName: null, adjusted: false });
      return;
    }
    const product = products.items.find((p) => p.id === productId);
    if (!product) return;
    // LIVE reference (Q2): pre-fill from the product's current values via the E2 wire⇄form
    // mapping — the same strings a manual entry would produce (SC-305 lineage). No price stored.
    const bundle = productToForm(product);
    updateLine(id, {
      values: bundle.values,
      productId,
      productName: product.name,
      filamentMaterial: bundle.filamentMaterial,
      adjusted: false,
    });
  };

  // The lines exactly as the save adapter sees them (T015). A line that is bound AND untouched
  // saves as a live reference; every other line materializes as a named catalog piece — including
  // a bound line that was EDITED (ADR-0017's edit-after-bind rule: saving it as a reference would
  // let the live product's values overwrite the adjustment the seller just made).
  const saveLines: KitSaveLine[] = lines.map((l, i) => ({
    values: l.values,
    quantityRaw: l.quantityRaw,
    productId: l.productId,
    productName: l.productName,
    filamentMaterial: l.filamentMaterial,
    adjusted: l.adjusted,
    pieceName: l.pieceNameRaw.trim() || defaultPieceName(i, kitName),
  }));

  const allLinesValid = lines.every(
    (l, i) => parseQuantity(l.quantityRaw) !== null && outcomes[i].ok,
  );

  const save = async () => {
    setSaveError(null);
    setMaterializations(null);
    if (lines.length === 0) return setSaveError(t.saveEmpty);
    if (!kitName.trim()) return setSaveError(t.kitNameRequired);
    if (!allLinesValid) return setSaveError(t.saveInvalid);

    try {
      const saved = await createBom.mutateAsync(linesToBomIn(kitName, saveLines));
      toast(t.saved, { tone: "success" }); // real 2xx only — never an optimistic fake
      setMaterializations(saved.materializations ?? []);
    } catch (err) {
      setSaveError(honestWriteError(err));
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} description={t.subtitle} />

      {/* The plan re-check failed but the last server answer said active — say so calmly and
          keep the work (the query refetches on focus/reconnect by itself). */}
      {staleEntitlement && <Alert tone="info">{t.guardError}</Alert>}

      {lines.length === 0 ? (
        <EmptyState
          icon="package"
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <Button onClick={addLine}>
              <Icon name="plus" size={16} aria-hidden /> {t.addLine}
            </Button>
          }
        />
      ) : (
        <>
          {lines.map((line, i) => {
            const qty = parseQuantity(line.quantityRaw);
            const invalid = qty === null || !outcomes[i].ok;
            return (
              <BomLineCard
                key={line.id}
                index={i + 1}
                name={line.productName}
                quantityRaw={line.quantityRaw}
                onQuantityChange={(raw) => updateLine(line.id, { quantityRaw: raw })}
                expanded={expandedId === line.id}
                onToggle={() => setExpandedId(expandedId === line.id ? null : line.id)}
                onRemove={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                lineResult={lineResults[i]}
                invalid={invalid}
              >
                <BomLineEditor
                  key={`${line.id}:${line.productId}`}
                  values={line.values}
                  onValuesChange={(values) =>
                    updateLine(line.id, { values, adjusted: line.productId !== "" })
                  }
                  products={products.items}
                  productId={line.productId}
                  onBindProduct={(productId) => bindProduct(line.id, productId)}
                  adjusted={line.adjusted}
                />
                {/* Any line that does NOT save as a live reference becomes a catalog piece on
                    save (K4), so it needs a name — and the seller sees that before it happens,
                    never as a surprise row appearing in Produtos. */}
                {!savesAsReference(saveLines[i]) && (
                  <div className="flex flex-col gap-1 pt-2">
                    {line.adjusted && line.productId !== "" && (
                      <p className="text-xs text-[var(--text-muted)]">{t.adjustedBecomesPiece}</p>
                    )}
                    <Field label={t.pieceName}>
                      {(p) => (
                        <div className="tf-inputwrap">
                          <input
                            {...p}
                            type="text"
                            className="tf-input"
                            placeholder={defaultPieceName(i, kitName)}
                            value={line.pieceNameRaw}
                            onChange={(e) => updateLine(line.id, { pieceNameRaw: e.target.value })}
                          />
                        </div>
                      )}
                    </Field>
                  </div>
                )}
              </BomLineCard>
            );
          })}

          <Button variant="secondary" onClick={addLine}>
            <Icon name="plus" size={16} aria-hidden /> {t.addLine}
          </Button>

          <AssemblySummary bom={bom} uiSkipped={uiSkipped} />

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
                    onChange={(e) => setKitName(e.target.value)}
                  />
                </div>
              )}
            </Field>
            {saveError && <Alert tone="danger">{saveError}</Alert>}
            <Button onClick={() => void save()} disabled={createBom.isPending}>
              {createBom.isPending ? t.saving : t.save}
            </Button>

            {materializations && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{t.savedTitle}</p>
                <ul className="flex flex-col gap-1">
                  {materializations.map((m) => {
                    const name = saveLines[m.position]?.pieceName ?? "";
                    const copy = m.action === "created" ? t.savedCreated : t.savedReferenced;
                    return (
                      <li key={m.position} className="text-sm text-[var(--text-muted)]">
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
                <Button
                  variant="secondary"
                  onClick={() => void navigate({ to: "/catalogo", search: { tab: "kits" } })}
                >
                  {t.viewKits}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
