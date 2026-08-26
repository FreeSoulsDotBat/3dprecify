import { useEffect, useState } from "react";

/**
 * 018/ADR-0031 — o **único** gate de largura da composição desktop.
 *
 * As quatro telas do 018 (Catálogo, Kits, Orçamentos, Conta) e o rail do menu ganham composições
 * ESTRUTURALMENTE diferentes acima de 1280px — no mestre-detalhe, clicar num card *seleciona* onde
 * hoje *navega*. Isso é comportamento, não aparência: uma media query esconderia um dos ramos, mas
 * os dois continuariam montados, com dois handlers no mesmo card e dois `PremiumTeaser` na árvore
 * (o invariante "um teaser, nunca dois" do 016/US1 passaria a depender de CSS).
 *
 * **A propriedade que este arquivo existe para garantir**: sem `window`/`matchMedia` a resposta é
 * `false`. Esse é exatamente o ambiente do jsdom, então TODA a suíte existente continua exercitando
 * o ramo de hoje — o mobile do 018 não é código equivalente ao anterior, é o mesmo código. "O mobile
 * não se mexe" deixa de ser disciplina e vira propriedade: abaixo do limiar não existe caminho de
 * render para a composição nova.
 *
 * Custo aceito e declarado: todo teste NOVO de desktop precisa instalar um `matchMedia` largo
 * explicitamente (`shared/lib/match-media.test-helper.ts`).
 *
 * Por que 1280px (dono, clarify 2026-08-10): a 1024px sobram ~700px de conteúdo depois da sidebar
 * de 240px; a ficha do desenho tem 560px, o que deixaria ~140px de lista. A 1280px sobram ~960px.
 *
 * Molde herdado de `useIsMobile` (app/app-shell.tsx), inclusive na defesa contra a ausência de
 * `matchMedia` — ninguém abre um segundo `matchMedia` de largura neste app (ADR-0031, Opção C).
 */
export const WIDE_QUERY = "(min-width: 1280px)";

/**
 * O limiar do rail FORÇADO (2026-08-15) — e ele entra aqui, e não num arquivo novo, porque o
 * ADR-0031 §Follow-ups decidiu exatamente este caso: *"se um dia uma quinta tela quiser um limiar
 * diferente, ela **não** abre um segundo `matchMedia` — estende este hook com um limiar nomeado"*.
 *
 * Por que 600px: entre 426px (o primeiro pixel em que a barra lateral monta) e ~600px, os 240px de
 * menu deixam ~150px de conteúdo, e nada do produto cabe nisso — a homologação mediu a PÁGINA
 * INTEIRA como culpada de 131px de transbordo, não um elemento. Abaixo de 600px o rail de 76px é a
 * única largura de menu que sobra espaço utilizável (426 − 76 − 32 de goteira ≈ 318px).
 *
 * Não conflita com o corte mobile de 425px (`useIsMobile`): abaixo dele não existe barra lateral
 * nenhuma, então na prática esta faixa é 426–599.
 */
export const RAIL_FORCADO_QUERY = "(max-width: 599px)";

/** A leitura defensiva compartilhada: sem `window`/`matchMedia` (o ambiente do jsdom) a resposta é
 *  `false`, que é a propriedade que mantém toda a suíte existente no ramo de hoje (ADR-0031). */
function useMediaQuery(query: string): boolean {
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState<boolean>(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    // Lê uma vez no efeito: entre o primeiro render e o commit a janela pode ter mudado.
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function useIsWide(): boolean {
  return useMediaQuery(WIDE_QUERY);
}

/**
 * A faixa em que o menu é recolhido POR NECESSIDADE, não por escolha do vendedor: abaixo de 600px
 * a barra lateral expandida não deixa espaço para o conteúdo. Sem botão de expandir, porque
 * expandir ali devolveria o transbordo — é uma restrição de espaço, não uma preferência.
 */
export function useRailForcado(): boolean {
  return useMediaQuery(RAIL_FORCADO_QUERY);
}
