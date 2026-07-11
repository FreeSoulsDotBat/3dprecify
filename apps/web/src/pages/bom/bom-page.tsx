import { useRef, useState } from "react";

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

// 008/T005+T006 — the /bom page (research R7 wiring): the SERVER-INFORMED premium gate
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
  const signedOut = sessionStatus !== "authenticated";
  const entitlement = useEntitlement();

  if (signedOut) return <BomGatePanel signedOut />;
  if (entitlement.isError) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <PageHeader title={t.title} />
        {/* A network failure is NOT "not premium" — honest retry, never composer, never teaser. */}
        <Alert tone="info">{t.guardError}</Alert>
        <Button variant="secondary" onClick={() => void entitlement.refetch()}>
          {t.guardRetry}
        </Button>
      </section>
    );
  }
  if (!entitlement.data) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <PageHeader title={t.title} />
        <div className="flex flex-col items-center gap-2 py-8">
          <Spinner />
          <p className="text-sm text-[var(--text-muted)]">{t.guardChecking}</p>
        </div>
      </section>
    );
  }
  if (entitlement.data.status !== "active") return <BomGatePanel signedOut={false} />;
  return <BomComposer />;
}

/** Free/lapsed/signed-out door — the honest US5 teaser (T008). PR-A note: lapsed lands here
 *  because no saved BOMs can exist yet; PR-B splits lapsed into the read-only saved list
 *  (FR-409 reconciliation flagged in ux §3 — an owner call recorded for the PR-B slice). */
function BomGatePanel({ signedOut }: { signedOut: boolean }) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} />
      <BomTeaser signedOut={signedOut} />
    </section>
  );
}

function BomComposer() {
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

          <AssemblySummary bom={bom} />
        </>
      )}
    </section>
  );
}
