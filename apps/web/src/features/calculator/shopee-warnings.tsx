import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, InfoTip } from "@/shared/ui";

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
 *
 * 019/T021 — a variante `compact` nasceu aqui, local, com uma geometria (8/12px, centrado); a folha
 * do design a redefiniu no DS com outra (12px/8px, `flex-start`). Promovida: `<Alert compact>` é o
 * dono; a cópia local morreu (guarda `tf-class-uniqueness`). O ⓘ segue INLINE no título para a
 * linha continuar UMA (a razão de ser da A5); a diferença de geometria (~8px) é re-medida a 360px.
 */
export function ShopeeMeasuredFreightWarning() {
  return (
    <Alert
      tone="info"
      compact
      data-testid="shopee-measured-freight-warning"
      title={
        <>
          {t.measuredFreightTitle}{" "}
          <InfoTip label={t.measuredFreightTipLabel}>{t.measuredFreightBody}</InfoTip>
        </>
      }
    />
  );
}
