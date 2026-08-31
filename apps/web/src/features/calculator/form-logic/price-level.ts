// The "varejo | atacado" price-level selection logic shared by PriceResults/ChannelPriceBlocks,
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import type { PriceHeroTone } from "@/shared/ui";

/** 019/PR-F (T142, prancheta 10) — o nível de preço que o `<Segmented split>` governa: o cartão
 *  grande, a linha-resumo do outro nível e os números de cada marketplace leem TODOS o mesmo
 *  `level`. Estado só de apresentação (nunca RHF) — nenhuma aritmética nova, é seleção de qual
 *  campo já calculado o cartão mostra. */
export type PriceLevel = "varejo" | "atacado";

/** 019/PR-F (T142, prancheta 10a) — o corpo do cartão grande (accent no varejo, superfície
 *  NEUTRA no atacado escolhido: a diferença entre os dois é cor, não corpo — o mesmo tamanho, um
 *  preço por vez). `PriceHeroTone` ainda não tinha um tom neutro-com-borda; ver price-hero.css. */
export const HERO_TONE: Record<PriceLevel, PriceHeroTone> = {
    varejo: "accent",
    atacado: "neutral",
};

/** 019/PR-F (10b) — "seis dígitos entram no corpo médio; o corpo grande fica para os valores de
 *  até quatro dígitos". Medido pela prancheta, não pela largura de tela: R$ 950.096,00 (6 dígitos)
 *  cabe no `md` sem rolagem; um preço de 4 dígitos usa o `lg` sempre que existir espaço. */
export function heroSizeFor(value: number): "md" | "lg" {
    return Math.floor(Math.abs(value)).toString().length > 4 ? "md" : "lg";
}
