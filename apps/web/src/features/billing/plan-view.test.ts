import { describe, expect, it } from "vitest";

import { planView } from "./plan-view";

// E6 PR-B (T025/US6) — a Conta é a casa da cobrança, e a regra do painel é uma FUNÇÃO PURA.
//
// SC-708 diz que nenhum estado de cobrança é inferido no cliente. O que o cliente faz é COMPOR duas
// verdades do servidor — o ledger (`GET /entitlement`) e o espelho do PSP (`GET /billing/subscription`)
// — e a clarificação de 2026-07-20 dá a precedência: **a assinatura vence quando existe; a cortesia
// responde quando não há assinatura; e a conta está ativa enquanto QUALQUER grant válido existir.**
//
// Testar isso como função e não pela árvore renderizada é deliberado: são 7 estados × combinações, e
// a asserção que importa é sobre a REGRA. A renderização tem o seu próprio teste, e a homologação
// visual (T028) é que julga a tela — porque um `toContainText` passa sobre um elemento ocluído.

const ativo = (over: Record<string, unknown> = {}) => ({
  status: "active" as const,
  source: "payment",
  expiresAt: "2026-12-31T00:00:00Z",
  ...over,
});

const assinatura = (over: Record<string, unknown> = {}) => ({
  plan: "annual" as const,
  status: "authorized",
  currentPeriodEnd: "2026-12-31T00:00:00Z",
  cancelAtPeriodEnd: false,
  graceUntil: null,
  ...over,
});

describe("planView — a assinatura vence quando existe", () => {
  it("assinatura autorizada → o painel fala de RENOVAÇÃO, com a data do servidor", () => {
    const v = planView({ entitlement: ativo(), subscription: assinatura() });
    expect(v.kind).toBe("subscription-active");
    if (v.kind !== "subscription-active") return;
    expect(v.plan).toBe("annual");
    expect(v.renewsAt).toBe("2026-12-31T00:00:00Z");
  });

  it("cancelada com o período correndo → 'ativo até', NUNCA 'expirado'", () => {
    // O vendedor pagou por este período. Chamar isso de expirado seria a hostilidade que a US4
    // existe para impedir, e o `entitlement` continua `active` justamente por isso.
    const v = planView({
      entitlement: ativo(),
      subscription: assinatura({ status: "cancelled", cancelAtPeriodEnd: true }),
    });
    expect(v.kind).toBe("subscription-canceled");
    if (v.kind !== "subscription-canceled") return;
    expect(v.activeUntil).toBe("2026-12-31T00:00:00Z");
    expect(v.courtesyOutlives).toBe(false);
  });

  it("em carência → a data vem do `graceUntil` DERIVADO, não do fim do período", () => {
    const v = planView({
      entitlement: ativo({ expiresAt: "2027-01-05T00:00:00Z" }),
      subscription: assinatura({ status: "grace", graceUntil: "2027-01-05T00:00:00Z" }),
    });
    expect(v.kind).toBe("grace");
    if (v.kind !== "grace") return;
    expect(v.graceUntil).toBe("2027-01-05T00:00:00Z");
  });

  it("a assinatura vence a CORTESIA — o vendedor gerencia o que ele paga", () => {
    // Ele tem um grant de cortesia E uma assinatura. O painel fala da assinatura, porque é ela que
    // ele pode cancelar e é ela que cobra o cartão dele.
    const v = planView({
      entitlement: ativo({ source: "comp" }),
      subscription: assinatura(),
    });
    expect(v.kind).toBe("subscription-active");
  });
});

describe("planView — sem assinatura, quem responde é o ledger", () => {
  it("cortesia ativa sem assinatura → cortesia, com a fonte do grant", () => {
    const v = planView({ entitlement: ativo({ source: "comp" }), subscription: null });
    expect(v.kind).toBe("courtesy");
    if (v.kind !== "courtesy") return;
    expect(v.source).toBe("comp");
  });

  it("beta é a mesma forma, com a outra fonte", () => {
    const v = planView({ entitlement: ativo({ source: "beta" }), subscription: null });
    expect(v).toMatchObject({ kind: "courtesy", source: "beta" });
  });

  it("lapsed → o congelamento existente, com a garantia de que nada some", () => {
    expect(planView({ entitlement: { status: "lapsed" }, subscription: null }).kind).toBe("lapsed");
  });

  it("nada → gratuito", () => {
    expect(planView({ entitlement: { status: "none" }, subscription: null }).kind).toBe("free");
  });

  it("assinatura PENDENTE não vira premium — quem não pagou não é premium", () => {
    // Um checkout aberto e não concluído não move o ledger (SEC-301). O painel tem de continuar
    // dizendo "Gratuito": exibir a assinatura pendente como plano seria prometer o que não houve.
    const v = planView({
      entitlement: { status: "none" },
      subscription: assinatura({ status: "pending", currentPeriodEnd: null }),
    });
    expect(v.kind).toBe("free");
  });

  it("erro na leitura do ledger → desconhecido, e nunca um palpite", () => {
    expect(planView({ entitlement: undefined, subscription: null, failed: true }).kind).toBe(
      "unknown",
    );
  });

  it("o erro do LEDGER manda mesmo com assinatura em mãos", () => {
    // A assinatura sozinha não decide se há premium — quem decide é o ledger (Constituição IV).
    // Renderizar "Premium ✔" a partir do espelho do PSP seria exatamente o estado inferido no
    // cliente que a SC-708 proíbe.
    const v = planView({ entitlement: undefined, subscription: assinatura(), failed: true });
    expect(v.kind).toBe("unknown");
  });
});

describe("planView — a borda do duplo-grant (ux-billing §4.3 / §10-F1)", () => {
  it("cortesia que SOBREVIVE à assinatura cancelada é sinalizada", () => {
    // "não renova até 31/12" implica um corte em 31/12. Se um grant de cortesia vai além, esse
    // corte NÃO acontece — e a frase, sozinha, engana. A detecção é o `expiresAt` do ledger (o
    // grant válido mais distante) passar do fim do período da assinatura.
    const v = planView({
      entitlement: ativo({ source: "comp", expiresAt: "2027-06-30T00:00:00Z" }),
      subscription: assinatura({ status: "cancelled", cancelAtPeriodEnd: true }),
    });
    expect(v.kind).toBe("subscription-canceled");
    if (v.kind !== "subscription-canceled") return;
    expect(v.courtesyOutlives).toBe(true);
  });

  it("cortesia que termina ANTES não é sinalizada — a frase já está certa", () => {
    const v = planView({
      entitlement: ativo({ source: "comp", expiresAt: "2026-11-30T00:00:00Z" }),
      subscription: assinatura({ status: "cancelled", cancelAtPeriodEnd: true }),
    });
    if (v.kind !== "subscription-canceled") throw new Error("estado errado");
    expect(v.courtesyOutlives).toBe(false);
  });

  it("a MESMA data não é 'sobrevive' — a borda é estrita", () => {
    // Empate significa que os dois acabam juntos: a frase "ativo até 31/12" continua verdadeira, e
    // acrescentar a linha de cortesia prometeria um acesso que não existe no dia seguinte.
    const v = planView({
      entitlement: ativo({ source: "comp", expiresAt: "2026-12-31T00:00:00Z" }),
      subscription: assinatura({ status: "cancelled", cancelAtPeriodEnd: true }),
    });
    if (v.kind !== "subscription-canceled") throw new Error("estado errado");
    expect(v.courtesyOutlives).toBe(false);
  });
});
