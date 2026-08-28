# Primeiro contato com "Minhas simulações" — a tela vazia

## O que desenhar

O estado vazio que aparece dentro do painel lateral **"Minhas simulações"** quando o vendedor Premium
abre a funcionalidade pela primeira vez e ainda não salvou nenhuma simulação. O painel é um sheet
ancorado à direita (`tf-dialog--sheet-right`, largura `min(92vw, 26rem)` — ~359px no mobile de 390,
416px no desktop), aberto pelo botão fantasma "Minhas simulações" que fica no topo da página
Calcular, ao lado do título. Quem chega aqui é um assinante que acabou de virar Premium e está
descobrindo o que é uma simulação: **é o único momento em que o produto tem a chance de ensinar isso**.
A saída do vazio é fechar o painel e usar o botão "Salvar simulação", que vive na calculadora, atrás
do painel.

## Por que este prompt existe

Esta peça nunca foi desenhada — foi inferida a partir de requisito textual. O componente `EmptyState`
foi desenhado (protótipo 2026-07-02), mas o protótipo **derruba a versão construída**: lá todo estado
vazio tem ARTE (`Grafismo` "espada"/"arco"/"linha" a 84–96px) e um CTA que AGE ("Adicionar filamento",
botão primário), e a regra de marca §C.6 pede "um floreio orgânico por tela… ótimos em empty-states".
O vazio de simulações é a única instância do produto **sem grafismo**, com um ícone reciclado do
catálogo (`boxes`) e um CTA secundário — "Voltar para a calculadora" — que **não faz nada além de
fechar o painel**. Nas 4 autoridades de design, 0 ocorrências de vazio de cenários. O código, aqui,
contraria uma regra de desenho explícita.

## O que já existe hoje (não invente do zero — corrija)

Composição atual do painel quando a lista volta vazia, de cima para baixo:

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título do sheet | "Minhas simulações" | `tf-dialog__title`, caixa alta, fonte de título |
| Subtítulo | "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." | só renderiza para quem tem Premium (o grátis vê o teaser no lugar) |
| Campo de busca | placeholder "Buscar por nome…" | → **renderiza mesmo com zero simulações**: uma busca sobre o nada |
| Ícone do vazio | ícone `boxes` a 28px num quadrado 56px de `--accent-soft`, cantos `--radius-lg` | → é o MESMO ícone do botão de entrada; não diz "simulação", diz "caixas" |
| Título do vazio | "Nenhuma simulação salva ainda" | copy boa, manter verbatim |
| Corpo do vazio | "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." | ensina o caminho e cita o botão real entre aspas curvas; manter verbatim |
| Ação | botão **secundário** "Voltar para a calculadora" | → o `onClick` é literalmente "fechar". Nenhuma arte, nenhuma condução |

→ **Três problemas a resolver no desenho:** (1) ausência de grafismo, contra §C.6 e contra as outras
telas; (2) ícone emprestado do catálogo; (3) hierarquia invertida — a única ação do momento mais
importante da funcionalidade é um botão secundário que fecha.

## Conteúdo e dados reais

- Não há número nem dinheiro nesta peça: ela existe justamente porque não há dados. O que existe é o
  **caminho**: painel → fechar → calculadora → botão "Salvar simulação" (que na calculadora só
  aparece para Premium e recusa com "Corrija os campos da calculadora antes de salvar." se a
  simulação estiver inválida).
- O que uma simulação guarda, e é o que a peça precisa fazer entender: canais de venda, taxas
  ajustadas e a base de custo (avulsa, referência do catálogo ou kit do catálogo). Ao reabrir, **ela
  recalcula com os preços de hoje** — é isso que a separa de um Orçamento, que fica congelado.
- Quando já existirem simulações, cada card mostra nome (1 linha, com reticências), nota opcional
  (2 linhas, com reticências) e "Atualizado há 2 dias" — **nunca uma data**. Útil como referência do
  que o vazio está prometendo, não para desenhar aqui.
- Limites que aparecem no fluxo vizinho: nome obrigatório, máx. 120 caracteres; nota opcional, máx.
  500 caracteres.

## Estados obrigatórios

1. **Vazio de verdade (primeiro contato)** — Premium ativo, zero simulações salvas. Ícone/arte +
   "Nenhuma simulação salva ainda" + o corpo verbatim + a ação. É a prancheta principal.
2. **Vazio da busca** — existem simulações, o filtro é que não achou: "Nenhuma simulação encontrada
   para “termo”." + botão secundário "Limpar busca". **Não pode parecer o mesmo vazio do item 1** —
   dizer "nenhuma simulação salva" para quem tem simulações é mentira sobre os dados do vendedor.
3. **Carregando** — hoje é só um `Spinner` centralizado com `padding` vertical generoso, sem
   esqueleto. Desenhe o que deve aparecer antes de sabermos se está vazio ou cheio.
4. **Erro de carga (frio)** — alerta de perigo "Não foi possível carregar suas simulações." + botão
   secundário "Tentar novamente". Nunca um vazio: "não carregou" ≠ "não existe".
5. **Offline / leitura em cache** — alerta informativo, título "Modo leitura offline", corpo "Suas
   simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de
   conexão." + "Tentar novamente". Desenhe como esse alerta convive com o vazio acima dele.
6. **Premium pausado (lapsed)** — alerta informativo, título "Premium pausado", corpo "Suas simulações
   continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir,
   reative o Premium." → **hoje esse aviso só aparece quando existe pelo menos uma simulação**: um
   assinante pausado com zero simulações vê o vazio limpo, convidando a salvar algo que ele não pode
   salvar. Desenhe a versão pausada do vazio.
7. **Sem permissão (grátis / deslogado)** — não é esta peça: o painel troca o corpo inteiro pelo
   teaser Premium. Só precisa constar que o vazio **nunca** deve ser confundido com paywall.
8. Estados de interação do CTA e do campo de busca: repouso, hover, foco visível, pressionado e, no
   caso pausado/offline, desabilitado com o motivo escrito ao lado — nunca um botão morto e mudo.

## Viewports

- **Mobile 390px** — obrigatória. O sheet ocupa 92vw (~359px) e o vazio vive dentro dele com padding
  de `--space-5`; a `max-width: 28rem` do bloco nunca chega a valer, então todo o texto quebra.
- **Desktop 1280px** — obrigatória. Mesmo sheet, agora travado em 416px encostado à direita, com a
  calculadora visível por baixo do overlay. Vale mostrar como o vazio se comporta numa coluna alta e
  estreita: 416px de largura por quase toda a altura da tela é muito espaço vertical vazio — é onde
  o grafismo e a hierarquia se resolvem, ou não.
- 1920px não precisa de prancheta própria: o sheet não cresce, só o fundo.

## Regras que o desenho não pode quebrar

- **Freemium binário.** Este vazio é território de quem JÁ pagou. Nada de selo de cadeado, coroa,
  "desbloqueie" ou preço. A conversão acontece no teaser, não aqui.
- **Nada de data.** A funcionalidade inteira proíbe data-alegação; o vazio não pode inventar
  "criado em" nem "desde".
- **Falha de rede nunca é falta de permissão.** Erro e offline têm frases próprias, já escritas —
  não podem ser desenhados como "você não tem simulações".
- **Frase honesta fora de placeholder.** O corpo educativo é texto de bloco, largura cheia; nunca
  dentro do campo de busca, nunca cortado.
- **Alvo ≥44px** para o CTA e para qualquer botão do alerta, inclusive dentro do sheet estreito.
- Contraste medido contra o fundo real do sheet (que é uma superfície elevada sobre overlay), nos
  dois temas.

## Armadilhas já pagas neste projeto

- **O campo de busca já shipou invisível** (1×1px) porque foi escondido pela via errada. Se o desenho
  decidir que a busca não deve existir no vazio, diga "não renderiza"; se decidir que existe, desenhe
  a geometria dela explicitamente.
- **Texto ocluso passa em teste.** `toBeVisible` aprova elemento sobreposto ou estourado — a
  homologação desta peça lê caixas, não strings. Nada pode encostar na borda de 359px.
- **Placeholder corta a frase.** Uma frase honesta dentro de um `placeholder` desaparece ao digitar e
  é clipada em campo estreito; já custou uma homologação neste projeto.
- **Aspas curvas no corpo** (“Salvar simulação”) são parte da copy homologada — não troque por retas
  nem quebre a citação em duas linhas de forma que o nome do botão fique partido.

## Entregável

Pranchetas, tema **escuro como padrão e claro como first-class** (as duas versões de cada uma das
duas primeiras):

1. Vazio de primeiro contato — mobile 390px (escuro + claro).
2. Vazio de primeiro contato — desktop 1280px, sheet sobre a calculadora (escuro + claro).
3. Vazio da busca ("Nenhuma simulação encontrada para “kit natal”." + "Limpar busca").
4. Vazio + faixa "Premium pausado", e vazio + faixa "Modo leitura offline".
5. Carregando e erro de carga, lado a lado, no mesmo recorte de painel.

Reutilize os primitivos existentes, sem criar componentes novos: o painel é `tf-dialog--sheet-right`
com `tf-dialog__title` + `tf-dialog__desc`; o bloco vazio é `tf-empty` (`__icon` no quadrado 56px de
`--accent-soft`, `__title`, `__desc`, `__action`); os avisos são `tf-alert` nos tons `info` e
`danger`; os botões são `tf-btn` nas variantes `primary`/`secondary`/`ghost`; a busca é
`tf-inputwrap` + `tf-input`; o carregando é `tf-spinner`. **O floreio deve usar o `Grafismo` que já
existe** — as quatro formas disponíveis são `arco`, `espada`, `linha-curva` e `onda`; `espada` e
`arco` já estão faladas no catálogo e no 404, então prefira `onda` ou `linha-curva` para simulações.
Se você propuser um ícone próprio para "simulação" no lugar do `boxes` emprestado, entregue-o como
proposta explícita, marcada como adição ao conjunto de ícones.

## Perguntas em aberto para o dono

1. **O CTA do vazio deve agir ou continuar só fechando?** Três produtos diferentes: (a) fecha o
   painel e ainda leva o olho até o botão "Salvar simulação" na calculadora; (b) cria uma simulação
   de exemplo (semente), como o Catálogo ganhou na rodada 2; (c) permanece "Voltar para a
   calculadora", assumido como suficiente. O desenho muda inteiro conforme a resposta.
2. **Se for semente, o que ela contém?** Uma comparação de canais fictícia é um número na tela — e
   este produto proíbe número sem procedência. Precisa de rótulo de exemplo, e o rótulo é decisão
   sua.
3. **A busca some quando não há nada salvo?** Ela hoje aparece sobre uma lista vazia. Some, ou fica
   desabilitada com motivo?
4. **O assinante pausado com zero simulações deve ver "Premium pausado" no vazio?** Hoje não vê, e o
   vazio o convida a salvar algo que ele não consegue salvar.
