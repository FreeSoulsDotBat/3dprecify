// 017/T012 (desenho §C.3) — o comando único do laço: compor → validar → escrever.
//
// Um comando só, com nome de gente, chamado IGUAL por humano e por CI: `pnpm fee:build`. É a mesma
// regra do `gate:all` (D4) — o job não pode rodar um comando que uma pessoa não consiga rodar igual
// na máquina dela, senão o CI e o local divergem sem ninguém perceber.
//
// Este arquivo é CLI: ele junta rede, disco e processo em volta de decisões que moram em `src/*.ts`,
// sob o ratchet de 100%. Nenhuma regra de dinheiro pode nascer aqui — os `.mjs` são isentos de
// cobertura DE PROPÓSITO, e a lição de 014/US4 é que uma suíte verde não prova um programa que roda.
// Por isso ele é BOOTADO sob `node` puro no gate e no job: o vitest é o resolvedor tolerante que
// escondeu três imports sem extensão.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { compor } from "./compose.ts";
import { lerPermissaoDeDispensa } from "./exemption.ts";
import { collectedAtFor } from "./guardrails.ts";
import { escreverArtefatosDePr } from "./pr-artifacts.ts";
import { projetarSemente, serializarSemente } from "./seed-projection.ts";
import { paraComposicao } from "./watch/vigia-artifacts.ts";

const ARTEFATO = fileURLToPath(new URL("../../../backend/app/data/catalog.json", import.meta.url));
const SEMENTE = fileURLToPath(
  new URL("../../../apps/web/src/shared/fee-catalog/seed.data.json", import.meta.url),
);
const VEREDITOS = fileURLToPath(new URL("../artifacts/", import.meta.url));
const BASELINES = fileURLToPath(new URL("../data/", import.meta.url));

const morrer = (mensagem) => {
  console.error(`fee:build — ${mensagem}`);
  process.exit(1);
};

const hoje = new Date().toISOString().slice(0, 10);
// `COLLECTED_AT=banana` saía com exit 0 e escrevia `lastReviewed: "banana"` em 78 entradas — o selo
// declarava aquilo fresco PARA SEMPRE (014, revisão adversarial de 2026-08-01). A validação vale
// para todos os caminhos.
const data = collectedAtFor({
  fromFixture: false,
  envDate: process.env.COLLECTED_AT,
  today: hoje,
});
if (!data.ok) morrer(data.reason);

if (!existsSync(ARTEFATO)) morrer(`artefato ausente em ${ARTEFATO}`);
const base = JSON.parse(readFileSync(ARTEFATO, "utf8"));

// Os vereditos que os jobs de coleta deixaram. Nenhum ⇒ nenhuma fatia: o laço roda, não muda nada, e
// diz isso em voz alta. Não é erro.
const vereditos = existsSync(VEREDITOS)
  ? readdirSync(VEREDITOS)
      .filter((f) => f.endsWith(".verdict.json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(`${VEREDITOS}${f}`, "utf8")))
  : [];

// 017/T023 — os artefatos que os VIGIAS deixaram (`<fonte>.vigia.json`). `paraComposicao` (testada,
// TS) é a única coisa que decide o que vira relato/decisão/baseline a reescrever; este arquivo só lê
// disco e repassa.
const artefatosDeVigia = existsSync(VEREDITOS)
  ? readdirSync(VEREDITOS)
      .filter((f) => f.endsWith(".vigia.json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(`${VEREDITOS}${f}`, "utf8")))
  : [];
const { vigias, decisao, baselinesParaEscrever } = paraComposicao(artefatosDeVigia);

const arquivosDoPr = [
  "backend/app/data/catalog.json",
  "apps/web/src/shared/fee-catalog/seed.data.json",
  ...Object.keys(baselinesParaEscrever).map((f) => `packages/fee-ingest/data/${f}`),
];

const desfecho = compor({
  base,
  vereditos,
  collectedAt: data.date,
  generatedAt: `${data.date}T00:00:00.000Z`,
  vigias,
  ...(decisao ? { decisao } : {}),
  dispensaPermitida: lerPermissaoDeDispensa(process.env.ALLOW_FRESHNESS_EXEMPTION),
  arquivosDoPr,
});

// O artefato só é reescrito quando há PR — e o catálogo composto SÓ EXISTE dentro do caso PR
// (FR-020a por tipo). Uma leitura que falhou não é "as taxas caíram" (I2/SC-806): o desfecho SEM_PR
// deixa o artefato byte a byte intocado, e não há sequer um valor a escrever.
const publicado = desfecho.kind === "PR" ? desfecho.catalogo : base;
if (desfecho.kind === "PR") {
  writeFileSync(ARTEFATO, `${JSON.stringify(publicado, null, 2)}\n`);
  // Os baselines de vigia viajam NO MESMO PR (decisão E.3/E.4) — nunca fora dele: um run SEM_PR não
  // move nem o catálogo nem o baseline, e o único arquivo que o desfecho "converge" toca é este.
  for (const [nome, conteudo] of Object.entries(baselinesParaEscrever)) {
    writeFileSync(`${BASELINES}${nome}`, `${JSON.stringify(conteudo, null, 2)}\n`);
  }
}
// 017/T016 — o corpo/título saem como ARQUIVOS (`artifacts/pr-body.md` + `artifacts/pr-title.txt`),
// nunca montados em shell dentro do job `publicar` (contrato `workflow-yaml.md`: "proíbe heredoc de
// corpo de PR"). Um desfecho SEM_PR não escreve nada — não há título nem corpo a publicar.
escreverArtefatosDePr(desfecho, VEREDITOS);

// A semente é RECONCILIADA sempre, mesmo num run SEM_PR: ela é saída, não documento (ADR-0029), e
// escrever os mesmos bytes é um no-op para o git. Fosse só no caminho PR, um artefato editado à mão
// deixaria a semente divergindo até o mês seguinte — que é o estado que o P0-a existe para acabar.
mkdirSync(dirname(SEMENTE), { recursive: true });
writeFileSync(SEMENTE, serializarSemente(projetarSemente(publicado)));

if (desfecho.kind === "SEM_PR") {
  console.log(`fee:build — SEM PR: ${desfecho.motivo}`);
} else {
  console.log(`fee:build — PR: ${desfecho.titulo}`);
  console.log(`fee:build — dispensa de revisão: ${desfecho.dispensa ? "CONCEDIDA" : "NEGADA"}`);
}
console.log(`fee:build — vereditos lidos: ${vereditos.length}`);
