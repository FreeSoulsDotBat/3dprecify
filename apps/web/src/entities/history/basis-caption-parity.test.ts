import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BASIS_CAPTION } from "./history-format";

// B4 (2026-09-01) — a TRAVA. `headline_basis` tem 4 espelhos no backend, mantidos IGUAIS por
// `backend/tests/test_history_basis_mirror.py`; este arquivo estende a paridade ao front, lendo o
// enum publicado em `contracts/openapi.json` (`components.schemas.SnapshotIn.properties
// .headlineBasis.enum`) — a MESMA fonte que o backend exporta a partir do seu `Literal` em
// `SnapshotIn.headline_basis` (`api/history.py`). Ler o JSON do contrato em vez do client Orval
// gerado (`shared/api/generated.ts`) é deliberado: o gerado só reflete o contrato depois de
// `pnpm gen:api` rodar de novo, e um enum novo adicionado ao backend sem regenerar o client não
// pegaria aqui se a fonte fosse o gerado.
//
// Se um `kind` novo entrar só de um lado — no backend sem vir para o front, ou num `BASIS_CAPTION`
// alargado sem o backend aceitar — este teste fica VERMELHO. Prova de não-vacuidade (relatada na
// entrega, não persistida): (a) acrescentar uma chave fictícia a `BASIS_CAPTION` faz o teste falhar
// (front > contrato); (b) remover uma chave real de `BASIS_CAPTION` também falha (front < contrato).

const openApiPath = fileURLToPath(
    new URL("../../../../../contracts/openapi.json", import.meta.url),
);

function canonicalHeadlineBasisValues(): string[] {
    const spec = JSON.parse(readFileSync(openApiPath, "utf-8")) as {
        components: {
            schemas: {
                SnapshotIn: {
                    properties: {
                        headlineBasis: { enum: string[] };
                    };
                };
            };
        };
    };
    const values = spec.components.schemas.SnapshotIn.properties.headlineBasis.enum;
    expect(values.length).toBeGreaterThan(0); // um enum vazio derrotaria a guarda em silêncio
    return values;
}

describe("BASIS_CAPTION — paridade com o enum publicado em contracts/openapi.json", () => {
    it("cobre exatamente o conjunto que o backend publica — nem a mais, nem a menos", () => {
        const canonical = canonicalHeadlineBasisValues().slice().sort();
        const front = Object.keys(BASIS_CAPTION).sort();
        expect(front).toEqual(canonical);
    });
});
