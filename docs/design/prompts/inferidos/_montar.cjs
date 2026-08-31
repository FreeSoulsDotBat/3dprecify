/**
 * Monta os prompts de Claude Design desta pasta.
 *
 * Cada arquivo final é composto por quatro partes, nesta ordem:
 *
 *   Contexto 1 — A plataforma          `_CONTEXTO-1-PLATAFORMA.md`  (igual em todos)
 *   Contexto 2 — Onde esta peça vive   `_contextos/<area>.json`     (mapa da área + inserção da peça)
 *   Contexto 3 — Regras de marca e DS  `_CONTEXTO-3-REGRAS.md`      (igual em todos)
 *   O pedido                           `_corpos/<id>.md`            (o prompt de desenho em si)
 *
 * A fonte de verdade é sempre `_corpos/` + os contextos — o arquivo final é derivado e pode ser
 * reconstruído a qualquer momento. Rodar de novo é idempotente.
 *
 *   node docs/design/prompts/inferidos/_montar.cjs
 *
 * Também (re)gera `README.md`, o índice navegável por área e prioridade.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS, roda fora do bundle */
const fs = require("fs");
const path = require("path");

const BASE = __dirname;
const SELO = "<!-- contextos-embutidos -->";

const ctx1 = fs.readFileSync(path.join(BASE, "_CONTEXTO-1-PLATAFORMA.md"), "utf8").trim();
const ctx3 = fs.readFileSync(path.join(BASE, "_CONTEXTO-3-REGRAS.md"), "utf8").trim();
const indice = JSON.parse(fs.readFileSync(path.join(BASE, "_achados", "_indice.json"), "utf8"));

const AREAS = {
    calculadora: "Calculadora e precificação",
    catalogo: "Catálogo (filamentos, impressoras, produtos)",
    kits: "Kits / BOM multi-peça",
    orcamentos: "Orçamentos (registros congelados, exportação, comparação)",
    simulacoes: "Simulações salvas (cenários de marketplace)",
    billing: "Billing, planos e Conta",
    shell: "Shell, navegação e telas transversais",
    "design-system": "Primitivos do Design System",
};
const ORDEM_PRIO = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

// ---- contexto funcional por área ----
const ctx2 = {};
for (const area of Object.keys(AREAS)) {
    const p = path.join(BASE, "_contextos", `${area}.json`);
    if (fs.existsSync(p)) ctx2[area] = JSON.parse(fs.readFileSync(p, "utf8"));
}

const porArea = {};
for (const item of indice) (porArea[item.area] ||= []).push(item);

function blocoContexto2(item) {
    const c = ctx2[item.area];
    const titulo = AREAS[item.area] || item.area;
    const L = ["# Contexto 2 — Onde esta peça vive", ""];

    if (c && c.mapaFuncional) {
        L.push(`## O mapa funcional de ${titulo}`, "", c.mapaFuncional.trim(), "");
    }

    const ins = c && (c.insercoes || []).find((x) => x.id === item.id);
    L.push("## O ponto exato de inserção desta peça", "");
    if (ins) {
        L.push(
            `- **Onde vive:** ${ins.ondeVive}`,
            `- **Como o vendedor chega:** ${ins.comoChega}`,
            `- **Vizinhança imediata:** ${ins.vizinhanca}`,
            `- **Dados que chegam (e o que ela devolve):** ${ins.dadosQueChegam}`,
            `- **O que acontece depois:** ${ins.oQueAconteceDepois}`,
            "",
        );
    } else {
        L.push(
            `Esta peça é **${item.nome}** (escala: ${item.escala}). O detalhe do ponto de inserção está na`,
            "seção **O que desenhar** do pedido, mais abaixo.",
            "",
        );
    }

    const vizinhos = (porArea[item.area] || []).filter((x) => x.id !== item.id);
    if (vizinhos.length) {
        L.push(
            "## Peças vizinhas que têm prompt próprio",
            "",
            "Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor",
            "no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem",
            "redesenhá-las:",
            "",
            vizinhos.map((v) => `\`${v.nome}\``).join(" · "),
            "",
        );
    }
    return L.join("\n");
}

let montados = 0;
const semCorpo = [];

for (const item of indice) {
    const corpoPath = path.join(BASE, "_corpos", `${item.id}.md`);
    if (!fs.existsSync(corpoPath)) {
        semCorpo.push(`${item.area}/${item.id}`);
        continue;
    }
    const corpo = fs.readFileSync(corpoPath, "utf8").trim();
    const partes = [
        SELO,
        "",
        "> Cole este arquivo inteiro no Claude Design. Ele traz, nesta ordem: **(1)** o que a plataforma é e",
        "> faz, **(2)** onde exatamente esta peça vive dentro dela, **(3)** as regras de marca e Design System",
        "> que o desenho deve obedecer, e **(4)** o pedido de desenho propriamente dito.",
        "",
        "---",
        "",
        ctx1,
        "",
        "---",
        "",
        blocoContexto2(item).trim(),
        "",
        "---",
        "",
        ctx3,
        "",
        "---",
        "",
        "# O pedido",
        "",
        corpo,
        "",
    ];
    fs.writeFileSync(path.join(BASE, item.area, `${item.id}.md`), partes.join("\n"));
    montados++;
}

// ---- índice ----
const totais = { ALTA: 0, MEDIA: 0, BAIXA: 0 };
for (const item of indice) totais[item.prioridade]++;
const comCtx2 = Object.keys(ctx2).length;

const linhas = [
    "# Prompts de Claude Design — superfícies de UI que nunca foram prototipadas",
    "",
    "Cada arquivo desta pasta é **um prompt autocontido**: abra, copie tudo, cole no Claude Design.",
    "",
    "## O que cada arquivo contém",
    "",
    "| Parte | Conteúdo | Fonte |",
    "|---|---|---|",
    "| **Contexto 1** | O que a plataforma é e faz — produto, público, as 5 abas, o modelo de preço, os canais de marketplace, a fronteira do Premium e os estados reais (offline, Premium pausado, sessão expirada, degradação) | `_CONTEXTO-1-PLATAFORMA.md` |",
    "| **Contexto 2** | Onde a peça vive — o mapa funcional da área e o ponto exato de inserção: rota, como o vendedor chega, vizinhança, dados que entram e saem, o que acontece depois | `_contextos/<area>.json` |",
    "| **Contexto 3** | As regras — marca, tokens dos dois temas, tipografia, geometria, os primitivos `tf-*` que já existem, WCAG 2.2 AA e as regras de honestidade | `_CONTEXTO-3-REGRAS.md` |",
    "| **O pedido** | O desenho pedido: o que já existe hoje, dados e textos literais, estados obrigatórios, viewports, armadilhas já pagas, entregável e perguntas ao dono | `_corpos/<id>.md` |",
    "",
    `Contexto 2 disponível para **${comCtx2} de ${Object.keys(AREAS).length}** áreas.`,
    "",
    "## De onde veio esta lista",
    "",
    "Auditoria de 16 agentes (8 mapeadores + 8 verificadores adversariais) sobre o repositório inteiro,",
    "confrontando cada superfície de UI existente contra as **três** autoridades de design que o projeto tem:",
    "",
    "1. `docs/design/prompts/claude-design-prototype.md` §E — o protótipo clicável de 2026-07-02 (E1–E9,",
    "   com checkout explicitamente FORA de escopo);",
    "2. `.design-import/` — o DS exportado + 6 telas-esqueleto (59–131 linhas cada) + 2 componentes;",
    "3. `specs/018-abas-desktop/design/Abas-Desktop.dc.html` — o canvas do dono: rail + as 4 abas **desktop**.",
    "",
    `**163 candidatas examinadas · ${indice.length} confirmadas sem protótipo · 6 derrubadas** pelos`,
    "verificadores (estavam desenhadas e o mapeador errou).",
    "",
    `Prioridade: **${totais.ALTA} ALTA · ${totais.MEDIA} MEDIA · ${totais.BAIXA} BAIXA**.`,
    "",
    "> Uma spec `ux-*.md` escrita pelo subagente `designer-ux` **não** conta como protótipo — é inferência de",
    "> IA em prosa. Screenshot de homologação também não: prova que a tela existe, nunca que houve desenho",
    "> antes dela.",
    "",
    "## Antes de rodar os prompts",
    "",
    "Leia **[PERGUNTAS-AO-DONO.md](PERGUNTAS-AO-DONO.md)** — 605 decisões de produto que os prompts não",
    "puderam tomar no seu lugar (rótulo ambíguo, hierarquia entre dois avisos, regra que nunca foi escrita).",
    "Cada prompt roda sem elas, mas responder as da sua área antes economiza uma rodada de redesenho.",
    "",
];

for (const [area, titulo] of Object.entries(AREAS)) {
    const itens = (porArea[area] || []).sort(
        (a, b) => ORDEM_PRIO[a.prioridade] - ORDEM_PRIO[b.prioridade] || a.id.localeCompare(b.id),
    );
    if (!itens.length) continue;
    linhas.push(`## ${titulo} (${itens.length})`, "");
    linhas.push("| Prioridade | Escala | Prompt | O quê |", "|---|---|---|---|");
    for (const i of itens) {
        linhas.push(
            `| ${i.prioridade} | ${i.escala} | [\`${i.id}\`](${area}/${i.id}.md) | ${i.nome} |`,
        );
    }
    linhas.push("");
}

linhas.push(
    "## Como regerar",
    "",
    "```bash",
    "node docs/design/prompts/inferidos/_montar.cjs",
    "```",
    "",
    "Edite `_corpos/<id>.md` (o pedido) ou os arquivos de contexto e rode de novo — os arquivos finais são",
    "derivados. As fichas cruas da auditoria (o que foi inferido, o impacto, e a refutação adversarial de",
    "cada achado) ficam em `_achados/<id>.json`.",
    "",
);

fs.writeFileSync(path.join(BASE, "README.md"), linhas.join("\n"));

console.log(
    `montados: ${montados} · sem corpo: ${semCorpo.length} · areas com contexto 2: ${comCtx2}`,
);
if (semCorpo.length) console.log("  faltando corpo: " + semCorpo.join(", "));
console.log("README.md gerado.");
