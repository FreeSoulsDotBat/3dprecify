import { type ReactNode, useRef, useState } from "react";

import { useProducts } from "@/entities/catalog/use-catalog";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { AssemblySummary } from "@/features/bom/assembly-summary";
import { composeBom, type ComposerLine } from "@/features/bom/bom-compute";
import { BomLineCard } from "@/features/bom/bom-line-card";
import { BomTeaser } from "@/features/bom/bom-teaser";
import { computeFromForm } from "@/features/calculator/calculator-model";
import { type CalcFormValues, defaultCalcValues } from "@/features/calculator/calculator-schema";
import { productToForm } from "@/features/calculator/product-mapping";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Button, EmptyState, Icon, Spinner } from "@/shared/ui";
import { BomLineEditor } from "@/widgets/bom-line-editor/bom-line-editor";
import { PageHeader } from "@/widgets/page-header/page-header";

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
  /** A bound line's fields were edited after binding (drives the "ajustado por você" seal). */
  adjusted: boolean;
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
  const [lines, setLines] = useState<LineState[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
        adjusted: false,
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
    updateLine(id, {
      values: productToForm(product).values,
      productId,
      productName: product.name,
      adjusted: false,
    });
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
              </BomLineCard>
            );
          })}

          <Button variant="secondary" onClick={addLine}>
            <Icon name="plus" size={16} aria-hidden /> {t.addLine}
          </Button>

          <AssemblySummary bom={bom} uiSkipped={uiSkipped} />
        </>
      )}
    </section>
  );
}
