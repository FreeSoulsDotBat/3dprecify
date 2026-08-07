import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Icon, InfoTip } from "@/shared/ui";

import "./shopee-warnings.css";

// 016/PR-F (US17, FR-924, T057) — the two Shopee warnings: where the fee is NOT published (the CPF
// regressive fee below R$ 12), and where a real cost is not modelled because it is incalculable in
// advance (the measured-freight retroactive recharge). Both are informational (`role="status"`),
// never blocking, never a fabricated number.
//
// The linear hypothesis (R$ 4 + 0,25 × preço) that fits the two published points is DELIBERATELY
// absent from this module and from the whole codebase (US17-AC2) — a guard elsewhere
// (`shopee-warnings.test.ts`) proves no code path computes it.

const t = messages.calculator.shopeeWarnings;

/**
 * US17-AC1 — Shopee CPF de alto volume com preço abaixo de R$ 12,00 (a banda `CPF_ALTO_VOLUME` só
 * começa ali — abaixo dela o nível fica "sem referência", I9). O aviso cita os DOIS pontos oficiais
 * verbatim do art. 26839 (T057) e o contexto em que valem, e NUNCA aplica uma fórmula.
 */
export function ShopeeRegressiveFeeWarning() {
  return (
    <Alert tone="info" title={t.regressiveTitle} data-testid="shopee-regressive-fee-warning">
      {t.regressiveBody}
    </Alert>
  );
}

/**
 * US17-AC3 — o ajuste de frete aferido (art. 4478): peso/dimensões cadastrados menores que os
 * aferidos pela transportadora geram recobrança retroativa. Puramente informativo: não bloqueia o
 * cálculo, não fabrica um número e não desaparece quando o vendedor edita o formulário (é estático,
 * não depende de nenhum campo).
 *
 * 016/PR-F homologação (A5) — era o `Alert` completo (título + corpo sempre visíveis); a seção
 * Shopee media 1248px a 360px, 48% os dois avisos, e ESTE é o estático (US17-AC3: presente sempre,
 * mesmo depois de editar). Colapsa para UMA linha (título curto + ⓘ InfoTip com o corpo completo) —
 * continua presente, continua acessível (o InfoTip da casa já é teclado/toque), só não ocupa a
 * altura inteira até alguém pedir o detalhe.
 */
export function ShopeeMeasuredFreightWarning() {
  return (
    <div
      className="tf-alert tf-alert--info tf-alert--compact"
      role="status"
      data-testid="shopee-measured-freight-warning"
    >
      <Icon name="info" size={20} className="tf-alert__icon" aria-hidden="true" />
      <p className="tf-alert__title">{t.measuredFreightTitle}</p>
      <InfoTip label={t.measuredFreightTipLabel}>{t.measuredFreightBody}</InfoTip>
    </div>
  );
}
