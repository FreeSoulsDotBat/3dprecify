import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useBoms, useCreateBom, useUpdateBom } from "@/entities/bom/use-bom";
import { useProducts } from "@/entities/catalog/use-catalog";
import { freezeBomResult, type FrozenProvenance } from "@/entities/history/frozen-payload";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { AssemblySummary } from "@/features/bom/assembly-summary";
import { composeBom, type ComposerLine } from "@/features/bom/bom-compute";
import { BomLineCard } from "@/features/bom/bom-line-card";
import { computeFromForm } from "@/features/calculator/calculator-model";
import { RecordSnapshotButton } from "@/features/history/record-snapshot-sheet";
import { type CalcFormValues, defaultCalcValues } from "@/features/calculator/calculator-schema";
import { productToForm } from "@/features/calculator/product-mapping";
import { honestWriteError } from "@/shared/api/error-messages";
import type { BomOut, Materialization } from "@/shared/api/generated";
import { PremiumTeaser } from "@/shared/billing/premium-teaser";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useSessionStore } from "@/shared/session/session-store";
import { Alert, Button, EmptyState, Field, Icon, Spinner, toast } from "@/shared/ui";
import { BomLineEditor } from "@/widgets/bom-line-editor/bom-line-editor";
import { PageHeader } from "@/widgets/page-header/page-header";

import {
  defaultPieceName,
  type KitSaveLine,
  lineToForm,
  linesToBomIn,
  savesAsReference,
} from "./kit-save";

// 008/T005+T006 — the /kits page (module stays pages/bom, K1; research R7 wiring): the
// SERVER-INFORMED premium gate
// (ADR-0015 — the composer mounts only on an authoritative `GET /api/v1/entitlement`
// `status = active`, NEVER a local flag) around the BOM composer (US1). The page owns the line
// list; each line's editor is the calculator piece form hosted at the widgets layer; every money
// number comes from `computeFromForm` → `composeBom` (pricing-core) — the view sums nothing.
// Free/signed-out surfaces are the honest US5 teaser (T008); the compute being offline is a SOFT
// boundary and nothing here implies otherwise (ADR-0015 honesty clause).
//
// PR-B adds saving (T015) and reopening (`?id=`), and with them the LAPSED split: a lapsed account
// is no longer teased, because its saved kits are its own data (FR-409, the Q3 freeze).

const t = messages.bom;
const tc = messages.calculator;

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
  /** Reopened on a last-known snapshot because the referenced product was deleted after save
   *  (server `degraded`). Drives the calm caption while the line is still Manual (ux §1.2-D). */
  degraded: boolean;
  /** The name this piece takes in the catalog when it materializes (K4). Empty = use the
   *  "Peça {n} · {kit}" pre-fill; the seller may override it. */
  pieceNameRaw: string;
}

/** Quantity is a finite integer ≥ 0 (contract); anything else marks the line invalid. */
function parseQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** Map a saved kit's server-resolved lines onto the composer's editable LineState. `nextId` mints
 *  the local row ids. Used both when REOPENING a kit and when adopting the CREATE response, so the
 *  two paths can never drift (and post-create adoption needs no second round-trip). */
function kitToLineStates(kit: BomOut, nextId: { current: number }): LineState[] {
  return (kit.lines ?? []).map((line) => {
    const { values, filamentMaterial } = lineToForm(line);
    return {
      id: nextId.current++,
      values,
      quantityRaw: String(line.quantity),
      // A line whose product is still live stays a LIVE reference on the next save; a degraded one
      // (product deleted) has no product to point at and saves as its own piece.
      productId: line.productId ?? "",
      productName: line.pieceName,
      filamentMaterial,
      adjusted: false,
      degraded: line.degraded,
      pieceNameRaw: line.pieceName ?? "",
    };
  });
}

/** A signature of the SERVER-resolved kit — id, name, copy/edit mode, and the full resolved line
 *  content. It changes when a referenced product is edited (D3 live values) OR deleted (D6:
 *  `productId`→null, `degraded`→true), but is byte-stable across an identical background refetch.
 *  The composer re-hydrates only when this changes, so fresh server truth flows in WITHOUT a
 *  same-content refetch clobbering in-progress edits (the PR-B guard, kept). `updatedAt` alone can't
 *  do this: read-time degradation never touches the kit row, so its `updatedAt` stays put. */
function kitSignature(kit: BomOut, duplicating: boolean): string {
  return `${kit.id}|${duplicating ? "copy" : "edit"}|${kit.name}|${JSON.stringify(kit.lines ?? [])}`;
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
  // A never-granted account meets the honest teaser. A LAPSED one does not: its kits are its own
  // data, and the Q3 freeze (FR-409) promises they stay readable — so it reaches the composer,
  // can reopen and recompute, and is told plainly that saving is what needs an active Premium.
  // (PR-A parked this split for PR-B; nothing was saveable back then.)
  if (entitlement.data.status === "none") return <BomGatePanel signedOut={false} />;
  return (
    <BomComposer
      staleEntitlement={entitlement.stale}
      lapsed={entitlement.data.status === "lapsed"}
    />
  );
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

/** The never-granted / signed-out door — the honest US5 teaser (T008). A LAPSED account does not
 *  come here (PR-B): it keeps reading and recomputing its saved kits (FR-409). */
function BomGatePanel({ signedOut }: { signedOut: boolean }) {
  return (
    <GateShell>
      <PremiumTeaser feature="KITS" signedOut={signedOut} />
    </GateShell>
  );
}

function BomComposer({ staleEntitlement, lapsed }: { staleEntitlement: boolean; lapsed: boolean }) {
  const products = useProducts();
  const { catalog, source, refreshFailed, refreshing, refetch: retryCatalog } = useFeeCatalog();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { id?: string; copy?: boolean };
  const savedKits = useBoms();
  const createBom = useCreateBom();
  const updateBom = useUpdateBom();
  const [lines, setLines] = useState<LineState[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [kitName, setKitName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [materializations, setMaterializations] = useState<Materialization[] | null>(null);
  const nextId = useRef(1);

  // Reopen (`/kits?id=…`): hydrate the composer from the SAVED kit. Its lines arrive with values
  // already resolved by the server (live product, or last-known snapshot when degraded), and the
  // price is recomputed right here from those inputs — no price was ever stored (FR-407).
  const openedKit = search.id ? savedKits.items.find((k) => k.id === search.id) : undefined;
  // Duplicating (US4) loads the same inputs but is NOT editing anything: the save creates a new
  // kit. The seller reviews the copy and saves it — a duplicate is never written behind their back.
  const duplicating = Boolean(search.copy) && Boolean(openedKit);
  const editing = duplicating ? undefined : openedKit;
  /** The signature of the server-resolved kit we last hydrated from. Re-hydrating only when it
   *  CHANGES lets fresh server truth (a referenced product edited or deleted) flow into an open
   *  composer, while an identical background refetch is a no-op (no clobber). */
  const hydratedSig = useRef<string | null>(null);
  /** The seller has edited since the last hydration — do not overwrite their work when newer
   *  server content arrives (they will see it on the next clean reopen). */
  const dirty = useRef(false);
  /** The kit this composer just created, so a second Salvar edits it instead of filing a copy. */
  const justSavedId = useRef<string | null>(null);
  // Depend on the CONTENT signature (a string), not the `openedKit` object ref: React Query's
  // structural sharing can keep the kit object reference stable across a live→degraded refetch, so
  // an object-ref dependency would miss the re-hydration the whole D6 fix hinges on. The string
  // changes whenever the server-resolved lines change (a referenced product edited or deleted).
  const openedSig = openedKit ? kitSignature(openedKit, duplicating) : null;
  useEffect(() => {
    if (!openedKit || openedSig === null) return;
    if (hydratedSig.current === openedSig) return; // already showing exactly this server truth
    if (dirty.current && hydratedSig.current !== null) return; // keep in-progress edits
    hydratedSig.current = openedSig;
    dirty.current = false;
    setKitName(duplicating ? `${openedKit.name} ${t.copySuffix}` : openedKit.name);
    setLines(kitToLineStates(openedKit, nextId));
  }, [openedSig]);

  // Leaving a saved kit for a fresh composer (the Kits nav tab routes to a bare `/kits`, and the
  // page stays MOUNTED across that search change) must not carry the previous kit's identity: the
  // next Salvar would silently overwrite it instead of filing a new one.
  useEffect(() => {
    if (search.id) return;
    justSavedId.current = null;
    hydratedSig.current = null;
    dirty.current = false;
    setLines([]);
    setKitName("");
    setMaterializations(null);
    setSaveError(null);
  }, [search.id]);

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
  // Lines that did NOT reach the total (invalid field or quantity) — surfaced as an honest note on
  // the headline so a partial kit never reads as a complete price (review 2026-07-12). A quantity-0
  // line is NOT excluded: it still contributed to `bom.lines` as a truthful zero.
  const excludedLineCount = lineResults.filter((r) => r === null).length;

  // 009/T010 — the kit lines a snapshot would freeze, aligned with `bom.lines` (which the engine
  // computes over the VALID lines only, compacted). An excluded line is not silently renumbered
  // into someone else's numbers: it is simply not part of the quote.
  const frozenKitLines = lines
    .map((l, i) => ({
      input: composerLines[i]?.input ?? null,
      quantity: composerLines[i]?.quantity ?? 0,
      name: l.productName?.trim() || null,
    }))
    .filter(
      (
        l,
      ): l is {
        input: NonNullable<ComposerLine["input"]>;
        quantity: number;
        name: string | null;
      } => l.input !== null,
    );
  // Provenance ONLY — never a source of value (the two-shelf rule). A snapshot taken from a saved
  // kit remembers which kit it came from; editing or deleting that kit later changes nothing here.
  const kitProvenance: FrozenProvenance | null =
    openedKit && !duplicating ? { kind: "KIT", id: openedKit.id, name: openedKit.name } : null;

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
    dirty.current = true;
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
        degraded: false,
        pieceNameRaw: "",
      },
    ]);
    setExpandedId(id);
  };

  const updateLine = (id: number, patch: Partial<LineState>) => {
    dirty.current = true;
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const bindProduct = (id: number, productId: string) => {
    dirty.current = true;
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

  const saving = createBom.isPending || updateBom.isPending;

  const save = async () => {
    setSaveError(null);
    setMaterializations(null);
    if (lines.length === 0) return setSaveError(t.saveEmpty);
    if (!kitName.trim()) return setSaveError(t.kitNameRequired);
    if (!allLinesValid) return setSaveError(t.saveInvalid);

    const body = linesToBomIn(kitName, saveLines);
    // A CREATE must not stay a create: tapping Salvar again after a successful save would file the
    // same kit a second time (homologation F2). The id is adopted from the RESPONSE, so the next
    // save replaces that kit — and it is held in a ref rather than waiting for the kit list to
    // refetch, which would leave a window where a second tap still created a duplicate.
    const targetId = editing?.id ?? justSavedId.current;
    try {
      const saved = targetId
        ? await updateBom.mutateAsync({ id: targetId, body })
        : await createBom.mutateAsync(body);
      toast(t.saved, { tone: "success" }); // real 2xx only — never an optimistic fake
      setMaterializations(saved.materializations ?? []);
      if (!targetId) {
        justSavedId.current = saved.id;
        // Adopt the SERVER's version of the just-saved kit straight from the RESPONSE: this shows
        // any superseded values (a referenced piece takes the live product's numbers) immediately,
        // and — crucially — records this exact server truth as the hydrated signature so the reopen
        // effect below does NOT re-run and clobber edits the seller makes after the save (review
        // 2026-07-12). The reopen effect re-hydrates only when the signature CHANGES (a referenced
        // product later edited/deleted), so an ordinary kit-list refetch of the same content is a
        // no-op — the window the old id-nulling reopened stays closed.
        hydratedSig.current = kitSignature(saved, false);
        dirty.current = false;
        setKitName(saved.name);
        setLines(kitToLineStates(saved, nextId));
        void navigate({ to: "/kits", search: { id: saved.id } });
      }
    } catch (err) {
      setSaveError(honestWriteError(err));
    }
  };

  // Lapsed + NOT reopening a saved kit = the CREATE entry, and creating is exactly what a lapse
  // freezes (ADR-0015 gates feature access on `active`; FR-409 only promises the DATA stays
  // readable). Handing a lapsed seller a full composer and letting them discover at "Salvar" that
  // none of it can be kept is a fake affordance — so the create door is a calm reactivation panel
  // that points at the kits they still have (ux §3, the reconciliation the plan asked PR-B to
  // settle). Reopening a saved kit (`?id=`) still lands in the composer below and recomputes.
  if (lapsed && !openedKit) {
    return (
      <GateShell>
        <Alert tone="info" title={t.lapsedTitle}>
          {t.lapsedBody}
        </Alert>
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: "/catalogo", search: { tab: "kits" } })}
        >
          {t.viewKits}
        </Button>
      </GateShell>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <PageHeader title={t.title} description={t.subtitle} />

      {/* The plan re-check failed but the last server answer said active — say so calmly and
          keep the work (the query refetches on focus/reconnect by itself). */}
      {staleEntitlement && <Alert tone="info">{t.guardError}</Alert>}

      {/* Reopened a saved kit while lapsed (FR-409): nothing was deleted, and reading and
          recalculating still work — saving is what needs an active Premium. The save affordance
          stays VISIBLE and answers honestly when tapped, never disabled-and-silent (ux §5). */}
      {lapsed && <Alert tone="info">{t.lapsedBanner}</Alert>}

      {/* The fee catalog feeds EVERY line's per-channel prices, so a failed online refresh is a
          kit-wide condition, not a per-line one — surface it ONCE here (the calculator does the
          same per form). NON-BLOCKING: the saved/seed reference still pre-fills and every price
          computes; this only offers a retry. `refreshFailed` is sticky so it does not blink out
          during the retry's pending window; `refreshing` drives the button spinner. */}
      {refreshFailed && (
        <Alert tone="info" title={tc.channels.refreshErrorTitle}>
          <p>{tc.channels.refreshErrorBody}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => retryCatalog()}
            loading={refreshing}
            className="mt-2"
          >
            {tc.channels.refreshRetry}
          </Button>
        </Alert>
      )}

      {lines.length === 0 ? (
        <EmptyState
          icon="package"
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <div className="flex flex-col items-center gap-2">
              <Button onClick={addLine}>
                <Icon name="plus" size={16} aria-hidden /> {t.addLine}
              </Button>
              {/* A seller with saved kits should reach them from the empty composer, not only from
                  the nav tab (review IA nit, 2026-07-12). */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate({ to: "/catalogo", search: { tab: "kits" } })}
              >
                {t.viewKits}
              </Button>
            </div>
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
                onRemove={() => {
                  dirty.current = true;
                  setLines((prev) => prev.filter((l) => l.id !== line.id));
                }}
                lineResult={lineResults[i]}
                invalid={invalid}
                // Caption only while the degraded line is still Manual — rebinding a saved product
                // (productId set) resolves it live again and retires the caption (ux §1.2-D).
                degraded={line.degraded && line.productId === ""}
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

          {/* ux §1.7/G4: AssemblySummary pins only its COMPACT total as the bottom bar (the
              channel rollup scrolls in normal flow) — so the sticky lives inside it, not here. */}
          <AssemblySummary bom={bom} uiSkipped={uiSkipped} excludedLineCount={excludedLineCount} />

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
                    onChange={(e) => {
                      dirty.current = true;
                      setKitName(e.target.value);
                    }}
                  />
                </div>
              )}
            </Field>
            {/* While lapsed, a refused save is the EXPECTED answer, not a failure — the rest of
                the lapse surface is calm and this must not be the one red thing on it. */}
            {saveError && <Alert tone={lapsed ? "info" : "danger"}>{saveError}</Alert>}
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? t.saving : t.save}
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
