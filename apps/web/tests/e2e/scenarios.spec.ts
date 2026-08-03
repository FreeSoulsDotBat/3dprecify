import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { goOffline, goOnline, grantPremium, signUpThrowaway } from "./history-helpers";

// 010/T017 (E5, PR-A) e2e — the SAVED SHELF against the REAL stack (Postgres + the entitlement gate
// + the Firebase Auth emulator). The claims a unit test cannot make honestly:
//   · a save is a real 2xx (never optimistic) and the config comes back byte-restorable (US1);
//   · the list is (server) ∪ (uid-keyed offline cache) and reads survive a real offline reload (US2);
//   · a save attempted OFFLINE fails HONESTLY — no queue, no fake "salvo!" (VR-612, the deliberate
//     contrast with E4's outbox);
//   · sign-out purges the uid-keyed cache (the privacy sweep, app/providers.tsx);
//   · free/signed-out meets the honest teaser and the free calculator carries NO inline "Salvar
//     cenário" button at all (SC-109).
// Reach every scenario surface via CLIENT-NAV (a Sheet inside /calcular) — never a 2-segment
// `page.goto` deep link (the `base:'./'` blank-route trap).

const t = messages.calculator;
const s = messages.scenarios;

/** A 120-char adversarial name (the T002-decided cap) — no spaces, so CSS truncation is the ONLY
 *  thing standing between this and a horizontal overflow (the E4 "homologate size" lesson). */
const LONG_NAME = "A".repeat(120);

async function openScenariosList(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: s.navEntry }).click();
  return page.getByRole("dialog");
}

test("premium saves online, the list shows it with no price, and reopening recomputes live (US1/US2, SC-601/604/606)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `scn-save-${info.workerIndex}`);
  grantPremium(email);

  // Adversarial SIZE from the start: the whole walk runs at 390px (the E4 lesson, both times).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/calcular");
  await page.reload(); // entitlement resolves `active` → the save affordance appears
  await expect(page.getByText("R$ 20,60")).toBeVisible(); // the E1 seed computes a result

  // Configure a real multi-channel comparison: slot 0 is a CURATED marketplace (Shopee) whose
  // pre-filled fee gets EXPLICITLY overridden (→ "ajustado por você"), slot 1 is left on the
  // uncovered Mercado Livre (→ the honest "sem referência", no fabricated pre-fill) — exactly the
  // mix the reopen must restore verbatim.
  //
  // 015/A11 — o ML e ESCOLHIDO, e nao mais herdado do padrao. Este teste dizia "left on the
  // uncovered Mercado Livre DEFAULT", e o padrao virou AMAZON (que tem tabela). A intencao —
  // "um canal sem cobertura mostra o selo honesto" — nao mudou; o que mudou e que ela agora esta
  // escrita em vez de depender de um padrao.
  const slot0 = page.getByTestId("channel-slot").nth(0);
  await slot0.getByLabel(t.channels.marketplace).selectOption("SHOPEE");
  // Curated → some catalog reference seal (embedded seed or a live served reference, whichever the
  // e2e stack resolves); either way it must NOT be the uncovered "sem referência" reading.
  await expect(slot0.getByTestId("fee-seal")).not.toContainText(t.seals.none);
  await slot0.getByLabel(/^Comissão(?! mínima)/).fill("12");
  await slot0.getByLabel(t.channels.fixedFee).fill("6,75");
  await expect(slot0.getByTestId("fee-seal")).toContainText(t.seals.adjusted);

  await page.getByRole("button", { name: t.channels.addChannel }).click();
  const slot1 = page.getByTestId("channel-slot").nth(1);
  await slot1.getByLabel(t.channels.marketplace).selectOption("MERCADO_LIVRE");
  await expect(slot1.getByTestId("fee-seal")).toContainText(t.seals.none);
  await expect(page.getByTestId("channel-price")).toHaveCount(2);

  // Save with an adversarially long name + a note.
  await page.getByTestId("save-scenario-trigger").click();
  const saveSheet = page.getByRole("dialog");
  await expect(saveSheet.getByText(s.saveSheetIntro)).toBeVisible();
  await saveSheet.getByLabel(s.nameField).fill(LONG_NAME);
  await saveSheet.getByLabel(s.noteField).fill("Comparação ML ajustado x Shopee catálogo");
  await saveSheet.getByTestId("save-scenario-submit").click();

  // A real 2xx only — never an optimistic/fake "salvo".
  await expect(page.getByText(s.saved)).toBeVisible();

  // The list shows it: name · note · relative last-updated, and NO price anywhere in the sheet.
  const listDialog = await openScenariosList(page);
  await expect(listDialog.getByText(LONG_NAME)).toBeVisible();
  await expect(listDialog.getByText("Comparação ML ajustado x Shopee catálogo")).toBeVisible();
  await expect(listDialog.getByText(/Atualizado/)).toBeVisible();
  // E6/US7 — o preco real entrou aqui; a proibicao valia enquanto a cobranca nao existia.
  for (const n of (await listDialog.innerText()).match(/\d+[.,]\d{2}/g) ?? []) {
    expect(["15,99", "12,99", "155,88"]).toContain(n);
  }

  // Adversarial SIZE homologation, in passing (§8 of quickstart): the long name must not blow the
  // 390px layout — assert GEOMETRY, not just that the text is present (the E4 lesson, twice).
  const { scrollWidth, clientWidth } = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(scrollWidth).toBe(clientWidth);

  // Reopen → the sheet closes, the calculator restores the FULL config and recomputes LIVE: 2
  // channels back, the manually-edited slot still reads "ajustado por você", today's numbers, no
  // frozen date anywhere (the live promise copy is the honest opposite of a snapshot's frozen date).
  await listDialog.getByText(LONG_NAME).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); // the list sheet closed
  await expect(page.getByText(s.loadedLive)).toBeVisible(); // "Recalculado com os preços de hoje"
  await expect(page.getByTestId("channel-slot")).toHaveCount(2);
  await expect(page.getByTestId("channel-slot").nth(0).getByTestId("fee-seal")).toContainText(
    t.seals.adjusted,
  );
  await expect(page.getByTestId("channel-price")).toHaveCount(2);
  await expect(page.getByText("R$ 20,60")).toBeVisible(); // the base cost recomputed, not stored
});

test("offline read survives a reload from cache; an offline save fails honestly, then succeeds back online (US2, SC-610)", async ({
  page,
  context,
}, info) => {
  const email = await signUpThrowaway(page, `scn-offline-${info.workerIndex}`);
  grantPremium(email);

  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByText("R$ 20,60")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  // Save one scenario online, then open the list ONCE online so the uid-keyed cache is populated.
  await page.getByTestId("save-scenario-trigger").click();
  const saveSheet = page.getByRole("dialog");
  await saveSheet.getByLabel(s.nameField).fill("Cenário para offline");
  await saveSheet.getByTestId("save-scenario-submit").click();
  await expect(page.getByText(s.saved)).toBeVisible();

  const listDialog = await openScenariosList(page);
  await expect(listDialog.getByText("Cenário para offline")).toBeVisible();
  await page.keyboard.press("Escape"); // close the list sheet before the offline reload

  // Lose the network in a way that reaches the `onlineManager` (event, not just navigator.onLine —
  // the same B1 idiom the E4 offline spec proved necessary).
  await goOffline(page, context);
  await page.reload(); // a fresh mount, offline: forces the uid-keyed IndexedDB cache fallback
  await expect(page.getByText("R$ 20,60")).toBeVisible();

  // The list is STILL readable and re-openable from the cache — never an error wall over data
  // already held on the device.
  const offlineList = await openScenariosList(page);
  await expect(offlineList.getByText(s.offlineTitle)).toBeVisible();
  await expect(offlineList.getByText("Cenário para offline")).toBeVisible();
  await offlineList.getByText("Cenário para offline").click();
  await expect(page.getByText(s.loadedLive)).toBeVisible(); // reopen still works offline

  // Attempt a save OFFLINE → an HONEST failure: no success toast, no fake "salvo!", no pending/queue
  // state — the deliberate contrast with E4's outbox (VR-612).
  await page.getByTestId("save-scenario-trigger").click();
  const offlineSaveSheet = page.getByRole("dialog");
  await offlineSaveSheet.getByLabel(s.nameField).fill("Tentativa offline");
  await offlineSaveSheet.getByTestId("save-scenario-submit").click();
  await expect(offlineSaveSheet.getByText(s.saveOffline)).toBeVisible();
  await expect(page.getByText(s.saved)).toHaveCount(0);
  // The Sheet stays open with the values intact — nothing was silently discarded either.
  await expect(offlineSaveSheet.getByLabel(s.nameField)).toHaveValue("Tentativa offline");

  // Back online → the SAME submit now succeeds for real.
  await goOnline(page, context);
  await offlineSaveSheet.getByTestId("save-scenario-submit").click();
  await expect(page.getByText(s.saved)).toBeVisible();
});

test("sign-out purges the scenarios cache — a fresh account never sees the previous one's list (privacy sweep)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `scn-signout-${info.workerIndex}`);
  grantPremium(email);

  await page.goto("/calcular");
  await page.reload();
  await expect(page.getByText("R$ 20,60")).toBeVisible();

  await page.getByTestId("save-scenario-trigger").click();
  const saveSheet = page.getByRole("dialog");
  await saveSheet.getByLabel(s.nameField).fill("Cenário da conta A");
  await saveSheet.getByTestId("save-scenario-submit").click();
  await expect(page.getByText(s.saved)).toBeVisible();

  // Read the list once online so the uid-keyed IndexedDB cache is actually populated (the thing
  // sign-out must purge).
  const listDialog = await openScenariosList(page);
  await expect(listDialog.getByText("Cenário da conta A")).toBeVisible();
  await page.keyboard.press("Escape");

  // Grab the uid Firebase persisted for THIS account (no pending queue → sign-out is immediate, no
  // guard dialog) before it's purged, so we can probe the IndexedDB key directly afterwards. The
  // modern Firebase Auth JS SDK persists the session in IndexedDB ("firebaseLocalStorageDb" /
  // "firebaseLocalStorage"), NOT localStorage.
  const uid = await page.evaluate(async () => {
    const req = indexedDB.open("firebaseLocalStorageDb");
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(["firebaseLocalStorage"], "readonly");
      const getReq = tx.objectStore("firebaseLocalStorage").getAll();
      getReq.onsuccess = () => resolve(getReq.result as unknown[]);
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();
    for (const row of rows) {
      const value = (row as { value?: { uid?: string } }).value;
      if (value?.uid) return value.uid;
    }
    return null;
  });
  expect(uid).not.toBeNull();

  await page.getByRole("button", { name: messages.account.signOut }).click();
  // No pending queue on this account → sign-out is immediate (no guard dialog, unlike the history
  // outbox path); the app returns to the anonymous calculator (soft paywall, ADR-0015).
  await expect(page.getByRole("button", { name: s.saveAction })).toHaveCount(0);

  // The uid-keyed IndexedDB row for THIS account's scenarios cache is actually gone — not merely
  // shadowed by a different key for the next signed-in user.
  const stillCached = await page.evaluate(async (u: string) => {
    const req = indexedDB.open("keyval-store");
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction("keyval", "readonly");
      const getReq = tx.objectStore("keyval").get(`scenarios:${u}`);
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();
    return value;
  }, uid as string);
  expect(stillCached).toBeUndefined();

  // A second, DIFFERENT account signs in on the same device: it sees an empty list, never account
  // A's saved scenario (uid-keyed isolation, FR-309 lesson).
  const email2 = await signUpThrowaway(page, `scn-signout-b-${info.workerIndex}`);
  grantPremium(email2);
  await page.reload();
  await expect(page.getByText("R$ 20,60")).toBeVisible();
  const secondList = await openScenariosList(page);
  await expect(secondList.getByText(s.emptyTitle)).toBeVisible();
  await expect(secondList.getByText("Cenário da conta A")).toHaveCount(0);
});

test("free/signed-out meets the honest teaser — NO inline 'Salvar cenário' anywhere (US5, SC-109/SC-607)", async ({
  page,
}) => {
  // Signed-out: /calcular is public.
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
  await expect(page.getByRole("button", { name: s.saveAction })).toHaveCount(0);

  const listDialog = await openScenariosList(page);
  await expect(listDialog.getByText(s.teaserTitle)).toBeVisible();
  // No price, no availability date, no fabricated sample scenario, no purchase CTA.
  // E6/US7 — o preco real entrou aqui; a proibicao valia enquanto a cobranca nao existia. O que
  // sobra e a honestidade do numero: so os tres precos praticados.
  for (const v of (await listDialog.innerText()).match(/\d+[.,]\d{2}/g) ?? []) {
    expect(["15,99", "12,99", "155,88"]).toContain(v);
  }
  // O CTA de assinar agora EXISTE e e desejado (US7). O que continua proibido e a compra fingida:
  // nada aqui pode virar premium sozinho — o salvar inline segue ausente, afirmado acima.

  await listDialog.getByText(s.teaserAction).click();
  const teaserDialog = page.getByRole("dialog").last();
  await expect(teaserDialog.getByText(s.teaserDialogTitle)).toBeVisible();
  // E6/US7 — o preco real entrou aqui; a proibicao valia enquanto a cobranca nao existia.
  for (const n of (await teaserDialog.innerText()).match(/\d+[.,]\d{2}/g) ?? []) {
    expect(["15,99", "12,99", "155,88"]).toContain(n);
  }
  await expect(teaserDialog.getByRole("button", { name: s.teaserSignIn })).toBeVisible();
  await teaserDialog.getByRole("button", { name: s.teaserDismiss }).click();

  // Nothing persisted anywhere along the way — a fresh load shows the exact same honest door.
  await page.reload();
  await expect(page.getByRole("button", { name: s.saveAction })).toHaveCount(0);
});

test("a free (signed-in, no premium) account gets the same honest door — SC-109 holds signed-in too", async ({
  page,
}, info) => {
  await signUpThrowaway(page, `scn-free-${info.workerIndex}`); // never granted
  await page.reload();
  await expect(page.getByText("R$ 20,60")).toBeVisible();

  await expect(page.getByRole("button", { name: s.saveAction })).toHaveCount(0);

  const listDialog = await openScenariosList(page);
  await expect(listDialog.getByText(s.teaserTitle)).toBeVisible();
  // E6/US7 — o preco real entrou aqui; a proibicao valia enquanto a cobranca nao existia. O que
  // sobra e a honestidade do numero: so os tres precos praticados.
  for (const v of (await listDialog.innerText()).match(/\d+[.,]\d{2}/g) ?? []) {
    expect(["15,99", "12,99", "155,88"]).toContain(v);
  }
});
