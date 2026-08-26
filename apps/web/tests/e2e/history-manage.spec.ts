import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import {
  grantPremium,
  recordFromCalculator,
  revokePremium,
  signUpThrowaway,
} from "./history-helpers";

// 009/T024 (E4, PR-B) e2e — the two claims of PR-B that only the REAL stack can settle:
//
//   · US3/SC-502 — the TWO-SHELF rule. A snapshot CONTAINS its values; the catalog LIVE-reflects. So
//     deleting the very product a snapshot was cut from must move NOTHING on the frozen document — it
//     only makes the read-time "Abrir produto" origin link stop resolving. No FK, no cascade, no lie.
//   · US6/SC-508 — a lapse is not a deletion. Reading stays open (the Q3 read-only freeze); the
//     manage surface (rename/delete) simply disappears; a re-grant restores it with the data intact.
//
// The unit/integration layers prove each half in isolation (origin.test.ts, test_history.py §3c/§2c);
// this is the layer where the client's live catalog query and the server's read-time gate run
// together against Postgres — the only place the two-shelf contrast is actually visible to a seller.
//
// A note on navigation: the detail is reached by OPENING it from the ledger (a card click), exactly
// as a seller does — never by a cold deep-link (013/deep-links.spec.ts covers THAT class directly).
// `?snapshot=<id>` requires an authenticated session, so a full page-load of that URL races the
// session bootstrap; the list `/historico` is public and is the real entry point to a record.

const t = messages;

/** Open a snapshot's detail the way a seller does — from the ledger. The card TITLE is stable across
 *  churn/lapse (a frozen label or the frozen origin name), so it identifies the record throughout. */
async function openFromLedger(page: Page, cardTitle: string): Promise<void> {
  await page.goto("/historico");
  await page.getByText(cardTitle).first().click();
  // 013/F-02 (D1=A): the detail is `?snapshot=<id>` on `/historico`, not `/historico/<id>` — the
  // old 2-segment shape `base:'./'` blanked on cold-load, which is exactly why it moved.
  await expect(page).toHaveURL(/\/historico\?snapshot=.+/);
}

// 014/T119 — um rótulo de UMA palavra de 120 caracteres. Não é entrada hostil: 120 é o `maxLength`
// do próprio campo, então o produto CONVIDA a digitar exatamente isto. Sem quebra de palavra a
// largura mínima do título vira a largura da palavra, e o detalhe do histórico rola de lado — o
// seller perde a coluna de valores para ler um rótulo que ele mesmo escreveu.
//
// Asserção geométrica pela mesma razão da T118: extrair texto é cego para transbordo.
const PALAVRA_120 = "a".repeat(120);

for (const vp of [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]) {
  test(`T119: rótulo de palavra única de 120 caracteres não faz o histórico rolar de lado (${vp.width}px)`, async ({
    page,
  }, info) => {
    const email = await signUpThrowaway(page, `hist-wrap${vp.width}-${info.workerIndex}`);
    grantPremium(email);
    await page.setViewportSize(vp);

    await page.goto("/calcular");
    await page.reload(); // a concessão só é lida na próxima carga
    await page.getByRole("button", { name: t.historico.saveAction }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(t.historico.saveSheetIntro)).toBeVisible();
    await sheet.getByRole("textbox", { name: t.historico.labelField }).fill(PALAVRA_120);
    await sheet.getByRole("button", { name: t.historico.saveSheetSubmit }).click();
    // ASSENTAR antes de navegar (online ⇒ synced) — senão o `goto` aborta o enfileiramento+drenagem
    // em voo e o registro se perde em silêncio. É a mesma espera que os dois testes abaixo já fazem,
    // e omiti-la produziu uma falha só na PRIMEIRA tentativa (a repetição passava com a máquina
    // quente), que é exatamente a forma como uma corrida real se disfarça de instabilidade.
    await expect(page.getByText(t.historico.saved)).toBeVisible();

    // A LISTA primeiro: o card do razão carrega o mesmo rótulo.
    await page.goto("/historico");
    await expect(page.getByText(PALAVRA_120).first()).toBeVisible();
    const naLista = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(naLista.scrollWidth, `razão em ${vp.width}px`).toBe(naLista.clientWidth);

    // E o DETALHE, onde o rótulo vira o título da página.
    await page.getByText(PALAVRA_120).first().click();
    await expect(page).toHaveURL(/\/historico\?snapshot=.+/);
    const noDetalhe = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
    expect(noDetalhe.scrollWidth, `detalhe em ${vp.width}px`).toBe(noDetalhe.clientWidth);
  });
}

// 014/T120 — o congelado exibia "Preço para anunciar" e "Recebido líquido" para um canal SEM
// comissão informada: exatamente os números que a Calcular se recusa a mostrar (`hasFee: false`
// esconde as linhas atrás de "Informe a comissão do canal para ver os preços"). Com comissão 0 o
// motor devolve anúncio == base, então há um número — mas ele não é um preço de marketplace, e o
// congelado passava a afirmar o que a origem tinha negado (Princípio II).
//
// Não é um caso de borda: o slot padrão de 100% dos usuários nasce em Mercado Livre, que hoje não
// tem entrada no catálogo. Quem grava sem digitar comissão cai exatamente aqui.
test("T120: um canal sem comissão informada não ganha preço no congelado que a Calcular recusou", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `hist-nofee-${info.workerIndex}`);
  grantPremium(email);
  const rotulo = `sem-comissao-${info.workerIndex}-${Date.now()}`;

  await page.goto("/calcular");
  await page.reload();

  // 015/A11 — o canal SEM tarifa passa a ser escolhido EXPLICITAMENTE. Este teste dependia de o
  // slot padrao nao ter cobertura no catalogo, o que era verdade enquanto o padrao era MERCADO_LIVRE
  // (`entries: []` ate a fatia US6). Com o padrao AMAZON, que TEM tabela, o canal ganha tarifa e a
  // premissa do teste evapora — mas a INVARIANTE que ele protege ("canal sem comissao informada nao
  // ganha preco") continua valendo e continua importando. Escolher o ML aqui e dizer em voz alta o
  // que o teste sempre precisou, em vez de herda-lo de um padrao que pode mudar de novo.
  await page
    .getByRole("combobox", { name: new RegExp(t.calculator.channels.marketplace) })
    .first()
    .selectOption("MERCADO_LIVRE");

  // A ORIGEM recusa: nenhuma linha de preço para o canal, e o motivo dito em palavras.
  await expect(page.getByText(t.calculator.channels.noFeeHint)).toBeVisible();
  const slotDaCalcular = page.getByTestId("channel-price").first();
  await expect(slotDaCalcular).not.toContainText(t.calculator.results.precoAnuncio);
  await expect(slotDaCalcular).not.toContainText(t.calculator.results.recebidoLiquido);

  await page.getByRole("button", { name: t.historico.saveAction }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(t.historico.saveSheetIntro)).toBeVisible();
  await sheet.getByRole("textbox", { name: t.historico.labelField }).fill(rotulo);
  await sheet.getByRole("button", { name: t.historico.saveSheetSubmit }).click();
  await expect(page.getByText(t.historico.saved)).toBeVisible(); // assentar antes de navegar

  await openFromLedger(page, rotulo);

  // O CONGELADO herda a recusa: o canal aparece (a escolha do vendedor não se apaga), sem os dois
  // números, e dizendo por quê.
  const canais = page.locator(".tf-historico__channel");
  await expect(canais.first()).toBeVisible();
  await expect(canais.first()).not.toContainText(t.calculator.results.precoAnuncio);
  await expect(canais.first()).not.toContainText(t.calculator.results.recebidoLiquido);
  await expect(canais.first()).toContainText(t.historico.channelNoFee);
});

test("SC-502/US3: deleting the origin product never moves the snapshot's values — only its link goes", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `hist-churn-${info.workerIndex}`);
  grantPremium(email);

  // Materialize a product the honest way: a one-line kit save turns "Peça 1 · <kit>" into a product.
  await page.goto("/kits");
  await page.reload();
  await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
  await expect(page.getByText(/R\$\s?16,16/).first()).toBeVisible();
  await page.getByRole("textbox", { name: new RegExp(t.bom.kitName) }).fill("Kit Origem");
  await page.getByRole("button", { name: t.bom.save, exact: true }).click();
  await expect(page.getByText(t.bom.saved)).toBeVisible();

  const piece = "Peça 1 · Kit Origem";

  // Record a snapshot FROM the product page — provenance = PRODUCT, the origin the calculator (which
  // binds a filament/printer, never a product) cannot itself set.
  await page.goto("/catalogo?tab=products");
  await page.getByText(piece).click();
  await expect(page.getByText(/R\$\s?24,24/).first()).toBeVisible(); // varejo of custo 16,16 (016/PR-C B1 seed)
  await recordFromCalculator(page); // the SAME RecordSnapshotButton + sheet as the calculator
  // Wait for the record to SETTLE (online ⇒ synced) before navigating — else the goto aborts the
  // in-flight enqueue+drain and the snapshot is silently lost.
  await expect(page.getByText(t.historico.saved)).toBeVisible();

  // In the ledger the snapshot carries the frozen value AND a live "Abrir produto" origin link. (The
  // card is titled by the frozen origin name, since the record has no manual label.)
  await openFromLedger(page, piece);
  await expect(page.getByText(/R\$\s?24,24/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: t.historico.openProduct })).toBeVisible();

  // CHURN: delete the origin product through the catalog — the seller's own action (T023). The
  // server soft-deletes it, so it drops out of the LIVE catalog the origin resolver reads.
  await page.goto("/catalogo?tab=products");
  await page.getByRole("button", { name: `${t.catalogo.remove} ${piece}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.catalogForm.deleteConfirm, exact: true })
    .click();
  await expect(page.getByText(piece)).toHaveCount(0); // gone from the catalog

  // Reopen the SAME snapshot from the ledger — its card still names the frozen origin. The document
  // is INERT: the frozen value is unchanged, and the origin link is simply GONE — never a broken
  // link, never a "produto removido" claim on a document that records no such thing.
  await openFromLedger(page, piece);
  await expect(page.getByText(/R\$\s?24,24/).first()).toBeVisible(); // byte-identical claim
  await expect(page.getByRole("link", { name: t.historico.openProduct })).toHaveCount(0);
  await expect(page.getByText(/removid|excluíd|deletad/i)).toHaveCount(0);
});

test("SC-508/US6: a lapse freezes rename+delete but never the reading — a re-grant restores them", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `hist-lapse-${info.workerIndex}`);
  grantPremium(email);

  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByRole("button", { name: t.historico.saveAction })).toBeVisible();
  await recordFromCalculator(page);
  // Settle before navigating (online ⇒ synced) — else the goto aborts the enqueue+drain.
  await expect(page.getByText(t.historico.saved)).toBeVisible();

  // The card of an unlabelled calculator record is titled by the honest neutral fallback.
  const card = t.historico.adhocFallback;

  // While ACTIVE, both writes are offered on the detail (ADR-0019: the label is the one mutable
  // field; delete is soft + confirmed).
  await openFromLedger(page, card);
  await expect(page.getByText(/R\$/).first()).toBeVisible(); // the frozen document renders
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toBeVisible();
  await expect(page.getByRole("button", { name: t.historico.deleteAction })).toBeVisible();

  // LAPSE — revoke the grant. The record itself is untouched (nothing auto-deletes on a lapse).
  revokePremium(email);
  await openFromLedger(page, card);
  // Reading stays open (require_catalog_read); writing is gone — neither affordance is offered, and
  // the server would deny it regardless.
  await expect(page.getByText(/R\$/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.historico.deleteAction })).toHaveCount(0);

  // RE-GRANT restores the manage surface — the record intact the whole time (SC-508).
  grantPremium(email);
  await openFromLedger(page, card);
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toBeVisible();
  await expect(page.getByText(/R\$/).first()).toBeVisible();
});

// 018/US2 (T035) — o mestre-detalhe de Orçamentos no desktop: lista e registro congelado na MESMA
// tela (SC-002), a seleção morando em `?snapshot=` (013/F-02 — a MESMA chave do mobile), e o
// endereço selecionado sobrevivendo a um reload (a forma honesta de "o link direto continua
// respondendo" depois que a rota de 2 segmentos morreu).
test("T035: mestre-detalhe de Orçamentos a 1440px — lista + registro juntos, seleção em ?snapshot=, reload mantém (018/US2)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `hist-md-${info.workerIndex}`);
  grantPremium(email);
  const rotulo = `md-${info.workerIndex}-${Date.now()}`;

  await page.goto("/calcular");
  await page.reload(); // a concessão só é lida na próxima carga
  await page.getByRole("button", { name: t.historico.saveAction }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("textbox", { name: t.historico.labelField }).fill(rotulo);
  await sheet.getByRole("button", { name: t.historico.saveSheetSubmit }).click();
  await expect(page.getByText(t.historico.saved)).toBeVisible(); // assentar antes de navegar (T119)

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/historico");

  // No corte largo o registro abre AO LADO da lista: o card continua visível quando o detalhe
  // abre — é isso que distingue o mestre-detalhe da navegação empilhada do mobile.
  await page.getByText(rotulo).first().click();
  await expect(page).toHaveURL(/\/historico\?snapshot=.+/);
  await expect(page.getByText(rotulo).first()).toBeVisible(); // o card da lista não saiu da tela
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toBeVisible(); // o detalhe abriu

  // O endereço com a seleção continua respondendo — um reload no MESMO URL reabre o registro.
  await page.reload();
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toBeVisible();
  await expect(page.getByText(rotulo).first()).toBeVisible();
});
