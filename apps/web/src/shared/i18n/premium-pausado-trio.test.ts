// 019/PR-F — T090 (D1). "Premium pausado" é usado em SETE pontos do vocabulário desde a auditoria
// de 27/08: seis continuam vivos hoje, um foi APAGADO pela PR-B (019/T038) por ficar sem
// consumidor — o teste registra a ausência dele em vez de esconder que ela existiu.
//
// Por que este teste existe: as seis ocorrências vivas divergem em silêncio hoje (cada uma foi
// escrita numa fatia diferente — E2/conta, E3/kits, E4/histórico, E5/simulações — sem revisão
// cruzada). Fixar as SEIS strings NOMEADAS num snapshot conjunto é a única coisa que garante que
// uma edição futura em qualquer uma delas seja uma decisão CONSCIENTE, não um efeito colateral.
//
// Prova por mutação (registrada, não deixada para o leitor confiar): mudei manualmente
// `messages.pt-br.ts:1251` (`scenarios.lapsedTitle`) de "Premium pausado" para "Premium Pausado"
// (maiúscula) e rodei `pnpm exec vitest run src/shared/i18n/premium-pausado-trio.test.ts` — RED
// (1 teste falhou, o snapshot `scenarios.lapsedTitle`). Revertido antes de commitar.
import { describe, expect, it } from "vitest";

import { messages as t } from "./messages.pt-br";

describe("019/PR-F T090 (D1) — o trio 'Premium pausado' (agora seis vivos, um apagado)", () => {
    // 1) conta.planLapsed (`:622`) — a linha de plano da Conta (E2). Rótulo NEUTRO deliberado (não
    //    "expirado"): ver o comentário histórico junto à chave (T038, causa não trafega no wire).
    it("account.planLapsed", () => {
        expect(t.account.planLapsed).toBe("Premium pausado");
    });

    // 2) catalog.lapsedTitle — SAIU. Confirmado por grep hoje (2026-08-29): não existe mais
    //    `lapsedTitle` no bloco `catalog`. A prancheta 32e (019/PR-B/T038) moveu a mensagem para
    //    `catalog.reactivateBody`, junto ao botão que ela explica, em vez de uma faixa separada —
    //    o comentário deixado no próprio arquivo (`messages.pt-br.ts` bloco `catalog`, acima de
    //    `readOnlyHint`) documenta a remoção e nomeia esta task (T090) como quem vigia a ausência.
    it("catalog.lapsedTitle não existe mais (apagada pela PR-B/T038 — prancheta 32e)", () => {
        expect("lapsedTitle" in t.catalog).toBe(false);
    });

    // 3-4) bom.lapsedTitle (`:950`) + bom.lapsedBanner (`:953-955`) — Kits (E3). Título curto para o
    //    cabeçalho da tela vazia/gate; banner mais longo explica o que ainda funciona (reabrir/
    //    recalcular) e o que precisa do Premium ativo (salvar).
    it("bom.lapsedTitle", () => {
        expect(t.bom.lapsedTitle).toBe("Premium pausado");
    });
    it("bom.lapsedBanner", () => {
        expect(t.bom.lapsedBanner).toBe(
            "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo.",
        );
    });

    // 5) historico.lapsedBanner (`:1132`) — Histórico (E4) NÃO tem `lapsedTitle` (confirmado por
    //    grep: só o banner existe nesse bloco). O histórico é write-once por natureza (snapshot
    //    imutável), então o banner cobre mais ações negadas (salvar/renomear/excluir/exportar) que
    //    os outros dois.
    it("history.lapsedBanner (sem lapsedTitle irmão — histórico não tem um)", () => {
        expect("lapsedTitle" in t.history).toBe(false);
        expect(t.history.lapsedBanner).toBe(
            "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium.",
        );
    });

    // 6-7) scenarios.lapsedTitle (`:1251`) + scenarios.writeLapsed (`:1268`) — Simulações (E5).
    //    `lapsedTitle` é o par de `lapsedBody` na tela de leitura; `writeLapsed` é a linha curta que
    //    a barra de contexto/ações usa quando uma escrita específica (renomear/duplicar/editar/
    //    excluir) é negada — vocabulário deliberadamente diferente do `lapsedBody` mais longo.
    it("scenarios.lapsedTitle", () => {
        expect(t.scenarios.lapsedTitle).toBe("Premium pausado");
    });
    it("scenarios.writeLapsed", () => {
        expect(t.scenarios.writeLapsed).toBe(
            "Premium pausado — reative para renomear, duplicar, editar ou excluir.",
        );
    });

    // Snapshot conjunto (D1) — as SEIS strings renderizadas lado a lado, para que uma futura edição
    // isolada de qualquer uma seja visível no diff do snapshot, não apenas no diff do arquivo fonte.
    it("snapshot conjunto das seis ocorrências vivas", () => {
        expect({
            "account.planLapsed": t.account.planLapsed,
            "bom.lapsedTitle": t.bom.lapsedTitle,
            "bom.lapsedBanner": t.bom.lapsedBanner,
            "history.lapsedBanner": t.history.lapsedBanner,
            "scenarios.lapsedTitle": t.scenarios.lapsedTitle,
            "scenarios.writeLapsed": t.scenarios.writeLapsed,
        }).toMatchInlineSnapshot(`
      {
        "account.planLapsed": "Premium pausado",
        "bom.lapsedBanner": "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo.",
        "bom.lapsedTitle": "Premium pausado",
        "history.lapsedBanner": "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium.",
        "scenarios.lapsedTitle": "Premium pausado",
        "scenarios.writeLapsed": "Premium pausado — reative para renomear, duplicar, editar ou excluir.",
      }
    `);
    });
});
