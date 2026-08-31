import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// 019/PR-A — as MEDIDAS que justificaram os primitivos, aferidas no bundle real (não no jsdom):
//   T016  `Frozen`: rótulo e dica dentro do fieldset congelado continuam legíveis (o esmaecimento vive
//         nos CONTROLES; opacidade no contêiner derrubava a dica a 2,58:1 — prancheta 23b);
//         `Plist`: a 390px, 12 itens dão ≥9 visíveis sem rolar (o card dava 4 — prancheta 23b).
//   T025  TabBar: rótulo a 10px com ≥7px de respiro por lado na célula de 390px ("Orçamentos" media
//         71,0px a 12px numa célula de 71px — prancheta 22b).
// Nenhuma tela monta `Frozen`/`Plist` antes da PR-B/PR-D, então a marcação da prancheta é INJETADA
// numa moldura própria; o CSS que a veste é o do bundle (shared/ui/index.ts importa as folhas).
// A cor é medida contra o fundo REAL pintado (primeiro ancestral opaco, compondo alfa).

const THEMES = ["dark", "light"] as const;
const AA_TEXT = 4.5;

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
    await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
    }, theme);
}

// Contraste WCAG do texto de `sel` contra o fundo efetivamente pintado atrás dele.
async function contrastOf(page: Page, sel: string): Promise<number> {
    return page.evaluate((selector) => {
        const parse = (v: string): [number, number, number, number] => {
            const m = v.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
            if (!m) throw new Error(`cor ilegível: ${v}`);
            return [
                Number(m[1]),
                Number(m[2]),
                Number(m[3]),
                m[4] === undefined ? 1 : Number(m[4]),
            ];
        };
        const el = document.querySelector(selector);
        if (!el) throw new Error(`sem elemento: ${selector}`);
        const fg = parse(getComputedStyle(el).color);
        // fundo: sobe a árvore compondo camadas translúcidas até um opaco
        const layers: [number, number, number, number][] = [];
        let node: Element | null = el;
        while (node) {
            const bg = parse(getComputedStyle(node).backgroundColor);
            if (bg[3] > 0) layers.unshift(bg);
            if (bg[3] >= 1) break;
            node = node.parentElement;
        }
        let base: [number, number, number] = [255, 255, 255];
        for (const [r, g, b, a] of layers) {
            base = [
                Math.round(r * a + base[0] * (1 - a)),
                Math.round(g * a + base[1] * (1 - a)),
                Math.round(b * a + base[2] * (1 - a)),
            ];
        }
        const lum = ([r, g, b]: [number, number, number]) => {
            const lin = [r, g, b].map((c) => {
                const s = c / 255;
                return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
        };
        const fgRgb: [number, number, number] = [
            Math.round(fg[0] * fg[3] + base[0] * (1 - fg[3])),
            Math.round(fg[1] * fg[3] + base[1] * (1 - fg[3])),
            Math.round(fg[2] * fg[3] + base[2] * (1 - fg[3])),
        ];
        const l1 = lum(fgRgb);
        const l2 = lum(base);
        const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
        return (hi + 0.05) / (lo + 0.05);
    }, sel);
}

const FROZEN_MARKUP = `
<div id="t016-frozen" class="tf-card" style="position:fixed;inset:16px auto auto 16px;width:358px;z-index:9999">
  <fieldset disabled class="tf-frozen" aria-disabled="true">
    <div class="tf-field">
      <label class="tf-field__label" for="fz-t016">Consumo médio <span class="tf-field__req" aria-hidden="true">*</span></label>
      <div class="tf-inputwrap"><input id="fz-t016" class="tf-input tf-input--num" type="text" aria-disabled="true" readonly><span class="tf-inputwrap__affix">kW</span></div>
      <span class="tf-field__hint">Consumo médio real da impressora, não a potência de placa (~0,12 kW).</span>
    </div>
  </fieldset>
</div>`;

function plistMarkup(n: number): string {
    const items = Array.from({ length: n }, (_, i) =>
        i % 3 === 1
            ? `<li><span class="tf-plist__row"><span class="tf-plist__main"><span class="tf-plist__name">Suporte de fone articulado ${i}</span><span class="tf-plist__meta"><span class="tf-plist__flag">recalcular</span></span></span><span class="tf-plist__val"><span class="tf-plist__price">R$&nbsp;34,50</span><span class="tf-plist__was">era R$&nbsp;31,00</span></span></span></li>`
            : `<li><span class="tf-plist__row"><span class="tf-plist__main"><span class="tf-plist__name">Vaso hexagonal grande ${i}</span><span class="tf-plist__meta">14/03</span></span><span class="tf-plist__val"><span class="tf-plist__price">R$&nbsp;89,90</span></span></span></li>`,
    ).join("");
    return `<div id="t016-plist" style="position:fixed;inset:0;z-index:9999;background:var(--bg-base);padding:16px;overflow:hidden"><ul class="tf-plist">${items}</ul></div>`;
}

test.describe("019/T016 — as medidas do Frozen e do Plist @ 390", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    for (const theme of THEMES) {
        test(`Frozen (${theme}): rótulo e dica ≥ ${AA_TEXT}:1 contra o fundo real`, async ({
            page,
        }) => {
            await page.goto("/calcular");
            await setTheme(page, theme);
            await page.evaluate(
                (html) => document.body.insertAdjacentHTML("beforeend", html),
                FROZEN_MARKUP,
            );
            await expect(page.locator("#t016-frozen .tf-frozen")).toBeVisible();

            const hint = await contrastOf(page, "#t016-frozen .tf-field__hint");
            const label = await contrastOf(page, "#t016-frozen .tf-field__label");
            test.info().annotations.push({
                type: "medida",
                description: `${theme}: hint ${hint.toFixed(2)}:1 · label ${label.toFixed(2)}:1`,
            });
            expect(hint, `dica dentro do Frozen (${theme})`).toBeGreaterThanOrEqual(AA_TEXT);
            expect(label, `rótulo dentro do Frozen (${theme})`).toBeGreaterThanOrEqual(AA_TEXT);

            // o esmaecimento NÃO vive no contêiner: opacidade 1 no fieldset e no field
            const opacities = await page
                .locator("#t016-frozen .tf-frozen, #t016-frozen .tf-field")
                .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
            expect(opacities).toEqual(["1", "1"]);
        });
    }

    test("Plist: 12 itens a 390px → ≥9 inteiramente visíveis sem rolar", async ({ page }) => {
        await page.goto("/calcular");
        await page.evaluate(
            (html) => document.body.insertAdjacentHTML("beforeend", html),
            plistMarkup(12),
        );
        const rows = page.locator("#t016-plist .tf-plist > li");
        await expect(rows).toHaveCount(12);
        const boxes = await rows.evaluateAll((els) =>
            els.map((el) => {
                const r = el.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom, height: r.height };
            }),
        );
        const visiveis = boxes.filter((b) => b.top >= 0 && b.bottom <= 844).length;
        test.info().annotations.push({
            type: "medida",
            description: `${visiveis}/12 itens inteiros em 844px; altura média ${(
                boxes.reduce((s, b) => s + b.height, 0) / boxes.length
            ).toFixed(1)}px`,
        });
        expect(visiveis).toBeGreaterThanOrEqual(9);
    });
});

test.describe("019/T025 — o rótulo da TabBar @ 390", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("10px, e ≥7px de respiro por lado na célula mais apertada", async ({ page }) => {
        await page.goto("/calcular");
        const labels = page.locator(".tf-nav--tabbar .tf-nav__label");
        await expect(labels).toHaveCount(5);
        await expect(labels.filter({ hasText: messages.nav.historico })).toHaveCount(1);

        const medidas = await labels.evaluateAll((els) =>
            els.map((el) => {
                const cell = el.closest(".tf-nav__cell") ?? el.closest("li");
                const r = el.getBoundingClientRect();
                const c = (cell ?? el).getBoundingClientRect();
                return {
                    texto: el.textContent?.trim() ?? "",
                    fontSize: getComputedStyle(el).fontSize,
                    respiro: Math.min(r.left - c.left, c.right - r.right),
                    overflow: el.scrollWidth > el.clientWidth,
                };
            }),
        );
        for (const m of medidas) {
            expect(m.fontSize, m.texto).toBe("10px");
            expect(m.overflow, `${m.texto}: transborda a própria caixa`).toBe(false);
            expect(
                m.respiro,
                `${m.texto}: respiro ${m.respiro.toFixed(1)}px`,
            ).toBeGreaterThanOrEqual(7);
        }
        test.info().annotations.push({
            type: "medida",
            description: medidas.map((m) => `${m.texto} ${m.respiro.toFixed(1)}px`).join(" · "),
        });
    });
});
