// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Segmented } from "./segmented";

// 018/T009 — o grupo segmentado. O que está sob teste é o CONTRATO de teclado e de semântica: um
// único ponto de tabulação, setas percorrendo, e o papel certo para cada uso (painel vs. valor).

type Sec = "fil" | "imp" | "prod";
const OPTIONS = [
    { id: "fil" as Sec, label: "Filamentos" },
    { id: "imp" as Sec, label: "Impressoras" },
    { id: "prod" as Sec, label: "Produtos" },
];

function renderTabs(value: Sec = "fil") {
    const onChange = vi.fn();
    render(
        <Segmented
            options={OPTIONS}
            value={value}
            onChange={onChange}
            ariaLabel="Seções do catálogo"
            idPrefix="sec"
            controlsPrefix="painel"
        />,
    );
    return { onChange };
}

afterEach(cleanup);

describe("Segmented", () => {
    it("no modo tablist anuncia tabs com aria-selected e aponta para o painel", () => {
        renderTabs();
        const list = screen.getByRole("tablist", { name: "Seções do catálogo" });
        expect(list).toBeInTheDocument();

        const tabs = screen.getAllByRole("tab");
        expect(tabs).toHaveLength(3);
        expect(tabs[0]).toHaveAttribute("aria-selected", "true");
        expect(tabs[1]).toHaveAttribute("aria-selected", "false");
        expect(tabs[0]).toHaveAttribute("aria-controls", "painel-fil");
        expect(tabs[0]).toHaveAttribute("id", "sec-fil");
    });

    it("mantém UM único ponto de tabulação — o item selecionado", () => {
        renderTabs("imp");
        const tabs = screen.getAllByRole("tab");
        expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    });

    it("as setas percorrem e dão a volta, e Home/End vão às pontas", async () => {
        // Controlado DE VERDADE: com um `onChange` que não atualiza nada, o foco anda mas o valor não,
        // e o teste mediria uma travessia que não existe. A primeira versão deste caso caiu nisso.
        function Controlado() {
            const [value, setValue] = useState<Sec>("fil");
            return (
                <Segmented options={OPTIONS} value={value} onChange={setValue} ariaLabel="Seções" />
            );
        }
        const user = userEvent.setup();
        render(<Controlado />);
        const selected = () =>
            screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true");

        screen.getByRole("tab", { name: "Filamentos" }).focus();
        await user.keyboard("{ArrowRight}");
        expect(selected()).toHaveAccessibleName("Impressoras");

        await user.keyboard("{ArrowLeft}");
        expect(selected()).toHaveAccessibleName("Filamentos");

        await user.keyboard("{ArrowLeft}"); // dá a volta pela esquerda
        expect(selected()).toHaveAccessibleName("Produtos");

        await user.keyboard("{Home}");
        expect(selected()).toHaveAccessibleName("Filamentos");

        await user.keyboard("{End}");
        expect(selected()).toHaveAccessibleName("Produtos");

        // E o foco acompanha a seleção — senão a próxima seta partiria do lugar errado.
        expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Produtos" }));
    });

    it("clicar seleciona", async () => {
        const user = userEvent.setup();
        const { onChange } = renderTabs();
        await user.click(screen.getByRole("tab", { name: "Produtos" }));
        expect(onChange).toHaveBeenCalledWith("prod");
    });

    it("no modo radiogroup a escolha é um VALOR: radio + aria-checked, sem aria-selected", () => {
        render(
            <Segmented
                options={[
                    { id: "light", label: "Claro" },
                    { id: "dark", label: "Escuro" },
                ]}
                value="dark"
                onChange={() => {}}
                ariaLabel="Tema"
                role="radiogroup"
            />,
        );
        const radios = screen.getAllByRole("radio");
        expect(radios).toHaveLength(2);
        expect(radios[1]).toHaveAttribute("aria-checked", "true");
        expect(radios[1]).not.toHaveAttribute("aria-selected");
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("os botões são type=button — dentro de um form, um segmentado não pode submeter nada", () => {
        renderTabs();
        for (const tab of screen.getAllByRole("tab")) expect(tab).toHaveAttribute("type", "button");
    });

    // 019/PR-A T014 (contracts/ui-porte.md §C0) — a bandeja que ocupa a linha e divide em partes
    // iguais; só onde a largura é escassa. Sem a prop, a bandeja segue se ajustando ao texto.
    it("split aplica tf-segmented--split, combinável com o size", () => {
        render(
            <Segmented
                options={OPTIONS}
                value="fil"
                onChange={() => {}}
                ariaLabel="Seções do catálogo"
                size="sm"
                split
            />,
        );
        const list = screen.getByRole("tablist", { name: "Seções do catálogo" });
        expect(list).toHaveClass("tf-segmented--split");
        expect(list).toHaveClass("tf-segmented--sm");
    });

    it("sem split nenhuma classe --split é aplicada", () => {
        renderTabs();
        expect(screen.getByRole("tablist")).not.toHaveClass("tf-segmented--split");
    });
});
