# O estado "precisa de atenção" de um produto (cartão, ficha e editor)

## O que desenhar
A forma visual de um único fato do Catálogo: **este produto salvo não tem um filamento e/ou uma impressora salvos por trás dele** — ou nasceu assim (foi materializado pela gravação de um kit), ou o item de catálogo que ele referenciava foi excluído. O vendedor encontra esse estado em três momentos da mesma jornada: (1) varrendo a lista da aba **Produtos** do Catálogo, quando decide em qual peça tocar; (2) na **ficha da direita** do mestre-detalhe desktop, depois de selecionar a peça; (3) dentro do **editor de página cheia do produto**, onde ele vai de fato religar as referências. Desenhe as três, mais o estado transitório em que as referências ainda estão sendo resolvidas. É o aviso que decide se o vendedor confia ou não num preço calculado sobre valores órfãos.

## Por que este prompt existe
A auditoria classificou esta peça como `PROTOTIPO_PARCIAL`: o canvas de 018 (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) **já resolveu bem duas superfícies** — no cartão da lista, um `tf-badge` com `tone: "danger"` e o texto `"precisa de atenção"`; na ficha, um `tf-alert--info` com a frase "Vincule um filamento e uma impressora salvos"; e o resumo da linha reduzido a `meta: "manual"`. Duas superfícies, dois papéis, uma copy. O que nunca foi desenhado, e por isso está aqui: (a) o placeholder **"carregando…"** que o código inventa enquanto os caches de filamento/impressora respondem — é indistinguível de um defeito; (b) a versão do alerta dentro do **editor de página cheia**, que ganhou um corpo próprio sem autoridade nenhuma; (c) a degradação real no produto hoje.
**E o código CONTRARIA o desenho, com todas as letras:** o badge `danger` do canvas nunca foi construído. Na lista (mobile e desktop) o estado sai como **mais uma legenda cinza empilhada** abaixo das outras, no mesmo tamanho e na mesma cor de todo o resto.

## O que já existe hoje (não invente do zero — corrija)

**Cartão / linha da lista de Produtos** (`features/catalog/catalog-panel.tsx`, `features/catalog/products-panel.tsx`) — o que se empilha hoje, tudo em coluna, dentro de um `tf-card`:

| ordem | conteúdo | como é hoje |
|---|---|---|
| 1 | nome do produto — "Base hexagonal" | forte, `--text-strong` |
| 2 | resumo das referências — "PLA Branco · Ender 3" | legenda `--text-muted` |
| 3 | o aviso — "Vincule um filamento e uma impressora salvos" | → **legenda cinza igual à de cima**, quando o desenho manda badge `danger` |
| 4 | "pode estar desatualizada" (cache antigo) | legenda cinza |
| 5 | "somente leitura" (Premium pausado) | legenda cinza |

→ Nos piores casos são **quatro linhas cinzas idênticas** competindo pelo mesmo peso visual; o único aviso acionável some no meio.
→ O resumo da linha, quando degrada, vira literalmente **"manual · manual"** (ou "PLA Branco · manual"). Não há rótulo dizendo qual é filamento e qual é impressora — a ordem é fixa (filamento · impressora) mas invisível para quem lê.
→ Enquanto os caches irmãos carregam, o mesmo resumo vira **"carregando… · carregando…"**. É honesto na intenção (não afirmar "manual" sem saber) e ruim na forma: parece a interface travada. Precisa de uma forma própria de *ainda não sei*, não de uma palavra.

**Ficha da direita, desktop** (`catalog-panel.tsx`, ficha de produto/kit): kicker "Produto salvo", título com o nome, ações Duplicar/Excluir, e — logo abaixo do cabeçalho — o alerta `tf-alert` com tom **info** e a frase "Vincule um filamento e uma impressora salvos" (sem corpo). Depois, o resumo repetido ("manual · manual") e o botão secundário "Abrir para editar". Para produto e kit a ficha **só resume**, não edita (decisão do dono, clarify 2026-08-10).

**Editor de página cheia do produto** (`pages/catalogo/produto-page.tsx`, ~linhas 278-284): o mesmo alerta, tom **info**, título "Vincule um filamento e uma impressora salvos" e corpo **"Os valores atuais foram mantidos e continuam editáveis."**, colocado logo abaixo do `PageHeader` e acima do cartão de nome/salvar. Mais abaixo, os dois seletores de referência, cujo item vazio aparece como **"— Manual —"** quando o produto já estava manual.
→ O corpo existe só aqui. Ou ele é bom em todo lugar, ou não é bom em nenhum: a mesma verdade contada em duas extensões diferentes conforme a tela.

## Conteúdo e dados reais
- Frase única do estado (homologada, **não reescreva**): **"Vincule um filamento e uma impressora salvos"**.
- Corpo hoje exclusivo do editor: **"Os valores atuais foram mantidos e continuam editáveis."**
- Texto do badge, definido no canvas: **"precisa de atenção"**, minúsculas, tom `danger`.
- Resumo degradado: **"manual"** por referência ausente, unidas por " · ".
- Placeholder de resolução: **"carregando…"**.
- Vizinhos: "pode estar desatualizada" · "somente leitura" · "Premium pausado" (título de alerta info, no editor).
- Ações próximas: "Abrir para editar" (ficha), "Salvar produto", "Duplicar", "Excluir".
- Regra que dispara o estado: **falta o filamento OU falta a impressora** — não precisa faltar os dois. Some no instante em que os dois estiverem ligados.
- Números verdadeiros para as pranchetas (do canvas e do seed): produto "Base hexagonal" — Gramas usadas **26 g**, Tempo de impressão **1,75 h**, Taxa de falha **10 %**, custo **R$ 12,10**; e um produto saudável ao lado, "Vaso G", preço sugerido **R$ 24,24**. Use pelo menos um nome longo de verdade ("Suporte de celular articulado com base pesada") para provar que nome + badge convivem sem estourar.
- O que o estado **não** mostra: preço na linha da lista. Uma linha de lista nunca exibe preço (implicaria um valor congelado que não existe).

## Estados obrigatórios
1. **Repouso, produto saudável** — sem badge, resumo com os dois nomes reais ("PLA Branco · Ender 3").
2. **Precisa de atenção, os dois faltando** — badge `danger` "precisa de atenção" + resumo "manual · manual".
3. **Precisa de atenção, só um faltando** — badge igual, resumo "PLA Branco · manual". Mostre como o desenho deixa claro **qual** dos dois falta.
4. **Resolvendo referências (carregando)** — o estado que hoje escreve "carregando…". Desenhe a forma neutra: nem "manual", nem badge de atenção, nem cara de erro. O badge só pode aparecer depois que a resposta chegou.
5. **Hover / foco por teclado / pressionado** no cartão inteiro (o cartão é um botão): foco visível com anel, sem depender de cor sozinha.
6. **Atenção + cache antigo** — badge + "pode estar desatualizada" convivendo, com hierarquia decidida.
7. **Atenção + Premium pausado** — badge + "somente leitura" no cartão; no editor, o alerta de atenção acima do alerta info "Premium pausado". Diga qual vem primeiro e por quê.
8. **Ficha da direita (desktop) com atenção** — `tf-alert--info` sob o cabeçalho, com a frase; e o mesmo produto sem atenção, para comparação.
9. **Editor de página cheia com atenção** — alerta no topo, e o par de seletores mostrando "— Manual —".
10. **Estado resolvido ao vivo** — o momento imediatamente após ligar as duas referências: o aviso sai. Desenhe o "depois" para provar que o estado é derivado, não um carimbo.

## Viewports
- **Mobile 390px** — obrigatório: a lista de Produtos e o editor de página cheia são a jornada principal do vendedor. É onde as legendas empilhadas mais machucam e onde o badge tem menos largura para conviver com um nome longo.
- **Desktop 1280px** — obrigatório: é o corte do mestre-detalhe (lista em duas colunas de cartões + ficha de 560px). O cartão fica estreito de novo: badge e nome disputam a mesma linha.
- **Desktop 1920px** — desejável, uma prancheta: mostrar que o badge não fica órfão numa linha larga demais.

## Regras que o desenho não pode quebrar
- **Não vender falha de rede como estado do dado.** "carregando…" e "precisa de atenção" são coisas diferentes; e "pode estar desatualizada" (cache) não é atenção.
- **Procedência antes de afirmação.** Só se pode escrever "manual" depois de saber que a referência não existe. A forma de carregamento não pode ser confundível com o resultado.
- **A degradação é dita, nunca escondida.** O produto continua calculando com os valores que tem; o aviso explica, não bloqueia.
- **Uma verdade, uma copy.** A mesma situação não pode ter frase curta numa tela e frase longa em outra sem motivo declarado.
- **Frase honesta nunca dentro de placeholder** — "— Manual —" é rótulo de opção, e o aviso precisa existir fora dele.
- **Alvo tocável ≥ 44px** no cartão e nos botões; o badge não é alvo.
- **Contraste medido contra o fundo real** do cartão nos dois temas — o tom `danger` sobre `surface-card` no tema claro é o caso a verificar.
- **Premium pausado não é punição**: leitura completa, tom calmo, escrita interceptada no toque e não no "Salvar".

## Armadilhas já pagas neste projeto
- **Legendas empilhadas do mesmo peso**: já aconteceu neste mesmo cartão — o aviso vira ruído. O badge existe justamente para quebrar isso.
- **Overflow horizontal medido**: nome longo + badge na mesma linha estourou coluna em 016; meça a caixa, não confie em "o texto aparece".
- **Texto ocluso passa em teste**: um elemento visualmente coberto ainda satisfaz asserção de conteúdo. O desenho tem que provar a hierarquia com geometria, não com presença.
- **Placeholder que corta a frase**: em 016 a frase honesta ficou dentro de um campo estreito e foi clipada. Frases honestas moram em elementos de largura cheia; placeholders carregam só números/nomes.
- **Máscara/valor grande estoura a coluna**: use "R$ 1.234,56" em pelo menos um cartão de comparação.

## Entregável
Pranchetas: (1) lista de Produtos em **390px** com quatro cartões — saudável, atenção total, atenção parcial, resolvendo; (2) a mesma lista em **1280px** no mestre-detalhe, com a ficha da direita aberta no produto em atenção; (3) o **editor de página cheia** em 390px e 1280px com o alerta e os dois seletores; (4) a variação "atenção + cache antigo + Premium pausado" no cartão; (5) o "depois" do estado resolvido. Cada prancheta em **tema escuro (padrão) e tema claro (first-class)**.
Reutilize os primitivos existentes, sem criar novos: `tf-card` / `tf-card--interactive` para o cartão-botão da lista; `tf-badge` com a variante **`tf-badge--danger`** (ela já existe no DS, ao lado de `neutral`, `info`, `success`) para "precisa de atenção"; `tf-alert` / `tf-alert--info` com `tf-alert__icon` + `tf-alert__title` para a ficha e o editor; `tf-field` + `tf-inputwrap` + `tf-select` para os dois seletores de referência; `tf-btn--secondary` para "Abrir para editar" e `tf-btn--primary` para "Salvar produto"; `tf-tnum` em qualquer número. Se o estado de carregamento pedir uma forma nova (skeleton de linha, por exemplo), proponha-a como variação de `tf-card`, não como componente novo.

## Perguntas em aberto para o dono
1. Quando falta **só um** dos dois (só a impressora, por exemplo), a frase continua sendo "Vincule um filamento e uma impressora salvos"? Ela pede duas coisas quando só uma está faltando. Manter uma frase única (mesmo remédio declarado) ou desenhar uma segunda variação nomeando o que falta?
2. O corpo "Os valores atuais foram mantidos e continuam editáveis." deve aparecer também na **ficha do desktop**, ou o alerta curto da ficha é intencional porque a ficha só resume e a edição acontece no editor?
3. O badge `danger` "precisa de atenção" fica lado a lado com "somente leitura" (Premium pausado) — dois selos no mesmo cartão, ou um deles vence e some?
4. O estado de resolução deve mostrar **skeleton** (forma sem texto) ou uma palavra neutra? Trocar "carregando…" por forma resolve o "parece defeito", mas muda o que um leitor de tela anuncia.
