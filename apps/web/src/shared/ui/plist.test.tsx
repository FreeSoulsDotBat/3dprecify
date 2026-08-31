// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Plist } from "./plist";

afterEach(() => cleanup());

// 019/T012 (PR-A, ADR-0032, contrato ui-porte.md §C0) — `tf-plist`: a lista densa do Catálogo a
// 390px. `list-style: none` some com o papel implícito de lista no VoiceOver do Safari — os papéis
// explícitos abaixo são o que a folha (23b) não precisa dizer porque HTML puro já resolveria.

describe("Plist (019/T012 — tf-plist)", () => {
    it("expõe list/listitem e nome+meta+preço por item", () => {
        render(
            <Plist
                items={[
                    { id: 1, name: "Vaso hexagonal grande", meta: "14/03", price: "R$ 89,90" },
                    { id: 2, name: "Organizador de bancada", meta: "02/03", price: "R$ 128,00" },
                ]}
            />,
        );

        expect(screen.getByRole("list")).toBeInTheDocument();
        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(screen.getByText("Vaso hexagonal grande")).toBeInTheDocument();
        expect(screen.getByText("14/03")).toBeInTheDocument();
        expect(screen.getByText("R$ 89,90")).toBeInTheDocument();
    });

    it("renderiza `was` só quando informado, sem quebrar os itens que não têm", () => {
        render(
            <Plist
                items={[
                    {
                        id: 1,
                        name: "Suporte de fone articulado",
                        price: "R$ 34,50",
                        was: "era R$ 31,00",
                    },
                    { id: 2, name: "Organizador de bancada", price: "R$ 128,00" },
                ]}
            />,
        );

        expect(screen.getByText("era R$ 31,00")).toBeInTheDocument();
        // segundo item não tem `was` — não pode aparecer um vazio "fantasma" no DOM
        expect(screen.queryAllByText(/^era /)).toHaveLength(1);
    });

    it("renderiza a flag (marca da linha); 'warning' é o tom BASE, sem modificador", () => {
        render(
            <Plist
                items={[
                    {
                        id: 1,
                        name: "Suporte de fone articulado",
                        meta: { flag: { label: "recalcular", tone: "warning" } },
                        price: "R$ 34,50",
                    },
                ]}
            />,
        );

        const flag = screen.getByText("recalcular");
        expect(flag).toHaveClass("tf-plist__flag");
        expect(flag.className).not.toMatch(/tf-plist__flag--warning/);
    });

    it("um tom explícito (neutral/success/danger) vira modificador `tf-plist__flag--<tom>`", () => {
        render(
            <Plist
                items={[
                    {
                        id: 1,
                        name: "Orçamento aceito",
                        meta: { flag: { label: "aceito", tone: "success" } },
                        price: "R$ 34,50",
                    },
                ]}
            />,
        );

        expect(screen.getByText("aceito")).toHaveClass("tf-plist__flag--success");
    });

    it("um item com onSelect vira controle clicável; sem onSelect não é foco de teclado", async () => {
        const onSelect = vi.fn();
        const user = userEvent.setup();
        render(
            <Plist
                items={[
                    { id: 1, name: "Item clicável", price: "R$ 10,00", onSelect },
                    { id: 2, name: "Item inerte", price: "R$ 20,00" },
                ]}
            />,
        );

        const clicavel = screen.getByRole("button", { name: /Item clicável/ });
        await user.click(clicavel);
        expect(onSelect).toHaveBeenCalledTimes(1);

        // o item sem onSelect não é um button — não some da tela nem vira um alvo de clique fantasma
        expect(screen.queryByRole("button", { name: /Item inerte/ })).not.toBeInTheDocument();
        expect(screen.getByText("Item inerte")).toBeInTheDocument();
    });

    it("aria-selected marca a linha ativa", () => {
        render(
            <Plist
                items={[
                    { id: 1, name: "A", price: "R$ 1,00", onSelect: () => {}, selected: true },
                    { id: 2, name: "B", price: "R$ 2,00", onSelect: () => {} },
                ]}
            />,
        );

        expect(screen.getByRole("button", { name: /^A/ })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("button", { name: /^B/ })).toHaveAttribute(
            "aria-selected",
            "false",
        );
    });
});
