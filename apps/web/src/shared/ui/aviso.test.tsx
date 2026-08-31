// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Aviso } from "./aviso";

afterEach(() => cleanup());

// 019/T012 (PR-A, ADR-0032, contrato ui-porte.md §C0) — `tf-aviso`: a 3ª categoria de mensagem
// (nem dica, nem erro). `role="status"` (polido, não interrompe) — NUNCA `role="alert"`, que é do
// `tf-alert` de erro/interrupção (research §A; C3 reserva `alert`≠`status` para o resto da fatia).

describe("Aviso (019/T012 — tf-aviso)", () => {
    it("tem role=status e mostra o texto do aviso", () => {
        render(<Aviso>850 g é bem acima do comum para uma peça só.</Aviso>);

        const aviso = screen.getByRole("status");
        expect(aviso).toHaveTextContent("850 g é bem acima do comum para uma peça só.");
    });

    it("NÃO é role=alert", () => {
        render(<Aviso>texto qualquer</Aviso>);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sem `action`, não renderiza a área de dispensa", () => {
        const { container } = render(<Aviso>texto sem ação</Aviso>);
        expect(container.querySelector(".tf-aviso__action")).not.toBeInTheDocument();
    });

    it("com `action`, renderiza o botão de dispensa recebido dentro de tf-aviso__action", () => {
        render(<Aviso action={<button type="button">Entendi</button>}>texto com dispensa</Aviso>);

        const botao = screen.getByRole("button", { name: "Entendi" });
        expect(botao).toBeInTheDocument();
        expect(botao.closest(".tf-aviso__action")).not.toBeNull();
    });
});
