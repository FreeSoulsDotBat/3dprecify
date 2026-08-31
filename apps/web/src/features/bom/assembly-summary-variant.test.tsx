// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { BomResult } from "@3dprecify/pricing-core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { AssemblySummary } from "./assembly-summary";

// 018/T038 — as duas apresentações do resumo do kit.
//
// O que este arquivo protege é o MOBILE: `variant` tem padrão `pinned`, então quem montar este
// componente sem saber do 018 continua recebendo a barra colada no rodapé — e toda a regra do
// 014/T118 (`--pinned-bottom` acima da TabBar) segue valendo lá, intocada.

afterEach(cleanup);

const t = messages.bom;

function bom(over: Partial<BomResult> = {}): BomResult {
    return {
        lines: [{ custoUnitario: "10.00", custoLinha: "20.00", quantidade: 2, channels: [] }],
        custoTotal: "20.00",
        precoVarejo: "60.00",
        precoAtacado: "40.00",
        channels: [],
        ...over,
    } as unknown as BomResult;
}

describe("AssemblySummary — apresentação (018/US3)", () => {
    it("por padrão é a barra FIXADA — o comportamento de hoje, que é o do mobile", () => {
        const { container } = render(<AssemblySummary bom={bom()} />);
        expect(container.querySelector(".assembly-summary__pinned")).not.toBeNull();
        expect(container.querySelector(".assembly-summary__col")).toBeNull();
    });

    it('variant="column" tira o bloco do rodapé — quem gruda passa a ser a coluna da página', () => {
        const { container } = render(<AssemblySummary bom={bom()} variant="column" />);
        expect(container.querySelector(".assembly-summary__pinned")).toBeNull();
        expect(container.querySelector(".assembly-summary__col")).not.toBeNull();
        // O conteúdo é o mesmo nos dois modos: o total continua sendo o total.
        expect(screen.getByTestId("kit-total-bar")).toBeInTheDocument();
        expect(screen.getByText(t.assemblyTitle)).toBeInTheDocument();
    });

    it("peça fora do total continua declarada nos DOIS modos", () => {
        for (const variant of ["pinned", "column"] as const) {
            cleanup();
            render(<AssemblySummary bom={bom()} excludedLineCount={2} variant={variant} />);
            expect(screen.getByText(t.assemblyExcluded.replace("{n}", "2"))).toBeInTheDocument();
        }
    });

    it("sem nenhuma linha, o estado honesto de espera vale nos dois modos — nunca três zeros", () => {
        for (const variant of ["pinned", "column"] as const) {
            cleanup();
            render(<AssemblySummary bom={bom({ lines: [] })} variant={variant} />);
            expect(screen.getByText(t.assemblyNoPriceTitle)).toBeInTheDocument();
            expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
        }
    });
});
