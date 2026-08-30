# Folha "Período…" — o intervalo de datas dos Orçamentos

## O que desenhar
O painel que abre quando o vendedor toca em **"Período…"** na barra de filtros da aba **Orçamentos**
(o registro congelado de cada cotação). A barra tem quatro controles em linha — `Tudo`, `30 dias`,
`90 dias`, `Período…` — e os três primeiros filtram na hora; o quarto abre esta folha, onde ele
escolhe um intervalo **De/Até** e confirma. É o **único componente de data do produto inteiro**, e é
usado num momento específico: o vendedor tem dezenas de orçamentos e quer achar "aquele de julho"
para reenviar ao cliente ou comparar com o preço de hoje. Depois de aplicar, a folha fecha, a lista
recarrega do servidor com o intervalo e uma marca de filtro ativo aparece abaixo dos botões.

## Por que este prompt existe
Nunca houve desenho de data neste produto. A única fonte é uma **recomendação escrita** no
`ux-history.md` §9.2 (gap G4): *"no date primitive… preset chips + a Sheet with two native
`<input type=date>`"* — e o código seguiu a recomendação ao pé da letra. Ou seja: a decisão de
entregar o **seletor nativo do sistema operacional** (que aparece diferente no Android, no iOS e no
desktop, com tipografia e cores que não são as nossas) nunca foi desenhada, só herdada do navegador.
Junto vieram três omissões que também nunca passaram por desenho: **não há validação** quando "De" é
posterior a "Até", **não há atalho** nenhum (este mês, ano passado), e **em lugar nenhum se diz que
deixar um campo em branco significa "sem limite"** — embora o filtro aceite intervalo aberto e
simplesmente omita o campo vazio.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` (`HistoryFilterBar`), textos em
`messages.pt-br.ts` → `historico.*`.

A folha é uma `Sheet` ancorada na **borda direita**, altura inteira da tela, largura
`min(92vw, 416px)`, e **sem o botão X de fechar** (`showClose={false}`). Conteúdo, na ordem exata:

| Ordem | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Título da folha | `"Período…"` | → é o **mesmo texto do botão que a abriu**. Reticências num botão significam "abre um painel"; como título de painel já aberto, prometem uma continuação que não vem. |
| 2 | Campo 1 (`Field` + input nativo de data) | rótulo `"De"` | sem dica, sem marca de "opcional", sem exemplo de formato |
| 3 | Campo 2 (`Field` + input nativo de data) | rótulo `"Até"` | idem |
| 4 | Botão secundário | `"Voltar"` | → é o **único** caminho visível de saída (não há X); Esc e o toque no scrim funcionam, mas nada os anuncia |
| 5 | Botão primário | `"Aplicar"` | alinhado à direita, colado no "Voltar" |

Fora da folha, o que ela produz:

- marca de filtro ativo: `"Período: {de} – {ate}"` + botão fantasma `"Limpar filtro"`;
  → os valores entram **crus, em ISO**: a marca lê `Período: 2026-07-01 – 2026-07-31` enquanto
  **todo card da lista** diz `Cotado em 31/07/2026`. Duas grafias de data na mesma tela.
- lista sem resultado: `"Nenhum registro encontrado para “{termo}”."` + `"Limpar busca"`;
  → num filtro só de período o `{termo}` vira `2026-07-01 – —`, e a frase passa a dizer que não
  achou registro "para 2026-07-01 – —", que não é português nem é o que aconteceu.

→ **Aplicar com os dois campos em branco**: o botão `Período…` fica **destacado como ativo** (estado
primário), mas nada é filtrado e nenhuma marca aparece. A barra afirma um filtro que não existe.
→ **De posterior a Até**: aceito sem aviso; a lista volta vazia e a tela culpa a busca.
→ O título reserva um vão à direita para um X que não é renderizado — espaço morto no cabeçalho.

## Conteúdo e dados reais
- **De** e **Até** são datas de calendário (dia inteiro), não horários. O limite superior é
  **inclusivo até o último milissegundo do dia escolhido** — quem escolhe `31/07/2026` recebe os
  orçamentos daquele dia também. Isso é verdade no código e **não está escrito em lugar nenhum**.
- Ambos são **opcionais e independentes**: só "De" = "de 01/07/2026 até hoje"; só "Até" = "tudo até
  31/07/2026"; os dois vazios = sem filtro.
- Faixa plausível: o produto tem orçamentos desde 2026; datas futuras não retornam nada.
- Exemplo real para a prancheta: `De 01/07/2026` · `Até 31/07/2026`, marca ativa
  `Período: 01/07/2026 – 31/07/2026`, lista com um card `Cotado em 18/07/2026 · Valor cotado
  R$ 1.234,56 · preço de varejo`.
- Os presets vizinhos, para o desenho ficar coerente: `"Tudo"`, `"30 dias"`, `"90 dias"` (contados
  para trás a partir de hoje, pelo relógio do aparelho).

## Estados obrigatórios
1. **Repouso, folha recém-aberta** — os dois campos com o valor já aplicado (a folha reabre com o
   rascunho do que está em vigor), ou vazios na primeira vez.
2. **Foco** em cada campo de data (anel de foco visível sobre o fundo da folha, medido).
3. **Hover / pressionado** em `Voltar`, `Aplicar` e no botão `Período…` que a abriu.
4. **Aplicar desabilitado ou não** — hoje ele nunca desabilita; mostre a decisão que você propõe
   para o caso "dois campos em branco" (ver Perguntas ao dono).
5. **Erro de intervalo invertido** — "De" depois de "Até". O `Field` já tem linha de erro própria
   (vermelha, abaixo do campo, com papel de alerta); use-a. Não existe frase homologada para este
   caso: proponha uma e marque como proposta.
6. **Carregando após aplicar** — a folha fecha e a lista é substituída por um indicador centralizado
   enquanto o servidor responde; a marca `Período: 01/07/2026 – 31/07/2026` já está visível.
7. **Sem resultado no intervalo** — estado vazio da lista com a frase de "nada encontrado" e o
   caminho de volta (`Limpar filtro`).
8. **Offline** — hoje o filtro de período **depende do servidor**: sem rede a consulta filtrada volta
   vazia e a tela mostra "nenhum registro", com o aviso `"Modo leitura offline"` /
   `"Seus registros continuam aqui. Novos registros ficam pendentes neste dispositivo até você voltar
   a ficar online."` acima da barra. A folha em si não diz nada. **Isso é uma falha de rede aparecendo
   como ausência de dados** — desenhe o estado que conta a verdade dentro da folha.
9. **Premium pausado** — o vendedor **pode** ler e filtrar; a página já mostra
   `"Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear,
   excluir ou exportar, reative o Premium."`. A folha **não** ganha cadeado nem trava.
10. **Filtro ativo combinado com busca** — a busca por rótulo (`"Cliente, pedido…"`) pode estar
    preenchida ao mesmo tempo; mostre a barra com os dois filtros vivos.

## Viewports
- **Mobile 390px** — é onde a peça nasceu e onde o seletor nativo domina a tela. A folha ocupa
  ~359px (92vw) na borda direita, altura inteira. Desenhe também a barra de filtros com os quatro
  controles **quebrando linha** (é o que o CSS faz), porque é ali que "Período…" pode cair sozinho
  numa segunda linha.
- **Desktop 1280px** — a mesma folha existe: acima de 1280px a aba vira mestre-detalhe, com a lista
  e seus filtros numa coluna à esquerda (mínimo 320px) e o **orçamento congelado à direita**. A folha
  ancorada na direita **cobre justamente o documento aberto**. Mostre esse enquadramento e resolva-o.
- **Desktop 1920px** — a coluna da lista passa a 520px fixos e sobra muito espaço à direita; vale
  mostrar se a folha continua sendo a forma certa nessa largura ou se o intervalo cabe na própria
  barra.

## Regras que o desenho não pode quebrar
- **Uma data só tem uma grafia na tela.** Se o card diz `18/07/2026`, a marca de filtro não pode
  dizer `2026-07-18`.
- **O que é opcional é dito, não adivinhado.** "Campo em branco = sem limite" precisa estar escrito
  em texto de dica (não em placeholder — placeholder some ao digitar e é cortado quando o campo é
  estreito; frase honesta nunca mora em placeholder neste projeto).
- **Falha de rede nunca vira "não existe".** Offline, a folha não pode deixar o vendedor concluir que
  seus orçamentos de julho sumiram.
- **Nada aqui é gate de Premium.** Filtrar é leitura; leitura continua aberta no plano pausado.
- **Alvos de toque ≥44px**, inclusive nos campos de data e nos dois botões do rodapé.
- **Contraste medido contra o fundo real da folha** (superfície de card sobre scrim), nos dois temas.
- O painel tem **uma saída visível**; se o X continuar ausente, `Voltar` precisa ser inequívoco.

## Armadilhas já pagas neste projeto
- **Texto que passa em teste e não aparece na tela.** Marca de filtro e frase de vazio já foram
  medidas por asserção de texto e nada acusou a data em ISO — só olhando é que se vê.
- **Overflow horizontal a 390px**: quatro controles + a marca `Período: 01/07/2026 – 31/07/2026` +
  `Limpar filtro` na mesma faixa estouram a coluna se não quebrarem. Desenhe a quebra, não confie
  nela.
- **Valor longo estourando a linha**: no desktop a marca fica numa coluna que pode encolher a 320px.
- **Placeholder que corta a frase honesta** (016/PR-F): a explicação do intervalo aberto vai em
  elemento de largura inteira.
- **Rótulo repetido com significados diferentes**: "Limpar filtro" (período) e "Limpar busca"
  (rótulo) convivem na mesma tela — não crie um terceiro "Limpar".

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. Folha aberta em repouso — 390px e 1280px (esta com o orçamento congelado atrás, para mostrar a
   oclusão).
2. Folha com intervalo preenchido + foco no segundo campo.
3. Folha em erro de intervalo invertido.
4. Folha no estado offline.
5. Barra de filtros com o período aplicado, em 390px (com quebra de linha) e 1280px.
6. Lista sem resultado no intervalo.
7. Opcional, se você propuser: a variante com atalhos ("Este mês", "Mês passado", "Este ano") acima
   dos campos — marcada claramente como **proposta**, porque não existe hoje.

Reaproveite os primitivos existentes, sem criar novos: a folha é o `Sheet`/`SheetContent`
(ancorado à direita) com `SheetTitle`; cada data é um `Field` (que já tem rótulo, marca "opcional",
linha de dica e linha de erro) envolvendo o `tf-input`; o rodapé é `Button` secundário + `Button`
primário; os presets e a marca de filtro ativo usam `Button` `sm` (primário quando ativo, secundário
quando não) e `Button` `ghost` para o "Limpar filtro"; o aviso offline é o `Alert` de tom
informativo; o vazio é o `EmptyState`. Se o desenho pedir um calendário próprio, ele é um
**componente novo** e precisa vir descrito como tal, com todos os estados de célula.

## Perguntas em aberto para o dono
1. **Seletor nativo ou calendário desenhado?** Manter o do sistema operacional é rápido e acessível,
   mas quebra a identidade visual e aparece diferente em cada aparelho. Um calendário nosso é um
   primitivo novo no design system. Essa escolha muda a peça inteira.
2. **Atalhos de período**: entram ("Este mês", "Mês passado", "Este ano") ou os três presets atuais
   (`Tudo`, `30 dias`, `90 dias`) bastam? Se entrarem, substituem os presets ou convivem?
3. **Aplicar com os dois campos em branco** deve equivaler a `Tudo` (limpando o filtro), ficar
   desabilitado, ou mostrar erro?
4. **Offline**: a folha "Período…" deve ficar indisponível com uma frase honesta enquanto não há
   rede, ou continuar abrindo e explicar o resultado depois?
