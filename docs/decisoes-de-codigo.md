# Decisões de código (DEC)

O degrau do meio da escada do `docs/PADRAO_DE_COMENTARIOS.md` §2: decisões pequenas e locais —
posicionamento de um módulo, escolha de forma, procedência de um limiar — que precisam ficar
registradas mas não justificam um ADR.

**Quando NÃO abrir um DEC:** se um ADR já governa o assunto, aponte para ele. Se mudar a decisão
mexeria em mais de um módulo, ou num contrato, schema ou regra de preço, é ADR.

**Cada DEC é citado por ao menos um ponto do código** (`// @doc DEC-xxx — resumo`) — o guarda
`packages/repo-audit` derruba o portão quando isso deixa de ser verdade, nos dois sentidos: âncora
que aponta para DEC inexistente, e DEC que ninguém mais cita. Um DEC órfão é decisão sobre código
que não existe mais; ele sai daqui em vez de virar documentação de um lugar que o leitor não acha.

---

## DEC-001 — O rail forçado (426–599px): o menu recolhe por necessidade, sem botão de expandir

**Data**: 2026-08-15 · **Governa**: `RAIL_FORCADO_QUERY`, `useRailForcado`

Entre 426px (o primeiro pixel em que a barra lateral monta) e ~600px, os 240px de menu deixam ~150px
de conteúdo, e nada do produto cabe nisso — a homologação mediu a **página inteira** como culpada de
131px de transbordo, não um elemento isolado. Abaixo de 600px, o rail de 76px é a única largura de
menu que deixa espaço utilizável (426 − 76 − 32 de goteira ≈ 318px).

Nesta faixa o menu é recolhido **por necessidade, não por preferência do vendedor**, e por isso não
ganha botão de expandir: expandir ali devolveria exatamente o transbordo que a faixa existe para
evitar.

Não conflita com o corte mobile de 425px (`useIsMobile`): abaixo dele não existe barra lateral
nenhuma, então na prática esta faixa é 426–599px.

**Fica aqui e não no ADR-0031** porque o ADR governa a *estrutura* do gate de largura (Option C: um
hook único, `false` sem `matchMedia`) e este é apenas mais um limiar nomeado sob aquela regra — o
caso que o próprio ADR previu em §Follow-ups.

> **Pendência registrada (2026-09-01):** a §Emenda 2 do ADR-0031 enumera "os **três** limiares que
> hoje vivem em `use-is-wide.ts`" e não menciona `RAIL_FORCADO_QUERY`, que existe desde 2026-08-15 —
> são quatro. Um ADR que se declara a casa única dos limiares está contando errado. Emendar um ADR
> aceito é decisão do dono; fica anotado, não corrigido.

### Onde isso vive no código

- `apps/web/src/shared/lib/use-is-wide.ts` → `RAIL_FORCADO_QUERY`, `useRailForcado`
