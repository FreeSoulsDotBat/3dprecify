import { diffCatalogs } from "./catalog-diff.ts";
import { classificarDispensa } from "./exemption.ts";
import { nextCatalogVersion } from "./guardrails.ts";
import {
    type FolhaDeOcr,
    type RelatoDeVigia,
    type SecaoDeDecisao,
    corpoDoPrMensal,
} from "./pr-body.ts";
import { decideRefresh } from "./refresh.ts";
import { type CatalogJson, aplicarFatia } from "./slice.ts";
import {
    type CollectorVerdict,
    MARKETPLACE_COVERAGE,
    type Mk,
    resolverVereditos,
} from "./verdict.ts";

// ⚠ @doc DEC-078 — escreve depois de validar, e o catálogo composto só EXISTE dentro do caso PR
//   do `RunOutcome`: não há como escrever a partir de um SEM_PR, porque o valor não está lá.

export type RunOutcome =
    | { kind: "SEM_PR"; motivo: string }
    | {
          kind: "PR";
          titulo: string;
          corpo: string;
          dispensa: boolean;
          decisaoDoDono: boolean;
          /** O documento a publicar. Só existe aqui — é a FR-020a em nível de tipo. */
          catalogo: CatalogJson;
          /** Os vereditos DEPOIS da composição (uma fatia reprovada já chega aqui como ABORTADO). */
          vereditos: Record<Mk, CollectorVerdict>;
      };

export type ComporArgs = {
    base: CatalogJson;
    /** Os vereditos como saíram dos coletores (do disco). A resolução total acontece aqui dentro. */
    vereditos: readonly CollectorVerdict[];
    /** A data da releitura. Validada por `collectedAtFor` ANTES de chegar aqui (SC-807). */
    collectedAt: string;
    /** O carimbo ISO desta execução. Só é usado se algo mudou de verdade. */
    generatedAt: string;
    vigias: readonly RelatoDeVigia[];
    folhasDeOcr?: readonly FolhaDeOcr[];
    decisao?: SecaoDeDecisao;
    /** `ALLOW_FRESHNESS_EXEMPTION`, já lida do ambiente (nasce false). */
    dispensaPermitida: boolean;
    /** Os arquivos que o PR vai tocar — o eixo (b) do classificador de dispensa. */
    arquivosDoPr: readonly string[];
};

/** O documento sem os campos que a própria composição carimba — a base de comparação honesta. */
const semMeta = (c: CatalogJson) =>
    JSON.stringify(
        Object.fromEntries(
            Object.entries(c).filter(([k]) => k !== "catalogVersion" && k !== "generatedAt"),
        ),
    );

/**
 * Compõe o artefato a partir da base e das fatias admitidas.
 *
 * Ordem ALFABÉTICA de marketplace, e isso é load-bearing: as fatias chegam na ordem em que os jobs
 * terminaram, que é ruído de agendador. Um artefato cujo conteúdo dependesse dela produziria um diff
 * diferente a cada mês pelo mesmo dado.
 */
export function compor(args: ComporArgs): RunOutcome {
    const { base, collectedAt, generatedAt, vigias, dispensaPermitida, arquivosDoPr } = args;
    const folhasDeOcr = args.folhasDeOcr ?? [];

    const resolvidos = resolverVereditos(args.vereditos);
    let catalogo = base;

    for (const mk of MARKETPLACE_COVERAGE) {
        const v = resolvidos[mk];
        if (v.kind !== "LIDO") continue;

        const aplicada = aplicarFatia(catalogo, v.slice);
        if (!aplicada.ok) {
            // Uma fatia que nem se aplica não vira exceção nem meia escrita: vira o estado que o
            // relatório sabe declarar.
            resolvidos[mk] = {
                kind: "ABORTADO",
                marketplace: mk,
                reason: aplicada.reason,
                sourceUrl: v.sourceUrl,
            };
            continue;
        }

        // O teto de mudança em bloco roda POR MARKETPLACE (U4-a) e sobre o catálogo ACUMULADO, não sobre
        // a base: o denominador tem de ser o mesmo documento em que o numerador foi contado.
        const decisao = decideRefresh({
            marketplace: mk,
            collectedAt: v.collectedAt,
            sourceUrl: v.sourceUrl,
            sanity: { ok: true },
            before: catalogo,
            after: aplicada.catalog,
        });
        if (decisao.kind === "ABORT") {
            resolvidos[mk] = {
                kind: "ABORTADO",
                marketplace: mk,
                reason: decisao.reason,
                sourceUrl: v.sourceUrl,
            };
            continue;
        }
        catalogo = aplicada.catalog;
    }

    const mudouDocumento = semMeta(catalogo) !== semMeta(base);
    const diff = diffCatalogs(base, catalogo);

    if (!mudouDocumento && vigias.length === 0 && !args.decisao) {
        return {
            kind: "SEM_PR",
            motivo: "nada mudou no artefato e nenhum vigia tem notícia — nada a publicar (o artefato fica byte a byte intocado)",
        };
    }

    // UM bump por EXECUÇÃO (decisão B.3), e ele só se move quando o CONTEÚDO mudou. Dois coletores
    // bumpando na mesma data produziriam `.1` e `.2` para um único run — dois rótulos para um
    // conteúdo, dentro de um payload que o ADR-0019 congela para sempre.
    const catalogVersion = nextCatalogVersion(
        String(base.catalogVersion),
        collectedAt,
        !diff.freshnessOnly,
    );
    // `generatedAt` só avança se o documento avançou: senão o gerador não teria ponto fixo e abriria
    // um PR novo todo mês sobre a mesma tabela — e o revisor aprenderia a não olhar.
    const publicado: CatalogJson = mudouDocumento
        ? { ...catalogo, catalogVersion, generatedAt }
        : catalogo;

    const dispensaDecidida = classificarDispensa({
        // O PR de decisão força a dispensa a NÃO (clarify Q2, item 4) — o dono é o portão, e um
        // interruptor não pode passar por cima dele.
        permitida: dispensaPermitida && !args.decisao,
        diffSoInerte: diffCatalogs(base, publicado).freshnessOnly,
        arquivosDoPr,
        contemFolhaDeOcr: folhasDeOcr.length > 0,
    });

    const corpo = corpoDoPrMensal({
        vereditos: resolvidos,
        diff: diffCatalogs(base, publicado),
        vigias,
        dispensa: dispensaDecidida,
        folhasDeOcr,
        ...(args.decisao ? { decisao: args.decisao } : {}),
    });

    const tituloBase = `Tarifas — leitura de ${collectedAt}`;
    return {
        kind: "PR",
        titulo: args.decisao ? `DECISÃO — ${tituloBase}` : tituloBase,
        corpo,
        dispensa: dispensaDecidida.concedida,
        decisaoDoDono: args.decisao !== undefined,
        catalogo: publicado,
        vereditos: resolvidos,
    };
}
