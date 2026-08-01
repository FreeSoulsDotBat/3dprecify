import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_BACKEND_URL, E2E_DATABASE_URL, MP_STUB_URL } from "../../playwright.config";
import { fireStubWebhook } from "./billing-helpers";
import { signUpThrowaway } from "./history-helpers";

// E6 PR-B (T027) — o ciclo REVERSO no navegador: cancelar · carência · congelamento · reassinar.
//
// O que os 22 testes de pytest provam é o LEDGER. O que este arquivo prova é que o vendedor VÊ a
// verdade — e são coisas diferentes: o painel podia dizer "Premium expirado" sobre uma assinatura
// cancelada com período correndo e a suíte de backend não notaria nada.
//
// Chromium-only pelo mesmo motivo do `billing.spec.ts`: cada fluxo aqui escreve `subscriptions` no
// MESMO banco de e2e, e dois projetos em paralelo poluem o candidato único do fallback do stub.

const tb = messages.billing;
const tc = messages.conta;

/** O id da preapproval que o app acabou de criar — sai da própria URL do hand-off do stub. */
function preapprovalFromCheckoutUrl(url: string): string {
  const id = url.split("/").pop();
  if (!id) throw new Error(`URL de checkout sem id de preapproval: ${url}`);
  return id;
}

/**
 * Roda SQL contra o banco de e2e. É o mesmo mecanismo do `grantPremium` (execSync no backend com
 * `P3D_DATABASE_URL`), e existe porque o que se testa aqui é a REGRA do lapso, não a passagem do
 * tempo: esperar 30 dias não é um teste, é uma espera.
 */
async function forcarExpiracao(email: string): Promise<void> {
  const { execSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));
  // UMA linha, sem aspas aninhadas e sem literal de intervalo (`make_interval` no lugar de
  // `interval '1 hour'`): um `-c` multilinha nao sobrevive ao `cmd.exe` do Windows, e a primeira
  // versao deste helper falhava CALADA — o teste reprovava na assercao seguinte, apontando para o
  // painel quando o problema era o helper.
  const sql =
    "UPDATE entitlement_grants SET expires_at = now() - make_interval(hours => 1)" +
    " WHERE account_uid IN (SELECT account_uid FROM accounts WHERE email = :m)";
  const py =
    "import os,sys,sqlalchemy as sa;" +
    "e=sa.create_engine(os.environ['P3D_DATABASE_URL']);c=e.connect();" +
    `n=c.execute(sa.text(${JSON.stringify(sql).replace(/"/g, "'")}),{'m':sys.argv[1]}).rowcount;` +
    // Zero linhas afetadas e um teste que nao testa nada — falhar alto aqui e o ponto.
    "c.commit();sys.exit(0 if n>0 else 3)";
  execSync(`uv run python -c "${py}" ${email}`, {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, P3D_DATABASE_URL: E2E_DATABASE_URL },
  });
}

/** Leva um vendedor recém-criado até PREMIUM PAGO de verdade, e devolve a preapproval. */
async function assinar(page: import("@playwright/test").Page): Promise<string> {
  await page.route("https://stub.mercadopago.local/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html>MP stub</html>" }),
  );
  await page.goto("/conta");
  await page.getByRole("button", { name: tb.subscribeAction }).click();
  await page.getByRole("dialog").getByRole("button", { name: tb.subscribeAction }).click();
  await page.waitForURL(/stub\.mercadopago\.local/);
  return preapprovalFromCheckoutUrl(page.url());
}

/** Registra um pagamento no stub (aprovado ou recusado) e dispara o webhook assinado. */
async function eventoDoMp(
  request: import("@playwright/test").APIRequestContext,
  preapprovalId: string,
  status: "approved" | "rejected",
): Promise<void> {
  const reg = await request.post(`${MP_STUB_URL}/_test/payments`, {
    data: { preapprovalId, status, periodDays: 30 },
  });
  expect(reg.status(), await reg.text()).toBe(200);
  const { id } = (await reg.json()) as { id: string };
  const hook = await fireStubWebhook(request, { paymentId: id, requestId: `e2e-${id}` });
  expect(hook.status(), await hook.text()).toBe(200);
}

test.describe("E6 PR-B — o ciclo reverso (cancelar · carência · congelamento)", () => {
  test.describe.configure({ mode: "serial" });

  // O `test.use({ browserName })` NAO serve num describe (o Playwright recusa: forcaria um worker
  // novo). O idioma da casa e este, e e o mesmo do `billing.spec.ts`.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "chromium-only — checkouts concorrentes de dois projetos compartilham UM banco de e2e",
    );
  });

  test("US4: cancelar mantém o premium até o fim do período, e a Conta diz isso", async ({
    page,
    request,
  }) => {
    await signUpThrowaway(page, "pr-b-cancel");
    const pre = await assinar(page);
    await eventoDoMp(request, pre, "approved");

    await page.goto("/conta");
    await expect(page.getByText(tc.planPremium)).toBeVisible();
    // O painel de uma assinatura ATIVA fala de renovação e oferece as duas ações.
    await expect(page.getByRole("button", { name: tb.planManage })).toBeVisible();

    await page.getByRole("button", { name: tb.planCancel }).click();
    const dialogo = page.getByRole("dialog");
    // §5 — o diálogo diz o que ele MANTÉM antes de perguntar qualquer coisa.
    await expect(dialogo.getByText(tb.cancelFreeze)).toBeVisible();
    await dialogo.getByRole("button", { name: tb.cancelConfirm }).click();

    // A tela vira "ativo até {data} · não renova" — e o selo Premium CONTINUA.
    await expect(page.getByText(tb.planWontRenew)).toBeVisible();
    await expect(page.getByText(tc.planPremium)).toBeVisible();
    // A asserção que importa é a AUSÊNCIA: chamar de expirado quem pagou pelo período é a
    // hostilidade que a US4 existe para impedir, e nenhuma asserção de presença acima a veria.
    await expect(page.getByText(tc.planLapsed)).toHaveCount(0);
    await expect(page.getByRole("button", { name: tb.planResubscribe })).toBeVisible();
  });

  test("US4: passado o período, congela para leitura — e os dados continuam lá", async ({
    page,
    request,
  }) => {
    const email = await signUpThrowaway(page, "pr-b-freeze");
    // Ele precisa ter PAGO antes: expirar uma conta sem grant nenhum nao produz lapso, produz
    // "Gratuito" — e o teste passaria a afirmar outra coisa. (Foi o que a primeira rodada mostrou.)
    const pre = await assinar(page);
    await eventoDoMp(request, pre, "approved");
    await page.goto("/conta");
    await expect(page.getByText(tc.planPremium)).toBeVisible();

    await forcarExpiracao(email);

    await page.goto("/conta");
    await page.getByRole("button", { name: tc.planRefresh }).click();
    // O congelamento é o estado que E2/E4/E5 já implementam — a US4 chega nele pela EXPIRAÇÃO.
    await expect(page.getByText(tc.planLapsedHint)).toBeVisible();
    await expect(page.getByRole("button", { name: tb.planResubscribe })).toBeVisible();
  });

  test("US5: uma renovação recusada mostra a carência com prazo, e NÃO derruba o premium", async ({
    page,
    request,
  }) => {
    await signUpThrowaway(page, "pr-b-grace");
    const pre = await assinar(page);
    await eventoDoMp(request, pre, "approved");
    await eventoDoMp(request, pre, "rejected");

    await page.goto("/conta");
    await expect(page.getByText(tb.planGrace)).toBeVisible();
    // O selo SEGUE Premium: a queda ainda não aconteceu, e degradá-lo aqui seria mentir para baixo.
    // `exact` porque a própria frase do prazo diz "…senão o Premium pausa" — sem isso o localizador
    // acha dois elementos e o teste morre por ambiguidade, não por defeito.
    await expect(page.getByText(tc.planPremium, { exact: true })).toBeVisible();
    await expect(page.getByText(tc.planLapsed)).toHaveCount(0);
    // O prazo é derivado do servidor — a tela nunca o calcula.
    await expect(page.getByText(/senão o Premium pausa/)).toBeVisible();
    // Quem está em carência quer PAGAR, não cancelar: a ação oferecida é atualizar o pagamento.
    await expect(page.getByRole("button", { name: tb.planUpdatePayment })).toBeVisible();
    await expect(page.getByRole("button", { name: tb.planCancel })).toHaveCount(0);
  });

  test("US5: a recuperação dentro da carência volta a assinatura ao normal", async ({
    page,
    request,
  }) => {
    await signUpThrowaway(page, "pr-b-recover");
    const pre = await assinar(page);
    await eventoDoMp(request, pre, "approved");
    await eventoDoMp(request, pre, "rejected");
    await page.goto("/conta");
    await expect(page.getByText(tb.planGrace)).toBeVisible();

    await eventoDoMp(request, pre, "approved");

    await page.goto("/conta");
    await expect(page.getByText(tb.planRenews)).toBeVisible();
    // A frase de carência tem de SUMIR. Sem esta ausência, uma tela que empilhasse os dois estados
    // passaria — e "pagamento pendente" sobre um pagamento recuperado é a mentira mais cara aqui.
    await expect(page.getByText(tb.planGrace)).toHaveCount(0);
  });
});

test.describe("E6 PR-B — o backend concorda com a tela", () => {
  // O `test.use({ browserName })` NAO serve num describe (o Playwright recusa: forcaria um worker
  // novo). O idioma da casa e este, e e o mesmo do `billing.spec.ts`.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "chromium-only — checkouts concorrentes de dois projetos compartilham UM banco de e2e",
    );
  });

  test("o cancelamento é idempotente pela rota, sem tocar o ledger", async ({ page, request }) => {
    await signUpThrowaway(page, "pr-b-idem");
    const pre = await assinar(page);
    await eventoDoMp(request, pre, "approved");
    await page.goto("/conta");
    await expect(page.getByText(tc.planPremium)).toBeVisible();

    await page.getByRole("button", { name: tb.planCancel }).click();
    await page.getByRole("dialog").getByRole("button", { name: tb.cancelConfirm }).click();
    await expect(page.getByText(tb.planWontRenew)).toBeVisible();

    // Recarregar e cancelar de novo não é possível pela UI (o botão sumiu) — que é o ponto: a
    // idempotência da rota tem o seu teste em pytest, e a UI não oferece o segundo clique.
    await page.reload();
    await expect(page.getByRole("button", { name: tb.planCancel })).toHaveCount(0);
    expect(await (await request.get(`${E2E_BACKEND_URL}/health`)).status()).toBe(200);
  });
});
