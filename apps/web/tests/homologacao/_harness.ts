import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_DATABASE_URL } from "../../playwright.config";

// Harness da homologação automatizada. Tudo aqui EXECUTA contra a pilha real (preview + FastAPI +
// Postgres + emulador de auth). Nada aqui simula o produto.
//
// Regra que governa o arquivo: um teste desta suíte NUNCA para no primeiro achado. Ele usa
// asserções macias (`expect.soft`) e `defeito()` para registrar, seguir e continuar procurando —
// uma homologação que morre no primeiro vermelho encontra um defeito por rodada.

const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));
const outDir = fileURLToPath(
  new URL("../../../../docs/homologacao/automatizada/resultados", import.meta.url),
);
export const t = messages;

export type Severidade = "critica" | "alta" | "media" | "baixa";

export interface Defeito {
  id: string;
  subcenario: string;
  categoria: string;
  descricao: string;
  resultado_esperado: string;
  resultado_obtido: string;
  severidade: Severidade;
  evidencia?: string;
  ts: string;
}

let seq = 0;

/** Registra um defeito INCREMENTALMENTE (um arquivo por worker, mesclado no relatório final).
 *  Existe porque metade dos defeitos desta homologação não é uma asserção que quebra — é uma
 *  mensagem que o leigo não entende, e isso não tem `expect` que pegue sozinho. */
export function defeito(
  info: TestInfo,
  d: Omit<Defeito, "id" | "ts"> & { evidencia?: string },
): void {
  seq += 1;
  const registro: Defeito = {
    ...d,
    id: `D-w${info.workerIndex}-${String(seq).padStart(3, "0")}`,
    ts: new Date().toISOString(),
  };
  mkdirSync(outDir, { recursive: true });
  appendFileSync(
    `${outDir}/defeitos-w${info.workerIndex}.jsonl`,
    `${JSON.stringify(registro)}\n`,
    "utf8",
  );
  // Anexa ao relatório do Playwright também, para o vermelho e o registro nunca divergirem.
  info.annotations.push({ type: "defeito", description: `[${d.severidade}] ${d.descricao}` });
}

/** Marca um teste como EXECUTADO e passado, para o relatório final poder dizer a taxa de falha
 *  sobre o total real e não sobre os que falharam. */
export function executado(info: TestInfo, subcenario: string, categoria: string): void {
  mkdirSync(outDir, { recursive: true });
  appendFileSync(
    `${outDir}/execucoes-w${info.workerIndex}.jsonl`,
    `${JSON.stringify({ subcenario, categoria, titulo: info.title, ts: new Date().toISOString() })}\n`,
    "utf8",
  );
}

// ---------------------------------------------------------------- sessão / entitlement

export async function signUp(page: Page, tag: string): Promise<string> {
  await page.goto("/sign-in");
  await page.waitForFunction(() => "__e2eAuth" in window);
  const email = `hom-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
  await page.evaluate(
    ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
      void w.__e2eAuth.signUp(em, pw);
    },
    { em: email, pw: "test-passw0rd" },
  );
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible({
    timeout: 30_000,
  });
  return email;
}

function cli(args: string): void {
  execSync(`uv run python -m app.scripts.grant_premium ${args}`, {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, P3D_DATABASE_URL: E2E_DATABASE_URL },
  });
}

/** Concede premium pelo caminho REAL de operador (o CLI escrevendo o ledger — ADR-0012), com
 *  espera limitada: a conta nasce na PRIMEIRA requisição autenticada, e a concessão corre com ela. */
export function grant(email: string): void {
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      cli(`grant ${email} --source beta --by homologacao`);
      return;
    } catch (err) {
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? "";
      if (!stderr.includes("no existing account matches") || Date.now() >= deadline) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);
    }
  }
}

export function revoke(email: string): void {
  cli(`revoke ${email} --by homologacao`);
}

/**
 * Um vendedor PREMIUM pronto para uso — e "pronto" aqui significa que o APP já sabe disso.
 *
 * A versão anterior concedia e recarregava, e seguia em frente. Isso deixava uma corrida: o
 * `GET /api/v1/entitlement` ainda estava em voo quando o teste procurava um botão que só existe
 * para quem tem Premium, e a ausência do botão era registrada como defeito do produto. Aconteceu
 * TRÊS vezes (CF-012, CF-025, CF-029) antes de eu tratar a causa em vez do sintoma.
 *
 * Aqui a espera é pelo FATO: a resposta do servidor dizendo `active`. Sem inventar um segundo
 * critério de "está premium" do lado do teste — quem decide continua sendo o servidor.
 */
export async function premium(page: Page, tag: string): Promise<string> {
  const email = await signUp(page, tag);
  await page.goto("/conta"); // força a requisição autenticada que provisiona a conta
  grant(email);

  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    const resposta = page.waitForResponse(
      (r) => r.url().includes("/api/v1/entitlement") && r.status() === 200,
      { timeout: 15_000 },
    );
    await page.reload();
    const vista = await resposta
      .then((r) => r.json() as Promise<{ status?: string }>)
      .catch(() => null);
    if (vista?.status === "active") return email;
    await page.waitForTimeout(700);
  }
  throw new Error(
    `A concessão de Premium para ${email} não chegou como "active" na resposta do servidor — ` +
      "o ambiente não está pronto para um teste de fluxo premium (não é um defeito do produto).",
  );
}

// ---------------------------------------------------------------- subcenário (viewport + tema)

export const VIEWPORTS = {
  V1: { width: 390, height: 844 },
  V2: { width: 1024, height: 768 },
  V3: { width: 1440, height: 900 },
} as const;

export type ViewportId = keyof typeof VIEWPORTS;

/** Aplica viewport e tema ANTES de qualquer navegação, porque o tema é resolvido antes do React
 *  montar (script inline do index.html) — aplicá-lo depois testaria outra coisa. */
export async function aplicarSubcenario(
  page: Page,
  opts: { viewport: ViewportId; tema?: "dark" | "light" },
): Promise<void> {
  await page.setViewportSize(VIEWPORTS[opts.viewport]);
  const tema = opts.tema ?? "dark";
  await page.addInitScript((th: string) => {
    localStorage.setItem("precifica3d-theme", JSON.stringify({ state: { theme: th }, version: 0 }));
    // `documentElement` ainda é null quando um init script roda em document-start: escrever nele
    // aqui lançava um `pageerror` que a coleta de console reportava como defeito DO PRODUTO. Era
    // meu. O script inline do index.html já resolve o tema a partir do localStorage acima.
    if (document.documentElement) document.documentElement.dataset.theme = th;
  }, tema);
}

// ---------------------------------------------------------------- rede

export async function offline(page: Page, context: BrowserContext): Promise<void> {
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
}

export async function online(page: Page, context: BrowserContext): Promise<void> {
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

/** 3G lento de verdade: atrasa CADA resposta, em vez de fingir latência com um sleep. */
export async function rede3G(page: Page, msPorResposta = 1200): Promise<void> {
  await page.route("**/api/**", async (route) => {
    await new Promise((r) => setTimeout(r, msPorResposta));
    await route.continue();
  });
}

/** Faz o servidor devolver `status` para as rotas que casarem com `padrao`. */
export async function falhaDeServidor(page: Page, padrao: string, status = 500): Promise<void> {
  await page.route(padrao, (route) =>
    route.fulfill({ status, contentType: "application/json", body: '{"detail":"boom"}' }),
  );
}

/**
 * Rótulo de campo virando regex COM escape.
 *
 * "Mão de obra (horas)" tem parênteses, que em regex são um GRUPO: sem escapar, o padrão vira
 * "Mão de obra horas" e não casa com nada. A primeira rodada reportou que a persona "não encontrou
 * o campo" — o campo estava lá; o meu seletor é que não existia.
 */
export function rotulo(texto: string): RegExp {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

// ---------------------------------------------------------------- medições de UI

/** Overflow horizontal E vertical do documento. A lição do 016/PR-B: headless não desenha a barra
 *  clássica, então medir só um eixo deixa passar metade dos casos. */
export async function overflow(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight };
  });
}

/** Um elemento nasceu FORA da viewport? (a classe de defeito do 012/PR-B: botão a 100px do lado
 *  de fora, invisível para `toBeVisible`). */
export async function foraDaViewport(page: Page, seletor: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const vw = window.innerWidth;
    const fora: string[] = [];
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        fora.push(
          `${el.tagName}.${el.className} left=${Math.round(r.left)} right=${Math.round(r.right)} vw=${vw}`,
        );
      }
    }
    return fora;
  }, seletor);
}

/**
 * Quem está estourando a largura da página — INCLUSIVE quando não é uma caixa.
 *
 * Um texto sem espaços (um código de produto colado, por exemplo) pinta FORA da caixa do elemento
 * sem alargá-la: nenhum `getBoundingClientRect()` de elemento passa do limite, e a página rola
 * mesmo assim. Por isso os nós de TEXTO são medidos por `Range`, que é o que enxerga a pintura.
 */
export async function culpadosDoOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const larg = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.right > larg + 2)
        out.push(
          `CAIXA ${el.tagName}.${String(el.className).slice(0, 40)} right=${Math.round(r.right)}`,
        );
    }
    const andarilho = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n = andarilho.nextNode();
    while (n) {
      const texto = (n.textContent ?? "").trim();
      if (texto.length > 0) {
        const faixa = document.createRange();
        faixa.selectNodeContents(n);
        const r = faixa.getBoundingClientRect();
        if (r.right > larg + 2) {
          const pai = n.parentElement;
          out.push(
            `TEXTO em ${pai?.tagName}.${String(pai?.className ?? "").slice(0, 40)} right=${Math.round(r.right)} conteudo="${texto.slice(0, 30)}…"`,
          );
        }
      }
      n = andarilho.nextNode();
    }
    return Array.from(new Set(out)).slice(0, 8);
  });
}

/** Contraste WCAG 2.1 calculado em página (substitui o axe-core sem tocar nas dependências do
 *  repositório). Devolve os textos abaixo do mínimo de 4,5:1 (3:1 para texto grande).
 *
 *  O fundo é COMPOSTO: a primeira versão parava no primeiro `background-color` não-transparente e
 *  usava um `rgba(...,0.18)` como se fosse opaco — o que faz um realce translúcido sobre superfície
 *  escura parecer quase preto e produz uma razão inventada. Aqui as camadas são empilhadas com
 *  alpha até chegar a uma opaca, que é o que o olho realmente vê. */
export async function contrasteInsuficiente(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rgba = (c: string): [number, number, number, number] | null => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
      return m
        ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
        : null;
    };
    const lum = (c: string): number => {
      const p = rgba(c);
      if (!p) return -1;
      const [r, g, b] = [p[0], p[1], p[2]].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const fundo = (el: Element): string => {
      const camadas: [number, number, number, number][] = [];
      let n: Element | null = el;
      while (n) {
        const p = rgba(getComputedStyle(n).backgroundColor);
        if (p && p[3] > 0) {
          camadas.push(p);
          if (p[3] >= 1) break;
        }
        n = n.parentElement;
      }
      const base = rgba(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
      if (camadas.length === 0 || camadas[camadas.length - 1][3] < 1)
        camadas.push([base[0], base[1], base[2], 1]);
      // Empilha de baixo para cima: cada camada superior é misturada sobre o resultado abaixo.
      let acc = camadas[camadas.length - 1];
      for (let i = camadas.length - 2; i >= 0; i -= 1) {
        const c = camadas[i];
        acc = [
          c[0] * c[3] + acc[0] * (1 - c[3]),
          c[1] * c[3] + acc[1] * (1 - c[3]),
          c[2] * c[3] + acc[2] * (1 - c[3]),
          1,
        ];
      }
      return `rgb(${Math.round(acc[0])}, ${Math.round(acc[1])}, ${Math.round(acc[2])})`;
    };
    const ruins: string[] = [];
    const nos = Array.from(
      document.querySelectorAll("p,span,label,h1,h2,h3,h4,button,a,li,td,th,div"),
    );
    for (const el of nos) {
      const texto = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? "")
        .join(" ")
        .trim();
      if (texto.length < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.1) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const lf = lum(cs.color);
      const lb = lum(fundo(el));
      if (lf < 0 || lb < 0) continue;
      const razao = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
      const px = parseFloat(cs.fontSize);
      const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
      const minimo = grande ? 3 : 4.5;
      if (razao < minimo) {
        ruins.push(
          `"${texto.slice(0, 40)}" ${razao.toFixed(2)}:1 (min ${minimo}) cor=${cs.color} fundo=${fundo(el)}`,
        );
      }
    }
    return Array.from(new Set(ruins));
  });
}

/**
 * WCAG 2.4.7 (Focus Visible) medido do único jeito que não mente: percorre a página por TAB e, em
 * cada parada, compara o estilo do elemento FOCADO com o dele mesmo SEM foco. Se outline, sombra,
 * fundo, borda e cor forem idênticos nos dois estados, não existe indicação de foco — mesmo que o
 * CSS declare uma.
 *
 * Olhar só `outline`/`box-shadow` (a primeira versão) reprova componentes cujo indicador é uma
 * mudança de FUNDO, e aprova o caso real que interessa: um item cujo indicador de foco é o mesmo
 * realce que ele já usa para dizer "estou ativo" — aí o foco existe no CSS e não existe na tela.
 */
export async function focoInvisivel(page: Page, paradas = 20): Promise<string[]> {
  const semIndicacao: string[] = [];
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  for (let i = 0; i < paradas; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // 1) Carimba o elemento focado e lê a cadeia de estilos DELE, ainda focado.
    const comFoco = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const caixa = el.getBoundingClientRect();
      if (caixa.width === 0 && caixa.height === 0) return null;
      el.setAttribute("data-foco-alvo", "1");
      const estiloDe = (n: Element): string => {
        const cs = getComputedStyle(n);
        return [
          cs.outlineStyle,
          cs.outlineWidth,
          cs.outlineColor,
          cs.boxShadow,
          cs.backgroundColor,
          cs.borderColor,
          cs.color,
        ].join("|");
      };
      const cadeia = [
        el,
        el.parentElement,
        el.parentElement?.parentElement ?? null,
        ...Array.from(el.querySelectorAll("*")).slice(0, 6),
      ];
      return {
        estilo: cadeia.map((n) => (n ? estiloDe(n) : "—")).join("//"),
        rotulo:
          `${el.tagName}.${String(el.className).slice(0, 30)}` +
          `[${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)}]`,
      };
    });
    if (!comFoco) continue;

    // 2) Tira o foco COM TECLADO (nunca `blur()` programático) e reconsulta o elemento pelo carimbo.
    //
    //    Esta é a terceira versão deste medidor, e as duas anteriores acusaram foco invisível em
    //    controles que TÊM anel. A última usava `blur()` + uma referência ao nó guardada em
    //    `window`: se o React recria aquele nó entre as duas leituras, a referência fica órfã, e
    //    `getComputedStyle` de um nó fora do documento devolve valores padrão — IDÊNTICOS nas duas
    //    medições, ou seja, "não mudou nada" por construção. Foi assim que TODO campo numérico da
    //    calculadora virou defeito num relatório, com o anel funcionando (medido: borda roxa +
    //    2px com foco, cinza sem foco).
    //
    //    Reconsultar pelo atributo garante que a segunda leitura é do nó que está no documento
    //    AGORA, e sair por Tab reproduz o que a pessoa faz de verdade.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    const semFoco = await page.evaluate(() => {
      const el = document.querySelector("[data-foco-alvo]");
      if (!el) return null;
      const estiloDe = (n: Element): string => {
        const cs = getComputedStyle(n);
        return [
          cs.outlineStyle,
          cs.outlineWidth,
          cs.outlineColor,
          cs.boxShadow,
          cs.backgroundColor,
          cs.borderColor,
          cs.color,
        ].join("|");
      };
      const cadeia = [
        el,
        el.parentElement,
        el.parentElement?.parentElement ?? null,
        ...Array.from(el.querySelectorAll("*")).slice(0, 6),
      ];
      const estilo = cadeia.map((n) => (n ? estiloDe(n) : "—")).join("//");
      el.removeAttribute("data-foco-alvo");
      return estilo;
    });

    if (semFoco !== null && comFoco.estilo === semFoco) semIndicacao.push(comFoco.rotulo);

    // 3) Volta o foco para onde estava, para a próxima parada ser a seguinte e não a de depois.
    await page.keyboard.press("Shift+Tab");
    await page.waitForTimeout(80);
  }
  return Array.from(new Set(semIndicacao));
}

/** Alvos de toque abaixo de 44x44 CSS px (WCAG 2.5.5 / diretriz de toque). */
export async function alvosPequenos(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const pequenos: string[] = [];
    for (const el of Array.from(
      document.querySelectorAll(
        'button,a[href],[role="tab"],input[type="checkbox"],[role="switch"]',
      ),
    )) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // WCAG 2.5.8 isenta explicitamente o alvo "inline" — um link no meio de uma frase nao tem
      // como ter 24px de altura sem quebrar a linha. Medi-lo como violacao acusa um falso positivo
      // em toda pagina com um link no corpo do texto.
      const cs = getComputedStyle(el);
      const ehInline = cs.display === "inline" && el.tagName === "A";
      // A área CLICÁVEL pode ser maior que a caixa pintada: o projeto estende o alvo do gatilho ⓘ
      // por um `::after` fora do fluxo (016/T072-A6 — 8+28+8 de largura, 12+28+4 de altura), de
      // propósito, para não inflar o visual. Medir só `getBoundingClientRect()` do botão acusava
      // 28×28 e reportava como "abaixo do conforto" um alvo que já tem 44px.
      const depois = getComputedStyle(el, "::after");
      const somaLado = (a: string, b: string) => (parseFloat(a) || 0) + (parseFloat(b) || 0);
      const extraX = depois.content !== "none" ? -somaLado(depois.left, depois.right) : 0;
      const extraY = depois.content !== "none" ? -somaLado(depois.top, depois.bottom) : 0;
      const larguraReal = r.width + Math.max(0, extraX);
      const alturaReal = r.height + Math.max(0, extraY);
      if (!ehInline && (larguraReal < 44 || alturaReal < 44)) {
        pequenos.push(
          `${el.tagName}[${(el.textContent ?? "").trim().slice(0, 24)}] ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return Array.from(new Set(pequenos));
  });
}

/** Vazamento técnico na tela: stack trace, JSON cru, código HTTP, nome de exceção, inglês de erro.
 *  A REGRA CENTRAL desta homologação — o usuário é leigo — vira uma medição aqui. */
export async function vazamentoTecnico(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const corpo = document.body.innerText;
    const padroes: [RegExp, string][] = [
      [/\bat\s+\w+\s*\([^)]*:\d+:\d+\)/, "stack trace"],
      [/\{"[a-zA-Z_]+":/, "JSON cru"],
      [/\b(TypeError|ReferenceError|SyntaxError|Traceback|NullPointer)\b/, "nome de exceção"],
      [
        /\bHTTP\s?(4|5)\d{2}\b|\b(status\s?code|Internal Server Error|Bad Gateway|Unprocessable)\b/i,
        "código/termo HTTP",
      ],
      [/\b(undefined|null|NaN|\[object Object\])\b/, "valor cru de JS"],
      [
        /must be a finite number|is not a function|Failed to fetch|NetworkError/i,
        "mensagem técnica em inglês",
      ],
    ];
    const achados: string[] = [];
    for (const [re, rotulo] of padroes) {
      const m = re.exec(corpo);
      if (m) achados.push(`${rotulo}: "${m[0].slice(0, 80)}"`);
    }
    return achados;
  });
}

/** A tela ficou BRANCA (nada renderizado além do shell)? */
export async function telaBranca(page: Page): Promise<boolean> {
  return page.evaluate(() => (document.body.innerText ?? "").trim().length < 20);
}

/** Todo input tem rótulo acessível? Devolve os que não têm. */
export async function inputsSemRotulo(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sem: string[] = [];
    for (const el of Array.from(document.querySelectorAll("input,select,textarea"))) {
      const input = el as HTMLInputElement;
      if (input.type === "hidden") continue;
      const id = input.id;
      const temLabel = id
        ? document.querySelector(`label[for="${CSS.escape(id)}"]`) !== null
        : false;
      const aria = input.getAttribute("aria-label") ?? input.getAttribute("aria-labelledby");
      const envolvido = input.closest("label") !== null;
      if (!temLabel && !aria && !envolvido)
        sem.push(`${input.tagName}[name=${input.name}|ph=${input.placeholder}]`);
    }
    return sem;
  });
}

/** Uma varredura de saúde aplicada em QUALQUER tela: junta as medições acima e registra o que
 *  achar. É o que garante que as 8 categorias rodem em todo subcenário sem copiar código. */
export async function varreduraDeSaude(
  page: Page,
  info: TestInfo,
  subcenario: string,
  contexto: string,
  opts: { contraste?: boolean; alvos?: boolean } = {},
): Promise<void> {
  const ov = await overflow(page);
  if (ov.x > 1) {
    defeito(info, {
      subcenario,
      categoria: "layout",
      descricao: `Overflow horizontal de ${ov.x}px em ${contexto}`,
      resultado_esperado: "scrollWidth == clientWidth (sem rolagem horizontal)",
      resultado_obtido: `${ov.x}px de excesso`,
      severidade: "media",
    });
  }
  // Review do PR #58 (2026-08-15) — o eixo Y era CALCULADO e DESCARTADO aqui, com a docstring do
  // `overflow()` citando, uma tela acima, a lição do 016/PR-B: "headless não desenha a barra
  // clássica, então medir só um eixo deixa passar metade dos casos". A bateria inteira era cega
  // para rolagem vertical — inclusive para o defeito de scroll que o 016 já tinha pago uma vez.
  //
  // O limiar não é 1px como no eixo X: uma página LONGA rola na vertical por natureza, e isso não é
  // defeito. Calibrado em 6 telas depois da primeira rodada com o eixo ligado: a 3 telas ele
  // acusava 22 vezes que "a calculadora é um formulário comprido" (4,6 telas), o que é verdade e
  // não é defeito — e 22 registros quase idênticos afogam o sinal que o eixo existe para dar.
  // A leitura útil sobre o resultado abaixo da dobra continua sendo feita, uma vez, pela jornada do
  // leigo (CF-001-LEIGO-E), que mede a POSIÇÃO do custo total e não a altura da página.
  const alturaJanela = await page.evaluate(() => window.innerHeight);
  if (ov.y > alturaJanela * 6) {
    defeito(info, {
      subcenario,
      categoria: "layout",
      descricao: `A página tem ${(ov.y / alturaJanela + 1).toFixed(1)} telas de rolagem vertical em ${contexto}`,
      resultado_esperado: "Conteúdo alcançável em poucas telas, ou um resumo que não exige rolar",
      resultado_obtido: `${ov.y}px além da janela de ${alturaJanela}px`,
      severidade: "baixa",
    });
  }
  const vaz = await vazamentoTecnico(page);
  if (vaz.length > 0) {
    defeito(info, {
      subcenario,
      categoria: "acolhimento",
      descricao: `Linguagem/artefato técnico exposto ao usuário em ${contexto}: ${vaz.join(" | ")}`,
      resultado_esperado:
        "Nenhum stack trace, JSON cru, código HTTP ou termo técnico em inglês na tela",
      resultado_obtido: vaz.join(" | "),
      severidade: "media",
    });
  }
  if (await telaBranca(page)) {
    defeito(info, {
      subcenario,
      categoria: "acolhimento",
      descricao: `Tela em branco em ${contexto}`,
      resultado_esperado: "Sempre uma tela com conteúdo, mesmo em erro",
      resultado_obtido: "corpo com menos de 20 caracteres",
      severidade: "critica",
    });
  }
  const semRotulo = await inputsSemRotulo(page);
  if (semRotulo.length > 0) {
    defeito(info, {
      subcenario,
      categoria: "acessibilidade",
      descricao: `${semRotulo.length} campo(s) sem rótulo acessível em ${contexto}: ${semRotulo.slice(0, 5).join(", ")}`,
      resultado_esperado: "Todo campo tem <label for>, aria-label ou envolvimento por <label>",
      resultado_obtido: semRotulo.slice(0, 8).join(", "),
      severidade: "media",
    });
  }
  if (opts.contraste) {
    const ruins = await contrasteInsuficiente(page);
    if (ruins.length > 0) {
      defeito(info, {
        subcenario,
        categoria: "acessibilidade",
        descricao: `${ruins.length} texto(s) abaixo do contraste WCAG em ${contexto}`,
        resultado_esperado: "Contraste >= 4,5:1 (3:1 para texto grande)",
        resultado_obtido: ruins.slice(0, 6).join(" ;; "),
        severidade: "media",
      });
    }
  }
  if (opts.alvos) {
    const pequenos = await alvosPequenos(page);
    // Dois patamares, porque tratá-los como um só exagera ou esconde o achado: abaixo de 24px o
    // alvo REPROVA na WCAG 2.2 AA (2.5.8); entre 24 e 43px ele passa na norma e fica abaixo do
    // conforto de toque recomendado (44px, WCAG AAA / HIG). Um relatório que chama o segundo caso
    // de "violação" perde a confiança do leitor no primeiro.
    const reprovaAA = pequenos.filter((p) => {
      const m = /(\d+)x(\d+)$/.exec(p);
      return m ? Number(m[1]) < 24 || Number(m[2]) < 24 : false;
    });
    if (reprovaAA.length > 0) {
      defeito(info, {
        subcenario,
        categoria: "acessibilidade",
        descricao: `${reprovaAA.length} alvo(s) abaixo de 24x24 em ${contexto} — reprova WCAG 2.2 AA (2.5.8)`,
        resultado_esperado: "Alvos interativos >= 24x24 CSS px",
        resultado_obtido: reprovaAA.slice(0, 8).join(", "),
        severidade: "media",
      });
    }
    const abaixoDoConforto = pequenos.filter((p) => !reprovaAA.includes(p));
    if (abaixoDoConforto.length > 0) {
      defeito(info, {
        subcenario,
        categoria: "acessibilidade",
        descricao: `${abaixoDoConforto.length} alvo(s) entre 24 e 43px em ${contexto} — passa na AA, abaixo do conforto de 44px`,
        resultado_esperado: "Alvos de toque com 44x44 CSS px no mobile (recomendação)",
        resultado_obtido: abaixoDoConforto.slice(0, 8).join(", "),
        severidade: "baixa",
      });
    }
  }
}

/** Erros de console e falhas de requisição coletados durante o teste — um crash silencioso é um
 *  defeito mesmo quando a tela parece bem. */
export function coletarConsole(page: Page): { erros: string[]; falhas: string[] } {
  const erros: string[] = [];
  const falhas: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => erros.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("requestfailed", (r) => falhas.push(`${r.method()} ${r.url().slice(0, 120)}`));
  return { erros, falhas };
}
