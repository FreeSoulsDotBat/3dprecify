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
import type { ChannelSlot, OtherCost, ProductIn, ProductOut } from "@/shared/api/generated";
import { premiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatDayMonthPtBr } from "@/shared/lib/format-date";
import { NAME_MAX, nameNormKey } from "@/shared/lib/name-norm";
import { useSessionStore } from "@/shared/session/session-store";
import {
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
// permanece PURO/testável por prop); `recomputed`/`changed` chegam prontos de
// `pages/catalogo/catalogo-page.tsx`. A LISTA nunca escreve nada (correção de fidelidade,
// achado da homologação): o aviso "custo hoje > fixado" e "Manter {valor}"/"Aceitar novo preço"
// vivem só no ITEM ABERTO (`pages/catalogo/produto-page.tsx`, prancheta 17c/16b·2) — nenhuma
// prancheta desenha os dois blocos aqui.

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
}

export function ProductsPanel({
    recomputed = new Map(),
    observations = new Map(),
    changed = new Map(),
    changedCount = 0,
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
            filamentValues: duplicateTarget.filamentValues,
            printerValues: duplicateTarget.printerValues,
            pieceInputs: duplicateTarget.pieceInputs,
            tariffPerKwh: duplicateTarget.tariffPerKwh,
            includeMarketplace: duplicateTarget.includeMarketplace,
            // Os DOIS casts restantes têm causa raiz nomeada (pendência 4 do relatório): o Out do
            // backend serializa channels/otherCosts como dict sem tipo, então o Orval gera um item
            // solto sem `marketplace`. Tipar o Out mudaria o OpenAPI (drift-guard) — decisão de
            // contrato, não de legibilidade. Os outros 3 casts deste bloco caíram: eram atribuíveis.
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

    return (
        <>
            {changedCount > 0 && (
                <Aviso data-testid="products-price-changed-banner">
                    {changedCount === 1
                        ? catalogo.priceChangedOne
                        : catalogo.priceChangedCount.replace("{n}", String(changedCount))}
                </Aviso>
            )}

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
                    productSummary(
                        p,
                        nameOf(p.filamentId, "filament"),
                        nameOf(p.printerId, "printer"),
                        {
                            filaments: filamentsLoading,
                            printers: printersLoading,
                        },
                    )
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
                onCreateNavigate={() =>
                    void navigate({ to: "/catalogo", search: { produto: "novo" } })
                }
                onEditNavigate={(p) =>
                    void navigate({ to: "/catalogo", search: { produto: p.id } })
                }
                onDuplicate={gate === "active" ? openDuplicate : undefined}
                remove={gate === "active" ? (id) => remove.mutateAsync(id) : undefined}
                deleting={remove.isPending}
            />

            {/* 17d — duplicar: o nome vem pré-preenchido com o sufixo "(cópia)"; herda tudo (o wire
          acima), exceto a data (novo produto = hoje) e o preço fixado (fora do tipo `ProductIn`). */}
            <Dialog
                open={duplicateTarget !== null}
                onOpenChange={(open) => !open && closeDuplicate()}
            >
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
                            <BreakdownRow
                                label={catalogo.inherits}
                                sublabel={catalogo.inheritsBody}
                            />
                            <BreakdownRow
                                label={catalogo.notInherits}
                                sublabel={catalogo.notInheritsBody}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={closeDuplicate}>
                                    {cf.cancel}
                                </Button>
                                <Button
                                    loading={create.isPending}
                                    onClick={() => void handleDuplicate()}
                                >
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
