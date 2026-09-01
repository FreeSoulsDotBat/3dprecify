import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { RunOutcome } from "./compose.ts";
import { BODY_FILENAME, TITLE_FILENAME, writePrArtifacts } from "./pr-artifacts.ts";
import { MARKETPLACE_COVERAGE, type CollectorVerdict, type Mk } from "./verdict.ts";

// 017/T016 — a ponte de disco entre `RunOutcome` (decisão, testada em `compose.test.ts`) e os
// arquivos que o job `publicar` passa para `gh pr create --title-file/--body-file`. O YAML não pode
// montar corpo de PR (heredoc proibido pelo contrato); ele só LÊ estes dois arquivos.

const vereditosVazios = Object.fromEntries(
    MARKETPLACE_COVERAGE.map((mk) => [
        mk,
        { kind: "NAO_LIDO", marketplace: mk, reason: "teste" } satisfies CollectorVerdict,
    ]),
) as Record<Mk, CollectorVerdict>;

const outcomePr: RunOutcome = {
    kind: "PR",
    titulo: "Tarifas — leitura de 2026-09-01",
    body: "## Estado por marketplace\n\n(conteúdo de teste)",
    dispensa: false,
    decisaoDoDono: false,
    catalog: { catalogVersion: "2026-09-01.0" },
    vereditos: vereditosVazios,
};

const outcomeSemPr: RunOutcome = { kind: "SEM_PR", motivo: "nada mudou" };

let dir: string | undefined;

afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
});

describe("escreverArtefatosDePr", () => {
    it("caso PR: escreve pr-body.md e pr-title.txt com o texto exato do desfecho", () => {
        dir = mkdtempSync(join(tmpdir(), "fee-refresh-pr-artifacts-"));
        writePrArtifacts(outcomePr, dir);

        expect(readFileSync(join(dir, BODY_FILENAME), "utf8")).toBe(outcomePr.body);
        expect(readFileSync(join(dir, TITLE_FILENAME), "utf8")).toBe(outcomePr.titulo);
    });

    it("caso SEM_PR: não escreve nenhum arquivo — não há título nem corpo a publicar", () => {
        dir = mkdtempSync(join(tmpdir(), "fee-refresh-pr-artifacts-"));
        writePrArtifacts(outcomeSemPr, dir);

        expect(existsSync(join(dir, BODY_FILENAME))).toBe(false);
        expect(existsSync(join(dir, TITLE_FILENAME))).toBe(false);
    });

    it("cria o diretório de destino se ele ainda não existir", () => {
        const base = mkdtempSync(join(tmpdir(), "fee-refresh-pr-artifacts-"));
        dir = join(base, "artifacts", "aninhado");
        writePrArtifacts(outcomePr, dir);

        expect(existsSync(join(dir, BODY_FILENAME))).toBe(true);
    });
});
