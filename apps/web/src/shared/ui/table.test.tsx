// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Table } from "./table";

afterEach(() => cleanup());

// 019/T012 (PR-A, ADR-0032, contrato ui-porte.md §C0) — `tf-table`: o Catálogo denso a partir de
// 1024px (research §A; 23g é um `tf-table` real com thead/th/tbody/td). O contrato não define uma
// API de `columns`/`rows`; o wrapper mais simples que preserva a marcação da folha é um `<table>`
// semântico — quem chama escreve o próprio `thead`/`tbody` com as classes `tf-table__*` da folha.

describe("Table (019/T012 — tf-table)", () => {
  it("é uma table nativa com columnheaders e células", () => {
    render(
      <Table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Preço</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="tf-table__name">Vaso hexagonal grande</td>
            <td className="tf-table__num">R$ 89,90</td>
          </tr>
        </tbody>
      </Table>,
    );

    expect(screen.getByRole("table")).toHaveClass("tf-table");
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent("Produto");
    const rows = screen.getAllByRole("row");
    // 1 de cabeçalho + 1 de dado
    expect(rows).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(2);
  });

  it("preserva className extra sem apagar a classe do primitivo", () => {
    render(
      <Table className="tf-catalog-table">
        <tbody>
          <tr>
            <td>x</td>
          </tr>
        </tbody>
      </Table>,
    );

    const table = screen.getByRole("table");
    expect(table).toHaveClass("tf-table");
    expect(table).toHaveClass("tf-catalog-table");
  });
});
