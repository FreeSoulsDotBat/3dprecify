// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";

// 019/PR-A T014 (contracts/ui-porte.md §C0) — as duas larguras do botão solto em coluna.
// Largura tirada do nº de letras do rótulo não é legítima; sem a prop, nenhuma classe de largura.

afterEach(cleanup);

describe("Button — width", () => {
  it('width="full" aplica tf-btn--full', () => {
    render(<Button width="full">Salvar kit</Button>);
    expect(screen.getByRole("button", { name: "Salvar kit" })).toHaveClass("tf-btn--full");
  });

  it('width="half" aplica tf-btn--half', () => {
    render(<Button width="half">Usar estimativa</Button>);
    expect(screen.getByRole("button", { name: "Usar estimativa" })).toHaveClass("tf-btn--half");
  });

  it("sem width nenhuma classe de largura é aplicada", () => {
    render(<Button>Continuar</Button>);
    const btn = screen.getByRole("button", { name: "Continuar" });
    expect(btn).not.toHaveClass("tf-btn--full");
    expect(btn).not.toHaveClass("tf-btn--half");
  });
});
