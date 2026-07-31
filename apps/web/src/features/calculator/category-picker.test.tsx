// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CategoryNode } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import { CategoryPicker } from "./category-picker";

const t = messages.calculator.categoryPicker;

// 014/US1. The seller does NOT know the marketplace's category name — he thinks "suporte de
// celular" while ML publishes "Acessórios para Celulares". So: search by text, and show the PATH,
// because ML really publishes two near-homonyms at DIFFERENT rates (Celulares e Telefones 18% vs
// Celulares e Smartphones 16%) and picking by name alone is a coin flip on 2 percentage points.

afterEach(cleanup);

const SPINE: CategoryNode[] = [
  { id: "MLB1051", name: "Celulares e Telefones", parentId: null },
  { id: "MLB1055", name: "Celulares e Smartphones", parentId: "MLB1051" },
  { id: "MLB3813", name: "Acessórios para Celulares", parentId: "MLB1051" },
  { id: "MLB1574", name: "Casa, Móveis e Decoração", parentId: null },
];

const setup = (props: Partial<React.ComponentProps<typeof CategoryPicker>> = {}) => {
  const onChange = vi.fn();
  render(
    <CategoryPicker
      spine={SPINE}
      value={undefined}
      onChange={onChange}
      hasFeeReference={false}
      {...props}
    />,
  );
  return { onChange, user: userEvent.setup() };
};

describe("CategoryPicker — finding the category (US1)", () => {
  it("renders ALWAYS visible and expanded, in an empty-but-active state (FR-006a)", () => {
    setup();
    // Not behind a disclosure: a collapsed field plus a plausible pre-filled number is what makes a
    // seller accept the wrong rate. The search input must be there on first paint.
    expect(screen.getByRole("textbox", { name: /categoria/i })).toBeVisible();
  });

  it("filters by part of the name, accent- and case-insensitively", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "moveis");
    const list = screen.getByRole("list");
    expect(within(list).getByText(/Casa, Móveis e Decoração/)).toBeVisible();
    expect(within(list).queryByText(/Celulares/)).toBeNull();
  });

  it("shows the PATH so near-homonyms are distinguishable, not a coin flip", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "celulares");
    const list = screen.getByRole("list");
    expect(within(list).getByText(/Celulares e Telefones › Celulares e Smartphones/)).toBeVisible();
    expect(
      within(list).getByText(/Celulares e Telefones › Acessórios para Celulares/),
    ).toBeVisible();
  });

  it("reports the chosen category id", async () => {
    const { user, onChange } = setup();
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "smartphones");
    await user.click(within(screen.getByRole("list")).getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("MLB1055");
  });

  it("a query that matches nothing says so — and says how to search instead", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "zzzzz");
    expect(screen.getByRole("status")).toHaveTextContent(
      messages.calculator.categoryPicker.noResults,
    );
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("an already-chosen category shows its full path and can be cleared", async () => {
    const { user, onChange } = setup({ value: "MLB1055" });
    expect(screen.getByText(/Celulares e Telefones › Celulares e Smartphones/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /limpar/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  // The spine is SPARSE and the name index is fetched on demand (D2). Offline on a first run the
  // seller has the RATE but not the full name list — the picker must say that plainly instead of
  // pretending the category does not exist.
  it("an empty spine explains itself instead of rendering a dead field", () => {
    setup({ spine: [], hasFeeReference: true });
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

// 014/T087 (A3, FR-006d) — o teste antigo verificava que EXISTIA um `role="status"`, nunca o que ele
// dizia. O texto dizia duas coisas falsas no estado padrão de 100% dos usuários (o slot nasce em ML,
// que hoje tem 0 entradas e 0 espinha): "a taxa exibida já é a correta" — não há taxa exibida — e
// "conecte uma vez para carregá-la" — conectar não carrega nada enquanto a fatia ML está bloqueada.
// Um `getByRole` sem asserção de conteúdo é um teste que garante que a mentira está na tela.
describe("CategoryPicker — o estado vazio não afirma o que não é verdade (FR-006d)", () => {
  it("sem taxa de referência: manda informar a comissão, e não promete carregamento", () => {
    setup({ spine: [], hasFeeReference: false });
    const nota = screen.getByRole("status").textContent ?? "";
    // Concorda com o selo do mesmo slot, que nesse estado lê "sem referência".
    expect(nota).toMatch(/informe a comissão/i);
    // As duas afirmações falsas, nomeadas: nenhuma pode voltar por reescrita de copy.
    expect(nota).not.toMatch(/taxa exibida/i);
    expect(nota).not.toMatch(/correta/i);
    expect(nota).not.toMatch(/conecte/i);
  });

  it("com taxa de referência: diz o que falta e nada sobre a taxa", () => {
    setup({ spine: [], hasFeeReference: true });
    const nota = screen.getByRole("status").textContent ?? "";
    expect(nota).toMatch(/categorias/i); // o que de fato está faltando
    expect(nota).not.toMatch(/correta/i); // quem fala da taxa é o selo, não o seletor
    expect(nota).not.toMatch(/conecte/i); // o seletor não sabe se conectar resolve
  });
});

// 014/T107 (a11y) — o estado ESCOLHIDO era o único dos três ramos deste arquivo sem tratamento de
// leitor de tela: os dois vizinhos (espinha vazia e busca sem resultado) usam `role="status"`, e o
// chip da categoria escolhida não anunciava nada. Pior, o botão da opção clicada DESMONTA junto com
// a lista, então o foco caía em `document.body` — quem navega por teclado perdia o lugar no
// formulário exatamente no momento em que acabou de decidir a alíquota da própria venda.
describe("CategoryPicker — o estado escolhido é anunciado e o foco não se perde (T107)", () => {
  it("o chip escolhido vive numa live region, como os dois ramos vizinhos", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "smartphones");
    await user.click(within(screen.getByRole("list")).getByRole("button"));
    // O componente é controlado: re-renderiza no ramo escolhido quando `value` chega.
    cleanup();
    render(
      <CategoryPicker spine={SPINE} value="MLB1055" onChange={vi.fn()} hasFeeReference={true} />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Celulares e Telefones › Celulares e Smartphones/);
  });

  it("o chip diz O QUE ele é — não um caminho solto ao lado de um botão", () => {
    render(
      <CategoryPicker spine={SPINE} value="MLB1055" onChange={vi.fn()} hasFeeReference={true} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      messages.calculator.categoryPicker.chosenLabel,
    );
  });

  /** O componente é CONTROLADO: quem guarda `value` é o formulário (um `Controller` do RHF na
   *  aplicação). Um `onChange` mockado nunca devolve o valor, então o ramo escolhido jamais
   *  renderiza — testar o foco com ele mediria o mock, não o componente. */
  function Controlado() {
    const [value, setValue] = useState<string | undefined>(undefined);
    return (
      <CategoryPicker spine={SPINE} value={value} onChange={setValue} hasFeeReference={false} />
    );
  }

  it("escolher move o foco para o 'Limpar' — nunca para o body", async () => {
    const user = userEvent.setup();
    render(<Controlado />);
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "smartphones");
    await user.click(within(screen.getByRole("list")).getByRole("button"));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /limpar categoria/i }));
  });

  it("montar JÁ com uma categoria não rouba o foco — só a escolha do vendedor rouba", () => {
    render(
      <CategoryPicker spine={SPINE} value="MLB1055" onChange={vi.fn()} hasFeeReference={true} />,
    );
    expect(document.activeElement).toBe(document.body);
  });
});

// 014/T117 — o campo anunciava o contrato ARIA de `combobox` sem cumprir nenhuma metade dele:
// `aria-controls` apontava para uma `listbox` que só existe enquanto há resultados (referência morta
// na maior parte do tempo), não havia `aria-activedescendant` nem navegação por setas, e cada opção
// carregava `aria-selected={false}` fixo. O leitor de tela recebia a promessa de um widget de popup
// navegável e encontrava uma lista em fluxo.
//
// A decisão foi DEIXAR DE ANUNCIAR, não implementar: o widget que está na tela não é um combobox.
// A lista fica em FLUXO abaixo do campo (escolha da T115, para não reabrir a classe de defeito de
// sobreposição que este projeto pagou três vezes) e cada resultado é um `<button>` de verdade, com
// Enter, Espaço e foco de graça. O que faltava de fato — saber que os resultados apareceram — virou
// uma live region com a contagem, que serve tanto ao leitor de tela quanto a quem enxerga a lista.
describe("CategoryPicker — o contrato ARIA anunciado é o cumprido (T117)", () => {
  it("não anuncia um combobox que não existe, e a lista não se diz uma listbox", async () => {
    const { user } = setup();
    const campo = screen.getByRole("textbox", { name: /categoria/i });
    expect(campo).not.toHaveAttribute("role");
    expect(campo).not.toHaveAttribute("aria-expanded");
    // O pior dos três: apontava para um id ausente do DOM sempre que a lista estava fechada.
    expect(campo).not.toHaveAttribute("aria-controls");

    await user.type(campo, "celulares");
    expect(screen.queryByRole("listbox")).toBeNull();
    // O que sobra é o que existe: uma lista de botões ativáveis por teclado.
    expect(within(screen.getByRole("list")).getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("os resultados são ANUNCIADOS — a contagem vive numa live region", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "celulares");
    expect(screen.getByRole("status")).toHaveTextContent(
      t.resultsMany.replace("{n}", "3"), // as 3 que contêm "celulares" na SPINE
    );
  });

  it("um resultado só fala no singular — a contagem é lida, não decorativa", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "moveis");
    expect(screen.getByRole("status")).toHaveTextContent(t.resultsOne);
  });

  // A lista mostra no máximo 8. Dizer "8 categorias encontradas" quando existem mais é afirmar um
  // total falso — o vendedor para de refinar acreditando ter visto tudo, e a dele pode ser a nona.
  it("com mais resultados do que cabem, a contagem diz que está CORTADA, não que achou 8", async () => {
    const grande: CategoryNode[] = Array.from({ length: 12 }, (_, i) => ({
      id: `X${i}`,
      name: `Suporte ${i}`,
      parentId: null,
    }));
    const { user } = setup({ spine: grande });
    await user.type(screen.getByRole("textbox", { name: /categoria/i }), "suporte");
    expect(screen.getByRole("status")).toHaveTextContent(
      t.resultsTruncated.replace("{n}", "8").replace("{total}", "12"),
    );
    expect(within(screen.getByRole("list")).getAllByRole("button")).toHaveLength(8);
  });
});

// 014/T116 — o chip escolhido nomeia o id pelo caminho na espinha. Quando o id NÃO está na espinha
// (produto salvo antes de uma revisão do catálogo, cenário reaberto, nó que o marketplace removeu) o
// caminho volta vazio e o chip renderiza um rótulo EM BRANCO ao lado do "Limpar". Não é a T097 —
// aquela era a espinha inteira vazia, que nem chega neste ramo. Aqui a espinha existe e é o id que
// não está nela, e nenhum guard confere `slot.category` contra a espinha.
describe("CategoryPicker — id fora da espinha não vira rótulo em branco (T116)", () => {
  const FORA = "MLB-que-o-catalogo-nao-carrega";

  it("o chip nunca fica em branco — diz que a categoria não está neste catálogo", () => {
    render(
      <CategoryPicker spine={SPINE} value={FORA} onChange={vi.fn()} hasFeeReference={false} />,
    );
    // O defeito, nomeado pela geometria do texto e não pela cópia: o rótulo VISÍVEL do chip não pode
    // ser vazio. Um `toHaveTextContent` na live region passaria mesmo em branco, porque o prefixo
    // sr-only "Categoria escolhida:" já enche o `textContent` do contêiner.
    expect(screen.getByTestId("category-chip").textContent?.trim()).not.toBe("");
    expect(screen.getByRole("status")).toHaveTextContent(
      messages.calculator.categoryPicker.unknownChosen,
    );
  });

  it("e continua limpável — o vendedor não fica preso a um id que o catálogo não carrega", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CategoryPicker spine={SPINE} value={FORA} onChange={onChange} hasFeeReference={false} />,
    );
    await user.click(screen.getByRole("button", { name: /limpar categoria/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
