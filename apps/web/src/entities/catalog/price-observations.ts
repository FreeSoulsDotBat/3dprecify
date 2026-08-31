import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

import {
    listPriceObservationsApiV1PriceObservationsGet,
    putPriceObservationsApiV1PriceObservationsPut,
} from "@/shared/api/generated";
import { type ApiError } from "@/shared/api/transport";
import { useOnline } from "@/shared/lib/use-online";
import { useSessionStore } from "@/shared/session/session-store";
import { PRICING_MODEL_VERSION } from "@3dprecify/pricing-core";

// 019/PR-D (T075, ADR-0033 §2, tasks T067/T075/T127) — as observações de preço.
//
// Este módulo é PURO sobre dados: `derivePriceChanges` recebe os preços RECOMPUTADOS por argumento
// (nunca chama o motor sozinho, nunca lê `entities/scenario`/`entities/history`) e nenhuma função
// aqui importa a camada de features — a fronteira FSD-Lite (`entities` só importa `shared` + `@3dprecify/*`)
// é a mesma que o eslint-boundaries cobra. A leitura NÃO ganha cache de dispositivo: é contexto
// ("era R$ …"), nunca fonte do valor exibido, e persistir em IDB duplicaria uma verdade que já mora
// no servidor — por isso `staleTime` curto no lugar de um pré-preenchimento uid-keyed (T127
// registra a ausência na varredura de `providers.test.tsx`).

export type SubjectKind = "PRODUCT" | "KIT";

export interface PriceObservation {
    subjectKind: SubjectKind;
    subjectId: string;
    observedPrice: number;
    observedAt: string;
    modelVersion: string;
    catalogVersion?: string | null;
}

/** Chave estável (kind:id) — usada tanto pelo `Map` de leitura quanto pelo comparador puro. */
export const observationKey = (kind: SubjectKind, id: string): string => `${kind}:${id}`;

export const priceObservationsQueryKey = (uid: string | undefined) =>
    ["price-observations", uid] as const;

export interface UsePriceObservationsResult {
    byKey: ReadonlyMap<string, PriceObservation>;
    isLoading: boolean;
    isError: boolean;
    error: ApiError | null;
    /** 403 `ENTITLEMENT_REQUIRED` — a parede caiu; nunca um erro visível (molde `use-history.ts`). */
    entitlementDenied: boolean;
}

/**
 * A leitura das observações da conta. Autenticação-only (`enabled`); sem pré-carga de IDB (T127) —
 * `staleTime` curto porque o valor é só contexto, não a fonte do preço mostrado.
 */
export function usePriceObservations(): UsePriceObservationsResult {
    const status = useSessionStore((s) => s.status);
    const uid = useSessionStore((s) => s.user?.uid);

    const query = useQuery({
        queryKey: priceObservationsQueryKey(uid),
        enabled: status === "authenticated" && !!uid,
        retry: false,
        staleTime: 30_000,
        queryFn: async () => {
            const res = await listPriceObservationsApiV1PriceObservationsGet();
            if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
            return res.data.items;
        },
    });

    const apiError = (query.error as ApiError | null) ?? null;
    const entitlementDenied = apiError?.code === "ENTITLEMENT_REQUIRED";

    // Identidade estável por resposta: quem depende de `byKey` num `useEffect` (a tela que chama
    // `observe` pós-render) não pode ver um Map novo a cada render.
    const data = query.data;
    const byKey = useMemo(() => {
        const map = new Map<string, PriceObservation>();
        for (const item of data ?? []) {
            map.set(observationKey(item.subjectKind, item.subjectId), {
                subjectKind: item.subjectKind,
                subjectId: item.subjectId,
                observedPrice: Number(item.observedPrice),
                observedAt: item.observedAt,
                modelVersion: item.modelVersion,
                catalogVersion: item.catalogVersion,
            });
        }
        return map;
    }, [data]);

    return {
        byKey,
        isLoading: query.isFetching && query.data === undefined,
        // Um 403 ENTITLEMENT_REQUIRED nunca é "erro" — é a parede, e `entitlementDenied` já a comunica.
        isError: query.isError && !entitlementDenied,
        error: entitlementDenied ? null : apiError,
        entitlementDenied,
    };
}

export interface RecomputedPrice {
    subjectKind: SubjectKind;
    subjectId: string;
    precoVarejo: number;
}

export interface PriceChange {
    subjectKind: SubjectKind;
    subjectId: string;
    was: number;
    now: number;
    observedAt: string;
}

/** Reais → centavos inteiros, para comparar sem o ruído de ponto flutuante. */
function centavos(x: number): number {
    return Math.round(x * 100);
}

/**
 * PURA: compara cada item recomputado com sua observação (quando existe) em CENTAVOS. Um item sem
 * observação não conta — ausência é ausência, nunca "0 mudaram" nem "era R$ 0,00" (ADR-0033 §2).
 */
export function derivePriceChanges(
    recomputed: readonly RecomputedPrice[],
    byKey: ReadonlyMap<string, PriceObservation>,
): { changed: PriceChange[]; count: number } {
    const changed: PriceChange[] = [];
    for (const item of recomputed) {
        const obs = byKey.get(observationKey(item.subjectKind, item.subjectId));
        if (!obs) continue;
        if (centavos(obs.observedPrice) === centavos(item.precoVarejo)) continue;
        changed.push({
            subjectKind: item.subjectKind,
            subjectId: item.subjectId,
            was: obs.observedPrice,
            now: item.precoVarejo,
            observedAt: obs.observedAt,
        });
    }
    return { changed, count: changed.length };
}

/** Assinatura estável de um conjunto — usada só para o dedupe "uma vez por visita" do hook abaixo. */
function signature(items: readonly RecomputedPrice[]): string {
    return items
        .map((i) => `${i.subjectKind}:${i.subjectId}:${i.precoVarejo}`)
        .sort()
        .join("|");
}

export interface UseObservePricesResult {
    observe: (items: readonly RecomputedPrice[], catalogVersion?: string | null) => void;
}

/**
 * O PUT em lote (T075). Chamado pela TELA depois do render bem-sucedido de TODOS os itens
 * recomputáveis daquela visita — um item degradado já vem de FORA do array que a tela monta.
 *
 * Online-only: offline (`useOnline`) não chama nada, e nada vai para o outbox — a observação é
 * best-effort, nunca uma promessa de entrega (ao contrário do Histórico, ADR-0018). Dedupe por
 * ASSINATURA na sessão do hook: o mesmo conjunto de entradas não repete o PUT enquanto o
 * componente ficar montado (o `useRef` morre com o componente — uma nova visita, um novo hook,
 * dedupe zerado). Falha (rede, 403 lapsed) é SILENCIOSA: sem toast/Alert/retry — a marca não avança
 * e a próxima visita simplesmente tenta de novo.
 */
export function useObservePrices(): UseObservePricesResult {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);
    const online = useOnline();
    const lastSignature = useRef<string | null>(null);

    const mutation = useMutation({
        mutationFn: async ({
            items,
            catalogVersion,
        }: {
            items: readonly RecomputedPrice[];
            catalogVersion?: string | null;
        }) => {
            const res = await putPriceObservationsApiV1PriceObservationsPut({
                items: items.map((i) => ({
                    subjectKind: i.subjectKind,
                    subjectId: i.subjectId,
                    observedPrice: i.precoVarejo.toFixed(2),
                    modelVersion: PRICING_MODEL_VERSION,
                    ...(catalogVersion ? { catalogVersion } : {}),
                })),
            });
            if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
            return res.data;
        },
        onSuccess: () => {
            void client.invalidateQueries({ queryKey: priceObservationsQueryKey(uid) });
        },
        // Falha silenciosa por desenho (ADR-0033 §2): nenhum toast/Alert, a marca não avança.
        onError: () => {
            /* silencioso de propósito — a próxima visita tenta de novo */
        },
    });

    return {
        observe: (items, catalogVersion) => {
            if (!online) return;
            if (items.length === 0) return;
            const sig = signature(items);
            if (lastSignature.current === sig) return;
            lastSignature.current = sig;
            mutation.mutate({ items, catalogVersion });
        },
    };
}
