import { describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { basisCaption } from "./history-format";

// B4 (2026-09-01) — o 5º espelho de `headline_basis` (ver comentário em `history-format.ts`, junto
// de `BASIS_CAPTION`) tinha um fallback silencioso para "preço de varejo" que o backend já recusa
// por design (`quote_render._basis_caption`/`_basis_key`). Este arquivo:
//
//   1. CARACTERIZA o comportamento ATUAL para os 3 kinds conhecidos hoje — prova que a correção do
//      passo 2 abaixo não muda nenhum caso real (o problema é só o fallback do desconhecido).
//   2. Fixa a correção: um `headlineBasis` desconhecido não é mais rotulado como varejo.

const t = messages.history;
const tq = messages.quote;

describe("basisCaption — caracterização dos 3 kinds conhecidos (não muda com o fix)", () => {
    it("PRECO_VAREJO", () => {
        expect(basisCaption("PRECO_VAREJO")).toBe(t.basisRetailCaption);
    });

    it("PRECO_ATACADO", () => {
        expect(basisCaption("PRECO_ATACADO")).toBe(t.basisWholesaleCaption);
    });

    it("PRECO_ORCAMENTO", () => {
        expect(basisCaption("PRECO_ORCAMENTO")).toBe(tq.totalSent);
    });
});

describe("basisCaption — B4 fix: um basis desconhecido nunca lê como varejo", () => {
    it("um kind futuro/desconhecido cai no traço honesto, nunca em 'preço de varejo'", () => {
        const result = basisCaption("PRECO_FUTURO_INEXISTENTE");
        expect(result).toBe("—");
        expect(result).not.toBe(t.basisRetailCaption);
    });

    it("string vazia é igualmente desconhecida — mesmo traço honesto", () => {
        expect(basisCaption("")).toBe("—");
    });
});
