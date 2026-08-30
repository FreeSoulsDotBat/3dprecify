# Total do kit no estado "Sem preço ainda"

## O que desenhar

O bloco de resumo da aba **Kits** (o compositor: "Monte seus kits") no momento em que o vendedor já
adicionou peça(s) mas **nenhuma delas chegou ao total** — campos incompletos ou quantidade inválida.
É o mesmo bloco que, com preço, mostra "Custo total" + Varejo + Atacado + os preços por canal; aqui ele
não tem número nenhum para mostrar e precisa dizer isso sem mentir. Ocupa exatamente o mesmo lugar do
total cheio: no **mobile** é a barra colada no rodapé, acima da TabBar de 64px; no **desktop ≥1280px** é o
topo da coluna fixa de 480px à direita da lista de peças. Quem vê: qualquer vendedor nos primeiros 30
segundos da aba — é o estado mais frequente da tela e o único do resumo que nenhum artboard desenhou.

## Por que este prompt existe

O estado foi decidido numa revisão de código ("review 2026-07-12", comentário no próprio
`apps/web/src/features/bom/assembly-summary.tsx`), não num desenho. **Autoridade de desenho: nenhuma.**
O protótipo de 2026-07-02 desenha o herói de preço **sempre com preço**, e a matriz de estados da §G
registra para Resultado/breakdown a linha "empty: zerado (0,00)" — literalmente o oposto do que o produto
faz hoje. E o produto está certo: R$ 0,00 seria uma mentira. O artboard de Kits do 018
(`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) só existe **populado**, com três peças e valores
calculados. O que nunca foi desenhado é como a ausência ocupa o espaço do total e como ela se liga aos
avisos das peças que a causaram.

## O que já existe hoje (não invente do zero — corrija)

Um `tf-card` (padding md) com **três parágrafos empilhados**, gap de 4px, e nada mais:

| Ordem | Papel | Texto literal (pt-BR, homologado) | Como está hoje |
|---|---|---|---|
| 1 | Título do bloco | `Total do kit` | 14px, semibold, `--text-strong` |
| 2 | Estado | `Sem preço ainda` | 14px, `--text-muted` |
| 3 | Explicação | `O preço do kit aparece assim que ao menos uma peça estiver completa e válida.` | 12px, `--text-muted` |

Comportamento real, verificado no código:

- → **Título e estado têm o mesmo tamanho** e diferem só na cor: o bloco se lê como duas legendas
  empilhadas, sem hierarquia. No desktop isso vira três linhas de texto no topo de uma coluna de 480px
  com o resto vazio.
- → **A contagem de peças fora do total NÃO aparece neste ramo.** O texto
  `{n} peça(s) fora do total — confira os avisos nas peças acima.` existe e é o único ponteiro para a
  causa, mas ele só renderiza quando **algumas** peças ficam de fora. Com 3 peças e as 3 incompletas —
  o caso deste estado — o vendedor não vê contagem nem ponteiro nenhum.
- → **Não há rollup de canal aqui** (sem peça válida não há canal): o card "Preços por canal (kit)"
  some, o que no desktop abre um segundo buraco na coluna.
- Este estado **nunca** é a tela de zero peças: com a lista vazia a página mostra o estado vazio próprio
  ("Monte seu kit peça por peça"). Sempre há **pelo menos um cartão de peça à esquerda/acima**.
- Ao lado/abaixo, na mesma coluna: o botão `Salvar em Orçamentos` fica **desabilitado** (nenhuma linha
  para congelar) → e não diz por quê; o campo `Nome do kit` (placeholder `Kit suporte + base`) e o botão
  `Salvar kit`, que fica **habilitado** e só depois do clique responde
  `Confira as peças com aviso antes de salvar.`
- → O artboard populado do 018 traz um `tf-badge--success` **"Ao vivo"** ao lado de "Total do kit". O
  código nunca implementou esse badge — e neste estado um selo verde "Ao vivo" sobre um total que não
  existe seria falso.

## Conteúdo e dados reais

- **Cartão de peça (contexto à esquerda/acima)**: rótulo `Peça 1 · (avulsa)`, campo `Quantidade` com
  sufixo `un`, e o aviso que causa este estado:
  `Confira os campos desta peça — ela não entra no total até ser corrigida.`
- **O total cheio, para o qual este estado dá lugar** (números verdadeiros do cenário de referência,
  1 peça, qtd 1): `Custo total` **R$ 27,55**; `Varejo` **R$ 41,33**; `Atacado` **R$ 35,82**. Com 3 peças
  os valores sobem para a faixa de R$ 100 a R$ 1.500 — **desenhe com `R$ 1.234,56`** ao mostrar o
  "depois", porque foi um valor curto que deixou um aperto de largura dormir por meses.
- Rótulos do par de preços na barra fixada são propositalmente curtos: `Varejo` e `Atacado` (nunca
  "Preço atacado", que mede 111px e trunca no orçamento de ~85px).
- O bloco é **derivado**: sem campo, sem número, sem estado próprio.

## Estados obrigatórios

1. **Repouso (o estado desta peça)**: título + "Sem preço ainda" + a frase explicativa, com hierarquia
   de verdade. Calmo — **não é erro**: sem vermelho, sem ícone de alerta, sem borda `--danger`.
2. **Repouso com contagem** (variação a desenhar para o dono decidir): o mesmo bloco declarando quantas
   peças estão fora e apontando para os avisos, usando o texto que já existe:
   `3 peça(s) fora do total — confira os avisos nas peças acima.`
3. **Parcial (estado vizinho, já existe)**: total completo (Custo total + Varejo + Atacado) **mais** a
   legenda de excluídas. Desenhe-o lado a lado para provar que os dois se lêem como a mesma família.
4. **Com preço (o "depois")**: o mesmo espaço ocupado pelo total cheio. Prove que a troca não empurra a
   lista de peças nem faz a barra saltar de altura.
5. **Premium pausado**: acima da tela aparece o alerta
   `Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo.` O resumo
   continua **idêntico** (calcular é sempre grátis) e o botão `Salvar em Orçamentos` **desaparece** — não
   fica cinza, não vira isca.
6. **Offline**: também **idêntico** — o cálculo do kit é local. "Sem preço ainda" jamais pode ser lido
   como falha de rede, e falha de rede jamais pode aparecer dentro deste bloco (a falha do catálogo de
   tarifas tem alerta próprio no topo da página).
7. **Carregando**: não existe dentro deste bloco (o cálculo é síncrono). Não desenhe esqueleto nem
   spinner aqui — um esqueleto de preço é justamente o R$ 0,00 disfarçado que este estado combate.
8. **Desabilitado (vizinho)**: `Salvar em Orçamentos` desabilitado, com foco visível preservado.
9. **Foco / hover / pressionado**: só se o desenho propuser algo clicável (pergunta 3) — aí com alvo
   ≥44px e anel de foco de 3px.

## Viewports

- **390px (obrigatório)** — o estado vive no mobile como barra `sticky` no rodapé. Desenhe **com a TabBar
  de 64px visível na prancheta**: o recuo da barra é medido a partir dela, não do chão do viewport.
  Mostre também o cartão de peça com aviso logo acima, porque a relação entre os dois é o ponto.
- **1280px (obrigatório)** — layout de duas colunas: lista de peças em `minmax(0, 1fr)` e a coluna do
  resumo com **480px** fixos, gap de 24px; a coluna inteira é `sticky` a 16px do topo, com altura máxima
  de `100dvh − 32px`. Nada fica no rodapé. Desenhe a **coluna inteira** (resumo + Salvar em Orçamentos +
  card de nome/Salvar kit) para que o buraco vertical fique visível e resolvido.
- **1920px (desejável)** — mesma coluna de 480px com a lista mais larga: é onde o vazio dói mais.

## Regras que o desenho não pode quebrar

- **Ausência não é zero.** Nada de `R$ 0,00`, `R$ --,--`, traço no lugar do valor ou esqueleto cinza com
  forma de preço. Se não há preço, não há herói de preço.
- **Calmo, não punitivo.** É espera normal, não falha do vendedor: tom no máximo `--info`, nunca
  `--danger`, e nenhum verbo de bloqueio.
- **Nunca upsell.** Calcular é grátis e ilimitado; este bloco jamais insinua que o preço aparece com
  Premium.
- **Nunca falha de rede.** O cálculo é offline; este estado não pode emprestar linguagem de conexão.
- **A frase honesta em elemento de largura total**, nunca em placeholder.
- **Mesmo lugar, mesma família**: sem preço e com preço são o mesmo cartão em dois momentos — mesma
  borda, raio, padding e posição.
- **Contraste medido contra o fundo real do cartão** (`--surface-card`, não o `--bg-base` atrás dele) —
  a frase explicativa é o texto mais fraco da tela e é a que carrega a informação.
- **Altura no mobile**: a barra não pode passar de ~1/3 do viewport de 390×844. Fixar mais coisa no
  rodapé já custou 2/3 da tela uma vez, e comeu a lista de peças.

## Armadilhas já pagas neste projeto

- **Sticky medido do chão errado**: a barra do total já parou 56px **dentro** da TabBar, com os dígitos
  cortados durante toda a composição do kit. Por isso a prancheta mobile tem que mostrar a TabBar.
- **Duas colunas de preço a 360px**: sobram 89px por valor e "R$ 1.234,56" não cabe nem em texto corrido
  — por isso o par virou duas **linhas de leitura** (rótulo à esquerda, valor à direita). Se este desenho
  propuser qualquer prévia numérica, ela segue a mesma regra: quem cede é o rótulo, nunca o número.
- **Coluna com rolagem invisível**: a coluna de 480px tem `overflow-y: auto`; em teste headless a barra
  clássica não aparece. Desenhe o conteúdo curto o bastante para não provocar rolagem interna.
- **Texto que "passa no teste" e ninguém lê**: asserções de texto são cegas a oclusão e overflow — o
  estado só está desenhado quando a frase inteira aparece na imagem, nos dois temas, e nenhuma frase
  deste bloco pode virar placeholder (ele corta).

## Entregável

Pranchetas (tema **escuro primeiro**, claro em paridade, não como rascunho):

1. `390 · escuro` — repouso: peça com aviso + barra "Sem preço ainda" acima da TabBar.
2. `390 · claro` — o mesmo.
3. `390 · escuro` — variação com contagem + ponteiro para os avisos (pergunta 1).
4. `390 · escuro` — o "depois": mesmo espaço com Custo total R$ 1.234,56 + Varejo/Atacado, para
   comparar altura e posição.
5. `1280 · escuro` **e** `1280 · claro` — a coluna de 480px inteira no estado sem preço (resumo +
   Salvar em Orçamentos desabilitado + card Nome do kit/Salvar kit), resolvendo os 480px sem rollup.
6. `1920 · escuro` (desejável) — mesma coluna, lista larga.

Componha com os primitivos existentes, sem criar novos: `tf-card` (padding md) como contêiner —
o **mesmo** do total com preço; `tf-title` (ou h2 de 1.125rem) para "Total do kit"; Inter corpo para
"Sem preço ainda" e para a frase explicativa; `tf-badge--neutral` **apenas se** o dono aprovar uma
etiqueta de estado (nunca `--success`); `tf-brow` só se houver contagem em forma de linha; `tf-alert`
só se o ponteiro para os avisos virar aviso próprio; `tf-btn--ghost --sm` se houver ação de navegação
até a peça incompleta. **Zero `tf-price` nesta prancheta** — é exatamente o primitivo que não pode
aparecer sem número. `tf-grafismo`: no máximo um floreio, e provavelmente nenhum — a tela já tem a
lista de peças carregando a composição.

## Perguntas em aberto para o dono

1. Quando **todas** as peças estão fora do total, o bloco deve dizer quantas e apontar para os avisos?
   O texto `{n} peça(s) fora do total — confira os avisos nas peças acima.` já existe e hoje não aparece
   justamente nesse caso. Reaproveitar, escrever um específico ("nenhuma peça entrou no total ainda"),
   ou manter só a frase genérica?
2. O badge **"Ao vivo"** do artboard populado deve existir no produto? Se sim, o que ele diz neste
   estado — some, ou vira uma etiqueta neutra de espera?
3. O bloco deve **levar** o vendedor até a primeira peça incompleta (link/botão que rola e abre a peça)?
   Isso cria o primeiro alvo interativo dentro do resumo, com foco/hover/pressionado próprios.
4. No desktop, os ~400px que sobram na coluna de 480px enquanto não há preço: ficam vazios, ou o card de
   nome/Salvar kit sobe para ocupá-los (e desce quando o preço aparece)?
5. O `Salvar em Orçamentos` desabilitado deve explicar por quê enquanto não há preço, ou continua mudo?
