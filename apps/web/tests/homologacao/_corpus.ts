// Corpus adversarial da homologação. Existe para dar VOLUME sem dar teatro: cada valor daqui é
// digitado de verdade num campo de verdade, e cada um tem um motivo para existir.
//
// Determinístico de propósito (gerador congruencial semeado, nunca `Math.random`): um estouro
// encontrado no caso 731 tem de ser o mesmo caso 731 na rodada seguinte, senão o achado não é
// reproduzível e não vira conserto.

export function semente(s: number): () => number {
  let estado = s >>> 0;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 0x100000000;
  };
}

export interface CasoNumerico {
  valor: string;
  nota: string;
  /** O produto DEVE recusar (mensagem visível) — ou, no mínimo, não pode virar preço. */
  invalido: boolean;
}

/** O corpus numérico: tudo que um leigo consegue digitar num campo de dinheiro/quantidade. */
export function corpusNumerico(): CasoNumerico[] {
  const fixos: CasoNumerico[] = [
    // --- vazio e brancos
    { valor: "", nota: "vazio", invalido: false },
    { valor: " ", nota: "um espaço", invalido: true },
    { valor: "   ", nota: "só espaços", invalido: true },
    { valor: "\t", nota: "tabulação", invalido: true },
    // --- zero e negativos
    { valor: "0", nota: "zero", invalido: false },
    { valor: "0,00", nota: "zero formatado", invalido: false },
    { valor: "-0", nota: "zero negativo", invalido: false },
    { valor: "-1", nota: "negativo", invalido: true },
    { valor: "-0,01", nota: "negativo de um centavo", invalido: true },
    { valor: "-999999", nota: "negativo grande", invalido: true },
    // --- separadores pt-BR vs en-US (o erro mais comum do usuário real)
    { valor: "1.5", nota: "ponto como decimal (en-US)", invalido: false },
    { valor: "1,5", nota: "vírgula como decimal (pt-BR)", invalido: false },
    { valor: "1.234,56", nota: "milhar pt-BR + decimal", invalido: false },
    { valor: "1,234.56", nota: "milhar en-US + decimal", invalido: false },
    { valor: "1.234.567,89", nota: "dois separadores de milhar", invalido: false },
    { valor: "1,,5", nota: "vírgula dupla", invalido: true },
    { valor: "1..5", nota: "ponto duplo", invalido: true },
    { valor: ",5", nota: "começa com vírgula", invalido: false },
    { valor: "5,", nota: "termina com vírgula", invalido: false },
    { valor: "1,5,5", nota: "três partes decimais", invalido: true },
    // --- magnitudes
    { valor: "0,001", nota: "abaixo do centavo", invalido: false },
    { valor: "0,0000001", nota: "muito abaixo do centavo", invalido: false },
    { valor: "999999999", nota: "nove dígitos", invalido: false },
    { valor: "999999999999", nota: "doze dígitos", invalido: false },
    { valor: "99999999999999999999", nota: "vinte dígitos", invalido: false },
    { valor: "1e10", nota: "notação científica", invalido: true },
    { valor: "1e308", nota: "beira do limite do double", invalido: true },
    { valor: "1e309", nota: "além do double (vira Infinity)", invalido: true },
    { valor: "-1e308", nota: "científica negativa", invalido: true },
    { valor: "0x1F", nota: "hexadecimal", invalido: true },
    { valor: "0b101", nota: "binário", invalido: true },
    { valor: "1_000", nota: "separador de JS", invalido: true },
    // --- texto e símbolos
    { valor: "abc", nota: "texto puro", invalido: true },
    { valor: "R$ 50,00", nota: "com prefixo de moeda", invalido: false },
    { valor: "50 reais", nota: "com sufixo por extenso", invalido: true },
    { valor: "cinquenta", nota: "número por extenso", invalido: true },
    { valor: "5x3", nota: "lixo no meio (013/FA-05)", invalido: true },
    { valor: "5+3", nota: "expressão aritmética", invalido: true },
    { valor: "5-3", nota: "subtração", invalido: true },
    { valor: "--5", nota: "sinal duplicado", invalido: true },
    { valor: "+5", nota: "sinal positivo explícito", invalido: false },
    { valor: "5%", nota: "com símbolo de porcentagem", invalido: false },
    { valor: "½", nota: "fração unicode", invalido: true },
    { valor: "٥", nota: "algarismo arábico-índico", invalido: true },
    { valor: "５０", nota: "dígitos de largura total", invalido: true },
    { valor: "🎉", nota: "emoji", invalido: true },
    { valor: "🎉🎊🎈🥳🎁", nota: "vários emoji", invalido: true },
    { valor: "ção", nota: "acentuação", invalido: true },
    { valor: "NaN", nota: "a palavra NaN", invalido: true },
    { valor: "Infinity", nota: "a palavra Infinity", invalido: true },
    { valor: "null", nota: "a palavra null", invalido: true },
    { valor: "undefined", nota: "a palavra undefined", invalido: true },
    { valor: "true", nota: "booleano", invalido: true },
    // --- injeção (o valor é do vendedor, nunca código)
    { valor: "<script>window.__xss=1</script>", nota: "script inline", invalido: true },
    { valor: "<img src=x onerror=window.__xss=1>", nota: "handler de imagem", invalido: true },
    { valor: "'; DROP TABLE filaments;--", nota: "SQL", invalido: true },
    { valor: "{{7*7}}", nota: "template injection", invalido: true },
    { valor: "${7*7}", nota: "template literal", invalido: true },
    { valor: "=1+1", nota: "fórmula de planilha (CSV injection)", invalido: true },
    // --- tamanho
    { valor: "9".repeat(100), nota: "cem dígitos", invalido: false },
    { valor: "9".repeat(1000), nota: "mil dígitos", invalido: false },
    { valor: "A".repeat(5000), nota: "cinco mil letras", invalido: true },
    // --- controle e invisíveis
    { valor: "5​0", nota: "espaço de largura zero no meio", invalido: true },
    { valor: "‮50", nota: "marca de direção RTL", invalido: true },
    { valor: "5\n0", nota: "quebra de linha", invalido: true },
  ];
  // Mais 20 casos gerados: magnitudes e casas decimais variadas, sempre os mesmos.
  const r = semente(20260812);
  const gerados: CasoNumerico[] = Array.from({ length: 20 }, (_, i) => {
    const expoente = Math.floor(r() * 12) - 3;
    const base = (r() * 9 + 1).toFixed(Math.floor(r() * 6));
    const valor = `${base.replace(".", ",")}e${expoente}`;
    const plano = (Number(base) * Math.pow(10, expoente)).toFixed(
      Math.min(8, Math.abs(expoente) + 2),
    );
    return i % 2 === 0
      ? { valor: plano.replace(".", ","), nota: `magnitude gerada 1e${expoente}`, invalido: false }
      : { valor, nota: `científica gerada ${valor}`, invalido: true };
  });
  return [...fixos, ...gerados];
}

/** O corpus de TEXTO: nomes que o vendedor digita em filamento, produto, kit, cenário, rótulo. */
export function corpusTexto(): { valor: string; nota: string }[] {
  return [
    { valor: "", nota: "vazio" },
    { valor: " ", nota: "um espaço" },
    { valor: "   ", nota: "só espaços" },
    { valor: "\t\n ", nota: "só brancos variados" },
    { valor: "a", nota: "um caractere" },
    { valor: "PLA Azul", nota: "normal" },
    { valor: "PLA Azul", nota: "duplicado exato" },
    { valor: "pla azul", nota: "duplicado com outra caixa" },
    { valor: "PLA  Azul", nota: "espaço duplo interno" },
    { valor: " PLA Azul ", nota: "com brancos nas pontas" },
    { valor: "Filamento ção ÀÉÎÕÜ çÇ", nota: "acentuação completa" },
    { valor: "Ürün — «çğışö»", nota: "diacríticos estrangeiros" },
    { valor: "日本語のフィラメント", nota: "japonês" },
    { valor: "العربية", nota: "árabe (RTL)" },
    { valor: "🎉🎊🎈 Kit Festa 🥳", nota: "emoji misturado" },
    { valor: "👨‍👩‍👧‍👦", nota: "emoji composto (ZWJ)" },
    { valor: "A".repeat(50), nota: "50 caracteres" },
    { valor: "A".repeat(255), nota: "255 caracteres" },
    { valor: "A".repeat(500), nota: "500 caracteres sem espaço" },
    { valor: "A".repeat(2000), nota: "2000 caracteres sem espaço" },
    { valor: "Lorem ipsum ".repeat(200), nota: "2400 caracteres com espaços" },
    { valor: "<script>window.__xss=1</script>", nota: "script inline" },
    { valor: "<img src=x onerror=window.__xss=1>", nota: "handler de imagem" },
    { valor: "<b>negrito</b>", nota: "html simples" },
    { valor: "javascript:alert(1)", nota: "protocolo javascript" },
    { valor: "'; DROP TABLE filaments;--", nota: "SQL" },
    { valor: '=HYPERLINK("http://x","clique")', nota: "fórmula de planilha" },
    { valor: "@SUM(1+1)", nota: "fórmula com arroba" },
    { valor: "../../etc/passwd", nota: "travessia de caminho" },
    { valor: "%00nulo", nota: "byte nulo codificado" },
    { valor: "‮esrever", nota: "inversão de direção" },
    { valor: "​​​", nota: "só espaços de largura zero" },
    { valor: "NULL", nota: "a palavra NULL" },
    { valor: "undefined", nota: "a palavra undefined" },
    { valor: "0", nota: "só um zero" },
    { valor: "-1", nota: "número negativo como nome" },
    { valor: "R$ 100,00", nota: "dinheiro como nome" },
    { valor: "nome\tcom\ttabs", nota: "tabulações internas" },
    { valor: "linha1\nlinha2", nota: "quebra de linha" },
    { valor: "\\\\servidor\\pasta", nota: "caminho UNC" },
  ];
}

/** Sinais de que a tela quebrou — checagem barata para rodar a cada caso do corpus. */
export const SINAIS_DE_QUEBRA =
  /NaN|Infinity|\[object Object\]|\bundefined\b|Traceback|TypeError|ReferenceError|SyntaxError|Internal Server Error|Unprocessable/;
