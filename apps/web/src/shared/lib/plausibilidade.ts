import { messages } from "@/shared/i18n/messages.pt-br";
import { parseDecimal } from "./decimal-ptbr";

// Homologação automatizada (2026-08-13) — o AVISO DE PLAUSIBILIDADE.
//
// Nove dos onze achados de severidade ALTA daquela homologação são a mesma coisa: o vendedor digita
// um número PLAUSÍVEL que significa outra coisa, e o produto devolve um preço com cara de preço,
// calado. Ele lê "120 W" na etiqueta e escreve 120 num campo que pede kW (custo ×38). Ele pensa a
// vida útil da máquina em ANOS e escreve 3 num campo que pede HORAS (×341). Ele zera o que não
// entende e chega a um preço de venda de R$ 0,00.
//
// Nenhum desses é erro de cálculo: a aritmética está certa em todos. Nenhum é entrada inválida:
// nenhum validador reprova 120. É por isso que só um aviso os pega — e é por isso que este módulo
// existe separado do schema, que é onde mora a RECUSA.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// A REGRA QUE GOVERNA ESTE ARQUIVO, e ela não é estilística: **AVISO NUNCA VIRA VALIDAÇÃO.**
//
// O dono decidiu, em 2026-08-03, que `failurePct` NÃO tem teto — "300% representa legitimamente uma
// peça que falha três vezes antes de sair" (está escrito no próprio `PriceInput` do pricing-core,
// com o pedido explícito de que ninguém "conserte" o que foi decidido). Este módulo encosta na
// mesma fronteira por todos os lados, então: um campo com aviso **continua calculando e continua
// salvando**. Quem transformar um destes avisos num erro terá revogado aquela decisão sem perceber.
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// MORA EM `shared/lib` e não em `features/calculator` por uma razão de FRONTEIRA, não de gosto:
// `features/bom` precisa do aviso de quantidade e NÃO pode importar `features/calculator` — a regra
// está escrita no topo do `bom-line-card.tsx` e é o `eslint-boundaries` que a cobra. Um módulo puro
// consumido por duas features é, por definição, `shared`.
//
// Puro e determinístico de propósito: entra número, sai frase. Sem React, sem estado, sem I/O — o
// que permite pinar cada limiar num teste unitário barato, e o que impede este arquivo de virar,
// com o tempo, um segundo lugar onde o preço é decidido.

const t = messages.calculator.plausibilidade;

/** Um aviso ancorado no campo que o causou. `campo` é o que a tela usa para colocá-lo no lugar. */
export interface AvisoPlausibilidade {
  campo: string;
  texto: string;
}

/**
 * Os limiares. Cada um é uma FAIXA do mundo real, nunca um teto de validação — e o comentário diz
 * de onde o número vem, porque um limiar sem procedência é um palpite que o próximo leitor vai
 * mexer sem saber o que está mexendo.
 */
export const LIMIARES = {
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

/** A entrada que este módulo lê — o subconjunto numérico já parseado pelo schema. */
export interface EntradaPlausivel {
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
export function avisosDePlausibilidade(
  entrada: EntradaPlausivel,
  resultado?: { custoTotal: number; precoVarejo: number },
): AvisoPlausibilidade[] {
  const avisos: AvisoPlausibilidade[] = [];
  const acima = (v: number | undefined, teto: number): v is number => v !== undefined && v > teto;

  if (acima(entrada.avgPowerKw, LIMIARES.avgPowerKwMax)) {
    avisos.push({ campo: "avgPowerKw", texto: t.avgPower.replace("{v}", fmt(entrada.avgPowerKw)) });
  }
  if (acima(entrada.tariffPerKwh, LIMIARES.tariffPerKwhMax)) {
    avisos.push({
      campo: "tariffPerKwh",
      texto: t.tariff.replace("{v}", fmt(entrada.tariffPerKwh)),
    });
  }
  if (
    entrada.machineLifetimeHours !== undefined &&
    entrada.machineLifetimeHours > 0 &&
    entrada.machineLifetimeHours < LIMIARES.machineLifetimeHoursMin
  ) {
    avisos.push({
      campo: "machineLifetimeHours",
      texto: t.machineLifetime.replace("{v}", fmt(entrada.machineLifetimeHours)),
    });
  }
  if (acima(entrada.rollWeightKg, LIMIARES.rollWeightKgMax)) {
    avisos.push({
      campo: "rollWeightKg",
      texto: t.rollWeight.replace("{v}", fmt(entrada.rollWeightKg)),
    });
  }
  if (acima(entrada.laborRatePerHour, LIMIARES.laborRatePerHourMax)) {
    avisos.push({
      campo: "laborRatePerHour",
      texto: t.laborRate.replace("{v}", fmt(entrada.laborRatePerHour)),
    });
  }
  if (acima(entrada.maintenanceReservePerHour, LIMIARES.maintenanceReservePerHourMax)) {
    avisos.push({
      campo: "maintenanceReservePerHour",
      texto: t.maintenance.replace("{v}", fmt(entrada.maintenanceReservePerHour)),
    });
  }
  if (acima(entrada.printGrams, LIMIARES.printGramsMax)) {
    avisos.push({ campo: "printGrams", texto: t.grams.replace("{v}", fmt(entrada.printGrams)) });
  }
  if (acima(entrada.printTimeHours, LIMIARES.printTimeHoursMax)) {
    avisos.push({
      campo: "printTimeHours",
      texto: t.printTime
        .replace("{v}", fmt(entrada.printTimeHours))
        .replace("{d}", fmt(Math.round((entrada.printTimeHours / 24) * 10) / 10)),
    });
  }

  // O caso da persona "zera o que não entende": custo 0 e preço 0 são matematicamente certos e
  // comercialmente absurdos. Só dispara quando a peça EXISTE (tem gramas ou tempo) — um formulário
  // recém-aberto e ainda vazio não é um erro, é um formulário recém-aberto.
  const pecaExiste = (entrada.printGrams ?? 0) > 0 || (entrada.printTimeHours ?? 0) > 0;
  if (resultado && pecaExiste && resultado.custoTotal === 0 && resultado.precoVarejo === 0) {
    avisos.push({ campo: "resultado", texto: t.precoZero });
  }
  // O outro extremo, e ele existe porque os limiares por campo NÃO o pegam: erros pequenos em
  // vários campos ao mesmo tempo (uma casa decimal aqui, outra ali) compõem um custo que nenhum
  // deles reprova sozinho. Medido na homologação: R$ 6.000.061,60 com todos os campos "válidos".
  if (resultado && resultado.custoTotal > LIMIARES.custoTotalMax) {
    avisos.push({
      campo: "resultado",
      texto: t.custoAbsurdo.replace("{v}", fmt(resultado.custoTotal)),
    });
  }

  return avisos;
}

/** O aviso do slot de canal — a comissão que o vendedor escreveu como fração (0,12 = 12%). */
export function avisoDeComissao(commissionPct: number | undefined): string | null {
  // `Number.isFinite` PRIMEIRO, e não é zelo: um campo vazio faz `parseDecimal` devolver `NaN`, e
  // `NaN <= 0` é FALSO — a primeira versão deste guarda deixava o NaN passar e a tela dizia
  // "Confira a comissão: NaN%". Pego pelo teste que o projeto já mantinha contra exatamente isso
  // (`calcular.test.tsx`: "never a NaN"), que é a razão de aquele teste existir.
  if (commissionPct === undefined || !Number.isFinite(commissionPct)) return null;
  if (commissionPct <= 0) return null;
  if (commissionPct >= LIMIARES.commissionPctMin) return null;
  return t.comissaoBaixa.replace("{v}", fmt(commissionPct));
}

/** O aviso do campo de quantidade de uma peça de kit. */
export function avisoDeQuantidade(quantity: number | undefined): string | null {
  if (quantity === undefined || !Number.isFinite(quantity)) return null;
  if (quantity <= LIMIARES.quantityMax) return null;
  return t.quantidade.replace("{v}", fmt(quantity)).replace("{max}", fmt(LIMIARES.quantityMax));
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
const CAMPOS_COM_FAIXA: readonly string[] = [
  "printGrams",
  "avgPowerKw",
  "tariffPerKwh",
  "machineLifetimeHours",
  "rollWeightKg",
  "laborRatePerHour",
  "maintenanceReservePerHour",
  "printTimeHours",
];

export function avisoDeCampo(nome: string, bruto: string): string | null {
  if (!CAMPOS_COM_FAIXA.includes(nome)) return null;
  const n = parseDecimal(bruto);
  if (!Number.isFinite(n)) return null;
  const entrada: EntradaPlausivel = {};
  (entrada as Record<string, number>)[nome] = n;
  return avisosDePlausibilidade(entrada)[0]?.texto ?? null;
}

/** Conveniência para a tela: os avisos indexados por campo. */
export function avisosPorCampo(avisos: AvisoPlausibilidade[]): Partial<Record<string, string>> {
  const mapa: Partial<Record<string, string>> = {};
  for (const a of avisos) if (!mapa[a.campo]) mapa[a.campo] = a.texto;
  return mapa;
}
