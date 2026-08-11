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

export function useIsWide(): boolean {
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(WIDE_QUERY).matches
      : false;
  const [isWide, setIsWide] = useState<boolean>(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(WIDE_QUERY);
    const onChange = () => setIsWide(mql.matches);
    // Lê uma vez no efeito: entre o primeiro render e o commit a janela pode ter mudado.
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isWide;
}
