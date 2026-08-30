# Bloco "Comparar com hoje" — o congelado ao lado do preço de hoje

## O que desenhar
O painel que responde "meu custo subiu desde que cotei?" dentro de um orçamento já salvo. Ele vive no
DETALHE de um registro de Orçamentos (`/historico?snapshot=…`), depois da "Ficha técnica" e antes da
fileira de ações [Recalcular hoje] [Exportar]. Quem usa é o vendedor que abriu um orçamento antigo — em
geral porque o cliente voltou a falar dele — e quer saber se o preço que ele cotou em julho ainda paga a
conta hoje. É uma consulta, não uma edição: o painel calcula o preço de hoje na hora, mostra os dois
números lado a lado e **não grava nada**. Hoje ele é um botão discreto que, ao ser tocado, se troca no
lugar por um card com as duas linhas. Desenhar: o gatilho, o painel aberto, e os três estados honestos
que ele já tem (offline, modelo aposentado, "não deu para calcular").

## Por que este prompt existe
O painel inteiro foi inferido: nenhum protótipo, nenhum canvas, nenhum ux-*.md o descreve. O canvas do
dono (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`, linha 315) desenha **só o gatilho** — um
`tf-btn--secondary` "Comparar com hoje" na fileira de ações, junto de Exportar e Recalcular hoje — e o
código o renderiza diferente: um botão fantasma solto entre a ficha técnica e a fileira. O protótipo
antigo (`HistoryScreen.jsx`) tem um "Comparar", mas é **outra funcionalidade**: compara dois registros
salvos entre si, mostra a linha "Diferença", e nunca foi construído. A decisão mais delicada da peça — as
duas linhas terem **peso visual idêntico**, para que "Hoje" não pareça o novo valor do registro — existe
hoje apenas como um comentário no CSS, sem nenhum desenho por trás.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/compare-today.tsx` + `historico-page.css` (`.tf-compare`) + copy em
`messages.pt-br.ts` (`historico.compare*`).

Fechado (repouso):
- um botão fantasma com o texto **"Comparar com hoje"**, sozinho numa linha, logo abaixo da ficha técnica.
  → **problema**: ele fica órfão, longe das outras duas ações do documento, e o canvas do dono o coloca na
  fileira. Duas autoridades divergem; o desenho precisa resolver (ver Perguntas em aberto).
- se a origem do registro (produto ou kit) não existe mais, o botão **simplesmente não aparece** — sem
  aviso, sem botão desabilitado. Isso é decisão consciente (FR-503) e deve continuar.

Aberto (o botão some e vira um card no mesmo lugar):

| Ordem | Conteúdo | Texto literal hoje |
|---|---|---|
| 1 | legenda da base, dita **uma vez** para as duas linhas | "preço de varejo" **ou** "preço de atacado" |
| 2 | linha 1 — o congelado | "Cotado em 03/07/2026" · **R$ 30,90** |
| 3 | linha 2 — o vivo | "Hoje" · **R$ 61,80** |
| 4 | só offline | "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados." |
| 5 | só se o congelado é de um modelo aposentado | "O valor congelado foi calculado pelo modelo 3.1.0, que incluía o campo Desperdício. O modelo atual não tem mais esse campo — parte da diferença acima pode vir daí." |
| 6 | a ressalva final, sempre | "Comparação informativa: este registro não muda. Para gravar o valor de hoje, use \"Recalcular hoje\"." |

Comportamento atual, verificado no código:
- as duas linhas usam a **mesma** classe, mesmo tamanho, mesmo peso; o valor vai à direita, alinhado por
  números tabulares. Isso é intencional e é a regra central da peça.
- **não existe diferença calculada** — nem número, nem seta, nem "subiu 12%". Decisão registrada: a
  aritmética de dinheiro mora no `pricing-core`, e dois números rotulados já respondem a pergunta.
- → **problema**: depois de aberto **não há como fechar**. Não existe X, "Fechar" nem seta; o card fica
  até o vendedor sair do registro.
- → **problema**: o estado "não deu para calcular" é um parágrafo mudo, cinza, sozinho dentro de um card —
  sem título, sem ícone, sem saída. O vendedor pediu uma resposta e recebeu um texto apagado.
- não há carregando: o cálculo é síncrono. Mas o gatilho **aparece atrasado**, quando o catálogo do
  vendedor termina de carregar — um pop-in que o desenho precisa prever.

## Conteúdo e dados reais
- **Valores**: sempre `R$ 1.234,56` (vírgula decimal, ponto de milhar), numerais tabulares. Faixa real de
  uma peça: `R$ 16,16` a `R$ 300,00`; um kit passa fácil de `R$ 1.000,00`. Desenhe também com
  **R$ 12.345,67** nas duas linhas para provar que a coluna aguenta.
- **Data**: `03/07/2026`, formatada com o fuso que o aparelho capturou no dia da cotação — a data faz parte
  da afirmação, não é detalhe de renderização.
- **Base**: exatamente uma das duas legendas ("preço de varejo" / "preço de atacado"), nunca as duas. Um
  orçamento de atacado é comparado com o atacado de hoje; misturar as bases inventaria um aumento que não
  aconteceu.
- **Modelo**: a versão citada na nota estrutural é literal do registro (ex.: `3.1.0`); a nota só existe
  para registros anteriores ao modelo 4.0.0.
- Nada aqui é editável, nada é opcional para o vendedor preencher: tudo é derivado.

## Estados obrigatórios
1. **Gatilho em repouso** — "Comparar com hoje", alvo ≥44px.
2. **Gatilho em foco / hover / pressionado** — foco visível medido contra o fundo real do card do registro.
3. **Gatilho ausente** — origem apagada: nada no lugar, sem buraco e sem explicação. Desenhe a fileira de
   ações sem ele para provar que não fica um vão.
4. **Aberto, subiu** — R$ 30,90 × R$ 61,80, pesos idênticos.
5. **Aberto, não mudou** — o **mesmo** número duas vezes, cada um com seu rótulo. Não colapse em uma linha:
   "não mudou" é uma resposta que o vendedor precisa VER.
6. **Aberto, offline** — mais a frase de catálogo salvo no aparelho (linha 4 da tabela), em texto completo,
   nunca truncada.
7. **Aberto, modelo aposentado** — mais o alerta informativo (linha 5), dentro do card.
8. **Não foi possível calcular** — "Não foi possível calcular o valor de hoje para este registro com o seu
   catálogo atual." O valor congelado **continua onde estava**, na ficha acima, e nunca é rerrotulado como
   "Hoje". Este estado precisa de desenho de verdade: tom, ícone e — se o dono aprovar — uma saída.
9. **Premium pausado** — o bloco **continua funcionando**: ler e comparar não é operação paga. Acima dele o
   registro já mostra "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar,
   renomear, excluir ou exportar, reative o Premium." Não desenhe cadeado, blur nem teaser aqui.
10. **Registro ainda não sincronizado** — o detalhe já carrega o alerta "Ainda não sincronizado" acima; a
    comparação funciona igual. Mostre a convivência dos dois blocos numa prancheta.

## Viewports
- **Mobile 390px** — o caso principal: o detalhe é uma página inteira e o card abre no fluxo, empurrando a
  fileira de ações para baixo. Prove que "Cotado em 03/07/2026" e **R$ 12.345,67** cabem na mesma linha, ou
  defina como quebram.
- **Desktop 1280px** — o registro vive no painel direito de um mestre-detalhe grudento (lista à esquerda),
  e nesse corte o painel é o mais estreito que existe (perto de 500px, com rolagem própria). É o teste
  duro da peça.
- **Desktop 1920px** — o painel fica largo; decida se as duas linhas continuam empilhadas ou ganham
  respiro, sem virar duas colunas que sugiram "antes → depois" com um vencedor.

## Regras que o desenho não pode quebrar
- **Peso idêntico nas duas linhas.** "Hoje" com destaque tipográfico, cor de acento ou tamanho maior
  transforma uma consulta informativa em "o novo valor do seu orçamento". É a mentira que esta peça existe
  para não contar.
- **Todo número diz o que é e QUANDO.** Nenhum total aparece sem rótulo e sem data/base.
- **Nunca imprimir um "Hoje" que não foi calculado hoje.** Se o cálculo falhou, é o estado 8 — jamais o
  número congelado com rótulo novo.
- **Sem diferença calculada** (número, percentual, seta, barra comparativa ou qualquer codificação visual
  de tamanho): isso é aritmética de dinheiro e não é desta superfície.
- **O registro não muda.** A ressalva final é obrigatória e vive em texto corrido de largura cheia — nunca
  em placeholder, tooltip, ou linha que possa ser cortada por reticências.
- **Falha de rede nunca vira "precisa de Premium"**, e Premium pausado nunca bloqueia a leitura.
- Alvos ≥44px; contraste do texto cinza (legendas e ressalva) medido contra o fundo real do card, que já
  está sobre o fundo da página — dois níveis de superfície.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido**: valores de 5 dígitos em coluna estreita já estouraram card neste projeto
  (E2) e já colidiram glifos num PDF (E4). Desenhe com o número grande, não com o bonito.
- **Frase honesta cortada**: em 016 uma frase honesta foi parar num placeholder e apareceu clipada. As
  frases dos estados 6, 7 e 8 são conteúdo, não decoração — elas nunca truncam.
- **Rolagem no eixo vertical dentro do painel desktop**: o painel direito já rola sozinho; um card que
  cresce (com alerta + duas notas) pode criar uma segunda barra de rolagem. Desenhe o caso mais alto
  possível (offline + modelo aposentado + ressalva) e veja onde ele termina.
- **Um bloco que abre e não fecha** vira estado permanente da tela; no desktop, com a lista ao lado, o
  vendedor troca de registro e não entende se aquilo continua aberto.
- **Alerta dentro de card dentro de painel**: três fundos empilhados apagam a hierarquia — o alerta
  informativo precisa continuar legível ali dentro.

## Entregável
Pranchetas, tema escuro (padrão) **e** tema claro, ambos completos:
1. 390px — fechado, no contexto: ficha técnica acima, fileira de ações abaixo.
2. 390px — aberto, caso "subiu" (R$ 30,90 × R$ 61,80).
3. 390px — aberto, caso "não mudou" (mesmo número duas vezes).
4. 390px — aberto, offline + modelo aposentado (o card mais alto que existe).
5. 390px — "não foi possível calcular".
6. 1280px — o painel direito do mestre-detalhe com o bloco aberto, no caso alto.
7. 1920px — o mesmo, com o painel largo.
8. Um recorte de estados do gatilho: repouso, hover, foco, pressionado.

Reutilize os primitivos existentes, sem criar novos: **`tf-btn--secondary`** para o gatilho (ou `ghost`, se
o dono decidir manter fora da fileira), **`tf-card`** para o painel, **`tf-tnum`** nos dois valores,
**`tf-alert` tom `info`** para a nota do modelo aposentado, e o estilo de legenda/hint já usado em
`tf-historico__meta` / `tf-historico__basis` para a base, a nota de offline e a ressalva final.

## Perguntas em aberto para o dono
1. **Onde fica o gatilho**: na fileira de ações como `tf-btn--secondary` (canvas, linha 315) ou solto e
   fantasma acima dela (código de hoje)? Na fileira ele ganha peso de ação — e esta não grava nada.
2. **Dá para fechar depois de aberto?** Hoje não. Se sim, o gatilho vira alternador ("Comparar com hoje" ↔
   o quê?) — e no desktop, ao trocar de registro na lista, ele volta fechado ou fica aberto?
3. **A recusa em mostrar a diferença vale também para o desenho?** Nada de número e percentual, isso está
   decidido — mas uma pista visual neutra (uma seta sem valor, uma cor de tendência) ainda é permitida ou
   também é proibida?
4. **O estado "não foi possível calcular" oferece alguma saída?** Explicar por quê (catálogo mudou, peça do
   kit incompleta) exigiria informação que a peça hoje não tem; oferecer "Recalcular hoje" ali seria mandar
   o vendedor para uma ação que grava.
5. **A ordem de leitura** deve ser sempre congelado-primeiro (cronológica, como hoje) ou hoje-primeiro (o
   que ele veio buscar)?
