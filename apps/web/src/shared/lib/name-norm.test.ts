import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { nameNorm } from "./name-norm";

// 019/PR-D (T063) — o vetor COMPARTILHADO com o backend (ADR-0033 §4). O caminho é relativo a
// ESTE arquivo, não ao cwd do vitest, e falha explícito se o fixture não existir.
const FIXTURE_PATH = fileURLToPath(
  new URL(
    "../../../../../specs/019-porte-design/contracts/fixtures/name-norm.json",
    import.meta.url,
  ),
);

interface FixtureCase {
  in: string;
  out: string;
  why: string;
}

function readFixture(): FixtureCase[] {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { cases: FixtureCase[] };
  if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error(`fixture ${FIXTURE_PATH} sem casos`);
  }
  return parsed.cases;
}

describe("nameNorm — o vetor compartilhado com o backend (ADR-0033 §4)", () => {
  const cases = readFixture();

  for (const { in: input, out, why } of cases) {
    it(`${why} (${JSON.stringify(input)} → ${JSON.stringify(out)})`, () => {
      expect(nameNorm(input)).toBe(out);
    });
  }
});
