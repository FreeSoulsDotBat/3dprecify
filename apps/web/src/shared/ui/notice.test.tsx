// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Notice } from "./notice";

afterEach(() => cleanup());

// 019/T012 (PR-A, ADR-0032, contrato ui-porte.md §C0) — `tf-aviso`: a 3ª categoria de mensagem
// (nem dica, nem erro). `role="status"` (polido, não interrompe) — NUNCA `role="alert"`, que é do
// `tf-alert` de erro/interrupção (research §A; C3 reserva `alert`≠`status` para o resto da fatia).

describe("Aviso (019/T012 — tf-aviso)", () => {
    it("tem role=status e mostra o texto do aviso", () => {
        render(<Notice>850 g é bem acima do comum para uma peça só.</Notice>);

        const notice = screen.getByRole("status");
        expect(notice).toHaveTextContent("850 g é bem acima do comum para uma peça só.");
    });

    it("NÃO é role=alert", () => {
        render(<Notice>texto qualquer</Notice>);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sem `action`, não renderiza a área de dispensa", () => {
        const { container } = render(<Notice>texto sem ação</Notice>);
        expect(container.querySelector(".tf-aviso__action")).not.toBeInTheDocument();
    });

    it("com `action`, renderiza o botão de dispensa recebido dentro de tf-aviso__action", () => {
        render(<Notice action={<button type="button">Entendi</button>}>texto com dispensa</Notice>);

        const botao = screen.getByRole("button", { name: "Entendi" });
        expect(botao).toBeInTheDocument();
        expect(botao.closest(".tf-aviso__action")).not.toBeNull();
    });
});
