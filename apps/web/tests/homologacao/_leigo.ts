import { messages } from "../../src/shared/i18n/messages.pt-br";

const t = messages.calculator;

// O modelo do USUÁRIO REAL desta homologação.
//
// O vendedor de impressão 3D que este produto atende não erra digitando emoji num campo de dinheiro
// — erra digitando um número PLAUSÍVEL que significa outra coisa. Ele lê "120W" na etiqueta da
// impressora e escreve 120 num campo que pede kW. Ele pensa a vida útil da máquina em ANOS e
// escreve 3 num campo que pede HORAS. Ele digita 150 em "horas" querendo dizer 2h30.
//
// Esse é o erro perigoso, e é perigoso porque NÃO é recusado: nenhum validador reprova 120, e o
// produto devolve um preço com cara de preço. O teste, então, não pergunta "quebrou?" — pergunta
// "avisou?". Um preço 1000× errado entregue em silêncio é o pior defeito que um produto de
// precificação pode ter, e nenhuma asserção de tipo o encontra.

export interface ErroDeUnidade {
    /** Rótulo do campo, como aparece na tela. */
    campo: string;
    /** O que o vendedor digita. */
    digitado: string;
    /** O que ele QUERIA dizer, na unidade certa. */
    correto: string;
    /** Por que ele erra — a frase que explica o erro para um humano. */
    porque: string;
    /** Quantas vezes o preço fica errado por causa disso (ordem de grandeza esperada). */
    fatorEsperado: number;
}

/**
 * Os erros de unidade que um vendedor comete de verdade. Cada um foi derivado do que o campo PEDE
 * (`messages.pt-br.ts`) contra o que o mundo real imprime na etiqueta/conta/nota.
 */
export const ERROS_DE_UNIDADE: ErroDeUnidade[] = [
    {
        campo: t.fields.avgPower,
        digitado: "120",
        correto: "0,12",
        porque: "A etiqueta da impressora diz 120 W; o campo pede kW. Ele copia o número da etiqueta.",
        fatorEsperado: 1000,
    },
    {
        campo: t.fields.avgPower,
        digitado: "220",
        correto: "0,12",
        porque: "Ele confunde consumo com a TENSÃO da tomada (220 V) — o número que ele conhece.",
        fatorEsperado: 1800,
    },
    {
        campo: t.fields.tariff,
        digitado: "95",
        correto: "0,95",
        porque: "A conta de luz fala em centavos por kWh; ele digita 95 em vez de 0,95.",
        fatorEsperado: 100,
    },
    {
        campo: t.fields.machineLifetime,
        digitado: "3",
        correto: "3600",
        porque: "Ele pensa a vida da máquina em ANOS. O campo pede HORAS.",
        fatorEsperado: 1200,
    },
    {
        campo: t.fields.machineLifetime,
        digitado: "36",
        correto: "3600",
        porque: "Ele pensa em MESES (3 anos = 36 meses).",
        fatorEsperado: 100,
    },
    {
        campo: t.fields.rollWeight,
        digitado: "1000",
        correto: "1",
        porque: "O rolo é vendido como 1000 g; o campo pede kg.",
        fatorEsperado: 1000,
    },
    {
        campo: t.fields.grams,
        digitado: "0,1",
        correto: "100",
        porque: "O fatiador mostrou 0,1 kg; o campo pede gramas.",
        fatorEsperado: 1000,
    },
    {
        campo: t.fields.costPerRoll,
        digitado: "0,1",
        correto: "100",
        porque: "Ele informa o custo por GRAMA em vez do custo do rolo inteiro.",
        fatorEsperado: 1000,
    },
    {
        campo: t.fields.markupVarejo,
        digitado: "1,5",
        correto: "50",
        porque: "Ele pensa markup como MULTIPLICADOR (1,5×) e não como porcentagem.",
        fatorEsperado: 1.5,
    },
    {
        campo: t.fields.markupVarejo,
        digitado: "500",
        correto: "50",
        porque: "Ele erra uma casa e não percebe, porque 500% ainda 'parece' um número de markup.",
        fatorEsperado: 4,
    },
    {
        campo: t.fields.maintenance,
        digitado: "500",
        correto: "0,50",
        porque: "Ele informa o gasto ANUAL de manutenção num campo que pede R$ por HORA.",
        fatorEsperado: 1000,
    },
    {
        campo: t.fields.failure,
        digitado: "0,1",
        correto: "10",
        porque: "Ele escreve a taxa de falha como FRAÇÃO (0,1) e não como porcentagem (10).",
        fatorEsperado: 100,
    },
    {
        campo: t.fields.laborRate,
        digitado: "3000",
        correto: "18,75",
        porque: "Ele informa quanto quer ganhar por MÊS num campo que pede o valor da HORA.",
        fatorEsperado: 160,
    },
];

/** Como o leigo digita um número quando ele acerta a unidade mas não a formatação. */
export const FORMATOS_REAIS: { valor: string; nota: string }[] = [
    { valor: "100", nota: "só o número" },
    { valor: "100,00", nota: "com centavos" },
    { valor: "100.00", nota: "ponto como decimal (teclado do celular)" },
    { valor: "R$ 100", nota: "com o R$ que ele vê no campo" },
    { valor: "R$100,00", nota: "com R$ colado" },
    { valor: "100 reais", nota: "escrevendo a moeda por extenso" },
    { valor: " 100 ", nota: "com espaços de uma colagem" },
    { valor: "100\n", nota: "colado do WhatsApp com quebra de linha" },
    { valor: "1.000", nota: "milhar com ponto (pt-BR)" },
    { valor: "1,000", nota: "milhar com vírgula (copiado de site gringo)" },
    { valor: "1000,5", nota: "milhar sem separador + decimal" },
    { valor: "100g", nota: "repetindo a unidade que o campo já mostra" },
    { valor: "100 g", nota: "unidade com espaço" },
    { valor: "cem", nota: "por extenso" },
    { valor: "", nota: "desistiu e deixou vazio" },
];

/** Como o leigo digita TEMPO — o campo que mais gera confusão num produto de impressão 3D. */
export const TEMPOS_REAIS: { horas: string; minutos: string; nota: string }[] = [
    { horas: "2", minutos: "30", nota: "correto" },
    { horas: "2,5", minutos: "", nota: "decimal no campo de horas (jeito antigo)" },
    { horas: "150", minutos: "", nota: "o total em MINUTOS no campo de horas" },
    { horas: "2:30", minutos: "", nota: "formato de relógio" },
    { horas: "2h30", minutos: "", nota: "como o fatiador mostra" },
    { horas: "", minutos: "150", nota: "tudo em minutos" },
    { horas: "0", minutos: "0", nota: "zerado" },
    { horas: "", minutos: "", nota: "deixou vazio" },
    { horas: "48", minutos: "0", nota: "impressão de dois dias" },
    { horas: "2", minutos: "90", nota: "minutos acima de 60" },
    { horas: "-2", minutos: "30", nota: "negativo por engano no teclado" },
];

export interface Persona {
    id: string;
    nome: string;
    /** Como ela preenche: rótulo do campo → o que digita. */
    entradas: { campo: string; valor: string }[];
    /** O que ela NÃO faz (campos que deixa como vieram). */
    historia: string;
}

/**
 * Seis vendedores reais. Nenhum deles é um invasor; todos estão tentando acertar.
 * Dois erram unidade, um erra formatação, um zera tudo, um exagera, um acerta.
 */
export const PERSONAS: Persona[] = [
    {
        id: "P1",
        nome: "Acerta tudo",
        historia: "Leu os tooltips, entendeu as unidades e preencheu certo. É o caso-controle.",
        entradas: [
            { campo: t.fields.costPerRoll, valor: "120,00" },
            { campo: t.fields.rollWeight, valor: "1" },
            { campo: t.fields.grams, valor: "85" },
            { campo: t.fields.avgPower, valor: "0,12" },
            { campo: t.fields.tariff, valor: "0,95" },
            { campo: t.fields.markupVarejo, valor: "60" },
            { campo: t.fields.markupAtacado, valor: "35" },
        ],
    },
    {
        id: "P2",
        nome: "Copia da etiqueta",
        historia:
            "Pega os números da etiqueta da impressora e da conta de luz, sem converter unidade.",
        entradas: [
            { campo: t.fields.costPerRoll, valor: "120" },
            { campo: t.fields.rollWeight, valor: "1000" },
            { campo: t.fields.grams, valor: "85" },
            { campo: t.fields.avgPower, valor: "120" },
            { campo: t.fields.tariff, valor: "95" },
        ],
    },
    {
        id: "P3",
        nome: "Pensa em anos e meses",
        historia:
            "Raciocina a máquina em anos, a manutenção no gasto do ano e a mão de obra no salário.",
        entradas: [
            { campo: t.fields.machineValue, valor: "4000" },
            { campo: t.fields.machineLifetime, valor: "3" },
            { campo: t.fields.maintenance, valor: "500" },
            { campo: t.fields.laborRate, valor: "3000" },
            { campo: t.fields.laborHours, valor: "1" },
        ],
    },
    {
        id: "P4",
        nome: "Teclado do celular",
        historia:
            "Digita com ponto no lugar da vírgula e cola valores com R$ e espaços do WhatsApp.",
        entradas: [
            { campo: t.fields.costPerRoll, valor: "R$ 149.90" },
            { campo: t.fields.rollWeight, valor: "1.0" },
            { campo: t.fields.grams, valor: "120 g" },
            { campo: t.fields.tariff, valor: "0.98" },
            { campo: t.fields.markupVarejo, valor: "1.5" },
        ],
    },
    {
        id: "P5",
        nome: "Zera o que não entende",
        historia: "Não sabe o que são metade dos campos, então põe 0 em tudo que parece opcional.",
        entradas: [
            { campo: t.fields.costPerRoll, valor: "100" },
            { campo: t.fields.rollWeight, valor: "1" },
            { campo: t.fields.grams, valor: "0" },
            { campo: t.fields.avgPower, valor: "0" },
            { campo: t.fields.tariff, valor: "0" },
            { campo: t.fields.machineValue, valor: "0" },
            { campo: t.fields.markupVarejo, valor: "0" },
            { campo: t.fields.markupAtacado, valor: "0" },
        ],
    },
    {
        id: "P6",
        nome: "Exagera sem perceber",
        historia: "Erra casas decimais para cima e não desconfia, porque o campo aceita.",
        entradas: [
            { campo: t.fields.costPerRoll, valor: "12000" },
            { campo: t.fields.grams, valor: "50000" },
            { campo: t.fields.markupVarejo, valor: "5000" },
            { campo: t.fields.failure, valor: "900" },
        ],
    },
];
