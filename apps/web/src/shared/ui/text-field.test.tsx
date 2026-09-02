// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextField } from "./text-field";

// O par do `NumberField` que faltava no DS. Estes testes pinam a FORMA que os 13 sítios migrados
// dependiam quando escreviam o markup à mão — se ela mudar, o CSS deles muda junto e em silêncio.

describe("TextField — a moldura que os 13 sítios escreviam à mão", () => {
    it("renderiza `tf-inputwrap` por fora e `tf-input` no input", () => {
        render(<TextField aria-label="nome" defaultValue="abc" />);
        const input = screen.getByLabelText("nome");
        expect(input).toHaveClass("tf-input");
        expect(input.parentElement).toHaveClass("tf-inputwrap");
    });

    it("`type` é `text` por padrão, e o chamador pode trocar", () => {
        const { rerender } = render(<TextField aria-label="a" />);
        expect(screen.getByLabelText("a")).toHaveAttribute("type", "text");
        rerender(<TextField aria-label="a" type="search" />);
        expect(screen.getByLabelText("a")).toHaveAttribute("type", "search");
    });

    it("`className` vai para o WRAPPER, não para o input — é onde o `NumberField` também o põe", () => {
        // A migração dos 13 sítios trouxe um `className="tf-input"` colado no input original; se ele
        // tivesse ficado, teria virado uma classe no wrapper e o DOM sairia diferente do de antes.
        render(<TextField aria-label="b" className="minha-classe" />);
        const input = screen.getByLabelText("b");
        expect(input.parentElement).toHaveClass("tf-inputwrap", "minha-classe");
        expect(input).not.toHaveClass("minha-classe");
    });

    it("erro e desabilitado vestem o wrapper, como no `NumberField`", () => {
        render(<TextField aria-label="c" error disabled />);
        const wrap = screen.getByLabelText("c").parentElement;
        expect(wrap).toHaveClass("tf-inputwrap--error", "tf-inputwrap--disabled");
        expect(screen.getByLabelText("c")).toBeDisabled();
    });

    it("o tamanho `md` não emite modificador; os outros emitem", () => {
        const { rerender } = render(<TextField aria-label="d" />);
        expect(screen.getByLabelText("d").parentElement?.className).not.toContain("tf-inputwrap--");
        rerender(<TextField aria-label="d" size="sm" />);
        expect(screen.getByLabelText("d").parentElement).toHaveClass("tf-inputwrap--sm");
    });
});
