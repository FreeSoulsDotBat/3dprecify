// 019/PR-E · T080 — o gerador da varredura de igualdade 4.1.0 ↔ 4.2.0 (ADR-0034 §Decision 1).
//
// Por que ele existe: a 4.2.0 é MINOR porque NENHUMA computação existente muda de resultado. Isso é
// uma AFIRMAÇÃO sobre centavos, e a lição que o 014/C cobrou é que versão bumpada sem diferença
// medida — ou implementação reescrita sem bump — são a mesma mentira. Então a prova é uma fixture
// gerada com o motor 4.1.0 INTOCADO e comparada campo a campo depois do bump.
//
// Determinismo (exigência da T080): PRNG `mulberry32(20260827)`, sem `Math.random` e sem `Date`.
// Rodar duas vezes produz o MESMO arquivo, byte a byte — é isso que torna o SHA-256 uma prova.
//
// Uso: `node tests/__fixtures__/generate-equality-4.1.0.mjs` (Node 24 tira os tipos sozinho).
import { writeFileSync } from "node:fs";

import { computeCalculator, computeBom, PRICING_MODEL_VERSION } from "../../src/index.ts";

/** PRNG de 32 bits, determinístico e sem estado global. */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rand = mulberry32(20260827);

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
/** Um número com `dp` casas — a fonte dos meio-centavos quando `dp === 3` e a 3ª casa é 5. */
const num = (min, max, dp) => Number((min + rand() * (max - min)).toFixed(dp));
/** Valor cujo 3º decimal é EXATAMENTE 5 — o alvo do ROUND_HALF_UP (`rounding.ts:12`). */
const meioCentavo = (min, max) =>
    Number((Math.floor((min + rand() * (max - min)) * 100) / 100 + 0.005).toFixed(3));

const MARKETPLACES = ["Mercado Livre", "Shopee", "Amazon", null];

function bandas() {
    const modo = rand();
    if (modo < 0.4) {
        // SELECTION (ausência do `bandMode` — a forma que viaja dentro de payload congelado).
        return {
            priceBands: [
                { minPrice: 0, maxPrice: 79, commissionPct: num(10, 16, 2), fixedFee: 6.75 },
                { minPrice: 79, maxPrice: null, commissionPct: num(10, 16, 2), fixedFee: 0 },
            ],
        };
    }
    if (modo < 0.7) {
        // PROGRESSIVE (ADR-0024) — declarado.
        return {
            bandMode: "PROGRESSIVE",
            priceBands: [
                { minPrice: 0, maxPrice: 200, commissionPct: 15, fixedFee: num(0, 5, 2) },
                { minPrice: 200, maxPrice: null, commissionPct: 10, fixedFee: 0 },
            ],
        };
    }
    // `fixedFeeRule PCT_OF_PRICE` (ADR-0027 / 4.1.0) — a capacidade mais nova antes desta fatia.
    return {
        priceBands: [
            {
                minPrice: 0,
                maxPrice: 8,
                commissionPct: num(8, 14, 2),
                fixedFee: 0,
                fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 50 },
            },
            { minPrice: 8, maxPrice: null, commissionPct: num(8, 14, 2), fixedFee: 4 },
        ],
    };
}

function canal(indice) {
    const c = { commissionPct: num(0, 18, 2) };
    const mkt = pick(MARKETPLACES);
    if (mkt !== null) c.marketplace = mkt;
    if (rand() < 0.5) c.fixedFee = num(0, 6, 2);
    if (rand() < 0.3) c.minPerItem = num(0, 3, 2);
    if (rand() < 0.4) c.freightCost = num(0, 25, 2);
    if (rand() < 0.35) Object.assign(c, bandas());
    if (rand() < 0.25) c.surcharges = [{ label: "Volumoso", value: num(0, 50, 2) }];
    if (rand() < 0.2) c.feeDeterminants = { categoria: `cat-${indice}` };
    if (rand() < 0.2) c.feeSource = "art. 23431";
    // ~8% dos slots erram DE PROPÓSITO (comissão fora de [0,100)) — o slot com erro é isolado
    // (SC-107) e, num BOM, vira `skippedLines` no rollup. Sem ele metade do rollup não seria varrida.
    if (rand() < 0.08) c.commissionPct = 100;
    return c;
}

function canais() {
    const n = int(1, 2);
    return Array.from({ length: n }, (_, i) => canal(i));
}

function outrosCustos() {
    const n = int(1, 3);
    return Array.from({ length: n }, (_, i) => ({
        name: `custo-${i}`,
        // 3 casas: metade meio-centavo exato, metade decimal qualquer.
        value: rand() < 0.5 ? meioCentavo(0, 40) : num(0, 40, 3),
    }));
}

function entrada(comCanais) {
    const input = {
        costPerRoll: rand() < 0.5 ? meioCentavo(40, 320) : num(40, 320, 2),
        rollWeightKg: pick([0.5, 0.75, 1, 3]),
        printGrams: num(1, 900, 3),
        printTimeHours: num(0, 40, 3),
        avgPowerKw: num(0, 0.4, 3),
        tariffPerKwh: num(0.4, 1.3, 3),
        machineValue: num(500, 12000, 2),
        machineLifetimeHours: int(500, 8000),
        markupVarejoPct: rand() < 0.5 ? num(0, 320, 2) : num(0, 320, 3),
        markupAtacadoPct: num(0, 180, 2),
    };
    if (rand() < 0.5) input.maintenanceReservePerHour = num(0, 4, 3);
    // `failurePct` ALTO e sem teto (015/A8, decisão do dono): 300% é uma peça que falha três vezes.
    if (rand() < 0.7) input.failurePct = rand() < 0.35 ? num(100, 1000, 2) : num(0, 30, 2);
    if (rand() < 0.5) {
        input.finishTimeHours = num(0, 6, 3);
        input.finishRatePerHour = num(0, 60, 2);
    }
    if (rand() < 0.5) {
        input.laborHours = num(0, 8, 3);
        input.laborRatePerHour = num(0, 90, 2);
    }
    if (rand() < 0.6) input.otherCosts = outrosCustos();
    if (comCanais) input.channels = canais();
    else if (rand() < 0.15) input.channels = []; // vazio explícito ≠ ausente: as duas formas entram
    if (rand() < 0.4) input.catalogVersion = "2026-08-06.1";
    return input;
}

const calculator = [];
for (let i = 0; i < 500; i += 1) {
    // Metade COM canais, metade SEM — os dois lados da mesma fixture (T080).
    const input = entrada(i % 2 === 0);
    calculator.push({ input, result: computeCalculator(input) });
}

const bom = [];
for (let i = 0; i < 200; i += 1) {
    const n = int(1, 4);
    const lines = Array.from({ length: n }, () => ({
        // Linhas COM canais por linha na maioria dos casos: `result.channels[]` (o rollup, `index.ts:485`)
        // é o único lugar onde uma mudança da 4.2.0 vazaria sem ser vista.
        input: entrada(rand() < 0.8),
        quantity: rand() < 0.1 ? 0 : int(1, 12),
    }));
    bom.push({ lines, result: computeBom(lines) });
}

if (PRICING_MODEL_VERSION !== "4.1.0") {
    // A fixture só é fiel se nasceu do motor 4.1.0. Gerá-la depois do bump provaria nada.
    throw new Error(`gerador exige o motor 4.1.0; encontrou ${PRICING_MODEL_VERSION}`);
}

const destino = new URL("./equality-4.1.0.json", import.meta.url);
// Indentação 2 + newline final = a saída do prettier para JSON (o arquivo NÃO está no .prettierignore).
writeFileSync(
    destino,
    `${JSON.stringify({ generatedAtVersion: "4.1.0", calculator, bom }, null, 2)}\n`,
);
console.log(`equality-4.1.0.json: ${calculator.length} calculator + ${bom.length} bom`);
