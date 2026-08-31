import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect } from "react";

import {
    createFilamentApiV1FilamentsPost,
    createPrinterApiV1PrintersPost,
    createProductApiV1ProductsPost,
    deleteFilamentApiV1FilamentsFilamentIdDelete,
    deletePrinterApiV1PrintersPrinterIdDelete,
    deleteProductApiV1ProductsProductIdDelete,
    fixProductPriceApiV1ProductsProductIdPatch,
    type FilamentIn,
    type FilamentOut,
    listFilamentsApiV1FilamentsGet,
    listPrintersApiV1PrintersGet,
    listProductsApiV1ProductsGet,
    type PrinterIn,
    type PrinterOut,
    type ProductIn,
    type ProductOut,
    updateFilamentApiV1FilamentsFilamentIdPut,
    updatePrinterApiV1PrintersPrinterIdPut,
    updateProductApiV1ProductsProductIdPut,
} from "@/shared/api/generated";
import { type ApiError, unreachableStatus } from "@/shared/api/transport";
import { useCachedPreload } from "@/shared/lib/use-cached-preload";
import { useSessionStore } from "@/shared/session/session-store";

import {
    type CatalogResource,
    catalogQueryKey,
    loadCachedCatalog,
    persistCachedCatalog,
} from "./catalog-cache";

// The catalog read hooks + write mutations (T018). Reads follow the fee-catalog resolution shape
// (uid-keyed cache pre-fill → online refresh → persist) but WITHOUT a seed and WITH honest
// staleness: when the online read fails and a device cache exists, we keep serving it and raise
// `stale` so the surface can show the offline banner (Q2). Writes are ONLINE-ONLY: they call the
// generated client (which throws a typed ApiError offline / on a server deny), and on a real 2xx
// they invalidate the uid-keyed query so the list refreshes — no optimistic fake.

/** The read state a catalog surface renders — items + honest load/stale/error flags. */
export interface CatalogListState<T> {
    items: T[];
    /** First online read in flight with nothing cached yet (show a spinner). */
    isLoading: boolean;
    /** The online read failed AND there is no cache to fall back to (show the error+retry state). */
    isError: boolean;
    /** The transport error, when one is present (lets the surface tell an entitlement gate apart). */
    error: ApiError | null;
    /** Serving the device cache because the online read failed — the honest "may be outdated" state. */
    stale: boolean;
    refetch: () => void;
}

type CatalogItem = FilamentOut | PrinterOut | ProductOut;

/** Shared read hook: uid-keyed Query + idb pre-fill/persist + honest staleness. The generated list
 *  clients return a status-discriminated union; we narrow on 200 (the only branch the transport can
 *  reach, since it throws a typed ApiError on any non-2xx) and cast the payload to the item type. */
function useCatalogList<T extends CatalogItem>(
    resource: CatalogResource,
    listFn: () => Promise<{ status: number; data: unknown }>,
): CatalogListState<T> {
    const status = useSessionStore((s) => s.status);
    const uid = useSessionStore((s) => s.user?.uid);

    // Pre-fill from the uid-keyed device cache (no seed — empty until the first online read). The
    // cache resets to null whenever the uid changes so account B never flashes account A's items.
    const cached = useCachedPreload(
        loadCachedCatalog<T>,
        // `uid!`: safe — `enabled` below gates the actual call, so this is never dereferenced while
        // undefined; it only needs to be a stable dep for the reset-on-change effect.
        [resource, uid!] as const,
        !!uid,
        "[cache] pre-carregamento de catalogo falhou; seguindo pela rede",
    );

    const query = useQuery({
        queryKey: catalogQueryKey(resource, uid),
        enabled: status === "authenticated" && !!uid,
        retry: false,
        staleTime: 5 * 60_000,
        queryFn: async () => {
            const res = await listFn();
            // The transport throws a typed ApiError on any non-2xx, so only the 200 branch is reachable.
            if (res.status !== 200) throw unreachableStatus("listFn");
            return res.data as T[];
        },
    });

    // Persist every successful online read under the uid key (offline read after load, R5).
    const fetched = query.data;
    useEffect(() => {
        if (fetched && uid) void persistCachedCatalog(resource, uid, fetched);
    }, [fetched, resource, uid]);

    const items = (query.data ?? cached ?? []) as T[];
    return {
        items,
        // qa pós-016 (13-B/13-D) — `cached === null` era um portão FURADO nos DOIS estados: uma
        // leitura bem-sucedida de catálogo VAZIO persiste `[]`, e na visita seguinte `[]` !== null
        // (a) silenciava o erro para SEMPRE e (b) pulava o loading durante a janela de RETRY do
        // React Query — o painel afirmava "Nenhum salvo ainda" enquanto a leitura ainda tentava.
        // A forma certa já morava em use-history.ts: os quatro estados ficam exaustivos —
        // buscando sem nada = loading · erro sem nada = erro · erro com algo = stale ·
        // sucesso com zero = vazio.
        isLoading: query.isFetching && items.length === 0,
        isError: query.isError && items.length === 0,
        error: (query.error as ApiError | null) ?? null,
        // Honest staleness: the online read errored but the device cache still answers.
        stale: query.isError && query.data === undefined && items.length > 0,
        refetch: () => void query.refetch(),
    };
}

export function useFilaments(): CatalogListState<FilamentOut> {
    return useCatalogList<FilamentOut>("filaments", listFilamentsApiV1FilamentsGet);
}

export function usePrinters(): CatalogListState<PrinterOut> {
    return useCatalogList<PrinterOut>("printers", listPrintersApiV1PrintersGet);
}

export function useProducts(): CatalogListState<ProductOut> {
    return useCatalogList<ProductOut>("products", listProductsApiV1ProductsGet);
}

/** Invalidate the uid-keyed query for a resource after a successful write (never optimistic). */
function useInvalidateCatalog(resource: CatalogResource): () => void {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);
    return () => void client.invalidateQueries({ queryKey: catalogQueryKey(resource, uid) });
}

// A product EDIT or DELETE ripples into any saved kit that references it: the kit resolves the
// product live on every read (D3 live-reflect / D6 read-time degrade — the kit's own row is
// untouched, only its resolved view changes). If the kits list does not refetch, a reopened kit
// keeps serving stale values, or a deleted product as a LIVE reference — the inverse honesty bug
// the PR-C homologation caught. The kits key is OWNED by entities/bom (`bomQueryKey`), but FSD-Lite
// forbids importing another entity (eslint-boundaries), so — exactly as entities/bom mirrors the
// products key — we restate it here as a deliberate mirror, pinned by a test against the SAME
// literal. Keep in lockstep with entities/bom/bom-cache `bomQueryKey`.
const bomsQueryKey = (uid: string | undefined) => ["boms", uid] as const;

/** Invalidate the products list AND the kits list after a product write that an existing kit could
 *  be resolving through (update/delete). A create needs only the products half — a brand-new
 *  product is referenced by no kit yet. */
function useInvalidateProductsAndKits(): () => void {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);
    const invalidateProducts = useInvalidateCatalog("products");
    return () => {
        invalidateProducts();
        void client.invalidateQueries({ queryKey: bomsQueryKey(uid) });
    };
}

// ── Filament writes (online-only; a failure surfaces as the mutation's typed ApiError) ──────────

export function useCreateFilament(): UseMutationResult<FilamentOut, ApiError, FilamentIn> {
    const invalidate = useInvalidateCatalog("filaments");
    return useMutation({
        mutationFn: async (body: FilamentIn) => {
            const res = await createFilamentApiV1FilamentsPost(body);
            if (res.status !== 201) throw unreachableStatus("createFilamentApiV1FilamentsPost");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

export function useUpdateFilament(): UseMutationResult<
    FilamentOut,
    ApiError,
    { id: string; body: FilamentIn }
> {
    const invalidate = useInvalidateCatalog("filaments");
    return useMutation({
        mutationFn: async ({ id, body }: { id: string; body: FilamentIn }) => {
            const res = await updateFilamentApiV1FilamentsFilamentIdPut(id, body);
            if (res.status !== 200)
                throw unreachableStatus("updateFilamentApiV1FilamentsFilamentIdPut");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

export function useDeleteFilament(): UseMutationResult<void, ApiError, string> {
    const invalidate = useInvalidateCatalog("filaments");
    const invalidateProducts = useInvalidateCatalog("products");
    return useMutation({
        mutationFn: async (id: string) => {
            await deleteFilamentApiV1FilamentsFilamentIdDelete(id);
        },
        // A filament deletion DEGRADES referencing products server-side (D6) — refresh both lists.
        onSuccess: () => {
            invalidate();
            invalidateProducts();
        },
    });
}

// ── Printer writes (mirror the filament set) ────────────────────────────────────────────────────

export function useCreatePrinter(): UseMutationResult<PrinterOut, ApiError, PrinterIn> {
    const invalidate = useInvalidateCatalog("printers");
    return useMutation({
        mutationFn: async (body: PrinterIn) => {
            const res = await createPrinterApiV1PrintersPost(body);
            if (res.status !== 201) throw unreachableStatus("createPrinterApiV1PrintersPost");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

export function useUpdatePrinter(): UseMutationResult<
    PrinterOut,
    ApiError,
    { id: string; body: PrinterIn }
> {
    const invalidate = useInvalidateCatalog("printers");
    return useMutation({
        mutationFn: async ({ id, body }: { id: string; body: PrinterIn }) => {
            const res = await updatePrinterApiV1PrintersPrinterIdPut(id, body);
            if (res.status !== 200)
                throw unreachableStatus("updatePrinterApiV1PrintersPrinterIdPut");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

export function useDeletePrinter(): UseMutationResult<void, ApiError, string> {
    const invalidate = useInvalidateCatalog("printers");
    const invalidateProducts = useInvalidateCatalog("products");
    return useMutation({
        mutationFn: async (id: string) => {
            await deletePrinterApiV1PrintersPrinterIdDelete(id);
        },
        // A printer deletion DEGRADES referencing products server-side (D6) — refresh both lists.
        onSuccess: () => {
            invalidate();
            invalidateProducts();
        },
    });
}

// ── Product writes (mirror the filament set; US6/T030) ──────────────────────────────────────────

export function useCreateProduct(): UseMutationResult<ProductOut, ApiError, ProductIn> {
    const invalidate = useInvalidateCatalog("products");
    return useMutation({
        mutationFn: async (body: ProductIn) => {
            const res = await createProductApiV1ProductsPost(body);
            if (res.status !== 201) throw unreachableStatus("createProductApiV1ProductsPost");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

export function useUpdateProduct(): UseMutationResult<
    ProductOut,
    ApiError,
    { id: string; body: ProductIn }
> {
    const invalidate = useInvalidateProductsAndKits();
    return useMutation({
        mutationFn: async ({ id, body }: { id: string; body: ProductIn }) => {
            const res = await updateProductApiV1ProductsProductIdPut(id, body);
            if (res.status !== 200)
                throw unreachableStatus("updateProductApiV1ProductsProductIdPut");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

// 019/PR-D (T075, ADR-0033 §3) — fixar/desfixar o preço declarado pelo vendedor. Molde de
// `useUpdateProduct`: invalida a lista de produtos (o recálculo lê `sellerFixedPrice` do
// `ProductOut` fresco) — a atualização do cache IDB uid-keyed acontece pelo MESMO caminho das
// outras mutações desta lista: a invalidação reabre `useCatalogList`, que refaz a leitura online e
// persiste o resultado fresco (`persistCachedCatalog`, linha 111-113 acima) sob a mesma chave.
export function useFixProductPrice(): UseMutationResult<
    ProductOut,
    ApiError,
    { id: string; sellerFixedPrice: string | null }
> {
    const invalidate = useInvalidateCatalog("products");
    return useMutation({
        mutationFn: async ({
            id,
            sellerFixedPrice,
        }: {
            id: string;
            sellerFixedPrice: string | null;
        }) => {
            const res = await fixProductPriceApiV1ProductsProductIdPatch(id, { sellerFixedPrice });
            if (res.status !== 200)
                throw unreachableStatus("fixProductPriceApiV1ProductsProductIdPatch");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

export function useDeleteProduct(): UseMutationResult<void, ApiError, string> {
    // Refresh BOTH lists: the catalog loses the product, and any kit that referenced it must refetch
    // so its line degrades honestly instead of serving a deleted product as live (D6).
    const invalidate = useInvalidateProductsAndKits();
    return useMutation({
        mutationFn: async (id: string) => {
            await deleteProductApiV1ProductsProductIdDelete(id);
        },
        onSuccess: invalidate,
    });
}
