import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
    type BomIn,
    type BomOut,
    createBomApiV1BomsPost,
    deleteBomApiV1BomsBomIdDelete,
    listBomsApiV1BomsGet,
    updateBomApiV1BomsBomIdPut,
} from "@/shared/api/generated";
import { type ApiError } from "@/shared/api/transport";
import { useSessionStore } from "@/shared/session/session-store";

import { bomQueryKey, loadCachedBoms, persistCachedBoms } from "./bom-cache";

// A kit write materializes catalog products (ADR-0017), so it must invalidate the products list.
// That key is OWNED by entities/catalog (`catalogQueryKey("products", uid)`), but FSD-Lite forbids
// an entity importing another entity (eslint-boundaries), so — exactly like bom-cache mirrors
// catalog-cache — we restate the key here as a deliberate mirror. Both copies are pinned by tests
// (use-bom.test.tsx here, catalog-cache.test.ts there) against the SAME literal, so neither can
// drift into invalidating the wrong list. Keep in lockstep with entities/catalog/catalog-cache.
const productsQueryKey = (uid: string | undefined) => ["catalog", "products", uid] as const;

// Saved-kit reads + writes (T014). Reads: uid-keyed cache pre-fill → online refresh → persist,
// with HONEST staleness (a failed online read keeps serving the device cache and raises `stale`
// so the surface can say "pode estar desatualizado"). Writes are ONLINE-ONLY — the server is the
// entitlement boundary (ADR-0015), so there is no optimistic fake to roll back when it denies.
//
// A kit write also MATERIALIZES catalog products (ADR-0017), which is why every write invalidates
// the products query too: the catalog would otherwise keep serving a list that is missing the
// manual products the save just created.

/** The read state a kit surface renders — items + honest load/stale/error flags. */
export interface BomListState {
    items: BomOut[];
    /** First online read in flight with nothing cached yet (show a spinner). */
    isLoading: boolean;
    /** The online read failed AND there is no cache to fall back to (error + retry state). */
    isError: boolean;
    /** The transport error, when present (lets the surface tell an entitlement gate apart). */
    error: ApiError | null;
    /** Serving the device cache because the online read failed — the honest "may be outdated". */
    stale: boolean;
    refetch: () => void;
}

export function useBoms(): BomListState {
    const status = useSessionStore((s) => s.status);
    const uid = useSessionStore((s) => s.user?.uid);

    // Pre-fill from the uid-keyed device cache. It resets to null whenever the uid changes, so
    // account B never flashes account A's kits.
    const [cached, setCached] = useState<BomOut[] | null>(null);
    useEffect(() => {
        let cancelled = false;
        setCached(null);
        if (!uid) return;
        void loadCachedBoms(uid)
            .then((items) => {
                if (!cancelled && items) setCached(items);
            })
            // 015/A5 ([F08-001]) — o pre-carregamento pode falhar (quota estourada, store corrompido,
            // navegacao privada) e a tela sobrevive, porque a consulta online roda de qualquer jeito. O que
            // nao pode e falhar em SILENCIO: sem este catch a rejeicao ficava sem tratador, e o vendedor
            // perdia o pre-preenchimento e o boot offline sem ninguem ficar sabendo. O `outbox.ts:121` ja
            // fazia o certo com `then(run, run)`; os seis pre-carregamentos nao herdaram.
            .catch((erro: unknown) => {
                console.warn("[cache] pre-carregamento de kits falhou; seguindo pela rede", erro);
            });
        return () => {
            cancelled = true;
        };
    }, [uid]);

    const query = useQuery({
        queryKey: bomQueryKey(uid),
        enabled: status === "authenticated" && !!uid,
        retry: false,
        staleTime: 5 * 60_000,
        queryFn: async () => {
            const res = await listBomsApiV1BomsGet();
            // The transport throws a typed ApiError on any non-2xx, so only the 200 branch is reachable.
            if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
            return res.data;
        },
    });

    const fetched = query.data;
    useEffect(() => {
        if (fetched && uid) void persistCachedBoms(uid, fetched);
    }, [fetched, uid]);

    const items = query.data ?? cached ?? [];
    return {
        items,
        // qa pós-016 (13-B/13-D) — as linhas idênticas ao use-catalog, com o mesmo furo do cache
        // `[]` nos dois estados; mesma correção (precedente use-history.ts, estados exaustivos).
        isLoading: query.isFetching && items.length === 0,
        isError: query.isError && items.length === 0,
        error: (query.error as ApiError | null) ?? null,
        stale: query.isError && query.data === undefined && items.length > 0,
        refetch: () => void query.refetch(),
    };
}

/** Invalidate the kit list AND the product list after a successful write. The products half is
 *  not incidental: a kit save materializes manual products (ADR-0017), so a catalog that did not
 *  refresh would be quietly missing rows the save just created. */
function useInvalidateAfterKitWrite(): () => void {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);
    return () => {
        void client.invalidateQueries({ queryKey: bomQueryKey(uid) });
        void client.invalidateQueries({ queryKey: productsQueryKey(uid) });
    };
}

export function useCreateBom(): UseMutationResult<BomOut, ApiError, BomIn> {
    const invalidate = useInvalidateAfterKitWrite();
    return useMutation({
        mutationFn: async (body: BomIn) => {
            const res = await createBomApiV1BomsPost(body);
            if (res.status !== 201) throw new Error("unreachable: non-2xx surfaces as ApiError");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

export function useUpdateBom(): UseMutationResult<BomOut, ApiError, { id: string; body: BomIn }> {
    const invalidate = useInvalidateAfterKitWrite();
    return useMutation({
        mutationFn: async ({ id, body }: { id: string; body: BomIn }) => {
            const res = await updateBomApiV1BomsBomIdPut(id, body);
            if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
            return res.data;
        },
        onSuccess: invalidate,
    });
}

export function useDeleteBom(): UseMutationResult<void, ApiError, string> {
    const invalidate = useInvalidateAfterKitWrite();
    return useMutation({
        mutationFn: async (id: string) => {
            await deleteBomApiV1BomsBomIdDelete(id);
        },
        onSuccess: invalidate,
    });
}
