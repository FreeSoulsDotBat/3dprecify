// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { PlanActions, planCaption, planDetail, planNote } from "./plan-panel";
import { type PlanState } from "./plan-view";

// E6 PR-B (T025/US6) — a metade de RENDERIZAÇÃO. A regra tem o seu próprio teste (`plan-view`).
//
// Várias asserções aqui são sobre AUSÊNCIA, e não por simetria: as frases deste painel são
// mutuamente excludentes — "Premium expirado" e "ativo até {data}" descrevem realidades opostas — e
// um teste que só confere presença passaria com as duas na tela ao mesmo tempo. É a mesma lição que
// a 014 pagou: presença não prova nada sobre uma mentira.
//
// O que este arquivo NÃO julga é a tela: `toBeVisible` passa sobre um elemento ocluído. Quem
// homologa layout é o T028, com imagem e geometria.

const t = messages.conta;
const b = messages.billing;

const clientes: QueryClient[] = [];
function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clientes.push(client);
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

afterEach(async () => {
  // O mesmo cuidado que a CI cobrou em `use-catalog.test.tsx`: um cliente não encerrado deixa
  // trabalho assíncrono resolvendo depois do teardown do jsdom.
  await Promise.all(clientes.map((c) => c.cancelQueries()));
  for (const c of clientes) {
    c.unmount();
    c.clear();
  }
  clientes.length = 0;
  // E o DOM: sem isto as renderizações se ACUMULAM, e "não deve haver botão Cancelar" falha por
  // causa do teste anterior — um vermelho que aponta para o lugar errado.
  cleanup();
  vi.restoreAllMocks();
});

const ativa: PlanState = {
  kind: "subscription-active",
  plan: "annual",
  renewsAt: "2026-12-31T12:00:00Z",
};
const cancelada = (courtesyOutlives: boolean): PlanState => ({
  kind: "subscription-canceled",
  activeUntil: "2026-12-31T12:00:00Z",
  courtesyOutlives,
});
const carencia: PlanState = { kind: "grace", graceUntil: "2027-01-05T12:00:00Z" };

describe("a legenda do painel diz a verdade de cada estado", () => {
  it("ativa: plano + data de RENOVAÇÃO", () => {
    expect(planDetail(ativa)).toBe(`${b.planPeriods.annual} · ${b.planRenews} 31/12/2026`);
  });

  it("cancelada: 'ativo até' e 'não renova' — e NUNCA 'expirado'", () => {
    const texto = planDetail(cancelada(false))!;
    expect(texto).toContain("31/12/2026");
    expect(texto).toContain(b.planWontRenew);
    // O vendedor pagou por este período. Chamá-lo de expirado seria a hostilidade que a US4 impede,
    // e nenhuma asserção de presença acima notaria a palavra errada convivendo com as certas.
    expect(texto).not.toContain(t.planLapsed);
  });

  it("carência: o badge SEGUE Premium — a queda ainda não aconteceu", () => {
    expect(planCaption(carencia)).toEqual({ badge: t.planPremium, tone: "success" });
    expect(planDetail(carencia)).toBe(b.planGrace);
    expect(planNote(carencia)).toBe(b.planGraceDeadline.replace("{data}", "05/01/2027"));
  });

  it("carência sem data derivada não inventa prazo nenhum", () => {
    // `graceUntil` vem do servidor. Sem ele, a frase "regularize até {data}" ficaria com um
    // literal na tela — pior do que não dizer o prazo.
    expect(planNote({ kind: "grace", graceUntil: null })).toBeNull();
  });
});

describe("a borda do duplo-grant (ux-billing §4.3)", () => {
  it("cortesia que sobrevive: a linha extra aparece", () => {
    expect(planNote(cancelada(true))).toContain(b.planCourtesyOutlives);
  });

  it("sem cortesia sobrevivente: a linha extra NÃO aparece", () => {
    // A ausência é a asserção que importa: prometer "seu acesso de cortesia continua" a quem não
    // tem cortesia seria inventar um acesso — a mentira oposta, e igualmente cara.
    expect(planNote(cancelada(false))).not.toContain(b.planCourtesyOutlives);
  });
});

describe("as ações separam o que é do MP do que é nosso", () => {
  it("ativa: gerenciar (MP) + cancelar (nosso)", () => {
    render(wrap(<PlanActions state={ativa} onSubscribe={() => {}} />));
    expect(screen.getByRole("button", { name: b.planManage })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: b.planCancel })).toBeInTheDocument();
  });

  it("carência: só atualizar pagamento — cancelar não é a saída oferecida a quem quer ficar", () => {
    render(wrap(<PlanActions state={carencia} onSubscribe={() => {}} />));
    expect(screen.getByRole("button", { name: b.planUpdatePayment })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: b.planCancel })).not.toBeInTheDocument();
  });

  it("cancelada: reassinar, e NENHUM botão de cancelar de novo", () => {
    render(wrap(<PlanActions state={cancelada(false)} onSubscribe={() => {}} />));
    expect(screen.getByRole("button", { name: b.planResubscribe })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: b.planCancel })).not.toBeInTheDocument();
  });

  it("gerenciar abre a superfície do MP, e não uma tela nossa de cartão", () => {
    // O cartão nunca passa pelo app (FR/SEC do E6). Um formulário nosso aqui seria o defeito.
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(wrap(<PlanActions state={ativa} onSubscribe={() => {}} />));
    screen.getByRole("button", { name: b.planManage }).click();
    expect(open).toHaveBeenCalledWith(expect.stringContaining("mercadopago.com.br"), "_blank");
  });
});

describe("o diálogo de cancelamento não usa padrão escuro", () => {
  it("diz o que ele MANTÉM, até quando, e que nada é apagado", async () => {
    const user = userEvent.setup();
    render(wrap(<PlanActions state={ativa} onSubscribe={() => {}} />));
    await user.click(screen.getByRole("button", { name: b.planCancel }));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(b.cancelTitle)).toBeInTheDocument();
    expect(within(dialogo).getByText(b.cancelBody.replace("{data}", "31/12/2026"))).toBeVisible();
    expect(within(dialogo).getByText(b.cancelFreeze)).toBeInTheDocument();
    // "Voltar" é a saída segura — a FR-014 proíbe "Cancelar" como controle de DISPENSA. Aqui a
    // palavra "Cancelar" só aparece no verbo da ação destrutiva.
    expect(within(dialogo).getByRole("button", { name: b.cancelBack })).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: b.cancelConfirm })).toBeInTheDocument();
  });

  it("nenhuma frase de culpa ou escassez", () => {
    // O texto é dado, então a asserção é sobre ele e vale para sempre: se alguém acrescentar um
    // "tem certeza que quer perder tudo?", este teste é que fecha a porta.
    const todo = [b.cancelTitle, b.cancelBody, b.cancelFreeze, b.cancelBack, b.cancelConfirm]
      .join(" ")
      .toLowerCase();
    for (const proibida of [
      "perder tudo",
      "tem certeza que quer perder",
      "última chance",
      "oferta",
    ]) {
      expect(todo).not.toContain(proibida);
    }
  });
});
