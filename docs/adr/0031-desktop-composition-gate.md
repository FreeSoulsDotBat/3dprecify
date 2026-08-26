# ADR-0031: O gate de composição desktop, e a invariância mobile por construção

- **Status**: Accepted (2026-08-26 — ratificado pelo dono no gate do PR #58: o merge em develop, com as 5 fatias homologadas pelo assistente e o fechamento T053–T058; flip executado no primeiro commit do 019 com a palavra do dono "mergeado, continue")
- **Date**: 2026-08-10
- **Deciders**: Jonatan (owner) + main thread (018-abas-desktop)

## Context

O incremento 018 implementa o redesenho desktop das quatro abas (Catálogo, Kits, Orçamentos, Conta)
que o dono desenhou a 1920px depois de julgar que as correções do 016 ainda não tinham acertado o
desktop. As quatro telas ganham composições **estruturalmente diferentes** da atual — mestre-detalhe,
colunas fixas, grade de três colunas — e o mobile, que já foi homologado, **não pode mudar**.

Três forças tornam isto uma decisão a registrar em vez de uma escolha de implementação:

1. **A diferença não é só visual.** No mestre-detalhe, clicar num card *seleciona*; hoje, *navega*.
   Um mesmo card com dois comportamentos disputando o mesmo clique é um defeito esperando acontecer.
2. **O projeto já pagou por regressão vinda da própria correção** (016/Polish: a correção da logo
   deixou os PNGs fora do precache). "Prometemos não mexer no mobile" não é garantia — é intenção.
3. **jsdom é cego para layout**, e o projeto já diagnosticou errado por isso três vezes. Qualquer
   desenho que dependa de "a suíte vai pegar" nasce frágil aqui.

Some-se a isso o Princípio VIII: escolhas estruturais não podem ser inferidas na implementação.

## Options considered

### Option A — Media query em CSS, ambos os ramos montados

Uma media query mostra/esconde as duas composições; React monta as duas.

- **Pros**: zero JavaScript novo; sem risco de divergência entre "o que a CSS acha" e "o que o JS
  acha"; nenhum teste precisa de `matchMedia`.
- **Cons**: os dois ramos ficam montados — dois handlers no mesmo card, dois formulários sobre o mesmo
  item, dois `PremiumTeaser` na árvore (o invariante "um teaser, nunca dois" do 016/US1 passaria a
  depender de CSS). Trabalho e memória dobrados em toda tela. Comportamento não se resolve com
  `display: none`.
- **Scalability impact**: negativo — cada tela nova herda o custo dobrado.
- **Confidence**: 90% de que quebraria o invariante do teaser.

### Option B — `matchMedia` local em cada página

Cada página decide sua própria largura.

- **Pros**: nenhuma abstração compartilhada; cada tela evolui sozinha.
- **Cons**: quatro limiares que podem divergir; o menu podendo achar "desktop" enquanto a página acha
  "estreito" (e o rail recolhido dando largura sem que a página perceba). Um valor mágico repetido em
  cinco arquivos é o modo clássico de um deles ficar para trás numa correção.
- **Scalability impact**: negativo — a divergência aparece na quinta tela, não na primeira.
- **Confidence**: 75% de que divergiriam dentro de dois incrementos.

### Option C — Um hook único (`useIsWide`), falso sem `matchMedia`

Um `shared/lib/use-is-wide.ts` sobre `matchMedia("(min-width: 1280px)")`, no mesmo molde defensivo do
`useIsMobile` que o shell já usa; retorna `false` quando `window`/`matchMedia` não existem.

- **Pros**: um limiar, um dono. O ramo mobile continua sendo **o mesmo código**, não um equivalente —
  e, como jsdom não tem `matchMedia`, **toda a suíte existente continua exercitando exatamente esse
  ramo**, sem tocar num teste. A invariância do mobile deixa de ser disciplina e vira propriedade:
  abaixo do limiar não existe caminho de render para a composição nova.
- **Cons**: todo teste novo de desktop precisa instalar um `matchMedia` largo explicitamente; e um
  hook de largura é estado de render (um resize repinta).
- **Scalability impact**: positivo — a quinta tela consome o mesmo hook.
- **Confidence**: 90%.

## Decision

**Option C.** Um único gate (`useIsWide`, 1280px), com `false` como resposta na ausência de
`matchMedia`, e as composições novas montadas **apenas** acima do limiar.

Decorrem daí, no mesmo ato:

- **Seleção do mestre-detalhe é estado do componente**, derivada contra a lista a cada render (com
  clamp), **não** da URL: a aba continua vindo de `?tab=` (013/F-02 permanece), mas a seleção dentro
  de uma lista é efêmera e escrevê-la na URL faria cada clique mexer no roteador sem que ninguém
  queira aquele link.
- **As rotas de detalhe permanecem** (`?produto=`, `/historico/$id`). Foi **rejeitado** transformar o
  mestre-detalhe numa rota de 2 segmentos: reabriria a armadilha do `base: './'` (rota de 2 segmentos
  em branco na carga fria) que o projeto já contornou.
- **A preferência do rail** vive em `localStorage` (`precifica3d-nav-rail`), por **aparelho**, no molde
  do `theme-store`, e **sem** script de pré-paint — um menu expandido por um quadro não pinta nada de
  errado, ao contrário do tema.
- **O rótulo do menu recolhido some da tela, nunca da árvore de acessibilidade.** Aqui divergimos do
  arquivo de design de propósito: ele usa `display: none`, o que deixaria cada item sem nome para
  leitor de tela. O que se vê é o desenho; o que se ouve continua sendo "Catálogo".

O limiar de 1280px e o escopo da ficha do Catálogo foram decididos pelo dono no clarify de 2026-08-10
(`specs/018-abas-desktop/spec.md` §Clarifications), com a medida que os motivou registrada lá.

**Aprovação**: Proposed — o dono flipa para Accepted no gate da primeira fatia, como fez com
ADR-0025–0030.

## Consequences

- **Positivo**: a US6 ("o mobile não se mexe") vira propriedade verificável por construção, não
  promessa; um único limiar impede a divergência menu↔página; o invariante "um teaser, nunca dois"
  continua sendo estrutural em vez de virar CSS.
- **Negativo / trade-off aceito**: cada arquivo de teste de desktop instala um `matchMedia` largo —
  incômodo recorrente e consciente, que é o preço de o padrão ser "mobile intocado". E um gate em JS
  repinta no resize (irrelevante para um limiar que quase ninguém cruza em uso real).
- **Risco declarado**: `position: sticky` das colunas fixas morre em silêncio se algum ancestral
  ganhar `overflow` diferente de `visible` — não quebra, só para de grudar. Coberto por guarda de
  geometria que mede **os dois eixos** (a lição do item 9 da rodada 1: headless não desenha barra
  clássica, e o olho não vê o que não é desenhado).
- **Follow-ups**: se um dia uma quinta tela quiser um limiar diferente, ela **não** abre um segundo
  `matchMedia` — estende este hook com um limiar nomeado, ou este ADR é superseded.
