# Estados da lista "Minhas simulações": carregando · erro frio · cache offline · paginação

## O que desenhar

O **corpo** do painel "Minhas simulações" nos momentos em que ele **não** está mostrando a lista pronta. O
painel é um sheet ancorado à direita (`tf-dialog--sheet-right`, `min(92vw, 26rem)` — no máximo **416px,
inclusive em 1920px**), aberto pelo cabeçalho da aba **Calcular**; dentro dele vivem, em ordem: título, a
linha de descrição, o campo de busca, eventuais avisos, os cartões e o botão de paginação. Quem usa é o
vendedor Premium que salvou estratégias de canal e quer reabrir uma — na feira, no celular, com rede ruim.
Esta peça é o que ele vê **antes** de a lista existir: primeira leitura, falha total, cópia local do
aparelho, e o fim de uma lista longa.

## Por que este prompt existe

Os quatro estados foram montados com primitivas cruas, sem desenho: carregando é um `Spinner` solto com
`py-8` e **nenhuma palavra**; erro frio é um `Alert tone="danger"` com um botão `secondary` embaixo; o
cache offline é um `Alert tone="info"` com um "Tentar novamente" **dentro** do alerta; a paginação é um
botão `secondary` de largura cheia dizendo só "Carregar mais". O verificador adversarial confirmou: os
**padrões** existem no protótipo de 2026-07-02, mas sempre para **outras** listas (esqueleto de linhas em
`CatalogScreen.jsx`; "Tentar novamente" homologado para Catálogo e Histórico; "Carregar mais" desenhado no
canvas de Orçamentos como `tf-btn--ghost tf-btn--sm` centralizado) — e o construído **diverge de todos
eles**. O estado "cache offline / leitura local" desta lista **não está desenhado em lugar nenhum**: a
matriz §G do protótipo tem coluna offline para Login, Calcular, Catálogo, Histórico, Exportar e Conta, e
nenhuma linha para simulações.

→ Correção de fato: **não existe primitivo `Skeleton` no DS de hoje** (`shared/ui` não tem nenhum;
`catalog-panel.tsx` também cai no `Spinner`). Pedir esqueleto é **propor um primitivo novo** — diga isso.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/scenarios/scenarios-list-sheet.tsx`, `entities/scenario/use-scenarios.ts`,
textos em `shared/i18n/messages.pt-br.ts` (`messages.scenarios`).

| Estado (nome real no código) | Quando acontece | O que é mostrado hoje |
| --- | --- | --- |
| `isLoading` | primeira leitura em voo **e nada em cache** | só `<Spinner/>` centralizado, `py-8`. Sem texto, sem esqueleto, e **o campo de busca some da tela** |
| `isError` | o servidor recusou **e não há nada em cache** (falha fria) | `Alert tone="danger"` "Não foi possível carregar suas simulações." + `Button secondary` "Tentar novamente" abaixo. Sem busca, sem título |
| `stale` | uma leitura falhou **mas há cópia local** | `Alert tone="info"` título "Modo leitura offline", corpo "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + `Button secondary size=sm` "Tentar novamente" embutido no alerta |
| `lapsed` | Premium pausado, lista carregada | `Alert tone="info"` "Premium pausado" / "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." |
| `hasMore` | há mais páginas (keyset, sem cap) | `Button variant="secondary"` largura cheia, "Carregar mais"; vira spinner interno enquanto busca a página |
| vazio | nenhuma simulação salva | `EmptyState` ícone `boxes`, "Nenhuma simulação salva ainda", corpo "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." + "Voltar para a calculadora" |
| vazio de busca | busca sem resultado | `EmptyState` ícone `boxes`, "Nenhuma simulação encontrada para “{termo}”." + "Limpar busca" |

Problemas que o desenho precisa resolver (marcados no que li):

→ **O carregando não diz nada** (um spinner mudo não distingue "estou buscando" de "travou") **e engole o
campo de busca**: a busca só existe no caminho final e toda busca filtrada ignora o cache, então a cada
termo digitado o corpo cai para o spinner e o campo **desmonta e volta**. A busca tem de ser moldura
permanente do corpo, nunca conteúdo do estado "pronto".
→ **"Tentar novamente" some ao ser tocado no erro frio** (o clique devolve o corpo ao spinner mudo: o erro
desaparece e nada afirma "estou tentando") e **não dá retorno nenhum dentro do alerta offline** (a lista já
tem dados, nada muda em voo nem numa segunda falha — lê-se como botão morto).
→ **Erro frio e cache offline não têm hierarquia visual**: duas caixas do mesmo formato; a diferença ("não
tenho nada" × "tenho uma cópia local") só existe na cor e no texto. E **"Premium pausado" usa o mesmo
`tone="info"` do offline** — pior, só aparece quando **não** está stale, então offline+pausado some.
→ **Até três blocos empilham acima do primeiro cartão** (busca + aviso offline/pausado + erro de
duplicação): num sheet de 416px, a lista some abaixo da dobra.
→ **A paginação é muda** sobre quantidade e sobre fim: nunca diz quantas faltam e, no fim, o botão só some.
→ **O motivo do bloqueio de escrita se repete em cada cartão** ("Esta ação precisa de conexão." / "Premium
pausado — reative para renomear, duplicar, editar ou excluir."): com 12 cartões, 12 vezes a mesma frase.

## Conteúdo e dados reais

O cartão **não mostra preço** — e isso é regra, não esquecimento: o preço só existe depois do recálculo com
os preços de hoje, então exibi-lo na lista seria uma alegação sem data. O cartão carrega:

- **Nome** — obrigatório, até 120 caracteres, uma linha com reticências. Ex.: `Vaso espiral 15 cm — Shopee × ML`.
- **Nota** — opcional, até 500 caracteres, 2 linhas com reticências explícitas; `overflow-wrap: anywhere`
  para que um token de 500 caracteres **sem espaço** ainda corte com "…". Ex.: `Frete grátis acima de R$ 79; margem apertada`.
- **Tempo relativo** — "Atualizado há 2 dias" (`agora mesmo` · `há 7 min` · `há 3 h` · `há 3 semanas`).
- **Três ações**: ícones `pencil`, `copy`, `trash-2` (18px) alinhados à direita.
- Descrição fixa do painel: "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre."
- Busca: placeholder "Buscar por nome…" (também é o `aria-label` — não há rótulo visível).
- Volume plausível: de 1 a algumas dezenas; a paginação é keyset, **sem teto**, e o contrato devolve só o
  cursor da próxima página — **não devolve total**.

## Estados obrigatórios

1. **Carregando frio** (primeira leitura, nada em cache) — esqueleto coerente com o cartão real (nome,
   nota de duas linhas, linha de tempo, três alvos à direita), 3 repetições, **com a busca já visível e
   desabilitada**, e uma frase de espera curta. Nunca um spinner mudo.
2. **Erro frio** — "Não foi possível carregar suas simulações." + "Tentar novamente"; nada de lista nem de
   cartões fantasmas, e a causa é desconhecida (**não diga "sem internet"**). Mais a variante **tentando de
   novo**: botão carregando, mensagem de erro **ainda visível**.
3. **Cache offline (stale)** — "Modo leitura offline" + "Suas simulações continuam aqui e podem ser
   abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + "Tentar novamente"; a lista
   aparece normalmente abaixo, com as escritas desabilitadas.
4. **Premium pausado** — "Premium pausado" / "Suas simulações continuam aqui e podem ser abertas e
   recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." **Visualmente distinto**
   do aviso offline.
5. **Offline + pausado ao mesmo tempo** — desenhe a composição; hoje o código esconde um dos dois.
6. **Carregando mais** (`isFetchingMore`, a lista intacta, só o rodapé muda) e **fim da lista paginada**.
7. **Vazio** e **vazio de busca** — os dois `EmptyState` já citados, com os textos literais.
8. **Ações desabilitadas** (offline/pausado) — os três ícones desabilitados, motivo dito **uma vez**.
9. **Foco, hover e pressionado** do cartão (ele inteiro é um botão), dos três ícones e do botão de
   paginação — anel visível sobre o cartão, alvo ≥44px mesmo com ícone de 18px.

## Viewports

- **390px (mobile)** — obrigatório: o sheet ocupa 92vw (≈359px) e é onde o vendedor lê a lista com rede ruim; mostre a rolagem (o aviso de offline sai da viewport quando ele desce até "Carregar mais").
- **1280px (desktop)** — obrigatório: o sheet continua com **416px fixos**, ancorado à direita, sobre a
  página Calcular escurecida pelo scrim. **O desktop não ganha largura nenhuma** — a coluna útil é a mesma
  do celular. 1920px é opcional: a peça não muda (se ela deve virar mestre-detalhe, é pergunta ao dono).

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como falta de permissão.** Nenhum destes estados pode escorregar para
  "assine o Premium"; o teaser é outra peça e só existe para conta grátis/deslogada.
- **Degradação dita, nunca escondida**: se o que está na tela veio do aparelho e não do servidor, isso é
  declarado em texto de largura cheia, **nunca dentro de um placeholder** e nunca cortado.
- **O erro frio não inventa causa** ("Não foi possível carregar" é o teto do que se sabe); **o cartão não
  traz data absoluta**, só o tempo relativo.
- **O sucesso só aparece depois do sucesso real**: nenhuma marca de "atualizado" pode vir do clique em
  "Tentar novamente" — só do retorno. **Alvos ≥44×44px** nos três ícones e no botão de paginação, com
  **contraste medido contra a superfície real do sheet** (`--surface-card` sobre o scrim).
- **Escuro é o padrão; claro é first-class** — info × danger precisam se distinguir nos dois temas, e não
  só pela cor (ícone + título carregam a diferença).

## Armadilhas já pagas neste projeto

- **Overflow medido, não estimado** (já custou 100,5px de estouro e um botão fora da viewport): numa coluna
  de 359px, um nome de 120 caracteres e uma nota de 500 sem espaço são o teste real.
- **Texto ocluso passa em teste** — um aviso empilhado que empurra o primeiro cartão para fora da dobra é
  defeito de desenho, não detalhe.
- **A rolagem vertical é invisível em headless**: o sheet tem `overflow: auto` — desenhe já contando que
  ela rola, decidindo se cabeçalho e busca acompanham.
- **Frase honesta em placeholder é frase perdida** (o placeholder só diz "Buscar por nome…"); **reticências
  sem quebra possível não aparecem**; **botão sem resposta ao clique é lido como quebrado**.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro**, nas duas larguras (390px e 1280px):

1. Carregando frio (esqueleto de 3 cartões + busca desabilitada + frase de espera).
2. Erro frio, em repouso e com "Tentar novamente" carregando.
3. Cache offline: aviso + lista + ações desabilitadas + o motivo dito uma vez.
4. Premium pausado, e a variante offline+pausado.
5. Rodapé de paginação: "Carregar mais" em repouso, carregando, e o **fim da lista**; vazio e vazio de busca.
6. Detalhe: cartão com nome de 120 caracteres e nota de 500 sem espaço (para provar o corte) e os três
   ícones com o alvo de 44px desenhado.

Reutilize os primitivos existentes em vez de criar novos: `tf-card` (`padding="sm"`) no cartão,
`tf-alert--danger` no erro frio, `tf-alert--info` em offline e pausado (resolva a colisão de significado
por título/ícone/estrutura, não inventando um tom novo), `tf-btn--secondary` no "Tentar novamente" do erro
frio, `tf-btn--ghost tf-btn--sm` nas ações do cartão, `tf-empty-state` (ícone `boxes`) nos dois vazios,
`tf-input`/`tf-inputwrap` na busca. **A única peça que pode ser nova é o esqueleto** — se propuser um
`tf-skeleton`, entregue-o como primitivo nomeado, com variantes e medidas: hoje ele não existe no DS.

## Perguntas em aberto para o dono

1. No desktop (018), "Minhas simulações" continua sendo um sheet de 416px à direita, ou vira mestre-detalhe
   como Catálogo? A resposta muda todos os estados desta peça.
2. Offline **e** Premium pausado juntos: hoje só o aviso de offline aparece. As duas verdades empilham, ou
   uma tem precedência — e qual?
3. "Carregar mais" deve declarar quantas faltam ("Carregar mais · 12 restantes") e o fim deve ser marcado
   ("Fim da lista · 37 simulações")? Hoje o contrato keyset não devolve total — declarar exige mudá-lo.
4. O motivo do bloqueio de escrita pode ser dito **uma vez** no topo, em vez de repetir em cada cartão?
5. O cartão deve mostrar a base de custo (produto/kit/avulsa) ou os canais, ou nome + nota + tempo é
   deliberadamente todo o conteúdo?
