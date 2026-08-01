import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ENTITLEMENT_QUERY_KEY } from "@/entities/user/use-entitlement";
import {
  type SubscriptionOut,
  cancelSubscriptionRouteApiV1BillingSubscriptionCancelPost,
  getSubscriptionApiV1BillingSubscriptionGet,
} from "@/shared/api/generated";
import { useSessionStore } from "@/shared/session/session-store";

// E6 PR-B (T026/US6) — o espelho do PSP que a Conta lê.
//
// Deliberadamente SEM cache de aparelho, ao contrário do `useEntitlement`. Aquele é cacheado porque
// o premium precisa sobreviver a um boot offline (ADR-0018 §9: é a última palavra do SERVIDOR, não
// uma flag do cliente). Este não tem esse dever: quem decide se há premium é o ledger, e uma
// assinatura guardada no aparelho só poderia dizer "não renova" sobre um estado que já mudou. Sem
// resposta, o painel cai para a superfície de entitlement — que é exatamente o que a US6 manda.

export const SUBSCRIPTION_QUERY_KEY = ["billing", "subscription"] as const;

export interface SubscriptionState {
  /** `null` = a conta não tem assinatura (cortesia/gratuita); `undefined` = ainda não se sabe. */
  data: SubscriptionOut | null | undefined;
  isError: boolean;
  isFetching: boolean;
}

export function useSubscription(): SubscriptionState {
  const status = useSessionStore((s) => s.status);
  const q = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: async () => {
      const res = await getSubscriptionApiV1BillingSubscriptionGet();
      // O transporte lança um `ApiError` tipado em qualquer não-2xx — só o 200 chega aqui. O
      // estreitamento é o mesmo do `useEntitlement`, e existe porque o cliente gerado tipa a
      // resposta como união com o envelope de erro.
      if (res.status !== 200) {
        throw new Error("unreachable: non-2xx surfaces as ApiError from the transport");
      }
      return res.data ?? null;
    },
    enabled: status === "authenticated",
    retry: false,
  });
  return { data: q.data, isError: q.isError, isFetching: q.isFetching };
}

/**
 * O cancelamento (US4 → §5 do `ux-billing`). Invalida AS DUAS leituras.
 *
 * A do entitlement também, e não por precaução: o `expiresAt` que a Conta mostra sai do ledger, e
 * uma tela que trocasse o rótulo para "não renova" mantendo a data antiga contaria metade da
 * verdade — a metade que o vendedor usa para decidir se reassina.
 */
export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await cancelSubscriptionRouteApiV1BillingSubscriptionCancelPost();
      if (res.status !== 200) {
        throw new Error("unreachable: non-2xx surfaces as ApiError from the transport");
      }
      return res.data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY }),
      ]);
    },
  });
}
