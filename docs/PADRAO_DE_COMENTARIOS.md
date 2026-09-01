# Padrão de comentários — a explicação sai da linha, a âncora fica

> Vigente desde 2026-09-01. Aprovado pelo dono na mesma data (marcador `@doc`, registro `DEC`,
> migração completa). Governa `apps/web/src`, `packages/*/src` e `backend/app`.

## 0. O diagnóstico que originou o padrão

Medido em 2026-09-01, sobre o código de produção (sem testes, sem `generated.ts`):

| medida                                       | valor                           |
| -------------------------------------------- | ------------------------------- |
| linhas de comentário no front                | **7.792 de 31.691 — 24%**       |
| blocos de ≥4 linhas seguidas de comentário   | **390**                         |
| pior arquivo                                 | `use-is-wide.ts` — 72/114 = 63% |
| comentários no backend (`#`, sem docstrings) | 725 de 8.887 — 8%               |
| ADRs existentes                              | **34** (`docs/adr/`, ~370 KB)   |
| arquivos de código que já citam um ADR       | **138 de 296 — 47%**            |

O achado que define o padrão: **esses comentários não preenchem um vazio de documentação — eles
duplicam documentação que já existe.** O `use-is-wide.ts` gasta 20 linhas explicando a decisão do
ADR-0031 e cita o ADR-0031 na primeira dessas linhas. A cópia nasceu porque não havia como pular do
código para a _seção_ certa do documento com confiança, nem do documento de volta para o código.

Como toda cópia, ela é invalidada em silêncio: quando o ADR muda, o comentário não muda junto, e o
leitor confia no que está mais perto dos olhos — o comentário. **Um comentário desatualizado é pior
que comentário nenhum, porque tem cara de verdade.**

## 1. As quatro coisas escritas num comentário — e as duas que ficam

| tipo                        | exemplo real do repositório                                               | destino                       |
| --------------------------- | ------------------------------------------------------------------------- | ----------------------------- |
| **Invariante**              | "AVISO NUNCA VIRA VALIDAÇÃO" · "sem `matchMedia` a resposta é `false`"     | **fica** — âncora de 1 linha  |
| **Procedência de um valor** | "por que 1280px: sobram 960px depois da sidebar de 240px"                  | **fica** — 1 linha no valor   |
| **História**                | "o parser antigo virava `0,12` → 12" · "a terceira cópia ficou sem o ramo" | **sai** — vai para o teste    |
| **Razão arquitetural**      | "mora em `shared/lib` porque `bom` não pode importar `calculator`"         | **sai** — vai para ADR ou DEC |

Os dois últimos são a maior parte do volume, e é neles que a poluição mora.

**A história tem um destino específico e ele não é o comentário: o nome do teste.** O
`entities/history/sync-toast.test.ts` conta o bug B3 inteiro nos nomes dos `it()` — _"sessão expirada
NÃO é falha"_, _"todo estado de `SyncState` tem aviso próprio"_. Aquele teste é a versão **viva** da
história: se a história deixar de ser verdade, ele fica vermelho. Um comentário contando a mesma
coisa é a versão morta — quando deixa de ser verdade, ninguém fica sabendo. Escrever história em
comentário é manter um changelog que ninguém executa.

## 2. A escada de três degraus

O motivo de tanta gente escolher o comentário é que só existiam dois degraus, e o de cima é caro: um
ADR tem 10–30 KB de cerimônia. Ninguém abre um ADR para registrar por que um helper mora em
`shared/lib`. O degrau do meio é o que faltava.

| degrau       | onde                         | para quê                                                          | tamanho    |
| ------------ | ---------------------------- | ----------------------------------------------------------------- | ---------- |
| **ADR-xxxx** | `docs/adr/`                  | decisão estrutural, com alternativas e consequências              | 5–30 KB    |
| **DEC-xxx**  | `docs/decisoes-de-codigo.md` | decisão pequena e local: posicionamento, escolha de forma, limiar  | ~10 linhas |
| **âncora**   | no código                    | o invariante e a procedência que o leitor precisa **no cursor**    | 1 linha    |

**Qual degrau usar** — na ordem, pare no primeiro "sim":

1. Um ADR já governa isso? → aponte para ele (`@doc ADR-0031 §3`). Não crie DEC.
2. Mudar essa decisão mexeria em mais de um módulo, ou num contrato/schema/preço? → é ADR.
3. Caso contrário → é DEC.

## 3. A gramática da âncora

```
// @doc <ID>[ §seção] — <resumo>
```

Regras, todas conferidas pelo guarda (§7):

- **Uma linha.** A linha inteira, com indentação, cabe em 100 colunas (o `printWidth` do
  repositório).
- **O ID resolve.** `ADR-0031`, `DEC-014`, ou um ID de spec (`013/FA-01`, `016/A3`, `009/T034`).
- **O resumo não é opcional.** O ID deixa _abrir_ o documento; o resumo deixa **não abrir**. Sem ele,
  todo leitor paga um salto de contexto — inclusive quem não precisava.
- **O resumo diz o invariante, não o assunto.** `— sem matchMedia responde false` é útil; `— sobre o
  gate de largura` não é: isso o nome do arquivo já disse.

## 4. As duas exceções que podem passar de uma linha

**Armadilha** (`⚠`) — o comentário cujo trabalho é impedir um "conserto" plausível. Até 3 linhas:

```ts
// ⚠ @doc DEC-003 — AVISO NUNCA VIRA VALIDAÇÃO: campo com aviso segue calculando e salvando.
//   Transformar um destes num erro revoga a decisão do dono de 2026-08-03 sem que ele saiba.
```

**Procedência de valor** — uma linha, colada no valor, com a fonte entre parênteses:

```ts
export const WIDE_QUERY = "(min-width: 1280px)"; // 1280: sobram 960px após a sidebar (dono, 2026-08-10)
```

Um limiar sem procedência é um palpite que o próximo leitor vai "ajustar".

## 5. O que nunca vai para comentário

- **História de bug** → nome de teste (§1).
- **Narração do que o código faz** → o código já diz; se não diz, o problema é o nome, não a falta de
  comentário.
- **Trecho de código copiado dentro de um documento** → é uma segunda fonte de verdade do próprio
  código: apodrece calada e passa a exigir dois lugares editados juntos. Este repositório já pagou
  por essa classe (é de onde vem a disciplina de SHA-256 nos documentos congelados).

## 6. O lado do documento: `## Onde isso vive no código`

Todo ADR ou DEC que recebe texto exilado ganha esta seção, e ela aponta **por símbolo, nunca por
linha**:

```markdown
## Onde isso vive no código

- `apps/web/src/shared/lib/use-is-wide.ts` → `WIDE_QUERY`, `RAIL_FORCADO_QUERY`, `useIsWide`
```

Número de linha morre no commit seguinte — e a refatoração de legibilidade de 2026-08/09 moveu
milhares de linhas. Um símbolo sobrevive a mudar de lugar, e o guarda consegue conferir se ele ainda
existe.

## 7. O guarda — `packages/repo-audit`

Sem guarda, isto é uma convenção, e convenção é lembrança. As quatro asserções, no `pnpm gate:all`:

1. **Nenhuma âncora morta** — todo `@doc <ID>` no código resolve para um documento/seção existente.
2. **Nenhum documento órfão** — todo `DEC-xxx` do registro é citado por ao menos um ponto do código.
   DEC que ninguém mais cita é decisão sobre código que não existe mais: some.
3. **Nenhum ponteiro de volta podre** — todo `arquivo → símbolo` das seções §6 ainda existe.
4. **A gramática vale** — uma linha, dentro de 100 colunas, com resumo. **É esta que impede a âncora
   de voltar a virar parágrafo.**

Cada asserção é provada não-vacuosa por mutação, como o resto da casa.

## 8. A catraca de densidade

`packages/repo-audit/comment-density.baseline.json` guarda a densidade de comentário de cada arquivo
no dia da migração. O guarda falha se um arquivo **subir**. Descer é sempre permitido e atualiza a
linha de base. É o mesmo mecanismo do `max-lines` do ESLint, e serve ao mesmo propósito: impedir a
recaída sem exigir um big-bang.

## 9. Ordem da migração

Por custo de depuração decrescente, que é a mesma ordem do `docs/RELATORIO_LEGIBILIDADE.md`: os
arquivos de maior densidade primeiro, porque são onde o leitor paga mais para achar a linha que
importa.
