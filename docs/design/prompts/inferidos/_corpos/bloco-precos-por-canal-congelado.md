# Preços por canal dentro de um orçamento congelado

## O que desenhar
O cartão **"Preços por canal"** que aparece dentro do detalhe de um orçamento salvo (aba Orçamentos →
abrir um registro). É onde o vendedor confere, meses depois, quanto teria anunciado e quanto teria
**recebido líquido** em cada marketplace *no dia em que cotou*. Cada canal é um bloco com o nome do
marketplace e até **quatro linhas de dinheiro** (anúncio e líquido × varejo e atacado). Mas o mesmo
bloco também precisa contar três coisas que **não são preço**: um canal que não teve comissão
informada, um erro gravado naquele canal e, quando o orçamento é de um kit, quantas peças realmente
somaram naquele canal. Hoje essas três frases são visualmente idênticas entre si e idênticas a
qualquer legenda cinza da tela. Esse é o problema central a resolver.

## Por que este prompt existe
O protótipo de 2026-07-02 desenhou só o **caso feliz**: dois canais ("Mercado Livre · Clássico" e
"Shopee"), cada um com duas linhas — "anúncio" e "líquido" — e nada mais. O produto de hoje tem
**quatro linhas por canal** (o desdobramento varejo/atacado nunca foi desenhado) e três recados de
exceção criados em 2026-08 sem autoridade de desenho nenhuma. Uma IA decidiu que os três seriam
`tf-historico__meta` — a legenda cinza pequena, a mesma do rodapé da ficha técnica. Resultado: "sem
comissão informada — este canal não teve preço" tem exatamente o mesmo peso visual que "Data
registrada pelo seu aparelho", e fica lado a lado com canais que **têm** preço. É uma frase que
existe justamente para impedir uma leitura errada, vestida como rodapé.

## O que já existe hoje (não invente do zero — corrija)
Ordem real dentro de um bloco de canal (arquivo de origem: `pages/historico/snapshot-detail-page.tsx`):

| # | Elemento | Texto/valor real | Observação |
|---|---|---|---|
| 1 | Título da seção | `Preços por canal` | caixa alta, 0.8125rem, cinza (`tf-historico__section`) |
| 2 | Nome do canal | `Mercado Livre`, `Shopee`, `Amazon`, `Outro`, ou `Canal` | negrito, tamanho de corpo |
| 3 | Linha 1 | `Preço para anunciar · Varejo` — **R$ 231,88** | rótulo à esquerda, valor à direita |
| 4 | Linha 2 | `Recebido líquido · Varejo` — **R$ 196,44** | |
| 5 | Linha 3 | `Preço para anunciar · Atacado` — **R$ 176,90** | |
| 6 | Linha 4 | `Recebido líquido · Atacado` — **R$ 149,20** | |
| 7 | Recado A | `sem comissão informada — este canal não teve preço` | **substitui** as 4 linhas |
| 8 | Recado B | o erro gravado naquele canal, ecoado literal (ex.: `Corrija os campos deste canal para ver os preços.`) | pode coexistir com as 4 linhas |
| 9 | Recado C | `3 de 5 peças` | só em kit; convive com as 4 linhas |

→ **Problema 1:** os itens 7, 8 e 9 são hoje o MESMO estilo (cinza, 0.8125rem). Um é uma recusa
honesta, o outro é uma falha, o terceiro é uma informação neutra de composição. Três naturezas, uma
aparência.
→ **Problema 2:** a legenda dupla `Preço para anunciar · Atacado` é longa; em 390px, com um valor de
5 dígitos, ela e o dinheiro disputam a mesma linha (o valor é empurrado para a direita com
`margin-inline-start:auto`, tabular-nums, e não quebra).
→ **Problema 3:** o recado A começa em minúscula e no meio da frase ("sem comissão…"), o que reforça
a leitura de rodapé em vez de recado.
→ **Problema 4:** com 3 ou 4 canais salvos, o cartão vira uma coluna longa de blocos indistintos —
não há separação visual entre um canal e o seguinte, só um respiro de 4px.

## Conteúdo e dados reais
- **Nome do canal**: vem gravado; quando o marketplace não foi informado, o texto é literalmente
  `Canal`. Nomes conhecidos: `Mercado Livre`, `Shopee`, `Amazon`, `Outro`. Um registro antigo pode
  trazer texto livre que o app não conhece e mostra cru — desenhe supondo nome de até ~28 caracteres.
- **Dinheiro**: string congelada, apenas formatada — `R$ 1.234,56`. Faixa plausível: `R$ 8,90` a
  `R$ 4.780,00`. Use `R$ 231,88`, `R$ 196,44`, `R$ 176,90`, `R$ 149,20` nas pranchetas.
- **Nenhuma das quatro linhas é obrigatória.** Um registro pode ter só varejo (o mais comum), só
  atacado, ou só anúncio sem líquido. Linha ausente **não é R$ 0,00** — ela simplesmente não existe.
  Desenhe pelo menos uma prancheta com um canal de duas linhas ao lado de um de quatro.
- **Contagem de kit**: dois inteiros — `{n} de {total} peças` (ex.: `3 de 5 peças`). Existe uma frase
  irmã já escrita no app e **não exibida aqui**: `2 sem este canal`.
- **Nada nesse cartão é recalculado.** Todo número é um valor gravado no dia da cotação; o cartão
  vive logo abaixo de "Detalhamento" / "Custo total" e logo acima de "Ficha técnica".

## Estados obrigatórios
1. **Repouso completo** — 1 canal com as quatro linhas; e uma variação com 3 canais empilhados.
2. **Canal parcial** — só `Preço para anunciar · Varejo` e `Recebido líquido · Varejo`. Não pode
   parecer quebrado nem sugerir que faltou algo.
3. **Canal sem comissão** — nenhum número, só `sem comissão informada — este canal não teve preço`.
   O nome do canal continua ali (o vendedor DE FATO escolheu aquele marketplace). Precisa ser
   inconfundível ao lado de um canal com preço.
4. **Canal com erro gravado** — o texto do erro ecoado como está, podendo aparecer **junto** com as
   quatro linhas (erro e preço não se excluem no registro).
5. **Canal de kit (rollup)** — as quatro linhas mais `3 de 5 peças`. Mostre também o caso `5 de 5
   peças`, que é neutro e não deve gritar.
6. **Erro + sem comissão no mesmo canal** — o pior caso combinado; desenhe.
7. **Premium pausado (`lapsed`)** — o registro continua **totalmente legível**; o cartão não muda em
   nada. Desenhe-o dentro da tela com a faixa de plano pausado no topo, para provar que ele não é
   escondido nem esmaecido.
8. **Sem conexão** — igual ao repouso. O valor é local e congelado: offline não degrada nada aqui e
   **não pode** ganhar aviso, tom cinza ou selo de "desatualizado".
9. **Carregando / erro de leitura / registro inexistente** — pertencem à página inteira, não ao
   cartão; não desenhe variação própria, só saiba que o cartão não aparece nesses casos.
10. **Sem estado interativo** — hoje não há botão, link ou campo dentro do cartão. Se o seu desenho
    introduzir algum alvo tocável (ex.: um "?" que explica "recebido líquido"), ele precisa de
    repouso/hover/foco/pressionado e ≥44px, e isso vira decisão nova a marcar como proposta.

## Viewports
- **390px (mobile)** — obrigatório: é a rota `/historico/$id` em página inteira e a leitura mais
  frequente. É onde a legenda dupla + dinheiro de 5 dígitos colidem.
- **1280px (desktop)** — o detalhe vira a **coluna direita** de um mestre-detalhe (largura útil de
  ~560px, sem cabeçalho de página próprio). O cartão é o mesmo conteúdo em menos largura do que se
  imagina; não assuma folga.
- **1920px** — no protótipo o cartão fica em uma coluna à direita, ao lado de "Detalhamento" em duas
  colunas. Mostre como as quatro linhas e os recados se comportam nessa largura maior sem virar uma
  linha esticada com um oceano entre rótulo e valor.

## Regras que o desenho não pode quebrar
- **Ausência nunca vira zero.** Nenhuma linha fantasma com `R$ 0,00`, nenhum traço `—` no lugar de um
  valor que não foi gravado (o `—` só existe na lista de peças do kit, não aqui).
- **Nada é recalculado.** O cartão não pode sugerir "valor de hoje", nem ganhar botão de atualizar;
  quem faz isso é "Recalcular hoje", fora do cartão.
- **Frase honesta nunca dentro de placeholder ou truncada.** As três frases de exceção vivem em
  elementos de largura cheia e quebram em várias linhas; jamais reticências.
- **Falha de rede não é premium, e premium pausado não apaga leitura.**
- **Contraste medido contra o fundo real do cartão**, nos dois temas — a legenda cinza atual
  (`--text-muted` em 0.8125rem) é justamente o que apaga os três recados.
- **A hierarquia tem que separar dinheiro / recusa / falha / composição.** Quatro naturezas, no
  máximo três tratamentos visuais; nenhum deles pode ser "igual ao rodapé".

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado.** Já custou 100,5px de estouro com botão nascendo fora da
  viewport. Em 390px, `Preço para anunciar · Atacado` + `R$ 1.234,56` é o par mais perigoso desta
  peça — desenhe com o valor mais largo, não com o mais bonito.
- **Texto ocluso passa em teste.** Um recado escondido atrás de outro elemento continua "visível"
  para qualquer asserção de texto; a única prova é a imagem.
- **Placeholder que corta a frase honesta** — já aconteceu: frases de honestidade em campo estreito
  perdem o final. Por isso os recados A/B/C nunca podem virar sufixo de linha.
- **Legenda muda = legenda ignorada.** O mesmo cinza para "aviso" e para "nota de rodapé" já foi
  apontado em homologação em outras telas deste app.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. `390 · repouso` — 2 canais, um com 4 linhas e um com 2.
2. `390 · exceções` — um canal sem comissão, um canal com erro, um canal de kit com `3 de 5 peças`,
   empilhados no mesmo cartão (é assim que o vendedor encontra na vida real).
3. `390 · valor extremo` — `R$ 12.345,67` nas quatro linhas com legenda dupla.
4. `1280 · coluna direita (~560px)` — repouso + um caso de exceção.
5. `1920 · duas colunas` — o cartão ao lado de "Detalhamento".
6. `Anatomia` — a escala visual proposta: valor, rótulo, recusa, falha, composição, lado a lado com
   uma legenda comum, para provar que se distinguem.

Reutilize os primitivos existentes: o contêiner é o **card do DS** (`tf-card`); o título usa o estilo
de seção já existente (`tf-historico__section`); as linhas de dinheiro reaproveitam a linha
rótulo-valor já usada no "Detalhamento" (`tf-brow` / `tf-historico__piece`, com numerais tabulares).
Para a recusa e para o erro, prefira **tons já existentes no DS** (`tf-alert` info/danger, ou selo
`tf-badge`) a inventar um estilo novo — e diga qual escolheu e por quê. Não crie primitivo novo.

## Perguntas em aberto para o dono
1. Um canal **sem comissão** deve manter o nome com o mesmo peso dos canais que têm preço, ou o bloco
   inteiro deve ser rebaixado/marcado (o vendedor escolheu aquele canal, mas não há preço nenhum)?
2. A contagem de kit deve dizer também o que aconteceu com as peças restantes? A frase `2 sem este
   canal` já está escrita no app e **não é mostrada** neste cartão — é omissão a corrigir ou decisão?
3. Existe o caso `0 de 5 peças` (nenhuma peça somou naquele canal)? Se sim, isso é um canal sem
   preço, um erro, ou ainda outra coisa?
4. Varejo e atacado devem aparecer **sempre** juntos, ou o desenho deve dar destaque ao par que
   corresponde à base do orçamento (o registro sabe se foi cotado em varejo ou em atacado) e recolher
   o outro?
