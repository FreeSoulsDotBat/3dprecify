# Nada encontrado para essa busca — o vazio do FILTRO no Catálogo (desktop)

## O que desenhar
O bloco que ocupa a coluna da lista do Catálogo quando o vendedor digita algo no campo "Buscar no catálogo…" e nenhum item salvo casa com o termo. Ele vive na aba **Catálogo**, no layout mestre-detalhe de desktop (≥1280px): lista à esquerda, ficha do item selecionado à direita. É o mesmo bloco nas quatro seções da aba — Filamentos, Impressoras, Produtos e Kits. Quem o vê é um vendedor que TEM catálogo salvo e errou o termo, abreviou, ou está procurando algo que ainda não cadastrou. O momento é sempre de fricção: ele digitou e a tela esvaziou.

## Por que este prompt existe
Este estado nunca foi desenhado. Não existe busca no protótipo de 2026-07-02 (`CatalogScreen.jsx` só tem o `EmptyState` de catálogo vazio, e a matriz de estados §G traz uma única coluna `empty` para "Catálogo lista"), a auditoria discute os empties de Catálogo e Histórico sem uma palavra sobre busca, e o canvas do 018 desenha o CAMPO de busca mas nenhuma prancheta do resultado zero — nem poderia, porque o `<script>` do canvas não implementa filtro nenhum. Autoridade de desenho: **NENHUMA**.
O que a IA decidiu sozinha: substituir a lista inteira por um bloco centralizado, reaproveitar o **mesmo ícone `package`** do vazio de catálogo, e a copy. O próprio código admite o buraco num comentário ("O vazio da BUSCA não é o vazio do catálogo… Dizer 'nenhum filamento salvo' seria mentira sobre os dados do vendedor") e resolve isso **só por texto**: graficamente os dois blocos são idênticos. É o pior mal-entendido possível — o vendedor que digitou errado vê exatamente a mesma imagem de "não tenho nada salvo".

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/catalog/catalog-panel.tsx` (ramo `isWide`) + `catalog-master-detail.css` + `shared/i18n/messages.pt-br.ts`.

A coluna da esquerda tem uma **barra de ferramentas** que permanece visível durante o vazio, e abaixo dela o bloco vazio:

| Elemento | Conteúdo literal hoje | Observação |
|---|---|---|
| Campo de busca | placeholder `"Buscar no catálogo…"`, rótulo acessível `"Buscar no catálogo"`, ícone `search` à esquerda | `flex:1`, largura máxima 420px |
| Contagem | `"0 filamento(s)"` / `"0 impressora(s)"` / `"0 produto(s)"` / `"0 kit(s)"` | → **problema**: com filtro ativo o número é o dos VISÍVEIS. "0 filamento(s)" ao lado de uma frase que diz "você tem itens" é a contradição do bloco inteiro na mesma linha |
| Botão de ação | `"Adicionar filamento"` / `"Adicionar impressora"` / `"Adicionar produto"` / `"Montar kit"` com ícone `plus` | continua ativo e é a saída errada para quem só errou o termo |
| Ícone do vazio | `package`, 56×56, fundo `accent-soft`, raio `lg` | → **problema**: é literalmente o mesmo do vazio de catálogo |
| Título | `"Nada encontrado para essa busca"` | homologado, mantenha |
| Corpo | `"Tente outro termo, ou limpe a busca para ver tudo de novo."` | homologado, mantenha |
| Ação | botão secundário `"Limpar busca"` | → **problema**: não repete o termo buscado; o vendedor não vê o que a máquina entendeu |

→ **Problema de layout, o mais grave**: a ficha da direita some junto (não há item selecionado), mas a grade continua `minmax(0,1fr) 560px`. A 1280px sobra uma coluna de lista de ~420px com um bloco centralizado de até 448px, e **560px de vazio absoluto ao lado**. Metade da tela fica em branco no exato momento em que o produto precisa parecer inteiro.

Para comparação, o vazio LEGÍTIMO de catálogo (que este NÃO pode parecer) usa: mesmo ícone `package`, título `"Nenhum filamento salvo ainda"` e corpo `"Salve seus filamentos uma vez e reutilize em cada cálculo."` com o botão primário de adicionar.

## Conteúdo e dados reais
- A busca **filtra a lista já carregada** — nenhuma requisição nova. Nunca há spinner nem erro de rede causado por digitar. O casamento é substring simples, sem acento-insensibilidade, sobre nome + resumo da linha (ex.: filamento `"PLA Preto 1,75mm"` + resumo `"R$ 129,90 · 1000 g"`).
- Termos reais que produzem zero: `"pl a"`, `"nylon"`, `"petg"` sem PETG salvo, um SKU colado inteiro.
- A contagem tem plural preguiçoso de propósito: `"3 filamento(s)"`. Não é erro de digitação e não é para ser "corrigido" no desenho — é o padrão da casa.
- O termo digitado é o único dado dinâmico disponível para o bloco. Ele pode ser longo (o vendedor cola um código de 60+ caracteres sem espaço).
- Não há sugestão, correção ortográfica, histórico de busca nem "você quis dizer" — nada disso existe no produto.

## Estados obrigatórios
1. **Repouso** — o bloco com termo sem resultado, sobre uma lista que tem itens salvos.
2. **Termo longo** — o mesmo bloco com um código de ~60 caracteres sem espaço; ele precisa quebrar (`overflow-wrap: anywhere`) e não pode empurrar a coluna.
3. **"Limpar busca": repouso, hover, foco visível por teclado, pressionado** — é um `tf-button` secundário `sm`; o mínimo de alvo do DS é 44px de altura (a base impõe `min-height: 44px` mesmo no tamanho `sm`) e o desenho não pode descer disso.
4. **Campo de busca em foco enquanto o vazio está na tela** — o cursor normalmente continua no campo; o anel de foco tem de conviver com o bloco vazio logo abaixo.
5. **Offline (leitura degradada)** — acima do bloco já renderiza um alerta de tom `info` com `"Modo leitura offline"` / `"Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."`. Desenhe os dois juntos: alerta + vazio de busca.
6. **Premium pausado** — acima do bloco renderiza o alerta `info` `"Premium pausado"`; as linhas trazem a legenda `"somente leitura"`. Desenhe alerta + vazio de busca coexistindo.
7. **Vazio de catálogo (referência de contraste, na mesma prancheta)** — `"Nenhum filamento salvo ainda"`. Precisa estar lado a lado com o vazio de busca para o desenho PROVAR que os dois não se confundem.

Não desenhe: carregando, erro de carga, sem permissão. Nenhum deles alcança este bloco — a busca só existe depois que a lista carregou com itens.

## Viewports
- **Desktop 1280px** — o corte onde o mestre-detalhe nasce e onde o buraco de 560px ao lado é mais brutal. Prancheta obrigatória.
- **Desktop 1920px** — acima de 1600px a lista vira duas colunas; o vazio de busca precisa dizer o que faz com a largura dobrada (ocupar as duas? centralizar em uma?). Prancheta obrigatória.
- **Mobile 390px — NÃO desenhar.** O campo de busca só existe dentro do ramo desktop do componente; abaixo de 1280px a lista é a lista simples de sempre, sem filtro, e este estado é inalcançável. Se o desenho sugerir busca no mobile, ele está propondo produto novo, e isso é decisão do dono.

## Regras que o desenho não pode quebrar
- **A frase honesta não pode virar a única diferença.** Título e corpo já dizem a verdade; o desenho tem de dizer a mesma verdade em forma — outro ícone (o DS tem `search`, além de `package`, `x`, `info`), outra densidade, outra moldura, ou o bloco ancorado ao campo em vez de centralizado no palco. Escolha e justifique.
- **Nunca afirmar que o catálogo está vazio.** Nem por texto, nem por número, nem por imagem. A contagem "0 filamento(s)" na barra é hoje uma afirmação falsa sobre os dados do vendedor — resolva (ex.: `"0 de 12 filamento(s)"`, ou a contagem some enquanto há filtro).
- **Zero resultado não é erro.** Tom neutro/informativo: nada de vermelho, nada de ícone de alerta, nada de linguagem de falha.
- **Falha de rede nunca se disfarça de vazio** — e vice-versa: o alerta offline é `info` e vive ACIMA, separado, nunca fundido ao bloco.
- **A saída barata primeiro.** "Limpar busca" é a ação certa para quem errou o termo; "Adicionar filamento" é a ação certa para quem realmente não tem o item. As duas coexistem na tela — a hierarquia visual tem de deixar claro qual é qual.
- Contraste medido contra o fundo real do card/palco, nos dois temas; alvo ≥44px.

## Armadilhas já pagas neste projeto
- **Nome do vendedor sem espaço já gerou 4.948px de rolagem horizontal a 1440px** (homologação CF-015-UI-02). O termo buscado é do mesmo tipo de dado: se ele aparecer no bloco, quebra ou trunca — nunca empurra.
- **Contagem mentirosa é invisível em teste**: no 014, um contador dizia "8 encontrados" com 31 casando, e nenhuma asserção pegou — só o screenshot. A contagem desta barra é exatamente a mesma classe.
- **Texto ocluso passa em `toBeVisible`**: o desenho tem de ser assertável por CAIXA (posição e tamanho), não por presença de string.
- **Frase honesta fora de placeholder** (lição do 016/PR-F): a explicação do vazio nunca pode viver só dentro do campo de busca, que corta o texto.
- **A ficha à direita é `sticky` e rola por dentro**; se o vazio for desenhado como um bloco que atravessa as duas colunas, ele quebra essa mecânica. Diga explicitamente se o bloco ocupa só a coluna da lista ou o palco inteiro.

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro (first-class)**:
1. `1280 · Filamentos · vazio de busca` — barra de ferramentas + bloco + o tratamento proposto para os 560px órfãos da direita.
2. `1280 · comparação lado a lado` — vazio de busca vs. vazio de catálogo, para provar a distinção visual.
3. `1920 · vazio de busca` — com a lista de duas colunas ao fundo indicada.
4. `1280 · vazio de busca + alerta offline` e `1280 · vazio de busca + Premium pausado`.
5. `Estados do botão "Limpar busca"` — repouso/hover/foco/pressionado, e o campo de busca em foco.

Reutilize os primitivos existentes, sem criar novos: o campo é o `tf-input` dentro do `tf-inputwrap` com o ícone `search`; a contagem é a legenda em `--fs-caption` / `--text-muted`; o botão de adicionar é o `tf-button` primário `sm` com ícone `plus`; "Limpar busca" é o `tf-button` secundário `sm`; os alertas offline e Premium pausado são o `tf-alert` de tom `info`; o bloco vazio é o `tf-empty` (ícone 56×56 em `accent-soft`, título `--fs-lg`, corpo `--fs-body-sm` em `--text-muted`, ação abaixo). Se a distinção visual exigir alterar o `tf-empty`, proponha a variação COMO variação do primitivo (ex.: uma modificação de alinhamento/ícone), não como um componente novo.

## Perguntas em aberto para o dono
1. A contagem com filtro ativo deve mostrar **"0 de 12 filamento(s)"** (o total continua visível, e a mentira morre), **sumir** enquanto há busca, ou continuar como está? Muda a barra inteira.
2. Quando a busca não acha nada, o botão **"Adicionar filamento"** deveria virar um atalho contextual (**"Adicionar 'petg'"**, já com o termo no nome do novo item) ou permanecer genérico? É uma funcionalidade nova, não um ajuste de desenho.
3. A busca deve ignorar acentos e maiúsculas (`"pla"` acha `"PLA Prêto"`)? Hoje ignora só maiúsculas — metade dos zeros que este bloco vai mostrar podem ser desta causa, e isso muda quanto o desenho precisa se esforçar.
