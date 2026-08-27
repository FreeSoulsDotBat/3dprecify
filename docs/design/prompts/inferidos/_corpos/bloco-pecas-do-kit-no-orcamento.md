# Bloco "Peças do kit" dentro do orçamento congelado

## O que desenhar

A lista itemizada das peças de um kit dentro do **detalhe de um registro da aba Orçamentos** — o
documento congelado e imutável (ADR-0019), aquele que o vendedor abre na frente do cliente para provar
o que cobrou e quando. O bloco só existe quando o registro é de um kit; um registro de peça única não
o tem. Cada linha é uma peça do kit **como ela foi capturada no dia**: o nome que ela tinha então, a
quantidade e o valor daquela peça já multiplicado pela quantidade. É a prova itemizada de "por que o
total deu R$ 1.348,00" — e é a única parte do documento em que o cliente confere item a item.

## Por que este prompt existe

O bloco nunca foi desenhado. O protótipo é de 2026-07-02, **anterior ao próprio conceito de kit** (E3
chegou em 2026-07-11), e o canvas do dono (018) foi verificado inteiro: a aba Orçamentos vai do card da
alegação direto para um grid de duas colunas com "Detalhamento" à esquerda e "Preços por canal" +
"Ficha técnica" à direita — **não há bloco de peças em lugar nenhum**, o registro exemplar é peça
única. Resta uma linha de ASCII em `ux-history.md` §3 (`Vaso G  3×  R$ 135,00`), e até ela foi
contrariada depois: a troca de "3×" por "3 un" veio de um comentário em revisão de código, não de
desenho. E a homologação **F11b-001 (severidade Alto, bloqueia provisionamento)** já mediu o preço
dessa ausência neste bloco exato — ver Armadilhas.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/historico/snapshot-detail-page.tsx` (função `KitLines`),
`historico-page.css` (`.tf-historico__piece`, `.tf-historico__qty`, `.tf-historico__section`) e
`apps/web/src/shared/i18n/messages.pt-br.ts` (`historico.*`).

Forma atual: um título `<h2>` em **caixa alta, 13px, cinza, com letter-spacing** — "PEÇAS DO KIT" —
e, abaixo, uma pilha de linhas de 3 colunas com `gap` de 4px entre elas, **sem nenhum separador**:

| Coluna | Conteúdo | Comportamento atual |
|---|---|---|
| esquerda | nome capturado da peça — ex.: "Suporte Articulado para Monitor Duplo" | cor de corpo; **não trunca** (não há ellipsis nesta classe, ao contrário do rótulo do card da lista) |
| meio | quantidade: `"{n} un"` → **"3 un"** | cinza `--text-muted`, algarismos tabulares |
| direita | valor total da peça: **"R$ 405,00"** | `<strong>` empurrado por `margin-inline-start:auto`, tabular; **"—"** quando não há valor |

Vizinhança real de um registro de KIT, na ordem exata da tela: badge de sincronização (se ≠ sincronizado)
→ card da alegação ("Cotado em 12/08/2026 às 14:32", "Valor cotado **R$ 1.348,00**", "preço de varejo",
"Validade da proposta: 15 dias") → banner de premium pausado (quando for o caso) → ações de renomear/
excluir → "Valores congelados em 12/08/2026" → **PEÇAS DO KIT** → "Custo total R$ 981,40" → "PREÇOS POR
CANAL" → "FICHA TÉCNICA" → "Comparar com hoje" → [Recalcular hoje] [Exportar].

Problemas a resolver no desenho:

- → **Um kit de 8 ou 11 peças vira um bloco de texto contínuo.** `gap: 4px`, zero separador, zero
  zebra, zero respiro — enquanto o bloco vizinho ("Detalhamento") usa `tf-brow`, que tem `min-height:
  40px`, `padding` vertical e **borda entre linhas**. Duas listas coladas na mesma tela, com dois
  ritmos diferentes, sem regra que explique por quê.
- → **A coluna do valor é estreita demais e quebra o dinheiro em duas linhas** (medido: 81px). Ver
  Armadilhas.
- → **Nome longo não trunca e come a coluna do valor**, empurrando o `<strong>` para fora do lugar; a
  quantidade "3 un" chega a partir em `3` / `un`.
- → **A leitura "quantidade × preço" é ambígua justamente onde não pode ser.** O valor já vem
  multiplicado, então "3 un … R$ 405,00" não é preço unitário — mas nada na linha diz isso, e o
  cliente que multiplicar de novo chega a R$ 1.215,00.
- → **O bloco não diz a sua base.** As peças são itemizadas na base da manchete (um kit cotado em
  atacado itemiza em atacado); "preço de varejo" está lá em cima, no card da alegação, longe daqui.
- → **Num registro de kit, "Detalhamento" não existe** (o detalhamento gravado é de peça única). Então
  logo abaixo das peças aparece um "Custo total" **sozinho**, com a borda superior de 2px que a classe
  de total desenha — um total órfão, sem a lista que ele deveria fechar.
- → **`tf-historico__qty` significa duas coisas na mesma tela**: aqui é a quantidade ("3 un"); em
  "Preços por canal" é o rótulo da linha ("anúncio", "líquido").

## Conteúdo e dados reais

- **Nome** (texto, opcional): o nome **capturado**, nunca consultado hoje — renomear o produto no
  catálogo não reescreve um orçamento passado. Quando a peça foi um cálculo sem produto, o texto
  literal é **"Cálculo avulso"**.
- **Quantidade** (inteiro ≥ 1): formatada como `"{n} un"` → "1 un", "3 un", "12 un". Nunca "3×".
- **Valor** (dinheiro `R$ 1.234,56`): já multiplicado pela quantidade. Faixa real medida em produção
  de homologação: de **R$ 16,16** a **R$ 70.867,77** — e valores acima de mil são comuns num kit
  (R$ 1.107,72 · R$ 2.024,96 · R$ 3.471,12 · R$ 4.339,30). **"—"** quando o documento não guardou
  valor para a base cotada; nunca "R$ 0,00" (ausente ≠ zero, FR-507).
- Quantidade de linhas: de 1 a mais de 11 (medido: 11 peças num registro real).
- O documento guarda por peça, mas **não mostra hoje**: o detalhamento por unidade e as entradas
  resolvidas. Não invente esses números na prancheta; se propuser expor algo, marque como proposta.

## Estados obrigatórios

- **Repouso, kit curto** (3 peças, nomes curtos, todos com valor).
- **Repouso, kit longo** (11 peças) — o estado que prova o ritmo da lista.
- **Nome longo** (≥ 45 caracteres, sem espaços em parte dele) ao lado de **R$ 70.867,77**.
- **Peça sem nome**: a linha mostra "Cálculo avulso" com a mesma dignidade das outras.
- **Peça sem valor para a base cotada**: "—" no lugar do dinheiro.
- **Base atacado**: o mesmo bloco quando o kit foi cotado em atacado (a base precisa estar dita).
- **Ausente**: registro de peça única — o bloco não existe, e nada ocupa o seu lugar.
- **Premium pausado**: o bloco continua **inteiro e legível** — a pausa só suspende escrita; nada aqui
  some, escurece ou ganha cadeado.
- **Offline / registro pendente**: idêntico, sem nenhuma degradação — o documento contém os seus
  valores e não referencia nada, então nada nele pode apodrecer.
- **Carregando** e **erro de leitura**: são da página inteira, não deste bloco (spinner; ou "Não foi
  possível carregar seus orçamentos." + [Tentar novamente]). Desenhe apenas o que sobra no lugar.
- **Sem estado interativo**: hoje nenhuma linha é clicável, e isso é deliberado — não há hover, foco
  nem pressionado a desenhar. Se propuser um alvo tocável, ele é ≥ 44px e vai para Perguntas.

## Viewports

- **Mobile 390px** — obrigatório, e é onde o defeito medido dói mais: a 360px, 7 das 11 peças
  quebraram o valor em duas linhas. É a largura em que o vendedor mostra o orçamento ao cliente.
- **Desktop 1280px** — o detalhe é a **coluna direita** de um mestre-detalhe (018/US2): sem moldura de
  página, sem "Voltar", sem segundo `<h1>`, com rolagem própria e largura menor que a da janela. É a
  largura que decide se o bloco entra no grid de duas colunas do canvas ou atravessa as duas.
- **Desktop 1920px** — a mesma composição com folga; mostre o que fazer com o espaço extra sem esticar
  a coluna do dinheiro até desgrudar do nome.

## Regras que o desenho não pode quebrar

- **Zero recálculo**: todo número aqui é uma string gravada, apenas formatada. O desenho não pode
  sugerir soma, média ou "preço unitário" — esse número não existe no documento.
- **Ausente não é zero**: "—" é a única forma de dizer que não há valor. Nunca "R$ 0,00".
- **Nome capturado, não nome de hoje**: nada no bloco pode parecer link vivo para o catálogo. A
  regra das duas prateleiras é o produto inteiro aqui.
- **`R$` e o número são uma coisa só.** A copy do projeto já escreveu isso: *"Numa linha de PREÇO,
  separar o símbolo do valor é a única quebra que não se permite"*.
- **Leitura sem permissão**: nenhum estado de assinatura esconde, borra ou trunca este bloco.
- Contraste medido contra o fundo real do card (claro e escuro), alvos ≥ 44px se houver algum.

## Armadilhas já pagas neste projeto

- **F11b-001, severidade Alto, bloqueava provisionamento, neste bloco exato**: a coluna do valor mede
  **81px** e `R$ 70.867,77` renderiza com o "R$" numa linha e "70.867,77" na outra — em 1440px, 390px
  e 360px, sem transbordo (`scrollWidth === clientWidth`). **Nenhuma asserção de texto vê isso**:
  `toContainText("R$ 70.867,77")` passa. Só a imagem e a geometria pegam.
- Texto ocluso ou transbordado passa em teste de visibilidade — layout se homologa com caixas.
- Nome sem espaços (um código colado) não tem onde quebrar: 300 caracteres já geraram 2.100px de
  rolagem horizontal noutro bloco desta mesma família, e o culpado era um nó de texto pintando fora
  da caixa, invisível a qualquer medida de elemento.
- Frase honesta nunca mora em placeholder nem em texto cortado — se a base cotada ou o "já
  multiplicado" for dito, é em elemento de largura inteira.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como igual**:

1. Mobile 390px — kit de 3 peças (repouso).
2. Mobile 390px — kit de 11 peças com nome longo, valor de R$ 70.867,77, uma peça "Cálculo avulso" e
   uma com "—". É a prancheta que resolve o defeito medido.
3. Desktop 1280px — o bloco dentro da coluna direita do mestre-detalhe, mostrando a decisão de grid
   (uma coluna cheia ou metade) e a relação com o "Custo total" órfão logo abaixo.
4. Desktop 1920px — a mesma composição com folga.
5. Uma tira comparativa: a linha de peça ao lado de uma linha `tf-brow` de "Detalhamento", para
   justificar por que os dois ritmos são iguais ou por que são diferentes.

Reutilize os primitivos existentes em vez de criar novos: o título do bloco é o mesmo
`tf-historico__section` dos blocos vizinhos ("Detalhamento", "Preços por canal", "Ficha técnica"); a
linha de peça deve ser resolvida **ou** aproximando-a de `tf-brow` (rótulo + sub-rótulo + valor
tabular, com borda entre linhas) **ou** justificando por escrito por que ela permanece mais compacta;
o dinheiro usa a fonte numérica tabular do sistema; o card que abriga o bloco é `tf-card`. Entregue
também os valores de espaçamento, largura mínima da coluna de dinheiro e a regra de truncamento (ou de
quebra) do nome — são exatamente os três números que faltaram.

## Perguntas em aberto para o dono

1. **A base cotada aparece no bloco?** Hoje "preço de varejo/atacado" só é dito no card da alegação, e
   as peças são itemizadas nessa base sem repeti-la. Vira sub-rótulo do título ("PEÇAS DO KIT · preço
   de varejo"), legenda de rodapé, ou continua implícita?
2. **Diz-se que o valor já está multiplicado?** Uma frase curta ("valores já multiplicados pela
   quantidade") elimina a ambiguidade, mas acrescenta ruído a um documento que o cliente lê. Vale?
3. **O bloco ganha uma linha de soma das peças?** Hoje ele termina sem total próprio, e o "Custo
   total" logo abaixo é outra coisa (custo, não preço) — dois números perto que não se somam.
4. **Um kit longo (11+ peças) rola inteiro ou colapsa** ("ver todas as 11 peças")? No desktop a
   coluna já tem rolagem própria; no mobile, 11 linhas empurram o resto do documento para longe.
5. **Nome longo: trunca com reticências (e revela como?) ou quebra em duas linhas?** As duas escolhas
   são defensáveis e mudam a forma da linha inteira — mas num documento imutável, truncar esconde
   informação que ninguém pode mais editar.
6. **A peça deve poder abrir o produto de origem?** Hoje não abre, e a regra das duas prateleiras
   sugere que não deve; mas o vendedor pode querer ir do item ao catálogo.
