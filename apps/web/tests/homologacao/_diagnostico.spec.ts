import { test } from "@playwright/test";

import { aplicarSubcenario, coletarConsole, t } from "./_harness";

// Arquivo de DIAGNÓSTICO — não afirma nada sobre o produto. Ele só coleta fatos do DOM real para
// que os achados da bateria possam ser separados entre "defeito do produto" e "erro do harness".
// Sem esta etapa, uma asserção minha errada vira um "defeito crítico" no relatório do dono.

test("DIAG — estrutura da calculadora, rótulos de preço, console e foco", async ({ page }) => {
  const con = coletarConsole(page);
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await page.goto("/calcular");
  await page.getByRole("heading", { name: t.calculator.title }).waitFor();

  const texto = await page.locator("body").innerText();
  console.log("=== INNERTEXT (primeiros 2500) ===");
  console.log(texto.slice(0, 2500));

  console.log("=== TEXTBOXES (nome acessível) ===");
  const nomes = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("input"))) {
      const i = el as HTMLInputElement;
      const lab = i.id ? document.querySelector(`label[for="${CSS.escape(i.id)}"]`) : null;
      out.push(
        `${i.type}|aria=${i.getAttribute("aria-label") ?? ""}|label=${(lab?.textContent ?? "").trim()}|val=${i.value}`,
      );
    }
    return out;
  });
  console.log(nomes.join("\n"));

  console.log("=== ALVOS < 44px ===");
  console.log(
    JSON.stringify(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll('button,a[href],[role="tab"],[role="switch"]'))
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              txt: (el.textContent ?? "").trim().slice(0, 30),
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })
          .filter((x) => (x.w > 0 && x.w < 44) || (x.h > 0 && x.h < 44)),
      ),
      null,
      1,
    ),
  );

  console.log("=== FOCO: elementos sem anel ao tabular ===");
  await page.keyboard.press("Tab");
  for (let i = 0; i < 15; i += 1) {
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        cls: (el.className ?? "").toString().slice(0, 50),
        txt: (el.textContent ?? "").trim().slice(0, 25),
        outline: `${cs.outlineStyle}/${cs.outlineWidth}/${cs.outlineColor}`,
        shadow: cs.boxShadow.slice(0, 60),
      };
    });
    if (f) console.log(JSON.stringify(f));
    await page.keyboard.press("Tab");
  }

  console.log("=== CONSOLE ===");
  console.log(JSON.stringify({ erros: con.erros, falhas: con.falhas.slice(0, 10) }, null, 1));
});

test("DIAG — outros custos: quais campos casam com /Valor/", async ({ page }) => {
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await page.goto("/calcular");
  await page.getByRole("heading", { name: t.calculator.title }).waitFor();
  await page.getByRole("button", { name: t.calculator.outrosCustos.addCost }).click();
  await page.getByRole("button", { name: t.calculator.outrosCustos.addCost }).click();

  const casam = await page.getByRole("textbox", { name: /Valor/ }).all();
  console.log(`=== ${casam.length} textbox(es) casam com /Valor/ ===`);
  for (const c of casam) {
    console.log(
      `  aria=${await c.getAttribute("aria-label")} id=${await c.getAttribute("id")} val=${await c.inputValue()}`,
    );
  }
  const exatos = await page.getByRole("textbox", { name: /^Valor$/ }).all();
  console.log(`=== ${exatos.length} casam com /^Valor$/ ===`);
});

test("DIAG — contraste a 1024px e overflow com nome gigante", async ({ page }) => {
  await aplicarSubcenario(page, { viewport: "V2", tema: "dark" });
  await page.goto("/calcular");
  await page.getByRole("heading", { name: t.calculator.title }).waitFor();
  const { contrasteInsuficiente } = await import("./_harness");
  console.log("=== CONTRASTE 1024 dark ===");
  console.log((await contrasteInsuficiente(page)).join("\n"));

  // nome gigante isolado, para saber QUAL elemento estoura
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: t.calculator.outrosCustos.addCost }).click();
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.outrosCustos.name) })
    .first()
    .fill("A".repeat(300));
  await page.keyboard.press("Tab");
  const culpados = await page.evaluate(() => {
    const larg = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.right > larg + 2) {
        out.push(
          `${el.tagName}.${(el.className ?? "").toString().slice(0, 40)} right=${Math.round(r.right)} larg=${larg}`,
        );
      }
    }
    return out.slice(0, 12);
  });
  console.log("=== ELEMENTOS QUE ESTOURAM COM NOME DE 300 CHARS ===");
  console.log(culpados.join("\n"));
});
