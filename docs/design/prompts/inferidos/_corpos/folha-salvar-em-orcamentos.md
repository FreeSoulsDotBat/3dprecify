# Folha "Salvar em Orçamentos" — onde o registro congelado nasce

## O que desenhar

A folha modal que abre quando o vendedor toca em **"Salvar em Orçamentos"** depois de calcular um preço.
Ela aparece em três lugares (calculadora avulsa, ficha de produto do catálogo e compositor de kits) e é
sempre a mesma peça. Nela o vendedor dá um rótulo opcional ao registro, diz por quantos dias a proposta
vale e — a parte que importa — **declara qual preço ele está cotando: varejo ou atacado**. Ao confirmar,
os valores da tela são congelados como estavam naquele dia e viram um documento imutável no Orçamentos
(ADR-0019: depois de salvo, só o rótulo pode mudar). A folha é premium-only: sem premium ativo o botão nem
existe — não é botão cinza, não é isca de venda.

## Por que este prompt existe

A folha inteira foi inferida por IA a partir de requisito textual (`009/T010`), sem nenhum desenho: o
protótipo de 2026-07-02 desenhou só o caminho **grátis** ("Ação Salvar → dispara bottom-sheet de upsell",
§E4/§E5), onde salvar sempre terminava no upsell — a folha de **gravação** premium nunca existiu. O que
falta é a hierarquia entre os três campos: hoje a decisão **irreversível** (a base cotada) tem o mesmo
peso visual do rótulo opcional, e é a única das três que muda o significado do registro. Errada, o
Orçamentos passa a mentir sobre o que foi cobrado, em silêncio e para sempre. (Varejo×atacado aparece no
protótipo só como segmented control de **resultado** na calculadora — lá é visualização, aqui é
declaração permanente.)

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/history/record-snapshot-sheet.tsx` + `.css`; textos em
`shared/i18n/messages.pt-br.ts` (`historico.*`).

Ordem atual, de cima para baixo, dentro de um painel `tf-dialog--sheet` **ancorado à direita**
(`width: min(92vw, 26rem)`, altura total, cantos arredondados só à esquerda, botão X de 44×44px no canto
superior direito, scrim por trás):

| # | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Título | "Salvar em Orçamentos" | `tf-dialog__title` — caixa alta, fonte de título |
| 2 | Descrição | "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje." | muted, `fs-body-sm` |
| 3 | Campo texto | rótulo "Rótulo (opcional)", hint abaixo "Cliente, pedido…" | opcional, máx. 120 caracteres, sem contador |
| 4 | Campo número | rótulo "Validade da proposta", sufixo "dias" dentro do `tf-inputwrap` | 1 a 3650, opcional, vazio ⇒ não registra validade |
| 5 | Grupo de escolha | legenda "Preço que você está cotando"; opções "Varejo" e "Atacado" | rádios nativos, valor em negrito tabular empurrado para a direita |
| 6 | Linha de data | "Cotado em 20/08/2026" | muted, `fs-body-sm`, não editável |
| 7 | Botão | "Salvar em Orçamentos" | primário, largura natural, último elemento |

→ **Problema 1 (o motivo deste prompt):** o item 5 é uma caixa com borda fina de 1px, legenda cinza em
0,875rem e dois rádios nativos de sistema — visualmente **menos** presente que o campo de rótulo acima
dele. É a única decisão irreversível da folha e parece o item menos importante.
→ **Problema 2:** o botão de confirmar repete literalmente o texto do título e do botão que abriu a folha
("Salvar em Orçamentos" três vezes na mesma interação). O terceiro não diz o que vai acontecer agora.
→ **Problema 3:** os dois campos são opcionais, mas só um diz isso — "Rótulo (opcional)" escreve a palavra
dentro do rótulo (o DS tem marca "opcional" própria) e "Validade da proposta" não marca nada.
→ **Problema 4:** enquanto grava, o botão apenas **morre** (fica desabilitado, sem spinner e sem trocar de
texto). Não há nenhum "Salvando…" — o DS tem estado de carregamento com spinner e o Kits já usa a palavra.
→ **Problema 5:** a data ("Cotado em 20/08/2026") é parte da declaração e está desenhada como nota de
rodapé cinza.
→ **Problema 6:** validade fora de 1–3650 cai na validação nativa do navegador (balão do sistema
operacional, fora do DS, às vezes em outro idioma). O DS tem estado de erro por campo e ele não é usado.

## Conteúdo e dados reais

- **Rótulo** — texto livre, opcional, até 120 caracteres. Exemplo real: `Ana — pedido 214`. Em branco,
  nada é gravado (não vira string vazia).
- **Validade da proposta** — inteiro em dias, 1 a 3650, opcional. Exemplo: `15`. Não é prazo de validade
  do registro (nada expira): é o prazo que o vendedor **prometeu** ao cliente.
- **Base cotada** — exatamente duas opções, "Varejo" e "Atacado", cada uma com o dinheiro congelado ao
  lado, em números tabulares. Números do seed do projeto: custo total R$ 16,16 → **Varejo R$ 24,24** ·
  **Atacado R$ 21,01**. Varejo vem pré-selecionado (é o caso comum). Desenhe também com um valor grande —
  **R$ 24.215,76** — porque o kit de 5 peças chega lá e a linha não pode quebrar nem cortar.
- **Data** — data do aparelho, no formato `20/08/2026`. Mostrada antes de gravar porque faz parte da
  declaração, não é efeito colateral.
- **Caso de uma opção só** — quando o cálculo congelado traz apenas um dos dois preços, o grupo desenha um
  rádio solitário já marcado: parece escolha e não é. Precisa de um tratamento próprio (ver Perguntas).

## Estados obrigatórios

1. **Repouso** — varejo já marcado, campos vazios, botão ativo. É o estado que o vendedor mais vê.
2. **Foco** — anel de foco visível em campo de texto, em campo numérico com sufixo e **na linha inteira do
   rádio** (a linha toda é o alvo, 44px de altura mínima, não só a bolinha).
3. **Hover / pressionado** — nas duas linhas de base e no botão de confirmar.
4. **Base alternada** — "Atacado" marcado. Mostre que a escolha ficou inequívoca à distância de um relance.
5. **Gravando** — botão desabilitado durante o envio; desenhe com spinner e o texto que o dono escolher
   (hoje não existe texto; o Kits usa "Salvando…").
6. **Erro de campo** — validade fora de 1–3650 dias, usando o estado de erro do DS por campo.
7. **Falha do aparelho (a folha NÃO fecha)** — o dispositivo não conseguiu nem guardar localmente: toast
   de perigo com "Não foi possível guardar o registro neste aparelho. Ele não foi salvo." e a folha
   permanece aberta com tudo preenchido — o vendedor não perdeu a cotação.
8. **Sucesso** — folha fecha, toast de sucesso "Registro salvo em Orçamentos."
9. **Pendente (offline)** — folha fecha, toast informativo "Pendente neste dispositivo. Sincroniza sozinho
   quando houver conexão."
10. **Envio pausado — premium** — toast informativo "Envio pausado — o Premium não está ativo. O registro
    continua neste aparelho."
11. **Envio pausado — sessão** — toast informativo "Envio pausado — sua sessão expirou. O registro
    continua neste aparelho." (a palavra "conexão" nunca aparece aqui: a causa é outra).
12. **Recusa do servidor** — toast de perigo "Não foi possível registrar. O servidor não aceitou este registro."
13. **Sem premium ativo** — a folha não existe e o botão que a abre também não. Não desenhe versão cinza.

Os estados 8 a 12 acontecem com a folha já fechada: desenhe cada toast sobre a tela de onde ela foi
chamada, não dentro da folha.

## Viewports

- **390px (obrigatório)** — é onde o vendedor realmente trabalha. Hoje o painel ocupa 92vw ancorado à
  direita, deixando uma faixa de scrim de ~32px à esquerda: mostre se isso é intencional ou se em telas
  estreitas a folha deve subir de baixo.
- **1280px (obrigatório)** — o corte desktop do 018. Hoje é literalmente o mesmo painel de 26rem colado na
  borda direita, sem variante: folha estreita e altíssima, seis elementos no topo e muito vazio embaixo.
- **1920px** — mesma folha, para mostrar como ela convive com o rail de navegação e a lista atrás.

## Regras que o desenho não pode quebrar

- **A base é a decisão principal da folha.** Ela precisa de mais peso visual que o rótulo opcional — e
  isso não pode virar um alerta vermelho: é uma escolha normal e correta, não um perigo.
- **Cada número aparece colado à sua base.** "Varejo" sem R$ ao lado é escolha às cegas.
- **Falha de rede nunca é vendida como falta de premium**, e sessão expirada nunca é chamada de conexão:
  são três textos distintos e todos já existem.
- **Frase honesta nunca dentro de placeholder.** "Cliente, pedido…" é hint abaixo do campo (é assim hoje;
  mantenha) — placeholder carrega só número.
- **Alvo ≥ 44×44px** em cada linha de rádio, no X de fechar e no botão.
- **Contraste medido contra o fundo real da folha** (superfície de card sobre scrim), não contra o fundo
  da página.
- **Nada de novo primitivo.** Só a composição muda.

## Armadilhas já pagas neste projeto

- **Valor grande estoura a coluna:** o valor da base é empurrado para a direita por espaçamento
  automático; com R$ 24.215,76 a 390px ele encosta no texto "Atacado". Desenhe a linha com o número
  grande, não só com 24,24.
- **Texto ocluso passa em teste:** o título reserva espaço para o X à direita; qualquer coisa nova no topo
  precisa desse mesmo respiro medido, e não basta "estar lá".
- **Rolagem no eixo vertical:** o painel rola; com teclado aberto a 390px, o botão de confirmar precisa
  continuar alcançável — mostre o estado com teclado virtual ocupando metade da tela.

## Entregável

Pranchetas, no tema escuro (padrão) **e** no claro, ambos de primeira classe:

1. **390px — repouso**, com os três campos e a nova hierarquia da base.
2. **390px — "Atacado" marcada** + a variante com valor grande (R$ 24.215,76).
3. **390px — foco e erro**: foco na linha de rádio, e validade com erro de faixa.
4. **390px — gravando** (botão com spinner) e **falha do aparelho** (folha aberta + toast de perigo).
5. **390px — os quatro toasts** (salvo / pendente / pausado premium / sessão) sobre a tela de origem.
6. **1280px e 1920px — repouso**, mostrando a forma da folha no desktop.
7. **390px — caso de uma base só**, com a proposta de tratamento.

Reutilize os primitivos existentes, nomeadamente: a folha em `tf-dialog--sheet` com seu X de fechar; o
título em `tf-dialog__title` e a introdução em `tf-dialog__desc`; os dois campos com o wrapper de campo do
DS (rótulo + hint + erro + marca "opcional") e o input em `tf-inputwrap` com afixo para o sufixo "dias";
o botão de confirmar como botão primário com estado de carregamento; os avisos como toasts nos tons
`success` / `info` / `danger` que já existem. Para a escolha de base, avalie o controle segmentado do DS
como alternativa aos rádios nativos — mas só se ele couber com o dinheiro de cada opção visível; se não
couber, mantenha a lista de linhas e resolva o peso por tipografia e superfície, sem inventar componente.

## Perguntas em aberto para o dono

1. Quando só existe **uma** base possível, o que a folha deve mostrar: o rádio solitário já marcado (hoje),
   uma linha de leitura sem escolha ("Cotando: Varejo — R$ 24,24"), ou nada?
2. A folha deve avisar **antes** de confirmar que o aparelho está offline e o registro ficará pendente, ou
   a honestidade continua só no toast depois de fechar?
3. A folha deve dizer em texto que a escolha é **irreversível** (ex.: "Depois de salvo, só o rótulo pode
   ser alterado")? É copy nova e afeta o tom da peça inteira.
4. O botão de confirmar deve continuar repetindo "Salvar em Orçamentos" ou receber um texto próprio (ex.:
   "Congelar este preço")? E qual é o texto do estado gravando?
5. A validade deve ter um valor sugerido (ex.: 15 dias) ou continuar em branco por padrão? Pré-preencher
   grava uma promessa que o vendedor não digitou.
6. No desktop, a folha continua ancorada à direita ou vira diálogo central?
