import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  useCreateProduct,
  useDeleteProduct,
  useFilaments,
  usePrinters,
  useProducts,
} from "@/entities/catalog/use-catalog";
import { useEntitlement } from "@/entities/user/use-entitlement";
import { honestWriteError } from "@/shared/api/error-messages";
import type {
  ChannelSlot,
  FilamentValuesInput,
  OtherCost,
  PieceInputsInput,
  PrinterValuesInput,
  ProductIn,
  ProductOut,
} from "@/shared/api/generated";
import { premiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { formatDayMonthPtBr } from "@/shared/lib/format-date";
import { NAME_MAX, nameNormKey } from "@/shared/lib/name-norm";
import { useSessionStore } from "@/shared/session/session-store";
import {
  Alert,
  Aviso,
  BreakdownRow,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Field,
} from "@/shared/ui";

import { productNeedsAttention, productSummary } from "@/entities/catalog/product-summary";

import { CatalogPanel } from "./catalog-panel";
import { productPriceOverFixed } from "./product-price-state";

// Produtos tab wiring (US6/T030): the uid-keyed read cache plugged into the generic premium
// panel in NAVIGATION mode — create/edit live on the full-page route (ux §1.6b), delete keeps
// the confirm Dialog here. The row summary resolves the reference NAMES from the sibling
// caches; a degraded link reads as manual. Never a price in a row (FR-310).
//
// 019/PR-B (T044): `gate` substitui o `lapsed` binário — o painel navega (não tem `renderForm`),
// então só decide vazio didático × lista e o intercept do delete em `gate === "lapsed"`.
//
// 019/PR-D (T076/T124) — o recálculo do Catálogo: nada aqui CHAMA `computeFromForm` nem os hooks
// de `entities/catalog/price-observations` (regra da fatia — hooks só na PAGE, este painel
// permanece PURO/testável por prop); `recomputed`/`changed`/`onFixPrice` chegam prontos de
// `pages/catalogo/catalogo-page.tsx`.

const catalogo = messages.catalogo;
const pf = messages.productForm;
const cf = messages.catalogForm;

export interface ProductsPanelProps {
  /** precoVarejo recomputado HOJE, por id — ausente para um produto degradado (K3) ou enquanto
   *  filamentos/impressoras ainda carregam (a page nunca injeta um mapa "envenenado"). */
  recomputed?: ReadonlyMap<string, number>;
  /** A última observação salva (qualquer produto, inclusive degradado — é o preço "parado"). */
  observations?: ReadonlyMap<string, { observedPrice: number; observedAt: string }>;
  /** Só os produtos cujo preço de hoje difere da última observação (`derivePriceChanges`). */
  changed?: ReadonlyMap<string, { was: number; observedAt: string }>;
  changedCount?: number;
  /** PATCH fixar/desfixar (T076) — a page resolve a mutation; o painel só chama. AUSENTE fora de
   *  `active` é a mesma barreira estrutural de `create`/`update`/`remove` (Constituição IV). */
  onFixPrice?: (id: string, sellerFixedPrice: string | null) => void;
}

export function ProductsPanel({
  recomputed = new Map(),
  observations = new Map(),
  changed = new Map(),
  changedCount = 0,
  onFixPrice,
}: ProductsPanelProps = {}) {
  const list = useProducts();
  const { items: filaments, isLoading: filamentsLoading } = useFilaments();
  const { items: printers, isLoading: printersLoading } = usePrinters();
  const remove = useDeleteProduct();
  const create = useCreateProduct();
  const navigate = useNavigate();
  const entitlement = useEntitlement();
  const gate = premiumGate(entitlement.data, { status: useSessionStore((s) => s.status) });

  const [duplicateTarget, setDuplicateTarget] = useState<ProductOut | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateError, setDuplicateError] = useState<string | undefined>(undefined);

  const nameOf = (id: string | null, kind: "filament" | "printer") => {
    if (!id) return undefined;
    const pool: { id: string; name: string }[] = kind === "filament" ? filaments : printers;
    return pool.find((x) => x.id === id)?.name;
  };

  // 019/PR-D (T076) — o preço da linha: fixado (declaração do vendedor) > parado (última
  // observação, quando existe) > recomputado hoje. Nunca "R$ 0,00": ausência é ausência.
  const priceOf = (p: ProductOut): number | undefined => {
    if (p.sellerFixedPrice != null) {
      const n = Number(p.sellerFixedPrice);
      return Number.isFinite(n) ? n : undefined;
    }
    if (productNeedsAttention(p)) return observations.get(p.id)?.observedPrice;
    return recomputed.get(p.id);
  };

  const wasOf = (p: ProductOut): number | undefined => {
    if (p.sellerFixedPrice != null || productNeedsAttention(p)) return undefined;
    return changed.get(p.id)?.was;
  };

  const flagOf = (p: ProductOut): { kind: "fixed" | "stopped"; label: string } | undefined => {
    if (p.sellerFixedPrice != null) return { kind: "fixed", label: catalogo.fixedFlag };
    if (productNeedsAttention(p)) return { kind: "stopped", label: catalogo.stoppedFlag };
    return undefined;
  };

  const metaOf = (p: ProductOut): string | undefined => {
    if (p.sellerFixedPrice != null && p.sellerFixedAt) {
      return catalogo.fixedSince.replace("{data}", formatDayMonthPtBr(p.sellerFixedAt));
    }
    if (productNeedsAttention(p)) {
      const obs = observations.get(p.id);
      return obs
        ? catalogo.stoppedAtLabel.replace("{data}", formatDayMonthPtBr(obs.observedAt))
        : undefined;
    }
    const obs = observations.get(p.id);
    const savedAt = obs?.observedAt ?? p.updatedAt;
    return catalogo.savedAtLabel.replace("{data}", formatDayMonthPtBr(savedAt));
  };

  const openDuplicate = (p: ProductOut) => {
    setDuplicateTarget(p);
    setDuplicateName(`${p.name}${catalogo.duplicateCopySuffix}`);
    setDuplicateError(undefined);
  };
  const closeDuplicate = () => {
    setDuplicateTarget(null);
    setDuplicateError(undefined);
  };

  const handleDuplicate = async () => {
    if (!duplicateTarget) return;
    const trimmed = duplicateName.trim();
    if (trimmed === "") {
      setDuplicateError(cf.nameRequired);
      return;
    }
    const conflict = list.items.some(
      (p) => p.id !== duplicateTarget.id && nameNormKey(p.name) === nameNormKey(trimmed),
    );
    if (conflict) {
      setDuplicateError(cf.nameConflict);
      return;
    }
    const body: ProductIn = {
      name: trimmed,
      filamentId: duplicateTarget.filamentId,
      printerId: duplicateTarget.printerId,
      filamentValues: duplicateTarget.filamentValues as unknown as FilamentValuesInput,
      printerValues: duplicateTarget.printerValues as unknown as PrinterValuesInput,
      pieceInputs: duplicateTarget.pieceInputs as unknown as PieceInputsInput,
      tariffPerKwh: duplicateTarget.tariffPerKwh,
      includeMarketplace: duplicateTarget.includeMarketplace,
      channels: duplicateTarget.channels as unknown as ChannelSlot[],
      otherCosts: duplicateTarget.otherCosts as unknown as OtherCost[],
      // `sellerFixedPrice` não existe em `ProductIn` — a cópia NUNCA herda o preço fixado, por
      // construção do tipo, não por um `if` que alguém possa esquecer (17d).
    };
    try {
      await create.mutateAsync(body);
      closeDuplicate();
    } catch (err) {
      setDuplicateError(honestWriteError(err));
    }
  };

  // 019/PR-D (T076, 17c/16b·2) — os dois avisos por-item: custo hoje > fixado (a spec US5 AC3
  // vence o desenho, que pinta info — este é `tone="warning"`) e "Manter {valor}" no item que
  // mudou. `onFixPrice` ausente (gate ≠ active) apaga os DOIS blocos — a mesma barreira estrutural
  // de `create`/`update`/`remove`, nunca um botão desabilitado escondendo uma escrita que falharia.
  const overFixedProducts = onFixPrice
    ? list.items.filter((p) => productPriceOverFixed(p, recomputed.get(p.id)))
    : [];
  const keepPriceProducts = onFixPrice
    ? list.items.filter((p) => p.sellerFixedPrice == null && changed.has(p.id))
    : [];

  return (
    <>
      {changedCount > 0 && (
        <Aviso data-testid="products-price-changed-banner">
          {changedCount === 1
            ? catalogo.priceChangedOne
            : catalogo.priceChangedCount.replace("{n}", String(changedCount))}
        </Aviso>
      )}

      {overFixedProducts.map((p) => {
        const hoje = recomputed.get(p.id)!;
        const fixado = Number(p.sellerFixedPrice);
        return (
          <Alert
            key={p.id}
            tone="warning"
            title={p.name}
            data-testid="product-fixed-over-alert"
            action={
              <Button variant="ghost" size="sm" onClick={() => onFixPrice!(p.id, null)}>
                {catalogo.unfix}
              </Button>
            }
          >
            {catalogo.fixedOverNote
              .replace("{hoje}", formatBRL(hoje))
              .replace("{diff}", formatBRL(hoje - fixado))}
          </Alert>
        );
      })}

      {keepPriceProducts.map((p) => {
        const was = changed.get(p.id)!.was;
        return (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <span>{p.name}</span>
            <Button variant="secondary" size="sm" onClick={() => onFixPrice!(p.id, was.toFixed(2))}>
              {catalogo.keepPrice.replace("{valor}", formatBRL(was))}
            </Button>
          </div>
        );
      })}

      <CatalogPanel<ProductOut, never>
        list={list}
        detailKicker={catalogo.detailProduct}
        feature="products"
        gate={gate}
        copy={{
          addLabel: catalogo.addProduct,
          emptyTitle: catalogo.emptyProductsTitle,
          emptyBody: catalogo.emptyProductsBody,
          newTitle: pf.newProduct,
          editTitle: pf.editProduct,
          savedToast: pf.savedProduct,
          count: (n) => catalogo.countProducts.replace("{n}", String(n)),
        }}
        rowName={(p) => p.name}
        rowSummary={(p) =>
          productSummary(p, nameOf(p.filamentId, "filament"), nameOf(p.printerId, "printer"), {
            filaments: filamentsLoading,
            printers: printersLoading,
          })
        }
        // K3: one honest state for a product born manual (materialized by a kit save) and one
        // degraded by a deletion — same missing links, same remedy, so the same calm line.
        rowNote={(p) => (productNeedsAttention(p) ? catalogo.needsAttention : undefined)}
        rowPrice={priceOf}
        rowWas={wasOf}
        rowFlag={flagOf}
        rowMeta={metaOf}
        // 013/F-02: the 2-segment routes are gone (they blanked on cold-load under `base:'./'`).
        // Navigate straight to the `?produto=` shape — going through the deprecated redirect route
        // would still work, but it costs an extra hop and keeps a dead URL alive in history.
        onCreateNavigate={() => void navigate({ to: "/catalogo", search: { produto: "novo" } })}
        onEditNavigate={(p) => void navigate({ to: "/catalogo", search: { produto: p.id } })}
        onDuplicate={gate === "active" ? openDuplicate : undefined}
        remove={gate === "active" ? (id) => remove.mutateAsync(id) : undefined}
        deleting={remove.isPending}
      />

      {/* 17d — duplicar: o nome vem pré-preenchido com o sufixo "(cópia)"; herda tudo (o wire
          acima), exceto a data (novo produto = hoje) e o preço fixado (fora do tipo `ProductIn`). */}
      <Dialog open={duplicateTarget !== null} onOpenChange={(open) => !open && closeDuplicate()}>
        <DialogContent variant="center" data-testid="product-duplicate-dialog">
          {duplicateTarget && (
            <div className="flex flex-col gap-3">
              <DialogTitle>
                {catalogo.duplicateTitle.replace("{nome}", duplicateTarget.name)}
              </DialogTitle>
              <Field
                label={catalogo.copyNameLabel}
                error={duplicateError}
                hint={cf.nameCounter
                  .replace("{n}", String(duplicateName.length))
                  .replace("{max}", String(NAME_MAX))}
              >
                {(p) => (
                  <div className="tf-inputwrap">
                    <input
                      {...p}
                      type="text"
                      className="tf-input"
                      value={duplicateName}
                      maxLength={NAME_MAX}
                      onChange={(e) => setDuplicateName(e.target.value)}
                    />
                  </div>
                )}
              </Field>
              <BreakdownRow label={catalogo.inherits} sublabel={catalogo.inheritsBody} />
              <BreakdownRow label={catalogo.notInherits} sublabel={catalogo.notInheritsBody} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeDuplicate}>
                  {cf.cancel}
                </Button>
                <Button loading={create.isPending} onClick={() => void handleDuplicate()}>
                  {catalogo.duplicate}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
