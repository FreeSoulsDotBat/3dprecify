import type { CatalogDiff } from "./catalog-diff.ts";
import type { DispensaDecisao } from "./exemption.ts";
import { isInerte } from "./inert-fields.ts";
import { type CollectorVerdict, MARKETPLACE_COVERAGE, type Mk } from "./verdict.ts";

// 017/T010 (`contracts/pr-mensal.md`) — o corpo do PR mensal como FUNÇÃO PURA.
//
// Ele é a INTERFACE do laço com o humano que revisa dinheiro, e por isso não mora em YAML: shell num
// workflow é o único código deste repositório que nenhum gate executa. O que este módulo tem de
// garantir é uma propriedade que a suíte de 014/US4 não tinha — que o corpo não afirme, na mesma
// página, duas coisas contraditórias. Lá ele imprimia "Sem mudança de tarifa nesta leitura"
// diretamente acima de "Categorias removidas da fonte", e mil testes não viram, porque todos
// afirmavam PRESENÇA e nenhum afirmava AUSÊNCIA.

/** O separador de `antigo → novo`. Exportado porque o teste de AUSÊNCIA precisa procurá-lo — e por
 *  isso ele não pode aparecer em NENHUMA outra parte do corpo. */
export const MARCADOR_MUDANCA = "→";

/** O título da seção condicional §4. Exportado pela mesma razão. */
export const TITULO_MUDANCAS = "## Mudanças de tarifa";

const TITULO_ESTADO = "## Estado por marketplace";

/** A prova-de-vida mensal: uma execução sem novidade É a notícia (Adendo A14). */
const SEM_NOTICIA = "Sem mudança de tarifa nesta leitura — apenas a data de reverificação avançou.";

export type FonteDeDecisao = { rotulo: string; valor: string; url: string };

/** clarify Q2 — duas fontes discordam sobre o mesmo número, e quem decide é o dono. */
export type SecaoDeDecisao = {
  titulo: string;
  fonteA: FonteDeDecisao;
  fonteB: FonteDeDecisao;
  /** A data que a própria página declara, quando declara. */
  autoDatacao: string | null;
};

/** clarify Q8 / US5-AC5 — uma folha de dinheiro que veio de OCR. O limiar do banner é decidido no
 *  módulo de OCR (PR-C), onde o dono o ratifica; aqui ele chega como FATO, e o corpo só RENDERIZA. */
export type FolhaDeOcr = {
  rotulo: string;
  lido: number;
  anterior: number;
  imagemUrl: string;
  acimaDoLimiar: boolean;
};

/** decisão E.3 — o alerta de vigia sai no MESMO PR, em seção cujo título diz que nada mudou. */
export type RelatoDeVigia = {
  fonte: string;
  sourceUrl: string;
  resumo: string;
  diffBaseline?: string;
};

export type CorpoArgs = {
  vereditos: Record<Mk, CollectorVerdict>;
  diff: CatalogDiff;
  vigias: readonly RelatoDeVigia[];
  dispensa: DispensaDecisao;
  folhasDeOcr?: readonly FolhaDeOcr[];
  decisao?: SecaoDeDecisao;
};

const rotulo = (e: { categoryName: string | null; categoryId: string | null }) =>
  e.categoryName ?? e.categoryId ?? "(sem categoria)";

/** Um valor de folha na tabela. `undefined` é ausência e vira travessão, nunca a string "undefined". */
const celula = (v: unknown): string => {
  if (v === undefined) return "—";
  if (v === null || typeof v !== "object") return String(v);
  return `\`${JSON.stringify(v).replaceAll("|", "\\|")}\``;
};

/** O diff não traz notícia NENHUMA — nem tabela, nem seção. É a condição da prova-de-vida.
 *
 *  Enumerada campo a campo e não derivada de `freshnessOnly`, pelo mesmo motivo do `refresh.ts`: no
 *  dia em que os dois divergirem, é o CORPO que precisa estar certo, porque é ele que o humano lê. */
function semNoticia(diff: CatalogDiff): boolean {
  return (
    diff.addedCategories.length === 0 &&
    diff.removedCategories.length === 0 &&
    diff.removedEntries.length === 0 &&
    diff.reparented.length === 0 &&
    diff.addedMarketplaces.length === 0 &&
    diff.removedMarketplaces.length === 0
  );
}

/** Fonte e data de coleta DECLARADAS pelo coletor daquele marketplace — nunca deduzidas. */
function procedencia(vereditos: Record<Mk, CollectorVerdict>, marketplace: string): string {
  const v = (vereditos as Record<string, CollectorVerdict | undefined>)[marketplace];
  if (v?.kind === "LIDO") return `${v.sourceUrl} · coletado em ${v.collectedAt}`;
  // Uma mudança cujo coletor não declarou LIDO é uma contradição do próprio run, e ela aparece em
  // vez de ser mascarada por um traço bonito.
  return "(procedência não declarada por nenhum coletor desta execução)";
}

/**
 * §C.2-bis — de ONDE veio a autoridade para remover isto.
 *
 * Sem esta linha o revisor lê "Colchões saiu do catálogo" e não tem como distinguir os dois fatos
 * que a produzem, que exigem ações OPOSTAS: a fonte deixou de publicar a categoria (notícia — e a
 * remoção está certa) ou o coletor não leu aquela parte da página (incidente — e a remoção é um
 * dano). A declaração de exaustividade é o que separa os dois, então ela é impressa.
 *
 * O segundo caso não é hipotético nem some sozinho: uma remoção que apareça no diff SEM nenhum
 * coletor tendo declarado exaustividade só pode ter vindo de edição à mão do artefato — e isso é
 * exatamente o que o revisor precisa ver escrito, em vez de deduzir.
 */
function procedenciaDaRemocao(
  vereditos: Record<Mk, CollectorVerdict>,
  marketplace: string,
): string {
  const v = (vereditos as Record<string, CollectorVerdict | undefined>)[marketplace];
  if (v?.kind === "LIDO" && v.slice.exhaustive.length > 0) {
    const secoes = v.slice.exhaustive.map((s) => `\`${s}\``).join("+");
    return `ausente na leitura EXAUSTIVA de ${secoes} em ${v.collectedAt} (${v.sourceUrl})`;
  }
  return (
    "presente antes e ausente agora, mas nenhum coletor declarou leitura exaustiva nesta " +
    "execução — isto NÃO é a fonte deixando de publicar; confira antes de aprovar"
  );
}

/**
 * O corpo do PR mensal, na ORDEM FIXA do contrato.
 *
 * Pura: nenhum `new Date()`, nenhuma leitura de disco. Duas chamadas com o mesmo insumo produzem os
 * mesmos bytes — que é o que torna a idempotência do §C.4 verificável.
 */
export function corpoDoPrMensal(args: CorpoArgs): string {
  const { vereditos, diff, vigias, dispensa } = args;
  const folhasDeOcr = args.folhasDeOcr ?? [];
  const out: string[] = [];

  // ── §1 DECISÃO (topo absoluto — clarify Q2) ────────────────────────────────────────────────────
  if (args.decisao) {
    const d = args.decisao;
    out.push(
      "## DECISÃO DO DONO — duas fontes discordam",
      "",
      d.titulo,
      "",
      `- **${d.fonteA.rotulo}**: ${d.fonteA.valor} — ${d.fonteA.url}`,
      `- **${d.fonteB.rotulo}**: ${d.fonteB.valor} — ${d.fonteB.url}`,
      `- **Auto-datação da página**: ${d.autoDatacao ?? "a página não se auto-data"}`,
      "",
      "Nenhum dado foi alterado por esta divergência; a dispensa de revisão está forçada a NÃO.",
      "",
    );
  }

  // ── §2 Banner de divergência de OCR (clarify Q8) ───────────────────────────────────────────────
  if (folhasDeOcr.some((f) => f.acimaDoLimiar)) {
    out.push(
      "> **Divergência acima do limiar declarado — confira a imagem antes de aprovar.**",
      "",
    );
  }

  // ── §3 Estado por marketplace (SEMPRE, 100% dos corpos — SC-1003) ──────────────────────────────
  out.push(TITULO_ESTADO, "", "| marketplace | estado | detalhe |", "|---|---|---|");
  for (const mk of MARKETPLACE_COVERAGE) {
    const v = vereditos[mk];
    if (v.kind === "LIDO") {
      out.push(`| ${mk} | LIDO | releitura de ${v.collectedAt} — ${v.sourceUrl} |`);
    } else if (v.kind === "ABORTADO") {
      out.push(`| ${mk} | ABORTADO | ${v.reason} — ${v.sourceUrl} |`);
    } else {
      out.push(`| ${mk} | NÃO LIDO | ${v.reason} |`);
    }
  }
  out.push("");

  // ── §4 Mudanças de tarifa (só se houver) ───────────────────────────────────────────────────────
  const materiais = diff.changedEntries
    .map((e) => ({ ...e, changes: e.changes.filter((c) => !isInerte(c.path)) }))
    .filter((e) => e.changes.length > 0);

  if (materiais.length > 0) {
    out.push(
      TITULO_MUDANCAS,
      "",
      "| marketplace | categoria | campo | antes/depois | fonte |",
      "|---|---|---|---|---|",
    );
    for (const e of materiais) {
      for (const c of e.changes) {
        out.push(
          `| ${e.marketplace} | ${rotulo(e)} | ${c.path} | ${celula(c.before)} ${MARCADOR_MUDANCA} ${celula(c.after)} | ${procedencia(vereditos, e.marketplace)} |`,
        );
      }
    }
    out.push("");
  }

  // As outras notícias do diff — cada uma é decisão humana, e nenhuma pode conviver com a
  // prova-de-vida abaixo.
  const outras: string[] = [];
  const removidas: string[] = [];
  for (const c of diff.addedCategories) {
    outras.push(
      `- **${c.marketplace}**: categoria NOVA na fonte — ${c.name} (\`${c.categoryId}\`)`,
    );
  }
  for (const c of diff.removedCategories) {
    removidas.push(`- ${c.name} — ${procedenciaDaRemocao(vereditos, c.marketplace)}`);
  }
  for (const e of diff.removedEntries) {
    removidas.push(
      `- \`${JSON.stringify(e.determinants)}\` (o slot correspondente deixa de resolver) — ` +
        procedenciaDaRemocao(vereditos, e.marketplace),
    );
  }
  for (const r of diff.reparented) {
    outras.push(
      `- **${r.marketplace}**: ${r.name} mudou de pai (muda a alíquota EFETIVA sem nenhum campo diferir) — de ${r.parentBefore ?? "(raiz)"} para ${r.parentAfter ?? "(raiz)"}`,
    );
  }
  if (removidas.length > 0) {
    out.push("### Categorias removidas da fonte (decisão humana necessária)", "", ...removidas, "");
  }
  if (outras.length > 0)
    out.push("## Notícias de cobertura (decisão humana necessária)", "", ...outras, "");

  if (materiais.length === 0 && semNoticia(diff)) out.push(SEM_NOTICIA, "");

  // AC5 — sem lido × anterior × link, a revisão humana de um número lido por OCR é teatro: as
  // guardas pegam ~35% do erro plausível de célula única (RA2), e o resto depende de alguém abrir a
  // imagem. Sai SEMPRE que houver folha de OCR, esteja acima ou abaixo do limiar do banner.
  if (folhasDeOcr.length > 0) {
    out.push("### Folhas lidas por OCR — confira contra a imagem", "");
    for (const f of folhasDeOcr) {
      out.push(
        `- ${f.rotulo}: lido \`${f.lido}\` · anterior \`${f.anterior}\` · imagem: ${f.imagemUrl}`,
      );
    }
    out.push("");
  }

  // ── §5 Vigias (só se houver) ───────────────────────────────────────────────────────────────────
  if (vigias.length > 0) {
    // A frase faz parte do TÍTULO de propósito: ninguém pode ler alerta de vigia como escrita de
    // catálogo (decisão E.3/E.5 — o vigia não tem caminho de tipo até o dinheiro).
    out.push("## Vigias (nenhum dado alterado)", "");
    for (const v of vigias) {
      out.push(`- **${v.fonte}** — ${v.resumo} (${v.sourceUrl})`);
      if (v.diffBaseline) out.push("", "```diff", v.diffBaseline, "```", "");
    }
    out.push("");
  }

  // ── §6 Rodapé de dispensa (P0-b) ───────────────────────────────────────────────────────────────
  out.push(
    "---",
    "",
    "**Dispensa de revisão (`ALLOW_FRESHNESS_EXEMPTION`)**: " +
      `${dispensa.concedida ? "CONCEDIDA" : "NEGADA"} — ${dispensa.motivo}.`,
  );
  return out.join("\n");
}
