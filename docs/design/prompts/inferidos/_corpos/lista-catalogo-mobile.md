# Lista do Catálogo no celular — a linha do item, a contagem e o botão de adicionar

## O que desenhar

A lista do Catálogo como ela aparece no **celular**: dentro da aba `/catalogo`, logo abaixo de um controle
segmentado de quatro seções ("Filamentos", "Impressoras", "Produtos", "Kits"), vem uma faixa fina com a
contagem à esquerda e o botão de adicionar à direita, e abaixo dela a pilha de itens salvos. Cada item é uma
linha com o nome, um resumo, eventuais avisos, e de 2 a 3 botões de ícone. É a tela que o vendedor abre todo
dia no balcão para conferir, corrigir ou apagar um filamento, uma impressora, um produto ou um kit antes de
precificar. O mesmo bloco serve às quatro seções — só mudam os textos e o resumo —, então o desenho precisa
funcionar para os quatro conteúdos, não só para o mais bonito.

## Por que este prompt existe

Esta lista nunca foi desenhada: o ramo mobile do `catalog-panel.tsx` foi composto por inferência a partir de
requisito textual. Existe protótipo (`.design-import/ui_kits/precifica3d/CatalogScreen.jsx`), mas ele é
**parcial e diverge ponto a ponto** do que o produto virou: lá era **um** cartão único envolvendo todos os
itens com divisórias, `Avatar` de 36px como elemento inicial, **duas** linhas de texto (título + subtítulo),
**um** único botão de lápis ao final, e o "+" era um `IconButton` sólido na barra de título — **não existia
faixa de contagem em lugar nenhum**. O produto de hoje tem faixa de contagem, botão de texto, cartão por item
(sem divisórias), até **quatro** textos empilhados e até **três** alvos de toque por linha. A regra do
incremento 018 é "o mobile não se mexe", e por isso o desenho de 1920px não alcança este código — ele segue
sem autoria de design.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual, de cima para baixo (`catalog-panel.tsx`, ramo abaixo de 1280px):

| Elemento | Conteúdo real hoje | Observação |
| --- | --- | --- |
| Faixa | contagem à esquerda, botão à direita | "3 filamento(s)" · botão pequeno com "+" e o texto "Adicionar filamento" |
| Item (cartão) | área clicável ocupando toda a largura restante + botões de ícone | o cartão inteiro **não** é clicável; só a área de texto é |
| Linha 1 | nome do item, semibold | ex.: "PLA Azul" |
| Linha 2 | resumo, tipografia de legenda | ver "Conteúdo e dados reais" |
| Linha 3 (condicional) | "Vincule um filamento e uma impressora salvos" | só em Produtos, quando falta referência |
| Linha 4 (condicional) | "pode estar desatualizada" | quando os dados vieram do cache offline |
| Linha 5 (condicional) | "somente leitura" | quando o Premium está pausado |
| Ações | lápis (sempre) · copiar (**só em Kits**) · lixeira (sempre) | todos ícones de 18px sem rótulo visível |

→ **Problema 1 — quatro textos, uma tipografia só.** Resumo, aviso de referência faltando, aviso de dado
velho e aviso de somente-leitura usam *exatamente* o mesmo estilo (legenda, cor esmaecida). Não há hierarquia:
o dado ("PLA · R$ 89,90 / 1 kg") e o alerta ("Vincule um filamento e uma impressora salvos") têm o mesmo peso
visual, e no pior caso os três avisos coexistem na mesma linha de lista. O desenho precisa decidir o que é
dado, o que é aviso, e o que acontece quando três avisos aparecem juntos.

→ **Problema 2 — o resumo de impressora cola três grandezas numa frase só**: "R$ 2.400,00 · 4680 h · 0,12 kW".
Sem rótulo nenhum: o vendedor precisa adivinhar que 4680 h é vida útil e 0,12 kW é potência média. (O canvas de
desktop, quando desenha a impressora, **separa em duas linhas** — `0,12 kW · 4.680 h de vida útil` e, à parte,
`R$ 2.400,00`. O oposto de colar as três.) Note ainda que o "4680" sai **sem separador de milhar** aqui,
enquanto o valor em reais sai com — a mesma linha usa duas convenções numéricas.

→ **Problema 3 — três alvos de toque de 44px disputando espaço com o texto** numa tela de 390px. A área de
texto é `flex-1` com `min-w-0`: nomes longos são o que cede. Em Kits são três botões; nas outras seções, dois.

→ **Problema 4 — a faixa de contagem.** "3 filamento(s)" com parênteses é linguagem de programador, e o botão
de texto ao lado ("Adicionar impressora") é largo e compete com a contagem em telas estreitas.

## Conteúdo e dados reais

Resumos, por seção (todos são a segunda linha do item):

- **Filamentos** — `{material} · R$ {custo do rolo} / {peso} kg`. Exemplo real: **"PLA · R$ 89,90 / 1 kg"**.
  O material é opcional: sem ele a linha começa direto no dinheiro — "R$ 89,90 / 1 kg".
- **Impressoras** — `R$ {valor} · {vida útil} h · {potência} kW`. Exemplo real:
  **"R$ 2.400,00 · 4680 h · 0,12 kW"**. Faixas plausíveis: valor de R$ 800,00 a R$ 40.000,00; vida útil de
  algumas centenas a ~20.000 h; potência de 0,05 a 1,5 kW.
- **Produtos** — os **nomes das referências**: `{filamento} · {impressora}`, ex.: **"PLA Azul · Ender 3"**.
  Nunca um preço: um preço na linha implicaria valor congelado, e produto é sempre recalculado. Referência
  ausente vira a palavra **"manual"**; enquanto o cache irmão ainda carrega, vira **"carregando…"** (jamais
  "manual" — isso seria uma afirmação falsa sobre a origem do dado).
- **Kits** — a contagem de peças: **"4 peça(s)"**.

Contagens da faixa, literais: **"{n} filamento(s)"**, **"{n} impressora(s)"**, **"{n} produto(s)"**,
**"{n} kit(s)"**. Botões de adicionar, literais: **"Adicionar filamento"**, **"Adicionar impressora"**,
**"Adicionar produto"**, **"Montar kit"**. Rótulos assistivos das ações: "Editar", "Duplicar", "Excluir",
sempre seguidos do nome do item.

Nomes de item são livres e podem ser longos ("PLA Silk Azul Petróleo 1,75mm — lote 2") — desenhe com um nome
longo, não com "PLA".

## Estados obrigatórios

- **Carregando**: hoje é só um indicador de progresso centralizado, sem esqueleto de lista. O protótipo antigo
  previa três linhas esqueleto com círculo + duas barras; decida e desenhe.
- **Vazio (catálogo sem itens)**: ilustração, título "Nenhum filamento salvo ainda" e corpo "Salve seus
  filamentos uma vez e reutilize em cada cálculo.", com o botão de adicionar em largura cheia. Sem faixa de
  contagem.
- **Erro de carga**: alerta de perigo, "Não foi possível carregar seu catálogo." + botão "Tentar novamente".
- **Sem permissão (conta não ativa)**: estado vazio com ícone de coroa e a frase de entitlement do servidor —
  sem lista falsa, sem CRUD que não funciona.
- **Offline / dado velho**: acima da lista, alerta **informativo** (nunca perigo) com título "Modo leitura
  offline" e corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de
  conexão."; **e** em cada linha o texto "pode estar desatualizada". Desenhe a repetição — hoje a mesma
  verdade aparece uma vez no topo e N vezes na lista, e isso é ruído.
- **Premium pausado**: alerta informativo "Premium pausado" / "Seus itens continuam aqui e podem ser usados no
  cálculo. Para criar ou editar, reative o Premium."; **e** "somente leitura" em cada linha. O lápis e a
  lixeira continuam presentes e levam à tela de reativação — não são desabilitados nem escondidos.
- **Produto precisando de atenção**: "Vincule um filamento e uma impressora salvos" na linha, e o resumo
  mostrando "manual" em uma ou nas duas posições.
- **Linha em repouso, foco (teclado), toque/pressionado**: a área de texto e cada botão de ícone são alvos
  independentes — mostre os três focos distintos, porque hoje o cartão inteiro não é um alvo só.
- **Pior caso combinado**: item de Kits, offline, Premium pausado, nome longo — 4 textos + 3 botões. Desenhe
  essa prancheta; é o caso que decide o layout.

## Viewports

**Somente 390px.** Esta peça é o ramo mobile: acima de 1280px o produto troca para uma composição
mestre-detalhe que já foi desenhada no canvas do 018. A faixa entre 600 e 1279px também cai neste mesmo ramo,
então acrescente **uma prancheta de checagem a 768px** apenas para mostrar como a linha respira quando sobra
largura (o botão de texto e a contagem deixam de competir).

## Regras que o desenho não pode quebrar

- **Nenhum preço na linha de Produto.** O preço é sempre recalculado; um número ali seria uma promessa falsa.
- **Degradação é dita, não escondida**: "manual", "carregando…", "pode estar desatualizada" e "somente
  leitura" precisam continuar legíveis — nada de escondê-los atrás de reticências ou de um ícone mudo.
- **Falha de rede nunca vira "não é premium"**: offline é tom informativo; erro de carga é erro de carga.
- **Frase honesta fora de placeholder** e fora de elemento truncável: nunca coloque essas frases num campo que
  corta o texto.
- **Alvo de toque ≥ 44px** para cada botão de ícone, com espaçamento suficiente para que a lixeira não seja
  vizinha imediata do lápis por acidente.
- **Contraste medido contra o fundo real do cartão**, não contra o fundo da página — os textos esmaecidos de
  legenda são o ponto frágil.

## Armadilhas já pagas neste projeto

- **Estouro horizontal medido, não olhado**: aqui o texto é o elemento que cede, então um nome longo ou
  "R$ 2.400,00 · 4680 h · 0,12 kW" empurra a linha. Desenhe com valores grandes de verdade.
- **Texto ocluso passa em teste**: presente e invisível é o defeito que nenhuma asserção pega. Se um aviso for
  truncado por decisão de desenho, diga explicitamente qual e por quê.
- **A frase honesta cortada**: já aconteceu de uma frase de honestidade viver num elemento estreito e sair
  cortada — daí a regra acima.
- **Máscara de milhar inconsistente**: "4680 h" sem separador ao lado de "R$ 2.400,00" com separador é defeito
  já corrigido em outras telas.

## Entregável

Pranchetas a 390px, **tema escuro (padrão) e tema claro (first-class, não um afterthought)**:

1. Lista de Filamentos com 4 itens, um deles com nome longo.
2. Lista de Impressoras — a prancheta que resolve o resumo de três grandezas.
3. Lista de Produtos com um item em "precisa de atenção" e um com "manual · manual".
4. Lista de Kits (o caso de três botões).
5. Carregando · Vazio · Erro de carga · Sem permissão.
6. Offline e Premium pausado (o alerta do topo + os avisos na linha).
7. O pior caso combinado descrito acima.
8. Prancheta de checagem a 768px.

Reutilize os primitivos existentes, sem criar novos: cartão para o item (ou o cartão único com divisórias, se
o desenho voltar ao padrão do protótipo), botão de ícone fantasma para lápis/copiar/lixeira, botão pequeno com
ícone à esquerda para adicionar, alerta informativo/perigo no topo, estado vazio com ícone e ação, esqueleto
ou indicador de progresso no carregamento, e a tipografia de legenda no resumo. Se propuser hierarquia nova
entre resumo e aviso, componha-a com tokens existentes e diga qual token usou.

## Perguntas em aberto para o dono

1. **Volta ao cartão único com divisórias?** O protótipo desenhava um cartão envolvendo todos os itens; o
   produto usa um cartão por item. Mudar isso é decisão de produto (densidade da tela), não de implementação.
2. **A faixa de contagem fica?** Ela não existe em nenhum desenho. Se ficar, "3 filamento(s)" precisa de uma
   forma melhor ("3 filamentos" / "1 filamento"); se sair, o botão de adicionar vai para a barra de título
   como ícone sólido (como no protótipo) — e o botão perde o texto.
3. **Avatar/inicial no começo da linha?** O protótipo tinha um de 36px; a auditoria registra que iniciais de
   uma letra já foram apontadas como problema e nunca corrigidas. Entra, sai, ou vira ícone da seção?
4. **A linha inteira vira um alvo só?** Hoje só a área de texto abre o item, e os botões ficam de fora. Um
   toque na borda direita do texto não faz nada.
5. **Três avisos ao mesmo tempo: mostrar todos, ou eleger um?** Se eleger, qual vence — a referência faltando,
   o dado velho, ou o somente-leitura?
6. **O resumo da impressora deve nomear as grandezas** ("4.680 h de vida útil · 0,12 kW"), separar em duas
   linhas como o desktop, ou mostrar menos?
