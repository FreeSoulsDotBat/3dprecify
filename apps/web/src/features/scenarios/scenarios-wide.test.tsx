// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 019/PR-F (T092, US7, vermelho primeiro) — `ScenariosList` NÃO existia como export: era o privado
// `ScenarioListBody` (`scenarios-list-sheet.tsx`), usado só dentro da gaveta `ScenariosListSheet`.
// Este teste prova a PROPRIEDADE que a T095 vai explorar em `calcular-page.tsx`: um "hospedeiro"
// que monta `ScenariosList` DIRETO na coluna larga (≥1280px) E a gaveta de sempre lado a lado nunca
// deixa DUAS instâncias da lista na árvore ao mesmo tempo — `useIsWide` é o único gate, exatamente
// como `tf-catalog-md`/`ADR-0031` já fazem para as quatro telas do 018.
//
// O ramo `showTeaser` que a T092 cita (`:462` na numeração antiga) SAIU na PR-B (T112): o comentário
// em `scenarios-list-sheet.tsx:206` já registra que "nunca teve"/deslogado hoje montam a MESMA
// `ScenariosList` como todo mundo (o `doorGate` deriva de `premiumGate` + o 403 honesto da própria
// lista) — o que ficou no lugar do antigo salto de página inteira é o vazio didático
// (`VazioDidatico`) DENTRO de `ScenariosList`, não um segundo componente.

const { useScenariosMock } = vi.hoisted(() => ({ useScenariosMock: vi.fn() }));

vi.mock("@/entities/scenario/use-scenarios", () => ({
  useScenarios: (args: unknown) => useScenariosMock(args),
  useRenameScenario: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDuplicateScenario: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteScenario: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// `ScenariosListSheet` (o ramo estreito do Host) lê `useEntitlement` + `useOnline` — moldados como
// `scenarios-list-sheet.test.tsx` já faz.
vi.mock("@/entities/user/use-entitlement", () => ({
  useEntitlement: () => ({ data: { status: "active" } }),
}));
vi.mock("@/shared/lib/use-online", () => ({
  useOnline: () => true,
}));

import { installMatchMedia, VIEWPORT } from "@/shared/lib/match-media.test-helper";
import { useSessionStore } from "@/shared/session/session-store";

import { ScenariosList, ScenariosListSheet } from "./scenarios-list-sheet";

const ROW = {
  id: "s1",
  name: "ML Clássico × Shopee",
  note: null,
  config: { schemaVersion: 1, costBasis: { kind: "AD_HOC", ref: null, degraded: false } },
  createdAt: "2026-07-19T10:00:00Z",
  updatedAt: "2026-07-19T10:00:00Z",
};

function listState() {
  return {
    items: [ROW],
    isLoading: false,
    isError: false,
    error: null,
    stale: false,
    refetch: vi.fn(),
    loadMore: vi.fn(),
    hasMore: false,
    isFetchingMore: false,
  };
}

/** O "hospedeiro" — a forma mínima de `calcular-page.tsx` (T095): a coluna larga monta
 *  `ScenariosList` direto SÓ quando `isWide`; a gaveta (`ScenariosListSheet`) continua montada como
 *  hoje, só que sem abrir sozinha (o teste nunca clica no botão que a abriria). */
function Host({ isWide }: { isWide: boolean }) {
  return (
    <>
      {isWide && (
        <ScenariosList onOpenScenario={vi.fn()} onClose={vi.fn()} lapsed={false} gate="active" />
      )}
      {!isWide && <ScenariosListSheet open onOpenChange={vi.fn()} onOpenScenario={vi.fn()} />}
    </>
  );
}

describe("019/PR-F — ScenariosList extraída e sem duplicação (T092)", () => {
  beforeEach(() => {
    useScenariosMock.mockReset().mockReturnValue(listState());
    useSessionStore.setState({
      status: "authenticated",
      user: { uid: "u1", email: "u@x.dev" } as never,
    });
  });
  afterEach(() => {
    cleanup();
    useSessionStore.setState({ status: "anonymous", user: null });
  });

  it("é um export nomeado do MESMO arquivo (não existia antes da T092)", () => {
    expect(typeof ScenariosList).toBe("function");
  });

  it("largo (matchMedia desktopLarge): o hospedeiro monta a lista DIRETO — uma instância só", () => {
    const mm = installMatchMedia(VIEWPORT.desktopLarge);
    render(<Host isWide />);
    mm.restore();

    // Uma lista de simulações na árvore — o testid do card já existe (scenarios-list-sheet.tsx).
    expect(screen.getAllByTestId("scenario-card")).toHaveLength(1);
    expect(screen.getByText(ROW.name)).toBeInTheDocument();
    // Nenhum <dialog> — a coluna larga NÃO é a gaveta.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("estreito (sem matchMedia — jsdom padrão): a gaveta de hoje, `useIsWide` é o único gate", () => {
    render(<Host isWide={false} />);

    // A gaveta continua sendo um <dialog> (Sheet) com a MESMA lista dentro.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByTestId("scenario-card")).toHaveLength(1);
  });
});
