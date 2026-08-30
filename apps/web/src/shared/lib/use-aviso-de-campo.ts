import { useRef, useState } from "react";

import { avisoDeCampo, licaoDeCampo } from "./plausibilidade";
import { dismissKey, usePlausibilityDismissStore } from "./plausibility-dismiss-store";

export interface UseAvisoDeCampoResult {
  /** O texto do aviso a mostrar, ou `null` quando nada há para avisar (ou já foi dispensado). */
  aviso: string | null;
  /** Espelha o `temErro` recebido — a tela usa para decidir se oferece "Entendi" (14b: não). */
  comErro: boolean;
  /** Handler de blur do campo: nasce aqui o aviso (14a — "ao sair do campo", nunca a cada tecla). */
  onBlur: () => void;
  /** Dispensa ("Entendi") o par campo+valor atual pela sessão. */
  onEntendi: () => void;
}

/**
 * 019/PR-C (T056, prancheta 14) — o aviso de plausibilidade de UM campo, com o ciclo de vida que
 * as pranchetas 14a/14b pedem: nasce no BLUR (nunca no `change`), é dispensável por "Entendi" salvo
 * quando acompanha uma recusa (`temErro`), e um valor novo faz o aviso voltar mesmo já dispensado.
 *
 * Um `ref` segura o valor mais recente digitado — para o `onBlur` ler o valor certo mesmo que o
 * componente tenha re-renderizado no meio do caminho — e só o valor COMPROMETIDO no blur (o
 * `useState`) alimenta o aviso: é essa a diferença entre "dispara a cada tecla" (o defeito de hoje)
 * e "dispara ao sair do campo".
 *
 * Vive em `shared/lib`, não em `features/calculator`: precisa de React (`useRef`/`useState`) e do
 * store de dispensa, e os dois consumidores — `features/calculator` e `widgets/bom-line-editor` (via
 * `ControlledField`) — importam do mesmo lugar que já hospeda `plausibilidade.ts` (a mesma fronteira,
 * ver o cabeçalho daquele arquivo).
 */
export function useAvisoDeCampo(
  nome: string,
  valorBruto: string,
  temErro: boolean,
): UseAvisoDeCampoResult {
  const latest = useRef(valorBruto);
  latest.current = valorBruto;

  const [committed, setCommitted] = useState<string | null>(null);

  const dismissed = usePlausibilityDismissStore((s) => s.dismissed);
  const dismiss = usePlausibilityDismissStore((s) => s.dismiss);

  const texto = committed === null ? null : avisoDeCampo(nome, committed, temErro);
  const key = committed === null ? null : dismissKey(nome, committed);
  // Um aviso que acompanha uma recusa nunca é dispensável (14b) — reaparece enquanto a recusa
  // existir, mesmo que o mesmo par campo+valor já tivesse sido dispensado ANTES de a recusa nascer.
  const suprimidoPelaDispensa = !temErro && key !== null && dismissed.has(key);

  // 019/PR-C (decisão do dono 28/08, prancheta 14b "Erro e aviso juntos") — quando o campo tem
  // erro E lição escrita, é a LIÇÃO que aparece, não "Confira {campo}: {valor}…" com o fecho
  // trocado: independentemente do valor comprometido (a lição não olha para ele) e da dispensa
  // (uma lição que acompanha uma recusa nunca se dispensa). Sem lição para o campo, cai no
  // comportamento de sempre.
  const licao = committed !== null && temErro ? licaoDeCampo(nome) : null;

  return {
    aviso: licao ?? (suprimidoPelaDispensa ? null : texto),
    comErro: temErro,
    onBlur: () => setCommitted(latest.current),
    onEntendi: () => {
      if (key) dismiss(key);
    },
  };
}
