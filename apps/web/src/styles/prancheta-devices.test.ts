import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// 019/PR-A (ADR-0032 §5) — os DISPOSITIVOS DE PRANCHETA não entram no produto.
//
// `tf-phone-scroll` (rolagem sem barra clássica dentro da moldura de telefone) e `tf-price--rola`
// (máscara de esmaecimento no preço que rola) existem na folha do design para a prancheta ser lida
// parada. No app, cada plataforma desenha a própria barra e a rolagem de preço é raríssima — o
// handoff §1/§3 manda NÃO portar. A folha é um arquivo versionado em `docs/design/handoff-019/`, e
// um `cp` distraído é o caminho mais provável de eles entrarem — por isso a guarda olha o código E
// o bundle (o bundle pega um import que o código-fonte esconde).

const PROIBIDAS = ["tf-phone-scroll", "tf-price--rola"] as const;
const SRC = join(__dirname, "..");
const DIST = join(__dirname, "..", "..", "dist");

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(p)) out.push(p);
  }
  return out;
}

function ocorrencias(files: string[], base: string): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const txt = readFileSync(f, "utf8");
    for (const cls of PROIBIDAS) {
      if (txt.includes(cls)) hits.push(`${cls} em ${relative(base, f).replace(/\\/g, "/")}`);
    }
  }
  return hits;
}

describe("019/ADR-0032 — dispositivos de prancheta ficam na prancheta", () => {
  it("zero ocorrência no código-fonte (css/ts/tsx)", () => {
    const hits = ocorrencias(walk(SRC, /\.(css|ts|tsx)$/), SRC).filter(
      // este próprio arquivo cita os nomes para procurá-los
      (h) => !h.endsWith("styles/prancheta-devices.test.ts"),
    );
    expect(hits).toEqual([]);
  });

  it("zero ocorrência no bundle (quando apps/web/dist existir)", () => {
    const files = walk(DIST, /\.(css|js)$/);
    if (files.length === 0) return; // sem build local: o e2e (que faz `pnpm build`) cobre este ramo
    expect(ocorrencias(files, DIST)).toEqual([]);
  });
});
