import { type ReactNode } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";

import { BILLING_PLANS } from "./plans";

import "./teaser-upgrade.css";

// E6 PR-C (T032/US7) — o pedaço que acende os quatro teasers.
//
// Eles terminavam num beco honesto — sem preço, sem compra — porque a cobrança não existia. Agora
// existe. Este componente é ADITIVO por contrato (§7.2): entra ENTRE a nota "continua grátis" e a
// linha de ações, e não toca no `EmptyState` de cada teaser. Eles foram homologados com tamanhos
// adversariais, e as restrições deles continuam valendo.
//
// Ele mora em `shared/` e não num dos teasers porque os quatro são features IRMÃS, e
// `feature → feature` é proibido por desenho (eslint-boundaries). O `ux-billing` §9-G2 já dava a
// saída — "be lifted to a shared layer if the boundary linter objects" —, e o linter objetou: quatro
// erros, um por teaser. Elevar não foi contorno, foi o caminho escrito.

const t = messages.billing;

/**
 * Para onde o "Assinar" leva.
 *
 * O `ux-billing` §7.1 nomeia `/assinatura`. **Essa rota nunca foi construída** — o PR-A entregou a
 * oferta como um `Sheet` dentro de `/conta`, e é isso que existe. O alvo aqui é o que EXISTE, com o
 * desalinhamento registrado no `tasks.md` em vez de resolvido em silêncio nos dois sentidos (nem
 * criar uma rota que ninguém pediu, nem fingir que o §7.1 já está satisfeito).
 *
 * E leva à OFERTA, não a um checkout: mensal e anual têm preços diferentes, e disparar a compra de
 * um período que o vendedor não escolheu é escolher por ele.
 */
export const TEASER_UPGRADE_TARGET = "/conta?assinar=1";

/**
 * A linha de preço — montada a partir de `BILLING_PLANS`, NUNCA de números redigitados.
 *
 * FR-710/SC-707: uma só fonte. Dois preços diferentes renderizados no mesmo app é bloqueador de
 * release, e ter uma fonte única é o que torna isso impossível em vez de meramente testado. O anual
 * entra pelo EQUIVALENTE mensal (um fato derivado honesto: 155,88 / 12 ≈ 12,99), que é o número que
 * o vendedor usa para comparar — e o R$ 191,88 nunca aparece riscado, porque um "de/por" fabricaria
 * um desconto que nunca existiu.
 */
export function teaserPriceLine(): string {
  return `${t.teaserPriceLead} ${BILLING_PLANS.monthly.price} · ${t.teaserAnnualLead} ${BILLING_PLANS.annual.equivalent}`;
}

export interface TeaserUpgradeProps {
  /** Deslogado: o caminho passa pelo sign-in preservando a intenção. */
  signedOut: boolean;
  className?: string;
}

/**
 * A linha de preço + o "Assinar". Um `<a>` simples, e não o `Link` do router, de propósito: os
 * quatro teasers renderizam dentro de diálogos e painéis que os testes montam SEM contexto de
 * roteador, e um componente que só funciona sob um provider é um componente que ninguém consegue
 * testar isolado.
 */
export function TeaserUpgrade({ signedOut, className }: TeaserUpgradeProps): ReactNode {
  // Sem o `redirect`, quem entra pela oferta cai na home e perde o que veio fazer — o defeito de
  // retorno frio que o `951d714` já consertou uma vez nesta mesma jornada.
  const href = signedOut
    ? `/sign-in?redirect=${encodeURIComponent(TEASER_UPGRADE_TARGET)}`
    : TEASER_UPGRADE_TARGET;

  return (
    <div className={`tf-teaser-upgrade${className ? ` ${className}` : ""}`}>
      <span className="tf-teaser-upgrade__price">{teaserPriceLine()}</span>
      <a className="tf-btn tf-btn--primary tf-btn--sm" href={href}>
        {t.subscribeAction}
      </a>
    </div>
  );
}
