# Research & decisões — 018 Abas desktop (Fase 0)

Este arquivo é a **autoridade técnica** do incremento (o plano aponta para cá; não existe
`arquitetura-018.md`). Cada decisão traz o que foi escolhido, por quê, e o que foi rejeitado.

Tudo aqui foi decidido **antes** da implementação (Princípio VIII). O que sustenta as decisões são
fatos lidos no código em 2026-08-10, não suposições — quando um fato foi medido, a medida está junto.

**ADR-0031 (Proposed)** cobre as decisões **A, B, C e G** — são as estruturais. O dono flipa no gate
da primeira fatia, como fez com 0025–0030.

---

## A — Um único gate de largura, em JavaScript, a 1280px

**Decisão**: um hook `useIsWide()` em `shared/lib/use-is-wide.ts`, sobre `window.matchMedia("(min-width:
1280px)")`, é o **único** lugar que decide "esta é a composição desktop do 018". Páginas e widgets o
consomem; ninguém abre um segundo `matchMedia`.

**Por que JS e não só CSS**: a diferença entre as composições não é só visual. No mestre-detalhe,
clicar num card **seleciona** em vez de **navegar** — comportamento, não aparência. Uma media query
esconderia a lista ou o detalhe, mas os dois ramos continuariam montados, com dois handlers de clique
disputando o mesmo card e dois formulários montados sobre o mesmo item. CSS resolve o que se vê; aqui
o que muda é o que acontece.

**Por que 1280px** (decisão do dono no clarify, com a medida que a motivou): a 1024px sobram ~700px de
conteúdo depois da sidebar de 240px e das goteiras; a ficha do desenho tem 560px, o que deixaria ~140px
para a lista. A 1280px sobram ~960px — ficha de 560px + lista de ~370px em uma coluna. A lista só vira
**duas** colunas a partir de ~1600px, que é a premissa do desenho a 1920px.

**Padrão herdado**: o shell já faz exatamente isso para o mobile (`useIsMobile`, 425px, defensivo
contra ausência de `matchMedia`). `useIsWide` é o mesmo molde, com o mesmo cuidado — o que nos leva a B.

**Rejeitado**: `container queries` (o corte depende da viewport, não do container, porque o rail
recolhido não deve promover a página a mestre-detalhe); e um `ResizeObserver` (mais caro e menos
declarativo para um limiar único).

---

## B — A invariância do mobile é ESTRUTURAL, não disciplinar

**Decisão**: `useIsWide()` retorna `false` quando `window` ou `matchMedia` não existem — que é
exatamente o ambiente de jsdom. Consequência deliberada: **toda a suíte existente continua exercitando
a composição de hoje**, sem tocar num único teste; e no navegador, abaixo de 1280px, o ramo novo não é
montado.

Isso transforma a US6 ("o mobile não se mexe") de promessa em propriedade: não existe caminho de
render para a composição nova abaixo do limiar. Um `if` esquecido não pode vazar o desktop para o
celular, porque o ramo mobile é o **mesmo código de antes**, intocado.

**O que isso NÃO prova**: que o desktop está certo. Prova só que o mobile não mudou. O desktop precisa
de teste próprio (RTL com `matchMedia` largo) e de navegador real — ver H.

**Custo aceito e declarado**: todo teste novo de desktop precisa instalar um `matchMedia` largo
explicitamente. É um incômodo por arquivo de teste, e é o preço de o padrão ser "mobile intocado".

---

## C — A seleção do mestre-detalhe é estado do componente, não da URL

**Decisão**: o item selecionado (Catálogo) e o registro aberto (Orçamentos) vivem em `useState` da
página, com **clamp derivado**: se a lista encolher, a seleção cai para um índice válido; se a lista
esvaziar, cai para o estado vazio. Trocar de seção reinicia a seleção.

**Por que não na URL**: o projeto já pagou por estado congelado (`013/F-02`: a aba do Catálogo era
`useState` e não seguia `?tab=`) — mas a lição de lá é "**o que a URL manda, a URL manda**", e a aba
está na URL porque é uma superfície que se compartilha e se marca. A seleção dentro de uma lista não é:
ela é efêmera, muda a cada clique, e colocá-la na URL faria cada clique escrever no histórico do
roteador (mesmo com `replace`) sem que ninguém queira aquele link.

**Por que isto não recria o bug do 013/F-02**: lá o estado *sombreava* uma verdade que estava na URL.
Aqui não existe verdade na URL para sombrear. A aba **continua** derivada de `?tab=`, como hoje.

**Deep link continua funcionando** por D.

---

## D — As rotas de detalhe continuam existindo; o mestre-detalhe é composição

**Decisão**: `?produto=` (Catálogo) e `/historico/$id` (Orçamentos) permanecem. No desktop, a ficha da
direita é a superfície primária; no mobile e para quem chega por link, a rota de hoje responde igual.

**Por que**: (1) o mobile não muda (B); (2) `/historico/$id` é a rota de compartilhar um orçamento;
(3) `?produto=` é o editor de página cheia que o clarify decidiu manter.

**Rejeitado — e este é o que mais parecia elegante**: transformar o mestre-detalhe numa rota
(`/catalogo/$id` renderizando lista + detalhe). Reabriria a armadilha do `base: './'` do Capacitor, em
que **qualquer rota de 2 segmentos abre em branco na carga fria** — o projeto já contornou isso
trocando `/catalogo/produtos/$id` por `?produto=`. Criar uma rota de 2 segmentos nova seria reintroduzir
um defeito conhecido para ganhar elegância de URL.

---

## E — A ficha do Catálogo: editor para filamento e impressora, resumo para produto e kit

**Decisão** (clarify do dono, 2026-08-10): a coluna da direita **é o editor** de filamentos e
impressoras — montando `FilamentForm` / `PrinterForm`, os mesmos de hoje, no lugar da gaveta. Para
produtos e kits, ela é um **resumo** com a ação que abre o editor de página cheia que já existe.

**Fato que sustenta**: `CatalogPanel` já tem os dois modos no código — *sheet mode* (recebe
`emptyForm`/`toFormValues`/`renderForm`: filamentos e impressoras) e *navigation mode* (produtos
navegam para `?produto=`). A decisão do dono se encaixa nos modos que já existem, em vez de brigar com
eles: no desktop o *sheet mode* muda de **lugar** (da gaveta para a coluna), e o *navigation mode*
continua navegando.

**Consequência de projeto**: o formulário não é reescrito nem duplicado. Se `FilamentForm` mudar,
gaveta e ficha mudam juntas, porque são o mesmo componente montado em dois hospedeiros.

**Rejeitado**: recompor o formulário completo de Produto dentro de 560px (o dono decidiu contra; e
seria a reescrita do maior formulário do app para caber num painel).

---

## F — A coluna fixa não pode inventar uma segunda barra de rolagem

**Decisão**: a ficha/resumo da direita usa `position: sticky` com `align-self: start` dentro da grade,
ancorada na goteira do topo. Ela **não** ganha `overflow` próprio por padrão; ganha `max-height` +
rolagem interna **apenas** quando o próprio conteúdo é mais alto que a viewport — que é o caso do
formulário de impressora com todos os campos.

**Por que isso merece uma decisão**: o defeito clássico deste layout é a coluna fixa gerar uma segunda
barra, e o projeto já teve o caso irmão — o scroll do item 9 da rodada 1, que **só apareceu quando o
eixo Y passou a ser medido**, porque headless não desenha barra clássica. Portanto:

- a guarda mede **os dois eixos**, na página **e** na coluna;
- e a medida é de **caixa**, não de texto: `toBeVisible` passa em elemento ocluso (lição do 014).

**Ponto de atenção declarado**: `position: sticky` só funciona se nenhum ancestral tiver `overflow`
diferente de `visible`. `.tf-shell__main` hoje não tem — se alguma correção futura adicionar, o sticky
morre em silêncio (não quebra, só para de grudar). A guarda de geometria pega isso.

---

## G — O rail recolhido: preferência do aparelho, rótulo nunca sai da árvore de acessibilidade

**Decisão**: um store Zustand com `persist`, chave `precifica3d-nav-rail`, exatamente no molde do
`theme-store` (mesmo `createJSONStorage(localStorage)`, mesmo `partialize`). Padrão: expandido.

**Decisão de acessibilidade — e aqui melhoramos o desenho de propósito**: o desenho recolhe usando
`display: none` no rótulo, o que o **remove da árvore de acessibilidade** e deixaria cada item do menu
sem nome para quem usa leitor de tela. Nós escondemos **visualmente** (a técnica de texto acessível já
usada no projeto), mantendo o nome acessível intacto. O que se vê é o desenho; o que o leitor de tela
ouve continua sendo "Catálogo", não "botão".

**Consequência**: a travessia por setas com um único ponto de tabulação (roving tabindex, já
implementada em `app-nav.tsx`) continua valendo sem alteração — o botão "Recolher" fica **fora** da
lista de itens, para não entrar na travessia de seções.

**Sem pré-paint**: diferente do tema, um rail recolhido que aparece expandido por um quadro não pinta
a tela errada — não há script inline novo em `index.html`.

---

## H — O que prova o quê (e o que nenhum teste vai provar)

| Camada | Prova | Não prova |
|---|---|---|
| Vitest + RTL com `matchMedia` largo | que a composição desktop monta, que clicar seleciona sem navegar, que a seção reinicia a seleção, que grátis vê um teaser | nada sobre layout |
| Guarda de geometria (caixas do DOM, **dois eixos**) | ausência de transbordo e de rolagem inesperada nas larguras de SC-003 | que a tela está bonita ou compreensível |
| Suíte existente, intocada | que o mobile não mudou (por B, ela só exercita o ramo mobile) | que o desktop funciona |
| e2e Playwright | o caminho real com dados reais | percepção |
| **Homologação visual do dono** | o julgamento — e é o único que fecha | — |

**A lição que governa este quadro**: em 012/PR-B, mais de mil testes automatizados não acharam
**nenhum** dos três defeitos reais; cada um precisou de algo que EXECUTASSE o produto. Este incremento
é de layout, que é exatamente a classe que jsdom é cego para — o projeto já pagou três vezes por
diagnosticar layout fora do navegador. Portanto: **nada aqui é declarado pronto sem navegador real**,
e o fechamento é a segunda passada do dono (`docs/homologacao/PROCESSO-HOMOLOGACAO.md`).

---

## I — Decisões menores, registradas para não virarem inferência

- **Tema segmentado (Conta, desktop)**: escreve no **mesmo** `useThemeStore`; o interruptor do mobile
  permanece. Dois controles, uma verdade. (Clarify do dono.)
- **Resumo do kit**: `AssemblySummary` ganha uma variante de apresentação (`pinned` | `column`); o
  desktop passa `column` e não renderiza `.assembly-summary__pinned`. `--pinned-bottom` e toda a lógica
  do 014/T118 ficam intocados para o mobile.
- **Grupo segmentado**: um componente de composição único (`shared/ui/segmented.tsx`) para as seções do
  Catálogo e o tema da Conta, no mesmo padrão `role`/roving tabindex que `catalogo-page.tsx` já usa.
  Não é primitiva nova de DS — é o padrão existente com **um** dono em vez de dois.
- **Dados do desenho são fictícios**: "PLA Prata 1kg", "Cliente Ana · pedido 132", R$ 231,88 são
  amostras de layout. Nada disso vira semente.
- **Busca do Catálogo**: filtra a seção ativa no cliente, sobre a lista já carregada — não é endpoint
  novo (Constraint: zero mudança de contrato).
