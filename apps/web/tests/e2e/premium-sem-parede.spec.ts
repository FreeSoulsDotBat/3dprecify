import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_DATABASE_URL } from "../../playwright.config";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/PR-B (T040) — Premium sem parede, contra a STACK REAL (backend + Postgres + emulador).
//
// A tese nova (dono, 25/08; prancheta "Premium - O Caminho Sem Parede", 32a–32g): quem não paga
// percorre a feature INTEIRA — vazio didático → "Adicionar" → formulário inerte com a dica legível →
// "Salvar" desabilitado e visível → um único convite. O que este spec prova que a tela não faz:
//   (1) ZERO escrita de rede (POST/PUT/PATCH/DELETE contados por `page.route` no fluxo inteiro) — a
//       barreira é a AUSÊNCIA do handler (research §E-2), não um `disabled` que um clique programático
//       atravessa; o servidor continua recusando (SC-1903), mas o cliente nunca chega a pedir;
//   (2) ZERO entrada no outbox do Histórico (a MESMA chave uid-scoped `history:outbox:<uid>` de
//       `entities/history/outbox.ts`) — um formulário alcançável não pode criar fila que o servidor
//       recusará depois (classe A3 do hotfix; spec US3 cenário 2);
//   (3) o deslogado vê o MESMO caminho (E-5), e o clique em "Assinar Premium" preserva a intenção.
// E o caso que a US8 distingue pelo LEDGER, nunca por heurística: quem TINHA e deixou vencer vê os
// itens e o formulário PREENCHIDO inerte com "Reative o Premium…" — nunca o vazio didático.

const t = messages;
const catalogo = t.catalogo;
const cf = t.catalogForm;
const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));

const ESCRITAS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Conta toda escrita de API a partir de AGORA (o sign-up JIT já passou). */
async function contarEscritas(page: Page): Promise<string[]> {
  const escritas: string[] = [];
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    if (ESCRITAS.has(req.method())) escritas.push(`${req.method()} ${new URL(req.url()).pathname}`);
    void route.continue();
  });
  return escritas;
}

/** Entradas no outbox do Histórico, lidas do IndexedDB do aparelho (idb-keyval: db `keyval-store`,
 *  store `keyval`, chaves `history:outbox:<uid>`). Zero chaves = zero entradas. */
async function entradasNoOutbox(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("keyval-store");
        req.onerror = () => resolve(0);
        req.onupgradeneeded = () => resolve(0); // o banco não existia — nada foi enfileirado
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("keyval")) return resolve(0);
          const store = db.transaction("keyval", "readonly").objectStore("keyval");
          const keysReq = store.getAllKeys();
          keysReq.onerror = () => resolve(0);
          keysReq.onsuccess = () => {
            const keys = keysReq.result.filter((k) => String(k).startsWith("history:outbox:"));
            if (keys.length === 0) return resolve(0);
            let total = 0;
            let pendentes = keys.length;
            for (const k of keys) {
              const g = store.get(k);
              const fim = () => {
                if (--pendentes === 0) resolve(total);
              };
              g.onsuccess = () => {
                total += Array.isArray(g.result) ? g.result.length : 0;
                fim();
              };
              g.onerror = fim;
            }
          };
        };
      }),
  );
}

/** Vence TODOS os grants da conta (a REGRA do lapso, não a passagem do tempo — o mesmo mecanismo
 *  de `billing-lifecycle.spec.ts`). Uma linha de SQL, sem aspas aninhadas: sobrevive ao cmd.exe. */
function vencerGrants(email: string): void {
  const sql =
    "UPDATE entitlement_grants SET expires_at = now() - make_interval(hours => 1)" +
    " WHERE account_uid IN (SELECT account_uid FROM accounts WHERE email = :m)";
  const py =
    "import os,sys,sqlalchemy as sa;" +
    "e=sa.create_engine(os.environ['P3D_DATABASE_URL']);c=e.connect();" +
    `n=c.execute(sa.text(${JSON.stringify(sql).replace(/"/g, "'")}),{'m':sys.argv[1]}).rowcount;` +
    "c.commit();sys.exit(0 if n>0 else 3)";
  execSync(`uv run python -c "${py}" ${email}`, {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, P3D_DATABASE_URL: E2E_DATABASE_URL },
  });
}

const cta = (page: Page) => page.getByTestId("teaser-upgrade-cta");
const formularioInerte = (page: Page) => page.getByTestId("catalog-form-frozen");
const largo = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280;

/** O formulário inerte do Catálogo, do jeito que a prancheta 32b o desenha. */
async function esperarFormularioInerte(page: Page, salvar: string, convite: string) {
  const frozen = formularioInerte(page);
  await expect(frozen).toBeVisible();
  await expect(frozen).toHaveAttribute("disabled", ""); // <fieldset disabled> — não um estilo
  // "Salvar" existe, desabilitado e VISÍVEL (32b: "um botão ausente não ensina isso").
  const btnSalvar = page.getByRole("button", { name: salvar, exact: true });
  await expect(btnSalvar).toBeVisible();
  await expect(btnSalvar).toBeDisabled();
  // A frase fica ANTES da linha de botões no DOM (32b).
  const nota = page.getByTestId("premium-footer-note");
  await expect(nota).toBeVisible();
  const ordem = await page.evaluate(() => {
    const nota = document.querySelector('[data-testid="premium-footer-note"]');
    const cta = document.querySelector('[data-testid="teaser-upgrade-cta"]');
    if (!nota || !cta) return "faltou";
    return nota.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING
      ? "antes"
      : "depois";
  });
  expect(ordem).toBe("antes");
  // O convite é secundário, FORA do fieldset, clicável — e é o ÚNICO da tela (FR-1906).
  await expect(cta(page)).toHaveCount(1);
  await expect(cta(page)).toHaveText(convite);
  await expect(cta(page)).toBeEnabled();
  expect(await cta(page).evaluate((el) => el.closest("fieldset[disabled]"))).toBeNull();
}

test("grátis (nunca teve): vazio didático → formulário inerte → zero escrita, zero outbox (US3 AC1/AC2)", async ({
  page,
}, info) => {
  await signUpThrowaway(page, `sp-free-${info.workerIndex}`);
  const escritas = await contarEscritas(page);

  // ---- Catálogo: o vazio explica a feature (32a) — sem parede, sem coroa.
  await page.goto("/catalogo");
  const vazio = page.getByTestId("vazio-didatico");
  await expect(vazio).toBeVisible();
  await expect(vazio).toContainText(catalogo.emptyFilamentsTitle);
  await expect(vazio).toContainText(catalogo.didaticoFilamentsBody);
  await expect(page.getByText(t.premiumTeaser.CATALOG.title)).toHaveCount(0); // a parede saiu
  await expect(cta(page)).toHaveCount(1); // um convite no estado de lista

  // "Adicionar filamento" abre de verdade (32b).
  await page.getByRole("button", { name: catalogo.addFilament }).first().click();
  await esperarFormularioInerte(page, cf.save, t.billing.subscribeAction);
  await expect(page.getByTestId("premium-footer-note")).toHaveText(
    t.premiumTeaser.salvarFazParteDoPremium,
  );
  // Campos VAZIOS com placeholder — "dados de exemplo seriam mais bonitos e mais mentirosos".
  await expect(formularioInerte(page).getByRole("textbox").first()).toHaveValue("");

  // Tentar escrever de todo jeito: teclar num campo inerte, submeter o form programaticamente.
  await formularioInerte(page)
    .getByRole("textbox")
    .first()
    .fill("PLA Azul", { force: true })
    .catch(() => undefined);
  await page.evaluate(() => {
    const form = document.querySelector('[data-testid="catalog-form-frozen"]')?.closest("form");
    form?.requestSubmit?.();
  });
  await expect(page.getByText(cf.savedFilament)).toHaveCount(0); // nenhum toast falso (T106)

  // ---- Impressoras: a dica do consumo (a peça mais didática) continua LEGÍVEL dentro do frozen.
  await page.goto("/catalogo?tab=printers");
  await expect(page.getByTestId("vazio-didatico")).toContainText(catalogo.didaticoPrintersBody);
  await page.getByRole("button", { name: catalogo.addPrinter }).first().click();
  await esperarFormularioInerte(page, cf.save, t.billing.subscribeAction);
  const dica = formularioInerte(page).getByText(/potência de placa/);
  await expect(dica).toBeVisible();
  // O esmaecimento vive nos CONTROLES, nunca no contêiner: a dica não herda opacidade.
  for (const el of [dica, formularioInerte(page)]) {
    expect(Number(await el.evaluate((e) => getComputedStyle(e).opacity))).toBe(1);
  }

  // ---- Kits: o composer monta e COMPÕE (decisão 3, 27/08) — só Salvar bloqueia.
  await page.goto("/kits");
  await expect(page.getByTestId("vazio-didatico")).toContainText(catalogo.didaticoKitsBody);
  await expect(cta(page)).toHaveCount(1);
  await page.getByRole("button", { name: t.bom.addLine }).first().click();
  await expect(page.getByText(t.bom.lineLabel.replace("{n}", "1"))).toBeVisible();
  const salvarKit = page.getByRole("button", { name: t.bom.save, exact: true });
  await expect(salvarKit).toBeVisible();
  await expect(salvarKit).toBeDisabled();
  await expect(cta(page)).toHaveCount(1);

  // ---- Orçamentos e a folha de Simulações: o botão do vazio leva à calculadora (32f).
  await page.goto("/historico");
  await expect(page.getByTestId("vazio-didatico")).toContainText(t.historico.didaticoTitle);
  await expect(cta(page)).toHaveCount(1);
  await page.getByRole("button", { name: t.premiumTeaser.fazerUmCalculo }).click();
  await expect(page).toHaveURL(/\/calcular/);
  await page.getByRole("button", { name: t.scenarios.navEntry }).click();
  const folha = page.getByRole("dialog");
  await expect(folha.getByTestId("vazio-didatico")).toContainText(t.scenarios.didaticoBody);
  await expect(folha.getByTestId("teaser-upgrade-cta")).toHaveCount(1);

  // ---- O que NÃO aconteceu: nenhuma escrita, nenhuma fila.
  expect(escritas, `escritas de API no fluxo grátis: ${escritas.join(", ")}`).toEqual([]);
  expect(await entradasNoOutbox(page)).toBe(0);
});

test("teve e deixou vencer: itens listados + formulário PREENCHIDO inerte + 'Reative' — nunca o vazio didático (US3 AC3 / FR-1908)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `sp-lapsed-${info.workerIndex}`);
  await page.goto("/catalogo"); // JIT-provisiona a conta antes do grant
  await expect(page.getByTestId("vazio-didatico")).toBeVisible();
  grantPremium(email);
  await page.reload();

  // Premium de verdade: salva UM filamento pela UI.
  await page.getByRole("button", { name: catalogo.addFilament }).first().click();
  await page.getByRole("textbox", { name: cf.name }).fill("PLA Azul");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
    .fill("94,90");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.rollWeight) }).fill("1");
  await page.getByRole("button", { name: cf.save, exact: true }).click();
  await expect(page.getByText(cf.savedFilament)).toBeVisible();

  // O grant vence (o ledger decide — não uma heurística de tela).
  vencerGrants(email);
  const escritas = await contarEscritas(page);
  await page.reload();

  // Os itens continuam (32e) — e a faixa de topo "Premium pausado" SAIU.
  await expect(page.getByText("PLA Azul").first()).toBeVisible();
  await expect(page.getByTestId("vazio-didatico")).toHaveCount(0);
  await expect(page.getByText("Premium pausado")).toHaveCount(0);

  // O formulário abre PREENCHIDO, inerte, com "Reative o Premium…" e "Reativar Premium".
  if (!largo(page)) await page.getByText("PLA Azul").first().click();
  await esperarFormularioInerte(page, cf.saveChanges, t.billing.reactivateAction);
  await expect(page.getByTestId("premium-footer-note")).toHaveText(catalogo.reactivateBody);
  await expect(formularioInerte(page).getByRole("textbox", { name: cf.name })).toHaveValue(
    "PLA Azul",
  );
  // O Alert com TÍTULO saiu (32d) — `exact`, porque o `reactivateBody` começa com as mesmas palavras.
  await expect(page.getByText(catalogo.reactivateTitle, { exact: true })).toHaveCount(0);

  expect(escritas, `escritas de API no lapsed: ${escritas.join(", ")}`).toEqual([]);
  expect(await entradasNoOutbox(page)).toBe(0);
});

test("deslogado (E-5): o MESMO caminho sem parede; 'Assinar Premium' leva a entrar com a intenção preservada; Produtos exige conta no clique", async ({
  page,
}) => {
  const escritas = await contarEscritas(page);

  // Filamentos / Impressoras / Kits / Orçamentos / Simulações: o mesmo vazio + formulário inerte.
  await page.goto("/catalogo");
  await expect(page.getByTestId("vazio-didatico")).toContainText(catalogo.didaticoFilamentsBody);
  await expect(page.getByText(t.premiumTeaser.CATALOG.title)).toHaveCount(0);
  await expect(cta(page)).toHaveCount(1);
  await page.getByRole("button", { name: catalogo.addFilament }).first().click();
  await esperarFormularioInerte(page, cf.save, t.billing.subscribeAction);
  await expect(cta(page)).toHaveAttribute("href", /\/sign-in\?redirect=/);

  await page.goto("/catalogo?tab=printers");
  await expect(page.getByTestId("vazio-didatico")).toContainText(catalogo.didaticoPrintersBody);
  await page.goto("/kits");
  await expect(page.getByTestId("vazio-didatico")).toContainText(catalogo.didaticoKitsBody);
  await expect(cta(page)).toHaveCount(1);
  await page.goto("/historico");
  await expect(page.getByTestId("vazio-didatico")).toContainText(t.historico.didaticoTitle);
  await expect(cta(page)).toHaveCount(1);
  await page.goto("/calcular");
  await page.getByRole("button", { name: t.scenarios.navEntry }).click();
  await expect(page.getByRole("dialog").getByTestId("vazio-didatico")).toContainText(
    t.scenarios.didaticoBody,
  );

  // Produtos: o `beforeLoad` do `?produto=` continua exigindo conta — o clique leva ao sign-in
  // com a intenção preservada (nominal: o redirect carrega o `produto=novo`).
  await page.goto("/catalogo?tab=products");
  await expect(page.getByTestId("vazio-didatico")).toContainText(catalogo.didaticoProductsBody);
  await page.getByRole("button", { name: catalogo.addProduct }).first().click();
  await expect(page).toHaveURL(/\/sign-in\?redirect=.*produto/);

  // "Assinar Premium" deslogado → sign-in com redirect → depois de entrar, cai na OFERTA.
  await page.goto("/catalogo");
  await cta(page).click();
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fconta%3Fassinar%3D1/);
  await page.waitForFunction(() => "__e2eAuth" in window);
  await page.evaluate(
    ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      void w.__e2eAuth?.signUp(em, pw);
    },
    { em: `e2e-sp-intent-${Date.now()}@e2e.local`, pw: "test-passw0rd" },
  );
  // O router serializa a intenção como JSON (`assinar=%221%22` = a string "1") — a Conta lê
  // `assinar === "1"` e abre a oferta; o que se asserta é a OFERTA, não a grafia da query.
  await expect(page).toHaveURL(/\/conta\?assinar=/);
  await expect(page.getByRole("heading", { name: t.billing.offerTitle })).toBeVisible();

  // Nenhuma escrita ANTES do login (o sign-up JIT que vem depois não conta como escrita do grátis).
  expect(
    escritas.filter((e) => !e.includes("/me")),
    `escritas: ${escritas.join(", ")}`,
  ).toEqual([]);
  expect(await entradasNoOutbox(page)).toBe(0);
});
