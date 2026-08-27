import { expect, test, type Locator, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// 019/T024 (US2) — a guarda do INVERSO. Decisão do dono (25/08, reafirmada 27/08; spec §Clarifications,
// exceção explícita ao WCAG 2.4.7): NENHUM controle mostra indicador de foco. O 018 tinha um medidor de
// anel (`tests/homologacao/_diag-foco.spec.ts`) que provava a presença; este prova a AUSÊNCIA — por tipo
// de controle, focando de verdade e lendo o estilo COMPUTADO, nunca a classe. O campo é a exceção
// desenhada: a moldura (`.tf-inputwrap`) continua marcando `:focus-within` pela borda de acento — é
// borda, não anel. Não-vacuidade: restaurar um `:focus-visible { outline: 2px solid }` em `button.css`
// deixa o caso "botão" vermelho (feito e revertido na T029; registrado em dod-evidence).

const VIEWPORTS = [
  { name: "390 (TabBar)", width: 390, height: 844 },
  { name: "1440 (sidebar)", width: 1440, height: 900 },
] as const;

async function focusStyles(locator: Locator): Promise<{
  outlineStyle: string;
  outlineWidth: string;
  boxShadow: string;
  background: string;
  hasFocus: boolean;
}> {
  await locator.focus();
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
      background: cs.backgroundColor,
      hasFocus: document.activeElement === el,
    };
  });
}

async function restingBackground(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
}

function expectNoRing(where: string, s: Awaited<ReturnType<typeof focusStyles>>): void {
  expect(s.hasFocus, `${where}: o foco chegou ao controle`).toBe(true);
  expect(
    s.outlineStyle === "none" || s.outlineWidth === "0px",
    `${where}: outline ${s.outlineStyle} ${s.outlineWidth}`,
  ).toBe(true);
  expect(s.boxShadow, `${where}: box-shadow`).toBe("none");
}

async function accentAsRgb(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`019/T024 — zero anel de foco @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("botão, link do menu, aba segmentada, switch e dispensa de alerta: sem anel", async ({
      page,
    }) => {
      await page.goto("/calcular");
      await expect(page.getByRole("button", { name: messages.theme.toggle })).toBeVisible();

      // 1. botão (o alternador de tema existe em toda rota)
      expectNoRing(
        "botão",
        await focusStyles(page.getByRole("button", { name: messages.theme.toggle })),
      );

      // 2. link do menu — um item NÃO ativo: o fundo em foco tem de ser o fundo em repouso
      //    (o 018 marcava foco com `--accent-soft` + inset box-shadow; os dois saem)
      const navItem = page.locator(".tf-nav__item:not([aria-current='page'])").first();
      const resting = await restingBackground(navItem);
      const nav = await focusStyles(navItem);
      expectNoRing("link do menu", nav);
      expect(nav.background, "link do menu: fundo em foco = fundo em repouso").toBe(resting);

      // 3. aba segmentada
      const tab = page.getByRole("tab").first();
      if ((await tab.count()) > 0) expectNoRing("aba segmentada", await focusStyles(tab));
      else test.info().annotations.push({ type: "skip", description: "sem role=tab em /calcular" });

      // 4. switch
      const sw = page.getByRole("switch").first();
      if ((await sw.count()) > 0) expectNoRing("switch", await focusStyles(sw));
      else
        test.info().annotations.push({ type: "skip", description: "sem role=switch em /calcular" });

      // 5. dispensa de alerta (o selo de procedência com `tf-alert__close` chega na PR-C — até lá,
      //    a ausência do controle é registrada, não fingida)
      const close = page.locator(".tf-alert__close").first();
      if ((await close.count()) > 0) expectNoRing("dispensa de alerta", await focusStyles(close));
      else
        test.info().annotations.push({
          type: "skip",
          description: "sem .tf-alert__close renderizado nesta fatia (PR-C)",
        });
    });

    test("campo: sem anel no input; a moldura marca o foco só pela borda de acento", async ({
      page,
    }) => {
      await page.goto("/calcular");
      const input = page.locator(".tf-inputwrap .tf-input").first();
      await expect(input).toBeVisible();
      const s = await focusStyles(input);
      expectNoRing("campo (input)", s);

      const wrap = page.locator(".tf-inputwrap").filter({ has: input }).first();
      const wrapStyles = await wrap.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          borderColor: cs.borderTopColor,
          boxShadow: cs.boxShadow,
          outline: cs.outlineStyle,
        };
      });
      expect(wrapStyles.boxShadow, "moldura: sem sombra de foco").toBe("none");
      expect(wrapStyles.outline, "moldura: sem outline").toBe("none");
      expect(wrapStyles.borderColor, "moldura: borda de acento em :focus-within").toBe(
        await accentAsRgb(page),
      );
    });
  });
}
