import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, signUpThrowaway } from "./history-helpers";

// T072/A5+A6 (correções pós-016) — as duas propriedades que jsdom não computa (clamp/em e
// hit-testing), medidas no browser real a 360×800, conforme docs/design/a5-a6-decisoes.md.
//
// A5: os 6,72px/8px fotografados pela homologação não eram escala errada — eram BASE errada:
// `cur`/`dec` (0,4/0,5em) resolviam contra `.tf-price__amount`, que herdava 16px do body,
// enquanto o tamanho do preço vivia no IRMÃO `__int`. A correção move a base para o contêiner.
//
// A6: os 16 gatilhos ⓘ medem 28×28 de GLIFO por decisão (inline affordance) — o piso da casa
// (INV-2 ≥44px) é entregue por um `::after` fora do fluxo. O guard de boundingBox é CEGO aqui
// de propósito: a propriedade certa é hit-testing (elementFromPoint), não geometria do glifo.

const t = messages.calculator;

/** 019/PR-F (T099, adoção) — `heroSizeFor()` (`calculator-form.tsx`) só escolhe a variante `md`
 *  quando o inteiro do preço tem MAIS de 4 dígitos (≥ R$ 10.000); a semente livre (~R$16-24)
 *  sempre renderiza `lg` desde o rodapé redesenhado (T142/T143, prancheta 10). Este teste é SOBRE
 *  a proporção do `md` — então em vez de trocar de variante, cravamos um preço de 6 dígitos que
 *  segue exercitando `md` de propósito (o mesmo valor/receita de `calculator-layout.spec.ts`'s
 *  `fillSixDigitPrice`, prancheta 10b: material sozinho, markup 0%, imprime EXATAMENTE
 *  R$ 950.096,00). */
async function fillSixDigitPrice(page: import("@playwright/test").Page): Promise<void> {
    const fill = (label: string | RegExp, value: string) =>
        page.getByRole("textbox", { name: label, exact: true }).fill(value);
    await fill(t.fields.costPerRoll, "950096");
    await fill(t.fields.grams, "1000");
    await fill(t.fields.avgPower, "0");
    await fill(t.fields.machineValue, "0");
    await fill(t.fields.markupVarejo, "0");
}

test.describe("A5 — preço-herói: centavos e símbolo com a base certa (360×800)", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto("/calcular");
        await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
        // Vermelho INTERMITENTE morre na causa (lição 016): medir geometria durante o swap da
        // webfont numérica dava 2px de overflow-Y fantasma que o retry não reproduzia.
        await page.evaluate(() => document.fonts.ready);
    });

    test("proporção pinada em px na variante md (cartão Varejo) + a regra que sobrevive a troca de token", async ({
        page,
    }) => {
        await fillSixDigitPrice(page);
        await expect(page.getByTestId("price-hero")).toContainText("950.096");
        const sizes = await page.evaluate(() => {
            const md = document.querySelector(".tf-price--md");
            if (!md) return null;
            const px = (sel: string) => {
                const el = md.querySelector(sel);
                return el ? parseFloat(getComputedStyle(el).fontSize) : null;
            };
            return {
                int: px(".tf-price__int"),
                cur: px(".tf-price__cur"),
                dec: px(".tf-price__dec"),
            };
        });
        expect(sizes, "esperado um .tf-price--md com int/cur/dec em /calcular").not.toBeNull();
        const { int, cur, dec } = sizes!;
        expect(int, "inteiro md = --fs-2xl").toBe(36);
        expect(cur, "R$ = 0.4em sobre 36px (era 6,72px)").toBeCloseTo(14.4, 1);
        expect(dec, "centavos = 0.5em sobre 36px (era 8px)").toBe(18);
        // A REGRA (sobrevive a uma troca de token): dominância do inteiro, centavos legíveis
        // como número (≥ corpo de texto), símbolo nunca de volta ao ornamental.
        expect(int!).toBeGreaterThan(dec!);
        expect(dec!).toBeGreaterThan(cur!);
        expect(dec!).toBeGreaterThanOrEqual(16);
        expect(cur!).toBeGreaterThanOrEqual(14);
        expect(dec!).toBeLessThanOrEqual(0.55 * int!);
    });

    test("zero regressão de layout: sem overflow horizontal da página e sem scroll nos DOIS eixos do amount", async ({
        page,
    }) => {
        const geo = await page.evaluate(() => {
            const amounts = [...document.querySelectorAll(".tf-price__amount")].map((el) => ({
                x: el.scrollWidth - el.clientWidth,
                // o eixo do item 9 é o VERTICAL — headless não desenha a barra clássica, mas
                // scrollHeight é medível (lição 016/T018).
                y: el.scrollHeight - el.clientHeight,
            }));
            return { pageX: document.documentElement.scrollWidth, amounts };
        });
        expect(geo.pageX, "documento sem overflow horizontal a 360px").toBeLessThanOrEqual(360);
        for (const [i, a] of geo.amounts.entries()) {
            expect(a.x, `amount[${i}] scrolla ${a.x}px no eixo X`).toBeLessThanOrEqual(0);
            expect(a.y, `amount[${i}] transborda ${a.y}px no eixo Y (item 9)`).toBeLessThanOrEqual(
                0,
            );
        }
    });

    test("não-vacuidade por mutação viva: sem a base no contêiner, os px voltam a 6,72/8", async ({
        page,
    }) => {
        await fillSixDigitPrice(page);
        await expect(page.getByTestId("price-hero")).toContainText("950.096");
        await page.addStyleTag({
            content: ".tf-price__amount { font-size: 1rem !important; }",
        });
        const sizes = await page.evaluate(() => {
            const md = document.querySelector(".tf-price--md");
            const px = (sel: string) => {
                const el = md?.querySelector(sel);
                return el ? parseFloat(getComputedStyle(el).fontSize) : null;
            };
            return { cur: px(".tf-price__cur"), dec: px(".tf-price__dec") };
        });
        // Se isto falhar, o teste de proporção acima está medindo o elemento errado.
        expect(sizes.cur).toBeCloseTo(6.4, 1);
        expect(sizes.dec).toBe(8);
    });
});

test.describe("A5-b — a barra fixada do kit é um READOUT de 1 coluna (emenda 2026-08-07)", () => {
    // A história completa está na emenda A5-b (a5-a6-decisoes.md): o guard original mediu wrap no
    // par FIXADO com `md` já aplicado — 89px por célula não comportam "R$ 1.234,56" nem em texto
    // corrido, então não existe saída tipográfica; a decisão é 1 coluna com rótulo à esquerda /
    // valor à direita. O guard mede com valor de 5 DÍGITOS: foi um valor curto que deixou o aperto
    // dormir até aqui.
    test("readout A5-c: invariância de altura, valor inteiro sempre, rótulo é quem cede", async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 360, height: 800 });
        const email = await signUpThrowaway(page, `a5kit-${info.workerIndex}`);
        grantPremium(email);
        await page.goto("/kits");
        await page.reload();
        await expect(page.getByText(messages.bom.emptyTitle)).toBeVisible();
        await page.getByRole("button", { name: new RegExp(messages.bom.addLine) }).click();
        await expect(
            page.locator(".assembly-summary__pinned .tf-price__amount").first(),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready); // geometria só depois do swap da fonte

        const measure = () =>
            page.evaluate(() => {
                // Wrap ≠ offsetTop diferente: com `align-items: baseline`, tokens de fontes diferentes
                // têm tops diferentes NA MESMA linha. Wrap real = uma caixa começa ABAIXO de onde outra
                // termina.
                const wrapOf = (amount: Element) => {
                    const boxes = [".tf-price__cur", ".tf-price__int", ".tf-price__dec"]
                        .map((s) => amount.querySelector(s)?.getBoundingClientRect())
                        .filter((r): r is DOMRect => r !== undefined);
                    return boxes.some((a) => boxes.some((b) => a.top >= b.bottom - 1));
                };
                const pinned = document.querySelector(".assembly-summary__pinned");
                const amounts = [...(pinned?.querySelectorAll(".tf-price__amount") ?? [])];
                const outside = [...document.querySelectorAll(".tf-price")].filter(
                    (p) => !p.closest(".assembly-summary__pinned"),
                );
                return {
                    pageX: document.documentElement.scrollWidth,
                    barH: pinned?.getBoundingClientRect().height ?? null,
                    pinned: amounts.map((a) => {
                        const label = a.closest(".tf-price")?.querySelector(".tf-price__label");
                        return {
                            text: (a.textContent ?? "").trim(),
                            wrapped: wrapOf(a),
                            scrollX: a.scrollWidth - a.clientWidth,
                            clientW: a.clientWidth,
                            // A5-d: textContent NÃO enxerga text-overflow — a reticência só aparece na
                            // medição de scrollWidth; as duas asserções andam JUNTAS por isso.
                            labelText: (label?.textContent ?? "").trim(),
                            labelEllipsis: label ? label.scrollWidth > label.clientWidth : false,
                        };
                    }),
                    // o resumo NÃO-fixado (o editor de linha embute a calculadora) fica intacto: cartões
                    // com fundo pintado, nunca o override de readout.
                    outsideTransparent: outside.filter(
                        (p) =>
                            p.classList.contains("tf-price--accent") &&
                            getComputedStyle(p).backgroundColor === "rgba(0, 0, 0, 0)",
                    ).length,
                };
            });

        // O guard da A5-c é de INVARIÂNCIA (a asserção comparativa da A5-b morreu: o baseline da
        // grade também muda sob mutação). Três valores, três verdades:
        const qtyField = page.getByRole("textbox", {
            name: new RegExp(`^${messages.bom.quantity}`),
        });

        // (1) semente (1 un — R$ 24,24): linha limpa, sem reticência; registra a ALTURA da barra.
        await qtyField.fill("1");
        await expect(page.locator(".assembly-summary__pinned")).toContainText("24,24");
        const seed = await measure();
        expect(seed.pinned.length, "esperados os 2 PriceHero do bloco fixado").toBe(2);
        for (const [i, g] of seed.pinned.entries()) {
            expect(g.wrapped, `semente: hero fixado [${i}] "${g.text}" quebrou`).toBe(false);
            expect(g.labelEllipsis, `semente: rótulo [${i}] com reticência`).toBe(false);
        }

        // (2) 5 dígitos (999 un — R$ 24.215,76): sem quebra E SEM reticência (a A5-c cabe inteira),
        // e a altura da barra é IDÊNTICA à da semente — uma sticky que cresce com o total é o
        // defeito que a 014/T118 existe para impedir.
        await qtyField.fill("999");
        await expect(page.locator(".assembly-summary__pinned")).toContainText("24.215,76");
        const five = await measure();
        for (const [i, g] of five.pinned.entries()) {
            expect(
                g.text.replace(/\D/g, "").length,
                `5 dígitos: hero [${i}] devia carregar 5+ dígitos, veio "${g.text}"`,
            ).toBeGreaterThanOrEqual(7); // 5 do inteiro + 2 dos centavos
            expect(g.wrapped, `5 dígitos: hero [${i}] "${g.text}" quebrou entre tokens`).toBe(
                false,
            );
            expect(g.scrollX, `5 dígitos: hero [${i}] scrolla ${g.scrollX}px`).toBeLessThanOrEqual(
                0,
            );
            expect(
                g.labelEllipsis,
                `5 dígitos: rótulo [${i}] truncou (não devia caber reticência)`,
            ).toBe(false);
        }
        // A5-d: os rótulos do readout são as chaves CURTAS por papel (bom.pinned), nunca os longos
        // de tc.results — copy exata + medição juntas (textContent sozinho passaria truncado).
        expect(five.pinned.map((g) => g.labelText)).toEqual([
            messages.bom.pinned.varejo,
            messages.bom.pinned.atacado,
        ]);
        expect(five.barH, "altura da barra INVARIANTE entre 24,24 e 24.215,76").toBe(seed.barH);
        expect(five.pageX, "documento sem overflow horizontal a 360px").toBeLessThanOrEqual(360);
        expect(five.outsideTransparent, "heroes fora do fixado perderam o fundo de cartão").toBe(0);

        // (3) o absurdo (99999 un — R$ 2.423.975,76): o NÚMERO continua inteiro e a página limpa;
        // reticência no rótulo aqui é RESULTADO ESPERADO da válvula, não falha.
        await qtyField.fill("99999");
        await expect(page.locator(".assembly-summary__pinned")).toContainText("2.423.975,76");
        await page.evaluate(() => document.fonts.ready);
        const absurd = await measure();
        for (const [i, g] of absurd.pinned.entries()) {
            expect(g.wrapped, `absurdo: hero [${i}] "${g.text}" quebrou entre tokens`).toBe(false);
        }
        expect(absurd.pageX, "absurdo: documento sem overflow horizontal").toBeLessThanOrEqual(360);
        expect(absurd.barH, "absurdo: a barra continua na MESMA altura").toBe(seed.barH);

        // Mutações (cada uma tem de DERRUBAR uma asserção acima). A mutação original da A5-c
        // (rótulo de volta a --fs-sm) MORREU VÁCUA com a A5-d: com os rótulos curtos, os dois
        // tamanhos cabem — o discriminante agora é a COPY (i-b) e a válvula (ii); o caption segue
        // como defesa-em-profundidade para rótulos futuros, que é exatamente o que (i-b) exercita.
        await qtyField.fill("999");
        await expect(page.locator(".assembly-summary__pinned")).toContainText("24.215,76");
        // (i-b) mutação de COPY da A5-d: o rótulo longo de tc.results de volta no readout tem de
        // derrubar a medição (é a regressão que a chave-por-papel existe para impedir).
        await page.evaluate(() => {
            const labels = document.querySelectorAll(".assembly-summary__pinned .tf-price__label");
            if (labels[1]) labels[1].textContent = "Preço atacado";
        });
        const mutCopy = await measure();
        expect(
            mutCopy.pinned.some((g) => g.labelEllipsis || g.wrapped),
            "não-vacuidade (i-b): o rótulo longo no readout tem de truncar ou quebrar",
        ).toBe(true);
        // (ii) sem a válvula (amount volta a encolher) ⇒ com o rótulo largo, o wrap volta.
        await page.addStyleTag({
            content:
                ".assembly-summary__pinned-prices .tf-price__amount { flex: 0 1 auto !important; }",
        });
        const mut2 = await measure();
        expect(
            mut2.pinned.some((g) => g.wrapped || g.scrollX > 0),
            "não-vacuidade (ii): sem flex: 0 0 auto o amount encolhe e o valor quebra",
        ).toBe(true);
        console.log(
            `[a5-c] barra: seed=${seed.barH}px · 5díg=${five.barH}px · absurdo=${absurd.barH}px · ellipsis no absurdo: ${JSON.stringify(absurd.pinned.map((g) => g.labelEllipsis))}`,
        );
    });
});

test.describe("A6 — InfoTip: 28×28 de glifo, ≥44×44 de área clicável por hit-test (360×800)", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto("/calcular");
        await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
        await page.evaluate(() => document.fonts.ready); // geometria só depois do swap da fonte
    });

    /** O retângulo PRETENDIDO a partir do box do glifo: x−8, y−12, 44×44 (inset -12px -8px -4px). */
    async function hitTestAll(page: import("@playwright/test").Page): Promise<{
        total: number;
        misses: { index: number; corner: string }[];
        inflated: number[];
    }> {
        return page.evaluate(() => {
            const triggers = [...document.querySelectorAll<HTMLElement>(".tf-infotip__trigger")];
            const misses: { index: number; corner: string }[] = [];
            const inflated: number[] = [];
            triggers.forEach((btn, index) => {
                const b = btn.getBoundingClientRect();
                if (Math.round(b.width) !== 28 || Math.round(b.height) !== 28) inflated.push(index);
                const rect = { x: b.x - 8, y: b.y - 12, w: 44, h: 44 };
                const points: [string, number, number][] = [
                    ["topo-esq", rect.x + 1, rect.y + 1],
                    ["topo-dir", rect.x + rect.w - 1, rect.y + 1],
                    ["base-esq", rect.x + 1, rect.y + rect.h - 1],
                    ["base-dir", rect.x + rect.w - 1, rect.y + rect.h - 1],
                    ["centro", rect.x + rect.w / 2, rect.y + rect.h / 2],
                ];
                for (const [corner, x, y] of points) {
                    // fora da viewport não é clicável por definição — só pontos visíveis contam
                    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
                    const el = document.elementFromPoint(x, y);
                    if (!el || el.closest(".tf-infotip__trigger") !== btn)
                        misses.push({ index, corner });
                }
            });
            return { total: triggers.length, misses, inflated };
        });
    }

    test("os 4 cantos + centro do retângulo 44×44 resolvem para o próprio gatilho, e o glifo não inflou", async ({
        page,
    }) => {
        // rola cada gatilho para a viewport em lotes: elementFromPoint só enxerga o visível
        const count = await page.locator(".tf-infotip__trigger").count();
        expect(count, "esperados os gatilhos ⓘ do 016 em /calcular").toBeGreaterThanOrEqual(10);
        const collected: Awaited<ReturnType<typeof hitTestAll>>[] = [];
        for (let i = 0; i < count; i += 1) {
            await page.locator(".tf-infotip__trigger").nth(i).scrollIntoViewIfNeeded();
            collected.push(await hitTestAll(page));
        }
        // cada gatilho foi visível em pelo menos uma passada; um miss em TODAS as passadas é real
        const persistentMisses = collected[collected.length - 1]!.misses.filter((m) =>
            collected.every((c) =>
                c.misses.some((x) => x.index === m.index && x.corner === m.corner),
            ),
        );
        expect(
            persistentMisses,
            `cantos que nunca resolveram para o gatilho: ${JSON.stringify(persistentMisses)}`,
        ).toEqual([]);
        expect(collected[0]!.inflated, "glifos que deixaram de medir 28×28").toEqual([]);
    });

    test("clique real FORA do glifo abre o popover, e o input abaixo não perde o hit", async ({
        page,
    }) => {
        const first = page.locator(".tf-infotip__trigger").first();
        await first.scrollIntoViewIfNeeded();
        const box = (await first.boundingBox())!;
        // canto superior-esquerdo do retângulo estendido: 6px à esquerda e 8px acima do glifo
        await page.mouse.click(box.x - 6, box.y - 8);
        await expect(page.locator(".tf-infotip__content")).toBeVisible();
        await page.keyboard.press("Escape");
        // o alvo concorrente: nenhum ponto do inputwrap do mesmo campo resolve para o gatilho
        const stolen = await page.evaluate(() => {
            const wraps = [...document.querySelectorAll<HTMLElement>(".tf-inputwrap")];
            return wraps.some((w) => {
                const r = w.getBoundingClientRect();
                if (r.width === 0 || r.top < 0 || r.top > innerHeight) return false;
                const el = document.elementFromPoint(r.x + r.width / 2, r.top + 2);
                return el ? el.closest(".tf-infotip__trigger") !== null : false;
            });
        });
        expect(stolen, "um .tf-inputwrap perdeu o topo para o ::after do gatilho").toBe(false);
    });

    test("não-vacuidade por mutação viva: sem o ::after, os cantos deixam de resolver", async ({
        page,
    }) => {
        await page.addStyleTag({
            content: ".tf-infotip__trigger::after { content: none !important; }",
        });
        const first = page.locator(".tf-infotip__trigger").first();
        await first.scrollIntoViewIfNeeded();
        const missed = await page.evaluate(() => {
            const btn = document.querySelector<HTMLElement>(".tf-infotip__trigger");
            if (!btn) return null;
            const b = btn.getBoundingClientRect();
            const el = document.elementFromPoint(b.x - 7, b.y - 11);
            return el ? el.closest(".tf-infotip__trigger") !== btn : true;
        });
        // Um guard que passa com e sem a regra não está medindo nada.
        expect(missed, "com o ::after removido, o canto tem de ESCAPAR do gatilho").toBe(true);
    });
});
