# Estado vazio (`tf-empty`) — a arte que virou ícone, e o vazio da busca

## O que desenhar
O bloco centrado que ocupa o lugar de uma lista quando não há nada para listar. É a **primeira tela** que o vendedor novo vê em Catálogo (Filamentos · Impressoras · Produtos · Kits), em Kits (o compositor sem peças), em Orçamentos e em Simulações — e reaparece, com outra voz, quando ele **busca e não acha**, quando a conta **não tem direito** ao recurso, e quando o painel de detalhe do desktop não tem item selecionado. Uma peça só, cinco papéis: boas-vindas, filtro vazio, porta fechada, painel sem seleção e página inexistente (404). Ela precisa parecer **intencional**, nunca um erro de carregamento.

## Por que este prompt existe
O kit de desenho pedia **arte** no vazio — o `Grafismo` do produto — e o código entregou um quadrado arredondado de 56px com fundo `--accent-soft` e um ícone de 28px dentro. A peça não tem slot de arte: só `icon`. O `Grafismo` perdeu as props de cor e tamanho que o kit usava e sobrou em **duas** telas do produto inteiro (404 e erro), sempre **fora** do bloco vazio, nunca dentro. Isso é divergência declarada, não omissão: o canvas do dono também desenha `tf-empty` na forma de ícone — mas naquele canvas há um único vazio, e ele não pertence a nenhuma das quatro abas. O que **ninguém desenhou nunca** é: o vazio da BUSCA sem resultado (existe só acima de 1280px no Catálogo), o `max-width: 28rem` centrado dentro de uma coluna de ~1720px a 1920px, e os vazios sem-permissão das quatro abas.

## O que já existe hoje (não invente do zero — corrija)
Anatomia atual (`shared/ui/empty-state.tsx` + `.css`): coluna centrada, `text-align:center`, gap `--space-3`, padding `--space-10` no eixo vertical e `--space-5` no horizontal, `max-width: 28rem`, `margin-inline: auto`. Dentro, nesta ordem: quadrado 56×56 (`--radius-lg`, fundo `--accent-soft`, cor `--accent-text`) com ícone de 28px → título `h2` em `--fs-lg` → descrição em `--fs-body-sm`/`--text-muted` → um slot de ação com `margin-top: --space-2`.

| Onde | Ícone | Título (literal) | Descrição (literal) | Ação |
|---|---|---|---|---|
| Catálogo · Filamentos | `package` | "Nenhum filamento salvo ainda" | "Salve seus filamentos uma vez e reutilize em cada cálculo." | "Adicionar filamento" (primário) |
| Catálogo · Impressoras | `package` | "Nenhuma impressora salva ainda" | "Salve os dados da sua impressora uma vez e reutilize em cada cálculo." | "Adicionar impressora" |
| Catálogo · Produtos | `package` | "Nenhum produto salvo ainda" | "Salve uma peça com seus custos e reabra com o preço sempre recalculado." | "Adicionar produto" |
| Catálogo · Kits | `package` | "Nenhum kit salvo ainda" | "Monte um kit com várias peças e reabra com o preço sempre recalculado." | "Montar kit" |
| Catálogo · busca vazia (**só ≥1280px**) | `package` | "Nada encontrado para essa busca" | "Tente outro termo, ou limpe a busca para ver tudo de novo." | "Limpar busca" (secundário sm) |
| Catálogo · sem direito | `crown` | "Salvar faz parte do Premium." | — nenhuma — | — nenhuma — |
| Kits (compositor vazio) | `package` | "Monte seu kit peça por peça" | "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro." | "Adicionar peça" (primário) + "Ver meus kits" (ghost) |
| Orçamentos · frio | `history` | "Nenhum registro ainda" | "Calcule uma peça ou um kit e toque em “Salvar em Orçamentos” para guardar o preço com a data." | "Ir para a calculadora" — **fora** da peça |
| Orçamentos · busca vazia | `history` | "Nenhum registro encontrado para “{termo}”." | — nenhuma — | "Limpar busca" — **fora** da peça |
| Simulações (dentro de um Sheet) | `boxes` | "Nenhuma simulação salva ainda" | "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." | "Voltar para a calculadora" |
| Simulações · busca vazia | `boxes` | "Nenhuma simulação encontrada para “{termo}”." | — nenhuma — | "Limpar busca" |
| 404 | `triangle-alert` | "Página não encontrada" | "O endereço que você abriu não existe." | "Voltar para Calcular" |

→ **Problemas a resolver no desenho:**
→ o vazio sem direito é uma **porta sem maçaneta**: título único, sem corpo, sem saída — e é o único título com ponto final, destoando de todos os outros;
→ três telas driblaram o slot único de ação pondo o botão **fora** do bloco, com espaçamento diferente do interno — a mesma peça se apresenta de dois jeitos;
→ os vazios de busca de Orçamentos e Simulações **não têm descrição**, enquanto o do Catálogo tem — mesmo papel, densidade diferente;
→ `max-width: 28rem` (≈448px) centrado: a 1920px a coluna de conteúdo tem ~1720px e o bloco fica uma ilha no meio do nada; dentro da coluna mestre a 1280px (≈560–600px, porque a ficha da direita é fixa em 560px) ele quase preenche — duas leituras opostas da mesma regra;
→ o `h2` do bloco compete com o `h2` da página e, dentro do Sheet de Simulações, com o título do próprio Sheet;
→ o **carregando** não é esta peça (é um spinner centrado com `py-8`) e o **erro** também não (é um alerta `danger` "Não foi possível carregar seu catálogo." + "Tentar novamente") — mas os três ocupam o mesmo retângulo em sequência, e o desenho precisa mostrá-los juntos para que a troca não pisque.

## Conteúdo e dados reais
- O **termo buscado** entra literal, entre aspas curvas: `Nenhum registro encontrado para “PLA preto 1,75”.` Ele é do vendedor: pode ter 80 caracteres colados sem espaço nenhum (um código de fornecedor). Já custou 4.948px de rolagem horizontal a 1440px num card vizinho.
- O contador que fica ao lado da busca no desktop lê "12 filamento(s)" / "3 kit(s)" / "5 peça(s)" — quando a busca não acha, ele mostra **0**, ao lado do bloco vazio: os dois números precisam concordar visualmente.
- Nenhum estado vazio mostra dinheiro. Se alguma prancheta precisar de um valor de contexto ao redor (um card da lista cheia, para comparação), use números verdadeiros do produto: `R$ 24,24`, `R$ 16,16`, `R$ 21,01`.
- `Grafismo` existe em quatro formas — `arco`, `espada`, `linha-curva`, `onda` —, é recolorido por `currentColor` e mede 120×40 por padrão (a altura é ajustável). Hoje só o 404 e a página de erro o usam.
- Ícones em uso hoje: `package`, `history`, `boxes`, `crown`, `triangle-alert`, `search`, `plus`.

## Estados obrigatórios
1. **Vazio frio (boas-vindas)** — a lista nunca teve nada. Título + descrição + ação primária. É o estado que mais precisa parecer convidativo, não quebrado.
2. **Vazio de busca** — existem itens salvos, o filtro é que não achou. Precisa dizer o termo e oferecer "Limpar busca" (secundário). **Nunca** pode dizer "Nenhum filamento salvo ainda" — seria mentira sobre os dados do vendedor.
3. **Sem permissão (Premium)** — "Salvar faz parte do Premium." com ícone `crown`. Calmo, sem preço e sem data; e precisa de uma saída (ver Perguntas).
4. **Painel de detalhe sem seleção** — o `aside` do desktop de Orçamentos mostra o mesmo bloco dentro de uma coluna estreita: desenhe a versão comprimida (sem descrição longa, sem ação).
5. **Carregando** — o que ocupa o retângulo antes dos dados (hoje um spinner centrado). Desenhe para que o vazio **não** apareça durante a busca.
6. **Erro de leitura** — alerta `danger` "Não foi possível carregar seu catálogo." + "Tentar novamente". Mostre lado a lado com o vazio: são coisas diferentes e hoje parecem parentes.
7. **Offline com lista vazia** — o alerta `info` "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." acima do bloco vazio, com a ação de criar desabilitada.
8. **Estados do botão dentro do bloco** — repouso, hover, foco visível, pressionado e desabilitado (offline / premium pausado).
9. **404 / erro de página** — a versão com arte de verdade (`Grafismo`), a única que tem hoje.

## Viewports
- **390px** — todas as telas têm vazio no mobile (menos o da busca do Catálogo, que não existe lá). É onde o padding `--space-10` + o quadrado de 56px definem se o bloco cabe acima da dobra.
- **1280px** — o corte do mestre-detalhe do Catálogo: a ficha da direita é fixa em 560px, então a coluna da lista fica com ~560–600px. É onde o vazio da busca vive e onde `28rem` quase preenche.
- **1920px** — a coluna de conteúdo tem ~1720px e a lista vira duas colunas acima de 1600px. É onde o bloco de 448px centrado fica perdido, e é o caso que precisa de decisão de largura.

## Regras que o desenho não pode quebrar
- **Vazio ≠ erro ≠ sem permissão.** Uma falha de rede nunca pode ser vendida como "vire Premium", e um bloqueio de plano nunca pode parecer falha técnica.
- **Freemium binário**: o vazio sem direito não faz oferta com preço, nem data, nem contagem regressiva. O teaser comercial é **outra peça** (`tf-premium-teaser`) e não deve ser redesenhada aqui.
- **O vazio de busca declara a busca**, com o termo à vista — e o termo aparece no corpo do texto, nunca dentro de um placeholder de campo (frase honesta cortada por placeholder já custou uma homologação neste projeto).
- **Nada estoura na horizontal.** Termo longo colado, título longo, nome de item longo: quebra ou trunca com reticências, e o desenho diz qual dos dois.
- **Alvo ≥44px** em qualquer botão do bloco, inclusive o "Limpar busca" que hoje é `sm`.
- **Contraste medido** do ícone (`--accent-text` sobre `--accent-soft`) e da descrição (`--text-muted`) contra o fundo real de cada tema — não contra o branco.
- **Hierarquia de título**: dentro de um Sheet ou de um painel lateral, o título do vazio não pode competir com o título do container.

## Armadilhas já pagas neste projeto
- Transbordo horizontal só é real quando **medido nos dois eixos** — o navegador headless não desenha barra clássica, e um scroll vertical indevido passou despercebido por isso.
- `toBeVisible`/`toContainText` passam em elemento **ocluso ou transbordado**: layout se verifica com caixas, e a única coisa que pega uma colisão é a imagem.
- Um nome de item sem espaço gerou 4.948px de rolagem a 1440px no card da lista — o vazio de busca ecoa exatamente esse texto.
- Frase honesta dentro de placeholder some quando o campo é estreito; placeholders carregam só números.
- Um bloco desenhado no mobile e esticado para o desktop vira ilha: a largura precisa ser desenhada no viewport largo, não herdada.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como cidadão de primeira classe** (ambos para cada prancheta):
1. **Anatomia** do `tf-empty`: com arte × com ícone, com e sem descrição, com uma e com duas ações, título curto e título longo, termo de busca de 80 caracteres sem espaço.
2. **Catálogo · Filamentos vazio** a 390 / 1280 / 1920 — mostrando o que acontece com a largura em cada um.
3. **Catálogo · busca sem resultado** dentro da coluna mestre a 1280 e 1920, com a barra de busca e o contador "0 filamento(s)" no mesmo quadro (nunca foi desenhado).
4. **Sem permissão (Premium)** nas quatro abas — e ao lado, na mesma prancheta, o **erro de leitura** e o **offline com lista vazia**, para provar que os três se distinguem à primeira vista.
5. **Painel de detalhe sem seleção** (coluna de 560px) + **Simulações dentro do Sheet**.
6. **404 com arte** (`Grafismo arco`), como referência de quanto floreio a peça suporta.

Reutilize os primitivos existentes: `tf-empty` com `tf-empty__icon`, `__title`, `__desc`, `__action`; `tf-btn--primary` para a ação de criar, `tf-btn--secondary` para "Limpar busca" e "Voltar para a calculadora", `tf-btn--ghost` para "Ver meus kits"; `tf-alert` (tom `info` para offline, `danger` para falha) como vizinho, nunca como substituto; `tf-inputwrap` + `tf-input` para a busca; `tf-card` para os itens de lista das pranchetas comparativas; `tf-grafismo` para a arte. Não crie primitivo novo — se a arte exigir um slot, ele é um slot **dentro** do `tf-empty`, no lugar do quadrado de 56px.

## Perguntas em aberto para o dono
1. **Arte ou ícone?** O kit pedia `Grafismo` nos vazios das abas; o código e o seu canvas mostram o quadrado com ícone. Vale arte no vazio **frio** e ícone nos demais (busca, sem-seleção), ou o ícone em todos?
2. **O vazio sem direito ganha saída?** Hoje "Salvar faz parte do Premium." não tem botão nenhum. Deve levar à oferta, à aba pública, ou continuar sem ação?
3. **Largura a 1920px**: o bloco continua centrado em ~448px na coluna de 1720px, ou ancora à esquerda / ocupa a coluna com a arte maior?
4. **O mobile ganha busca no Catálogo?** Hoje o vazio de busca só existe ≥1280px porque a busca só existe lá.
5. **Duas ações viram regra?** Kits já empilha primário + ghost, e Orçamentos põe o botão fora do bloco. A peça passa a aceitar oficialmente ação primária + secundária?
6. **Os vazios de busca de Orçamentos e Simulações ganham a segunda linha** ("Tente outro termo, ou limpe a busca para ver tudo de novo.") que o Catálogo já tem, ou o vazio de busca é deliberadamente mais seco?
