# Barra de filtros dos Orçamentos no celular

## O que desenhar
A faixa de filtro da aba **Orçamentos** (rota `/historico`) no celular: um campo de busca por rótulo,
uma escolha de período com quatro opções, e — quando o período é um intervalo escolhido à mão — uma
linha que declara o intervalo ativo com um jeito de desfazê-lo. Ela vive entre os avisos do topo
(banner de fila pendente, "Modo leitura offline", "Premium pausado") e a pilha de cards de orçamento
congelado. Quem usa é o vendedor Premium procurando o orçamento de um cliente específico numa lista
que é **ilimitada e paginada sob demanda** ("Carregar mais"): rolar não é alternativa, o filtro é o
único caminho até um registro antigo.

## Por que este prompt existe
O único desenho que existe desta barra é **desktop** (`Abas-Desktop.dc.html`, linhas 269–278) e o
código **não bate com ele**: o desenho tem lupa dentro do campo e `aria-label` invisível, presets como
`tf-badge--neutral` clicáveis (32px) na ordem 30 dias / 90 dias / Tudo / Período…, com o ativo pintado
em `accent-soft`. O código tem label **visível**, quatro `Button size="sm"` primary/secondary e a ordem
Tudo / 30 dias / 90 dias / Período… Não existe nenhuma prancheta mobile, e o protótipo de 2026-07-02
não ajuda: **não há busca nem filtro em lugar nenhum nele** (§E6 não menciona, a matriz §G não lista,
`HistoryScreen.jsx` não tem) — a busca nasceu no PR-B de 2026-07, depois do protótipo. Então: forma,
ordem, quebra de linha em 390px e as duas maneiras divergentes de limpar foram todas inferidas.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` (`HistoryFilterBar`), `historico-page.css`
(`.tf-historico__filters`, `__chips`, `__filterchip`) e `shared/i18n/messages.pt-br.ts` (`historico.*`).

| Parte | Como está hoje | Problema |
|---|---|---|
| Busca | `Field` com label **visível** "Buscar por rótulo" empilhado sobre um `tf-inputwrap`; placeholder "Cliente, pedido…"; `type="search"`, `maxLength 120`; debounce de 250 ms até a leitura no servidor | → rótulo e placeholder dizem a mesma coisa duas vezes e custam uma linha inteira da tela; **não há ícone de lupa** (o desenho desktop tem) |
| Presets | Quatro `Button size="sm"` numa fileira com `flex-wrap`, ordem "Tudo" · "30 dias" · "90 dias" · "Período…"; ativo = `primary` (bloco cheio de accent), inativos = `secondary` | → quatro botões lado a lado leem como **quatro ações**, não como uma escolha entre quatro; o ativo em primary compete com a ação primária da tela |
| Largura | Medido: 390px − 32px de gutter = **358px úteis**; os quatro botões (padding 16px de cada lado, `fs-body-sm`) somam ≈343px + 24px de gaps | → sobra ~15px. Qualquer fonte de sistema um pouco mais larga joga "Período…" para uma **segunda linha**, e a barra passa a ocupar 3 linhas antes do primeiro card |
| Intervalo ativo | Linha em `fs-caption`/`text-muted`: `Período: {de} – {ate}` com as datas **cruas do input** (ex.: "2026-07-01 – 2026-07-31"), seguida de um `Button ghost sm` "Limpar filtro" | → data em formato de máquina numa frase para humano; e o botão fica colado ao texto, sem hierarquia |
| Duas limpezas | "Limpar filtro" (no chip) volta **só** o período para "Tudo" e **mantém a busca digitada**. "Limpar busca" (no vazio de resultado) zera **busca + período + datas** | → dois rótulos parecidos com escopos diferentes; quem clica em "Limpar filtro" e continua sem resultado não entende por quê |
| Folha "Período…" | `Sheet` com título "Período…", campos "De" e "Até" (`type="date"`), rodapé "Voltar" (secondary) + "Aplicar" (primary) | → sem atalhos ("este mês", "mês passado") e sem dizer que o "Até" inclui o dia inteiro |
| Quando aparece | A barra só é renderizada se **há lista** ou **já há filtro em força**. Ledger frio e vazio: nenhuma barra | correto — desenhe sabendo disso |

## Conteúdo e dados reais
- Textos literais em pt-BR (não reescrever sem dizer que está reescrevendo): `"Buscar por rótulo"`,
  `"Cliente, pedido…"`, `"Tudo"`, `"30 dias"`, `"90 dias"`, `"Período…"`, `"De"`, `"Até"`,
  `"Aplicar"`, `"Voltar"`, `"Período: {de} – {ate}"`, `"Limpar filtro"`, `"Limpar busca"`,
  `"Nenhum registro encontrado para “{termo}”."`, `"Carregar mais"`.
- A busca casa **apenas o rótulo** do registro — campo opcional, escrito pelo vendedor na hora de
  salvar ("Rótulo (opcional)", dica "Cliente, pedido…"). Um registro salvo sem rótulo aparece na lista
  como `"Cálculo avulso"` e **nunca** é encontrado por busca.
- Exemplo verdadeiro para preencher as pranchetas: termo digitado `Ateliê Marina — pedido 118`;
  cards abaixo com `"Cotado em 12/08/2026"`, `"Valor cotado"` **R$ 1.234,56**, legenda
  `"preço de varejo"`, e um segundo card `"Kit · 4 peças"` com **R$ 389,90**.
- `{termo}` na frase de vazio recebe o termo **debounced**; se só houve período, recebe o rótulo do
  período ("30 dias", "90 dias") ou o intervalo ("2026-07-01 – 2026-07-31").
- Presets são limites inferiores calculados no aparelho (30/90 dias atrás); o intervalo à mão manda as
  duas pontas, com o "Até" incluindo o dia inteiro até o último milissegundo.

## Estados obrigatórios
- **Repouso** — nenhum filtro, "Tudo" selecionado, campo de busca vazio mostrando o placeholder.
- **Foco no campo** — anel de foco do DS visível contra o fundo real do card, nos dois temas.
- **Digitando** — termo no campo; hoje **não há nenhum sinal** de que uma leitura vai disparar em
  250 ms; decida se algo aparece (e o quê) ou se o silêncio é intencional.
- **Carregando** — a lista abaixo some e vira um `Spinner`; **a barra continua no lugar** com o que foi
  digitado. Desenhe esse par (barra viva + lista carregando), porque é o que o vendedor vê.
- **Preset selecionado / não selecionado / pressionado / com hover** — quatro pílulas, uma escolhida.
- **Intervalo à mão ativo** — a linha "Período: 01/07/2026 – 31/07/2026" com sua saída.
- **Vazio por filtro** — `EmptyState` com `"Nenhum registro encontrado para “Ateliê Marina — pedido 118”."`
  e o botão `"Limpar busca"`. Nunca o vazio frio ("Nenhum registro ainda").
- **Offline com filtro** — o filtro é um refinamento **do servidor**: sem conexão a leitura filtrada não
  cai no cache do aparelho, de propósito, então sobra só a fila local; com a fila vazia a tela cai hoje
  no muro vermelho `"Não foi possível carregar seus orçamentos."` + `"Tentar novamente"`, com a barra
  ainda oferecendo o filtro como se funcionasse. Desenhe o estado honesto.
- **Premium pausado** — o alerta `"Premium pausado — seus registros continuam aqui e podem ser abertos…"`
  fica acima; a barra continua **inteiramente utilizável** (ler e filtrar não exigem Premium ativo).
- **Sessão expirada** — o banner de sessão manda; a barra não repete a causa nem oferece "tentar de novo".
- **Barra ausente** — ledger vazio e sem filtro: nada de campo de busca sobre o nada.

## Viewports
- **390px — obrigatório e principal.** É onde a barra não cabe por ~15px e onde a decisão de forma se
  paga. Todas as pranchetas de estado saem daqui.
- **1280px — uma prancheta de reconciliação.** Acima do corte a mesma barra vive na coluna mestre do
  mestre-detalhe (a coluna mede ≈410px a 1280px, ganhando largura fixa de 520px só a partir de 1440px).
  É o **mesmo componente**: se a solução de 390px não sobreviver a 410px, ela está errada. Mostre-a ao
  lado do que o `Abas-Desktop.dc.html` já desenhou e diga qual das duas formas vence.

## Regras que o desenho não pode quebrar
- **Vazio por filtro nunca se veste de ledger vazio.** O vendedor tem histórico; esta busca é que erra.
- **Falha de rede nunca é vendida como "nada encontrado"** nem como "não é premium". Sem conexão, a
  frase diz *conexão* — em elemento de texto próprio, **nunca dentro de um placeholder** (o placeholder
  some quando se digita e é cortado pela largura do campo).
- **A fila local nunca é filtrada.** Um orçamento ainda não sincronizado aparece na lista *mesmo que não
  case com a busca* — é dado do vendedor e sumir seria pior. O desenho precisa de um jeito de isso não
  parecer bug (o card já traz o selo "Pendente neste dispositivo").
- **Alvo ≥44px em toda pílula e no "Limpar filtro".** O `tf-badge` de 32px do desenho desktop está
  abaixo do mínimo no celular — se a forma de badge for adotada, ela sobe para 44px de altura mínima.
- **Sem rolagem horizontal em nenhum eixo** e sem texto ocluso: a barra é medida por caixa, não por
  "o texto está lá".
- **Contraste do estado selecionado medido contra o fundo real** (`accent-soft` no claro e no escuro),
  não contra um cinza imaginado.
- **O selecionado não pode competir com a ação primária da tela**: um filtro é uma escolha, não um botão
  de confirmar.

## Armadilhas já pagas neste projeto
- **Overflow medido nos dois eixos.** O headless não enxerga barra de rolagem clássica; o 016/PR-B
  perdeu um item inteiro por medir só a horizontal. Aqui a soma dos quatro presets é o risco.
- **Asserção de texto é cega para colisão.** "está visível" passa com o elemento ocluso ou estourado
  (014, três vezes numa fase). O que decide esta barra é geometria.
- **Frase honesta em placeholder é frase perdida** (016/PR-F): placeholder carrega exemplo, nunca aviso.
- **Sintoma de layout se diagnostica em navegador real** (E5, três vezes): não confie que "cabe".
- **Valor longo estoura a linha**: "Período: 01/07/2026 – 31/07/2026" + "Limpar filtro" na mesma linha,
  a 358px, é o caso adversarial desta peça.

## Entregável
Pranchetas, tema **escuro como padrão e claro como cidadão de primeira classe** (ambos desenhados):

1. 390px — repouso, com três cards de orçamento abaixo para dar contexto.
2. 390px — busca ativa com o termo longo do exemplo + resultado.
3. 390px — carregando (barra viva, lista em spinner).
4. 390px — vazio por busca, com a frase exata e "Limpar busca".
5. 390px — intervalo à mão ativo (linha do período + saída).
6. 390px — folha "Período…" aberta, com "De", "Até", "Voltar" e "Aplicar".
7. 390px — offline com filtro em força.
8. 1280px — a mesma barra na coluna mestre de ≈410px, comparada ao desenho desktop existente.

**Reutilize os primitivos, não crie novos**: `Segmented` (`tf-segmented`, bandeja com pílula
selecionada, já com 44px de altura mínima e navegação por setas — foi extraído no 018 justamente para
ter um dono só) **ou** `Badge` (`tf-badge`) clicável para os presets — escolha um e justifique;
`tf-inputwrap` + `tf-input` para a busca, com o ícone de lupa do `Icon` dentro do wrap; `Button`
`ghost`/`sm` para "Limpar filtro"; `Sheet` para a folha de período; `EmptyState` para o vazio;
`Alert` tom `info` (nunca `danger`) para o estado offline.

## Perguntas em aberto para o dono
1. **As duas limpezas viram uma só?** Hoje "Limpar filtro" zera só o período e "Limpar busca" zera os
   três. Um único "Limpar filtros" é mais simples, mas apaga um termo que o vendedor pode querer manter
   enquanto troca o período. Qual escopo é o certo — e como cada rótulo o declara?
2. **Qual ordem dos presets?** Código: Tudo · 30 dias · 90 dias · Período… Desenho desktop:
   30 dias · 90 dias · Tudo · Período… A primeira posição comunica qual é o padrão.
3. **Filtrar sem conexão: bloquear ou deixar tentar?** Desabilitar a barra com um aviso é honesto e
   fecha uma porta; deixar tentar e explicar mantém a porta e exige uma frase boa. Hoje o app deixa
   tentar e devolve um erro genérico vermelho.
4. **A busca cobre só o rótulo.** Um registro salvo sem rótulo ("Cálculo avulso") é inatingível por
   busca. Isso deve ser dito na barra (uma dica sob o campo), aceito em silêncio, ou a busca deveria
   cobrir mais campos (o que é mudança de contrato, não de desenho)?
5. **O período à mão merece atalhos** ("este mês", "mês passado", "este ano") na folha, ou dois campos de
   data bastam para o vendedor que procura o pedido de um cliente?
