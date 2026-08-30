# Aviso de falha ao atualizar as taxas (não bloqueante), na seção Marketplaces

## O que desenhar

Um aviso curto, com botão de retentativa embutido, que aparece no topo da lista de canais dentro da seção
**"Marketplaces"** da tela **Calcular** (aba principal do app) quando a busca online da tabela de tarifas
falhou. Quem o vê é o vendedor Premium que já ligou a chave "Incluir marketplaces no preço" e está
preenchendo/lendo os canais (Mercado Livre, Shopee, Amazon, Outro). O ponto central: **nada parou**. As
tarifas continuam pré-preenchidas pela referência salva no dispositivo (cache) ou pela semente embutida no
app, e todo preço continua sendo calculado localmente. O aviso é uma NOTA, não uma parede de erro — e o
desenho precisa fazer essa diferença ser lida em meio segundo, sem que o vendedor ache que o número na
tela está quebrado. Ele fica logo acima dos cartões de canal e do botão "Adicionar canal".

## Por que este prompt existe

Autoridade de desenho: **NENHUMA**. Tom (info e não perigo), posição (topo da lista de canais), o botão
dentro do próprio alerta e a convivência com o selo de procedência de cada canal foram todos decididos no
código, por inferência de requisito textual (005/US3). O catálogo de tarifas nem existia no protótipo de
2026-07-02. O padrão vizinho existe e é **outra coisa**: o item 17 do `-fixes.md` desenha "Não foi possível
carregar. Tente de novo." + "Tentar novamente" para Catálogo e Histórico — um estado que **substitui** uma
lista que não carregou. Aqui nada foi substituído: a seção inteira continua funcionando com dado embutido.
O problema real, não resolvido por ninguém: **duas superfícies dizem coisas parecidas com formas
diferentes** — este alerta no topo ("não foi possível atualizar") e, dois centímetros abaixo, o selo de cada
canal ("Referência: <fonte> · atualizada em 06/07/2026"). O vendedor pode ler as duas como contradição.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/calculator/calculator-form.tsx` (`MarketplaceSection`),
`apps/web/src/pages/calcular/calcular-page.tsx`, `apps/web/src/features/calculator/fee-seal.tsx`,
textos em `apps/web/src/shared/i18n/messages.pt-br.ts`.

Composição atual, de cima para baixo dentro da seção:

| Ordem | Elemento | Conteúdo literal hoje |
|---|---|---|
| 1 | Título de seção + info | "Marketplaces" |
| 2 | Linha de chave (full width, rótulo à esquerda, switch à direita) | "Incluir marketplaces no preço" |
| 3 | **O aviso desta peça** (`Alert tone="info"`, ícone 20px, `role="status"`) | Título: "Não foi possível atualizar as taxas" |
| 3b | Corpo do aviso (parágrafo) | "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." |
| 3c | Botão dentro do alerta (`Button variant="secondary" size="sm"`, margem superior curta) | "Tentar novamente" |
| 4 | Lista de cartões de canal, cada um com seu selo de procedência | ver "Conteúdo e dados reais" |
| 5 | Botão secundário | "Adicionar canal" |

→ **Problema 1 (o principal):** o aviso e o selo de cada canal falam do mesmo assunto sem se enxergarem. O
aviso diz "não foi possível atualizar"; o selo abaixo diz "Referência: Tabela de comissões do Mercado Livre
· atualizada em 06/07/2026" com tom **info** (azul), que lê como "está tudo fresco". O desenho tem de
resolver essa relação — uma delas cede: hierarquia, tom, ou fusão.
→ **Problema 2:** quando a referência em uso é a semente embutida, o selo já diz "referência embutida
(offline) · atualizada em 06/07/2026 · pode estar desatualizada". Nesse caso o aviso do topo é quase
redundante — só acrescenta o botão. Desenhe a versão em que as duas coexistem sem soar repetitiva.
→ **Problema 3:** o botão nasce colado ao corpo do texto, herdando o alinhamento do parágrafo. Falta uma
decisão de desenho sobre onde a ação vive dentro do bloco (à direita do título? em rodapé próprio?).
→ **Problema 4:** o aviso só existe **dentro** da seção Marketplaces ligada. Se o vendedor tiver a chave
desligada, ou não for Premium, a falha acontece e ninguém é avisado. Isso pode estar certo — mas nunca foi
desenhado. Ver "Perguntas em aberto".
→ **Problema 5:** a mesma tela Calcular já tem, mais acima, um alerta de retentativa com tom **perigo**
("Não foi possível carregar seus itens salvos agora." + "Tentar novamente"). Os dois podem aparecer juntos:
dois alertas com o mesmo botão e tons diferentes na mesma coluna. Desenhe essa colisão explicitamente.

## Conteúdo e dados reais

- **Título do aviso** (literal, homologado): "Não foi possível atualizar as taxas".
- **Corpo** (literal): "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você
  também pode informar as taxas manualmente." — a frase está correta e é honesta; **não a reescreva**, e
  ela **não pode** ir para dentro de placeholder ou de elemento que corte texto.
- **Botão** (literal): "Tentar novamente".
- **Selos de procedência por canal** (pílulas pequenas, um por cartão de canal — todos textos reais):
  - `Referência: Tabela de comissões do Mercado Livre · atualizada em 06/07/2026` (tom info)
  - `referência embutida (offline) · atualizada em 06/07/2026` (tom neutro)
  - `… · pode estar desatualizada` (sufixo, quando passou de 30 dias)
  - `categoria não informada — usando a maior alíquota da tabela` (tom neutro)
  - `ajustado por você` / `sem referência — informe as taxas` / `estimativa de frete`
  - selo separado da taxa fixa: `Taxa fixa: venda.amazon.com.br/precos · vigente desde 01/08/2026`
- **Números reais ao redor** (para as pranchetas não usarem valores fictícios): comissão 14%, taxa fixa
  R$ 2,00, preço do anúncio R$ 24,24, líquido R$ 16,16. Nenhum desses números muda quando a atualização
  falha — esse é exatamente o ponto do aviso.
- Nada aqui é campo editável: o aviso é só texto + uma ação. Ele **não** tem estado de "fechado/dispensado"
  no código de hoje.

## Estados obrigatórios

1. **Ausente** — o padrão: a busca teve sucesso. Nenhum aviso; a seção começa direto na lista de canais.
   Desenhe esta prancheta como linha de base para medir o deslocamento que o aviso causa.
2. **Repouso (falha travada)** — aviso visível com título, corpo e botão "Tentar novamente" ativo. Esse
   estado é **pegajoso**: uma vez levantado, só baixa quando uma atualização finalmente dá certo.
3. **Retentativa em andamento** — o mesmo aviso, **sem sumir**, com o botão em estado de carregamento
   (spinner + rótulo). O aviso permanecer é intencional: piscar entre "falhou" e "falhou" é pior que ficar.
   Desenhe o botão em `loading` com largura estável (não pode encolher/pular quando o spinner entra).
4. **Retentativa falhou de novo** — visualmente igual ao estado 2. Nenhum contador, nenhuma escalada de
   tom no código atual. Se você propuser um reconhecimento ("tentamos de novo às 14h32"), marque como
   proposta, não como existente.
5. **Sucesso após retentativa** — o aviso desaparece e os selos abaixo passam a exibir a data nova.
   Desenhe o "depois": o vendedor precisa perceber que algo mudou, senão o botão parece não ter feito nada.
6. **Foco de teclado no botão** — anel de foco visível sobre o fundo do alerta (fundo tonal, não o fundo da
   página): o contraste tem de ser medido contra o fundo do próprio alerta.
7. **Hover / pressionado** no botão secundário dentro de superfície tonal.
8. **Convivência com o selo desatualizado** — aviso no topo + pelo menos um cartão de canal abaixo com
   "referência embutida (offline) · … · pode estar desatualizada" visível na mesma prancheta.
9. **Convivência com o alerta de perigo do catálogo pessoal** — os dois alertas empilhados na mesma tela.
10. **Não renderizado por falta de permissão** — conta sem Premium: a seção mostra "Vender em marketplaces
    faz parte do Premium." + CTA de assinatura, e o aviso **não** aparece mesmo com a falha acontecendo.
11. **Chave desligada** — "Incluir marketplaces no preço" em off: corpo da seção oculto, aviso oculto.

## Viewports

- **Mobile 390px** — obrigatório e prioritário: é onde a peça mais dói. O aviso empurra a lista de canais
  para baixo e o botão de 44px tem de caber numa coluna estreita sem quebrar o rótulo em duas linhas.
- **Desktop 1280px** — a tela Calcular tem grade multi-coluna no desktop (018), e a seção Marketplaces
  ocupa colunas diferentes conforme a conta é Premium ou não. Desenhe o aviso na largura real da coluna em
  que ele vive, não numa faixa full-width imaginária.
- 1920px é opcional aqui: acima de 1280px a coluna não muda de natureza, só de folga.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como falta de premium** e nunca vira parede de erro: o cálculo continua,
  e a peça tem de parecer uma nota, não um bloqueio. Nada de vermelho, nada de ícone de alarme.
- **Procedência do número é obrigatória e não pode ser escondida**: se o desenho fundir o aviso com o selo,
  o resultado ainda tem de dizer de onde veio cada tarifa e quando foi revista.
- **Degradação dita, não maquiada**: "referência embutida (offline)" e "pode estar desatualizada" são
  afirmações que o vendedor precisa conseguir ler — não podem virar só um ícone ou uma cor.
- **A frase honesta fica em texto corrido, nunca em placeholder** e nunca em elemento que trunca.
- **Alvo de toque ≥44px** para "Tentar novamente", inclusive no estado de carregamento.
- **Contraste medido contra o fundo tonal do alerta**, não contra o fundo da página — o texto secundário
  dentro de superfície tonal é onde esse erro costuma passar.
- O aviso **não** pode ganhar um "X" de dispensar sem decisão do dono: dispensar uma degradação silencia
  uma verdade que continua valendo.

## Armadilhas já pagas neste projeto

- **Texto que passa em teste e está ocluso/estourado**: assertivas de texto não veem colisão de layout.
  Meça caixas. Uma fonte longa dentro do selo ("Tabela de comissões da Amazon — Calçados (…)") é o caso
  real que estoura a pílula.
- **Overflow horizontal medido nos DOIS eixos** a 390px: já perdemos um item por medir só um.
- **Botão que nasce fora da viewport** dentro de bloco tonal — aconteceu na tela de Conta (100,5px).
- **Frase honesta cortada por sufixo/placeholder** — o corpo deste aviso é longo (duas orações); ele tem de
  caber inteiro a 390px sem reticências.
- **Órfão de CTA**: em faixa larga, o botão distante do texto que o motiva já custou uma correção (149,6px
  de distância). No desktop, ancore a ação ao texto.
- **Alerta que muda de altura ao entrar em carregamento** faz a lista abaixo pular; a lista de canais é
  clicável logo abaixo.

## Entregável

Pranchetas em **tema escuro (padrão)** e **tema claro (first-class, mesma qualidade)**:

1. `Marketplaces — sem falha (linha de base)` — 390px e 1280px.
2. `Aviso em repouso` — 390px e 1280px, com dois cartões de canal visíveis abaixo e seus selos.
3. `Retentativa em andamento` — botão em carregamento, 390px.
4. `Depois do sucesso` — aviso ausente, selo com data nova em destaque momentâneo, 390px.
5. `Colisão de alertas` — o alerta de perigo do catálogo pessoal acima e este aviso abaixo, 1280px.
6. `Sem Premium / chave desligada` — comprovando que o aviso não aparece, 390px.
7. Um detalhe ampliado (2x) do bloco do aviso mostrando foco, hover e pressionado no botão.

Reutilize os primitivos existentes, sem criar novos: o bloco é o **`tf-alert` no tom informativo** (com seu
ícone de 20px), o título usa o slot de título do próprio alerta, o corpo é parágrafo de texto secundário, a
ação é o **`tf-btn` secundário tamanho `sm`** com estado de carregamento, os selos por canal são o
**`tf-badge`** nos tons neutro/info, os canais vivem em **`tf-card`**, e a chave é o **`tf-switch`**. Se a
sua solução para o Problema 1 exigir uma peça nova, apresente-a como variante de um primitivo existente e
diga qual, explicitamente.

## Perguntas em aberto para o dono

1. **Quem cede na relação aviso × selo?** Três caminhos possíveis e nenhum decidido: (a) o aviso some e o
   selo de cada canal ganha a ação de retentativa; (b) o aviso fica e os selos abaixo perdem o tom info
   enquanto a falha estiver travada; (c) os dois ficam como estão e o aviso ganha uma frase que amarra
   ("os valores abaixo são da referência salva").
2. **A falha deve ser avisada quando a seção Marketplaces está desligada ou a conta não é Premium?** Hoje
   não é. É decisão de produto: o catálogo só serve aos canais, mas a falha é do app, não da seção.
3. **O aviso pode ser dispensado pelo vendedor?** Hoje não pode. Se puder, volta na próxima sessão ou fica
   dispensado enquanto a falha durar?
4. **Retentativa automática:** hoje só existe a manual. Se o app tentar sozinho de tempos em tempos, o
   desenho precisa de um estado "tentando novamente sozinho" que não existe hoje.
