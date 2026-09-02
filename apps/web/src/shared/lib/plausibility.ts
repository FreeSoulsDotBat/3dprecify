import { messages } from "@/shared/i18n/messages.pt-br";
import { formatDecimal, parseDecimal } from "./decimal-ptbr";

// ⚠ @doc DEC-003 — AVISO NUNCA VIRA VALIDAÇÃO: campo com aviso segue calculando e salvando.
//   Transformar um destes num erro revoga a decisão do dono de 2026-08-03 sem que ele saiba.

const t = messages.calculator.plausibility;

/** Um aviso ancorado no campo que o causou. `campo` é o que a tela usa para colocá-lo no lugar. */
export interface PlausibilityWarning {
    field: string;
    text: string;
}

/**
 * Os limiares. Cada um é uma FAIXA do mundo real, nunca um teto de validação — e o comentário diz
 * de onde o número vem, porque um limiar sem procedência é um palpite que o próximo leitor vai
 * mexer sem saber o que está mexendo.
 */
export const THRESHOLDS = {
    /** Uma impressora 3D de mesa puxa ~0,05–0,25 kW. 5 kW é a faixa de um chuveiro elétrico. */
    avgPowerKwMax: 5,
    /** A tarifa residencial no Brasil orbita R$ 0,60–1,20/kWh. R$ 5 é 5× o teto do país. */
    tariffPerKwhMax: 5,
    /** 100 h é menos de uma semana ligada — vida útil de máquina não se mede assim. */
    machineLifetimeHoursMin: 100,
    /** Rolo comum: 1 kg. 50 kg denuncia gramas informadas como quilos. */
    rollWeightKgMax: 50,
    /** R$ 500/hora denuncia um salário MENSAL informado como valor da hora. */
    laborRatePerHourMax: 500,
    /** R$ 50/hora de reserva denuncia o gasto ANUAL de manutenção informado por hora. */
    maintenanceReservePerHourMax: 50,
    /** 100 h de impressão são mais de 4 dias. Denuncia minutos digitados no campo de horas. */
    printTimeHoursMax: 100,
    /**
     * 50 kg de filamento numa peça só. A maior impressora FDM de mesa tem volume para poucos quilos;
     * acima disso o número é do rolo inteiro, do lote, ou uma casa decimal a mais.
     */
    printGramsMax: 50_000,
    /** Nenhum marketplace cobra menos de 1%. Denuncia 0,12 escrito quando se queria 12%. */
    commissionPctMin: 1,
    /** O teto do `int4` da coluna `bom_lines.quantity` (backend/app/validation.py CEIL_QUANTITY). */
    quantityMax: 2_147_483_647,
    /**
     * Custo de UMA peça impressa em 3D acima disto não existe no negócio que este produto atende.
     * Não é um teto de validação (o vendedor pode seguir): é a rede que pega o erro de casa decimal
     * que nenhum limiar POR CAMPO pega — a persona que erra 12000 no rolo E 50000 nas gramas E 5000
     * no markup chega a R$ 6 milhões sem estourar nenhuma faixa individual.
     */
    custoTotalMax: 100_000,
} as const;

function fmt(n: number): string {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(n);
}

/** 019/PR-C (T049/T056) — a variante de dinheiro do formatador acima: SEMPRE 2 casas, nunca as 4
 *  do `fmt` genérico ("R$ 6.000.061,6" era o defeito que a prancheta 14 mediu — a frase perdia os
 *  centavos). Reusa `formatDecimal` (mesma casa que `formatBRL`) para não ter uma SEGUNDA regra de
 *  dinheiro no produto — os quatro campos monetários deste arquivo (tarifa, valor da hora, reserva
 *  de manutenção, custo absurdo) passam por aqui. */
function fmtMoney(n: number): string {
    return formatDecimal(n, 2);
}

/** A entrada que este módulo lê — o subconjunto numérico já parseado pelo schema. */
export interface PlausibleInput {
    avgPowerKw?: number;
    tariffPerKwh?: number;
    machineLifetimeHours?: number;
    rollWeightKg?: number;
    laborRatePerHour?: number;
    maintenanceReservePerHour?: number;
    printTimeHours?: number;
    printGrams?: number;
}

/**
 * Os avisos de uma entrada. `custoTotal`/`precoVarejo` entram porque o caso "zerei o que não
 * entendi" só é visível no RESULTADO: cada campo isolado está perfeitamente válido em 0.
 */
export function plausibilityWarnings(
    plausibleInput: PlausibleInput,
    resultado?: { custoTotal: number; precoVarejo: number },
): PlausibilityWarning[] {
    const notices: PlausibilityWarning[] = [];
    const acima = (v: number | undefined, teto: number): v is number => v !== undefined && v > teto;

    if (acima(plausibleInput.avgPowerKw, THRESHOLDS.avgPowerKwMax)) {
        notices.push({
            field: "avgPowerKw",
            text: t.avgPower.replace("{v}", fmt(plausibleInput.avgPowerKw)),
        });
    }
    if (acima(plausibleInput.tariffPerKwh, THRESHOLDS.tariffPerKwhMax)) {
        notices.push({
            field: "tariffPerKwh",
            text: t.tariff.replace("{v}", fmtMoney(plausibleInput.tariffPerKwh)),
        });
    }
    if (
        plausibleInput.machineLifetimeHours !== undefined &&
        plausibleInput.machineLifetimeHours > 0 &&
        plausibleInput.machineLifetimeHours < THRESHOLDS.machineLifetimeHoursMin
    ) {
        notices.push({
            field: "machineLifetimeHours",
            text: t.machineLifetime.replace("{v}", fmt(plausibleInput.machineLifetimeHours)),
        });
    }
    if (acima(plausibleInput.rollWeightKg, THRESHOLDS.rollWeightKgMax)) {
        notices.push({
            field: "rollWeightKg",
            text: t.rollWeight.replace("{v}", fmt(plausibleInput.rollWeightKg)),
        });
    }
    if (acima(plausibleInput.laborRatePerHour, THRESHOLDS.laborRatePerHourMax)) {
        notices.push({
            field: "laborRatePerHour",
            text: t.laborRate.replace("{v}", fmtMoney(plausibleInput.laborRatePerHour)),
        });
    }
    if (acima(plausibleInput.maintenanceReservePerHour, THRESHOLDS.maintenanceReservePerHourMax)) {
        notices.push({
            field: "maintenanceReservePerHour",
            text: t.maintenance.replace("{v}", fmtMoney(plausibleInput.maintenanceReservePerHour)),
        });
    }
    if (acima(plausibleInput.printGrams, THRESHOLDS.printGramsMax)) {
        notices.push({
            field: "printGrams",
            text: t.grams.replace("{v}", fmt(plausibleInput.printGrams)),
        });
    }
    if (acima(plausibleInput.printTimeHours, THRESHOLDS.printTimeHoursMax)) {
        notices.push({
            field: "printTimeHours",
            text: t.printTime
                .replace("{v}", fmt(plausibleInput.printTimeHours))
                .replace("{d}", fmt(Math.round((plausibleInput.printTimeHours / 24) * 10) / 10)),
        });
    }

    // O caso da persona "zera o que não entende": custo 0 e preço 0 são matematicamente certos e
    // comercialmente absurdos. Só dispara quando a peça EXISTE (tem gramas ou tempo) — um formulário
    // recém-aberto e ainda vazio não é um erro, é um formulário recém-aberto.
    const pecaExiste =
        (plausibleInput.printGrams ?? 0) > 0 || (plausibleInput.printTimeHours ?? 0) > 0;
    if (resultado && pecaExiste && resultado.custoTotal === 0 && resultado.precoVarejo === 0) {
        notices.push({ field: "resultado", text: t.zeroPrice });
    }
    // O outro extremo, e ele existe porque os limiares por campo NÃO o pegam: erros pequenos em
    // vários campos ao mesmo tempo (uma casa decimal aqui, outra ali) compõem um custo que nenhum
    // deles reprova sozinho. Medido na homologação: R$ 6.000.061,60 com todos os campos "válidos".
    if (resultado && resultado.custoTotal > THRESHOLDS.custoTotalMax) {
        notices.push({
            field: "resultado",
            text: t.absurdCost.replace("{v}", fmtMoney(resultado.custoTotal)),
        });
    }

    return notices;
}

/** O aviso do slot de canal — a comissão que o vendedor escreveu como fração (0,12 = 12%). */
export function commissionWarning(commissionPct: number | undefined): string | null {
    // `Number.isFinite` PRIMEIRO, e não é zelo: um campo vazio faz `parseDecimal` devolver `NaN`, e
    // `NaN <= 0` é FALSO — a primeira versão deste guarda deixava o NaN passar e a tela dizia
    // "Confira a comissão: NaN%". Pego pelo teste que o projeto já mantinha contra exatamente isso
    // (`calcular.test.tsx`: "never a NaN"), que é a razão de aquele teste existir.
    if (commissionPct === undefined || !Number.isFinite(commissionPct)) return null;
    if (commissionPct <= 0) return null;
    if (commissionPct >= THRESHOLDS.commissionPctMin) return null;
    return t.lowCommission.replace("{v}", fmt(commissionPct));
}

/** O aviso do campo de quantidade de uma peça de kit. */
export function quantityWarning(quantity: number | undefined): string | null {
    if (quantity === undefined || !Number.isFinite(quantity)) return null;
    if (quantity <= THRESHOLDS.quantityMax) return null;
    return t.quantity.replace("{v}", fmt(quantity)).replace("{max}", fmt(THRESHOLDS.quantityMax));
}

/**
 * O aviso de UM campo, a partir da string crua que está nele.
 *
 * Existe nesta forma para que o `ControlledField` se baste: ele já tem o nome e o valor, e não
 * precisa de nenhuma prop nova atravessando a árvore. O efeito colateral é o que interessa — o
 * `widgets/bom-line-editor` renderiza os MESMOS `CalcFieldMeta`, então o editor de linha de kit
 * ganha os mesmos avisos sem uma linha a mais.
 *
 * Cross-field (o "zerei tudo") não cabe aqui, de propósito: ele só é visível no RESULTADO, e vive
 * em `avisosDePlausibilidade`.
 */
const FIELDS_WITH_RANGE: readonly string[] = [
    "printGrams",
    "avgPowerKw",
    "tariffPerKwh",
    "machineLifetimeHours",
    "rollWeightKg",
    "laborRatePerHour",
    "maintenanceReservePerHour",
    "printTimeHours",
];

/**
 * `comErro` (019/PR-C, T056, prancheta 14b) — quando o mesmo campo TAMBÉM foi recusado pela
 * validação, "Nada foi recusado." mentiria bem abaixo da recusa. O fecho troca para
 * "Corrija o campo acima para calcular." e a tela (`useAvisoDeCampo`) é quem decide não oferecer
 * "Entendi" nesse estado — não se dispensa uma lição que acompanha uma recusa.
 */
export function fieldWarning(nome: string, bruto: string, comErro = false): string | null {
    if (!FIELDS_WITH_RANGE.includes(nome)) return null;
    const n = parseDecimal(bruto);
    if (!Number.isFinite(n)) return null;
    const plausibleInput: PlausibleInput = {};
    (plausibleInput as Record<string, number>)[nome] = n;
    const text = plausibilityWarnings(plausibleInput)[0]?.text ?? null;
    if (!text) return null;
    return comErro ? text.replace(t.closingNormal, t.closingRejected) : text;
}

/**
 * 019/PR-C (decisão do dono 28/08, prancheta 14b) — a LIÇÃO de um campo, sem cabeça e sem o valor
 * digitado: quando o campo TAMBÉM está recusado, é isto (não `avisoDeCampo`) que a tela mostra —
 * puro pelo NOME do campo, nunca pelo valor comprometido. `null` para quem não tem lição escrita
 * (hoje, todo campo fora dos oito de `messages.calculator.plausibility.lesson`).
 */
export function fieldLesson(nome: string): string | null {
    return (t.lesson as Partial<Record<string, string>>)[nome] ?? null;
}
