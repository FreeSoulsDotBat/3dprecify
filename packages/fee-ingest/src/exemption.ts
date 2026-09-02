// 017/T011 (desenho §I, clarify Q5) — quem pode entrar sem um humano ler.
//
// O ACHADO que este módulo existe para fechar: `mayAutoMerge(diff)` decide olhando SÓ o diff do
// catálogo. A partir do 017 o PR mensal também carrega BASELINES de vigia (decisão E), e um mês em
// que só um baseline mude produz diff de catálogo VAZIO ⇒ `freshnessOnly === true` ⇒ dispensa
// concedida. Um arquivo que ninguém revisou entraria sozinho, e o classificador estaria certo sobre
// a pergunta que ele sabe responder e mudo sobre a que passou a importar.
//
// Por isso a dispensa passa a exigir as DUAS condições, e falha fechado nas duas.

/**
 * O par de arquivos que uma execução pode mover sozinha: o artefato servido e a semente que é
 * PROJEÇÃO dele (ADR-0029). Qualquer outro arquivo no PR — baseline, workflow, código — derruba a
 * dispensa pelo eixo (b), inclusive quando o diff do catálogo é impecável.
 */
export const EXEMPTABLE_FILES = [
    "backend/app/data/catalog.json",
    "apps/web/src/shared/fee-catalog/seed.data.json",
] as const;

export type ExemptionAxis = "FLAG" | "DIFF_MATERIAL" | "ARQUIVOS_FORA_DO_PAR" | "FOLHA_DE_OCR";

export type ExemptionDecision = {
    concedida: boolean;
    /** TODOS os eixos que negaram — o revisor não conserta um e descobre o próximo no dia seguinte. */
    eixosQueNegaram: ExemptionAxis[];
    /** O que o rodapé do corpo do PR imprime. Preenchido também quando concedida. */
    motivo: string;
};

/**
 * `ALLOW_FRESHNESS_EXEMPTION` — nasce DESLIGADA (clarify Q5) e só a string exata `"true"` a liga.
 *
 * Nada de `Boolean(valor)` nem de aceitar `1`/`yes`: a variável chega de um input de workflow
 * digitado à mão, e um parser generoso transforma um dedo escorregando em "dinheiro entra sem
 * revisão". O padrão de um interruptor de dinheiro é a posição segura.
 */
export function readExemptionGrant(valor: string | undefined): boolean {
    return valor === "true";
}

/**
 * Classifica a dispensa nos DOIS eixos do desenho (§I.1) mais os dois que o desenho PROÍBE por fora:
 * a flag (que nasce desligada) e a folha vinda de OCR (§F.5).
 *
 * `contemFolhaDeOcr` já entra aqui, e não na PR-C onde o OCR chega: um eixo acrescentado depois é um
 * eixo que alguém precisa lembrar de acrescentar, e a lição de 014/U4-f é sobre exatamente isso.
 */
export function classifyExemption(args: {
    /** `ALLOW_FRESHNESS_EXEMPTION` — eixo do dono. */
    permitida: boolean;
    /** Eixo (a): o diff do catálogo é EXCLUSIVAMENTE inerte (`freshnessOnly`). */
    diffSoInerte: boolean;
    /** Eixo (b): o conjunto de arquivos do PR. */
    arquivosDoPr: readonly string[];
    /** §F.5: qualquer folha do diff veio de OCR. */
    contemFolhaDeOcr: boolean;
}): ExemptionDecision {
    const { permitida, diffSoInerte, arquivosDoPr, contemFolhaDeOcr } = args;
    const eixosQueNegaram: ExemptionAxis[] = [];
    const detalhes: string[] = [];

    if (!permitida) {
        eixosQueNegaram.push("FLAG");
        detalhes.push(
            "`ALLOW_FRESHNESS_EXEMPTION` está DESLIGADA (padrão; o P0-b — ruleset de revisão obrigatória " +
                "em `develop` — é tarefa do dono e ainda não está feito)",
        );
    }
    if (!diffSoInerte) {
        eixosQueNegaram.push("DIFF_MATERIAL");
        detalhes.push("o diff do catálogo tem mudança MATERIAL (não é só data de reverificação)");
    }

    const exemptable = new Set<string>(EXEMPTABLE_FILES);
    const forasteiros = arquivosDoPr.filter((f) => !exemptable.has(f));
    // Zero arquivo não é "subconjunto vazio, logo dispensável": um PR sem arquivo não existe, e
    // conceder sobre o vazio é o jeito de a dispensa nascer ligada por acidente de aritmética.
    if (forasteiros.length > 0 || arquivosDoPr.length === 0) {
        eixosQueNegaram.push("ARQUIVOS_FORA_DO_PAR");
        detalhes.push(
            forasteiros.length > 0
                ? `o PR toca arquivo fora do par artefato+semente: ${forasteiros.join(", ")}`
                : "o PR não declara arquivo nenhum",
        );
    }
    if (contemFolhaDeOcr) {
        eixosQueNegaram.push("FOLHA_DE_OCR");
        detalhes.push(
            "há folha de dinheiro vinda de OCR, e OCR nunca dispensa revisão humana (§F.5)",
        );
    }

    return {
        concedida: eixosQueNegaram.length === 0,
        eixosQueNegaram,
        motivo:
            eixosQueNegaram.length === 0
                ? "diff exclusivamente inerte (`lastReviewed`/`catalogVersion`/`generatedAt`) e nenhum arquivo fora do par artefato+semente"
                : detalhes.join("; "),
    };
}
