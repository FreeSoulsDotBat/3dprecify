import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// Review do PR #58 (2026-08-15) — A GUARDA QUE FALTAVA.
//
// O plano de correção (`docs/homologacao/automatizada/PLANO-CORRECAO.md` §3) escreveu, sobre as
// correções de transbordo: *"O que dá trabalho não é o conserto — é a **guarda**, e ela é
// obrigatória"*. As correções entraram e a guarda não. Esta é ela, e ela vive em `tests/e2e`
// justamente porque é aqui que a CI olha — uma medição feita uma vez por script não impede
// regressão nenhuma.
//
// Duas coisas que esta guarda faz e a suíte de overflow que já existia (`a11y-overflow.spec.ts`)
// não fazia:
//
// 1. **Mede NÓS DE TEXTO por `Range`, não só caixas de elemento.** O defeito que originou tudo —
//    2.100px de rolagem com um nome de sub-custo de 300 caracteres — tem como culpado um texto que
//    pinta FORA da caixa sem alargá-la. Nenhum `getBoundingClientRect()` de elemento o enxerga, e
//    foi assim que ele passou por baixo das asserções existentes.
// 2. **Inclui 426px**, o primeiro pixel do layout desktop. As larguras testadas até aqui pulavam
//    exatamente a faixa onde a sidebar de 240px deixa ~150px de conteúdo — e foi lá que o teaser
//    premium estourou 131px.
//
// Dado adversarial de propósito: o conserto é `overflow-wrap`, e um texto COM espaços quebra
// sozinho. Só um texto SEM espaço nenhum prova que a regra está lá.

const t = messages.calculator;

/** As larguras que importam, e por quê:
 *  360/390 mobile · **426 o primeiro pixel do desktop** · **599/600 os dois lados do corte do rail
 *  forçado** (abaixo de 600 a barra lateral recolhe sozinha para 76px — sem isso, os 240px dela
 *  deixavam ~150px de conteúdo e a página inteira transbordava) · 1024 a faixa do meio · 1279 o
 *  último pixel antes do corte do 018 · 1440 o wide · **1600/1920 o desktop cheio** (SC-003 do 018
 *  nomeia as duas e a lista parava em 1440 — o desenho de autoridade é a 1920px, e era exatamente a
 *  largura que a guarda não media; fechamento do 018, 2026-08-26).
 *
 *  O par 599/600 existe para provar o corte dos DOIS lados: um limiar testado só por dentro passa
 *  igual se alguém trocar o `max-width` por outro número. */
const LARGURAS = [360, 390, 426, 599, 600, 1024, 1279, 1440, 1600, 1920] as const;

/** Um nome que um vendedor cola de verdade: código de produto sem espaço nenhum. */
const NOME_SEM_ESPACO = "A".repeat(300);

interface Estouro {
  eixoX: number;
  culpados: string[];
}

/** Mede o transbordo horizontal E nomeia o culpado, incluindo nós de TEXTO. */
async function medir(page: Page): Promise<Estouro> {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    const larg = document.documentElement.clientWidth;
    const culpados: string[] = [];

    for (const node of Array.from(document.querySelectorAll("*"))) {
      const r = node.getBoundingClientRect();
      if (r.right > larg + 2) {
        culpados.push(`CAIXA ${node.tagName}.${String(node.className).slice(0, 40)}`);
      }
    }
    // Os nós de TEXTO — a metade que a caixa não denuncia.
    const andarilho = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n = andarilho.nextNode();
    while (n) {
      if ((n.textContent ?? "").trim().length > 0) {
        const faixa = document.createRange();
        faixa.selectNodeContents(n);
        const r = faixa.getBoundingClientRect();
        if (r.right > larg + 2) {
          const pai = n.parentElement;
          culpados.push(`TEXTO em ${pai?.tagName}.${String(pai?.className ?? "").slice(0, 40)}`);
        }
      }
      n = andarilho.nextNode();
    }
    return { eixoX: el.scrollWidth - el.clientWidth, culpados: Array.from(new Set(culpados)) };
  });
}

test("a calculadora não rola na horizontal em nenhuma largura suportada, nem com um nome sem espaços", async ({
  page,
}) => {
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

  // O dado adversarial: um sub-custo cujo nome é impossível de quebrar por espaço. Ele aparece no
  // detalhamento como rótulo de linha, que é exatamente onde os 2.100px nasceram.
  await page.getByRole("button", { name: t.outrosCustos.addCost }).click();
  await page
    .getByRole("textbox", { name: /^Nome do custo$/ })
    .first()
    .fill(NOME_SEM_ESPACO);
  await page
    .getByRole("textbox", { name: /^Valor$/ })
    .first()
    .fill("10");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);

  for (const largura of LARGURAS) {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.waitForTimeout(150);
    const { eixoX, culpados } = await medir(page);
    expect(
      eixoX,
      `${largura}px: rolagem horizontal — culpados: ${culpados.join(" ;; ")}`,
    ).toBeLessThanOrEqual(1);
  }
});

test("as abas públicas não rolam na horizontal em nenhuma largura suportada", async ({ page }) => {
  for (const rota of ["/catalogo", "/kits", "/historico", "/privacidade"]) {
    await page.goto(rota);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.waitForTimeout(150);
      const { eixoX, culpados } = await medir(page);
      expect(
        eixoX,
        `${rota} a ${largura}px: rolagem horizontal — culpados: ${culpados.join(" ;; ")}`,
      ).toBeLessThanOrEqual(1);
    }
  }
});
