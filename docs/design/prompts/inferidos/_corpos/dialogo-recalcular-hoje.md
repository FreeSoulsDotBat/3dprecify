# Diálogo "Recalcular hoje" — confirmar a criação de um novo orçamento

## O que desenhar

O diálogo modal central que aparece quando o vendedor, olhando um **orçamento congelado** já salvo
(aba Orçamentos → detalhe do registro), toca em **"Recalcular hoje"**. A ação não altera o registro
aberto: ela **cria um registro novo e permanente**, com os valores do catálogo de hoje, herdando o
mesmo rótulo do original. O diálogo é o único momento em que dá para desistir — depois de confirmar,
o registro é imutável (não existe editar nem desfazer; só existe excluir). Quem usa é o vendedor que
cotou para um cliente semanas atrás e quer saber/registrar quanto cobraria hoje.

## Por que este prompt existe

O diálogo **nunca foi desenhado**. O gatilho está (`Abas-Desktop.dc.html`, `tf-btn--secondary`
"Recalcular hoje" na ficha do registro), mas aquele arquivo não tem um único diálogo, e o protótipo de
2026-07-02 é anterior à função — "Recalcular hoje" nasceu em 15/07/2026 e a tela de histórico do
protótipo oferece só [Duplicar]/[Exportar]. A única autoridade é texto ASCII (`ux-history.md` §4.4 +
§10-F3). Tudo o que é forma foi inferido pela IA que implementou: dois pesos visuais diferentes para
dois avisos igualmente decisivos, e — o ponto mais grave — **o resultado do recálculo não aparece
antes de gravar**: o vendedor assina em branco e só descobre o número por um toast.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/historico/recalc-today.tsx` (+ `compare-today.tsx` no mesmo detalhe).
Estrutura atual do diálogo, na ordem em que aparece:

| # | Elemento | Conteúdo literal hoje |
|---|---|---|
| 1 | Título (`tf-dialog__title`, caixa alta) | "Recalcular hoje" |
| 2 | Descrição — caso A, **repreçou de verdade** | "Isso cria um NOVO registro com os valores do seu catálogo hoje. O registro de 08/08/2026 continua como está." |
| 2' | Descrição — caso B, **origem não encontrada** | "Não foi possível localizar a origem deste registro no seu catálogo agora. Dá para recalcular usando os valores guardados neste registro e a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo." |
| 3 | Aviso de offline (só sem conexão) | "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados." |
| 4 | Aviso estrutural (só quando repreçou e o congelado é de modelo aposentado) | "O valor congelado foi calculado pelo modelo 3.1.0, que incluía o campo Desperdício. O modelo atual não tem mais esse campo — parte da diferença acima pode vir daí." |
| 5 | Ações, alinhadas à direita | [Voltar] (`tf-btn--secondary`) · [Recalcular] (`tf-btn--primary`) |

→ **Não existe número nenhum no diálogo.** Nem o valor do registro original, nem o valor que será
gravado. Ele já foi calculado quando o diálogo abriu — está pronto, só não é mostrado. Resolva isso.
→ **O aviso 4 mente por dangling**: a frase diz "parte da **diferença acima** pode vir daí" e acima
dela não há diferença nenhuma. Essa copy foi escrita para o bloco "Comparar com hoje" (que mostra dois
números) e reaproveitada aqui. Ou o diálogo passa a ter os números, ou a frase precisa mudar.
→ **Dois pesos visuais para dois avisos igualmente decisivos**: o offline é um `<p>` mudo, cinza,
13px, sem ícone; o estrutural é `tf-alert--info` com ícone e caixa. Nada justifica a diferença.
→ **O diálogo não tem X de fechar** (`showClose={false}`); Esc e clique no scrim fecham. E [Voltar]
não desabilita durante a gravação: dá para fechar no meio da escrita.
→ **Falha na gravação não aparece no diálogo**: sai um toast vermelho de 5s ("Não foi possível
guardar o registro neste aparelho. Ele não foi salvo.") e o diálogo **continua aberto**, sem marca
nenhuma do que houve. Este projeto já pagou por confiar em toast: um toast que nunca renderizou
sustentava a única confirmação de uma ação.
→ Nada diz que o novo registro **herda o rótulo** do original ("Cliente Ana · pedido 132") e que a
**validade da proposta não é herdada** (começa em branco).

## Conteúdo e dados reais

- Registro de exemplo (use estes números): rótulo **"Cliente Ana · pedido 132"**, "Cotado em
  08/08/2026 às 14:20", tipo "Peça única", base **"preço de varejo"**, valor cotado **R$ 196,44**.
  Valor recalculado hoje, exemplo: **R$ 213,90**. Um segundo exemplo, kit: "Kit suporte + base",
  "Kit · 3 peças", **R$ 512,80** → **R$ 498,15** (o valor pode CAIR — não desenhe só o caso de alta).
- Vocabulário fixado no produto: o número antigo é **"Valor cotado"** com a data; o número novo é
  **"Hoje"**. Legenda de base sempre presente: "preço de varejo" / "preço de atacado". Os dois números
  são SEMPRE da mesma base — nunca varejo contra atacado.
- **O app não calcula a diferença** entre os dois (aritmética de dinheiro mora no motor de preço).
  Não desenhe "+8,9%" nem seta de variação sem que o dono decida (ver Perguntas em aberto).
- No caso B (origem sumiu), o valor gravado é **igual** ao congelado (R$ 196,44) — e o registro criado
  carrega para sempre a legenda "Estes valores foram reaproveitados de um congelamento anterior — a
  origem não estava disponível para repreçar."
- Textos dos toasts pós-confirmação (não invente outros): sucesso "Registro salvo em Orçamentos." ·
  pendente "Pendente neste dispositivo. Sincroniza sozinho quando houver conexão." · bloqueado "Envio
  pausado — o Premium não está ativo. O registro continua neste aparelho." · falha do servidor "Não
  foi possível registrar. O servidor não aceitou este registro." O toast é só mensagem: **não tem
  botão nem link**, e some sozinho em 5s.

## Estados obrigatórios

1. **Repouso — caso A (repreçou)**: descrição do item 2 + os dois números (cotado × hoje) + base.
2. **Repouso — caso B (origem não encontrada)**: descrição 2' + o valor que será gravado, dito como
   reaproveitado, não como "preço de hoje".
3. **Offline** (pode acontecer em A e em B): aviso do item 3. É informação, não erro — mas precisa o
   mesmo peso do aviso estrutural.
4. **Modelo aposentado** (só em A): aviso do item 4, empilhado abaixo do offline. Desenhe o caso
   **os dois avisos juntos** — é o pior caso de altura e ele existe.
5. **Confirmando**: [Recalcular] com spinner (`tf-btn--loading`, rótulo permanece), [Voltar] inerte,
   scrim ainda bloqueando. Nada de diálogo que pisca duas vezes.
6. **Falha ao gravar**: o diálogo **permanece aberto** e mostra a falha dentro dele (`tf-alert--danger`
   com a frase literal "Não foi possível guardar o registro neste aparelho. Ele não foi salvo."), com
   o botão voltando a ser acionável para tentar de novo.
7. **Foco**: primeiro foco visível ao abrir, anel roxo de 3px, e mostre o percurso Tab entre
   [Voltar] e [Recalcular].
8. **Premium pausado / plano ainda verificando**: o gatilho "Recalcular hoje" **simplesmente não
   existe** — a ação é escrita e escrita exige Premium ativo; o aviso de plano pausado já está na
   página. Desenhe a ficha do registro **sem** o botão, mostrando que os botões restantes
   (Exportar · Comparar com hoje) não dançam de posição quando ele aparece/some.

## Viewports

- **Mobile 390px** — obrigatório: é o uso principal e o pior caso de altura (modal de 358px de largura,
  teto de 85% da tela, com título + descrição longa do caso B + dois avisos + dois botões).
- **Desktop 1280px** — obrigatório: o diálogo abre sobre o mestre-detalhe de Orçamentos (lista à
  esquerda, ficha do registro à direita), largura travada em 512px, centralizado sobre o scrim.
- **1920px** não precisa de prancheta própria: o modal continua com 512px e só o scrim cresce.

## Regras que o desenho não pode quebrar

- **Procedência em todo número**: o valor antigo sempre vem com a data ("Cotado em 08/08/2026"); o
  novo sempre com "Hoje". Dois valores nus lado a lado são um enigma, não uma informação.
- **Falha de rede nunca é upsell**: offline aqui significa "catálogo salvo neste aparelho, pode estar
  desatualizado" — nunca "isso é Premium".
- **Degradação dita, não escondida**: no caso B o diálogo tem de deixar claro que o registro novo vai
  ter a data de hoje com números de antes.
- **A frase honesta mora em elemento de largura total** — os dois avisos ocupam a largura do diálogo,
  nunca ficam espremidos ao lado de um botão.
- **Alvo ≥44px** nos dois botões, inclusive a 390px, onde eles dividem a linha.
- **Contraste medido contra o fundo real** do diálogo (`--surface-card`), não contra a página atrás do
  scrim — vale especialmente para o cinza do aviso de offline. Um acento por zona: [Recalcular] é o
  único botão de acento.

## Armadilhas já pagas neste projeto

- **Botão que nasce fora da tela**: o modal rola por dentro (teto de 85% da altura). Com descrição
  longa + dois avisos, a linha de ações pode ficar abaixo da dobra do próprio diálogo. Desenhe a
  solução (rodapé fixo dentro do modal ou a garantia de que a pilha cabe) e mostre o pior caso medido.
- **Toast como única confirmação**: já houve um toast que nunca renderizou porque o diálogo desmontava
  antes. Tudo que é decisivo (a falha, e idealmente o número gravado) precisa existir **no diálogo**.
- **Valor grande que estoura a linha**: teste com R$ 12.480,75 nos dois números lado a lado a 390px —
  números tabulares, sem quebrar a linha no meio do valor.
- **Texto ocluso passa em teste**: o aviso estrutural é longo (duas linhas no desktop, quatro a
  390px). Mostre-o inteiro, sem corte, sem "…".

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como par de cada uma**:

1. 390px — caso A em repouso, com os números cotado × hoje.
2. 390px — caso A com **offline + aviso estrutural empilhados** (pior caso de altura, com a régua da
   altura visível).
3. 390px — caso B (origem não encontrada).
4. 390px — confirmando (spinner) e falha ao gravar (alerta dentro do diálogo) — pode ser uma prancheta
   com os dois quadros.
5. 1280px — caso A sobre o mestre-detalhe de Orçamentos, com foco visível em [Recalcular].
6. 1280px — a ficha do registro **sem** o botão (Premium pausado), provando que o resto não se desloca.

Componha com os primitivos existentes, sem criar novos: `tf-dialog` (modal central) com
`tf-dialog__title` e `tf-dialog__desc`; os dois valores como duas linhas rotuladas em `tf-card--flat`
ou `tf-brow`, com `tf-tnum` nos números — **não** use `tf-price` aqui (o herói de preço é da
calculadora, e este número é um registro, não um preço vivo); `tf-alert--info` para offline e para o
aviso estrutural (mesmo peso para os dois); `tf-alert--danger` para a falha de gravação;
`tf-btn--secondary` em [Voltar] e `tf-btn--primary` (+`--loading`) em [Recalcular]. Sem grafismo aqui:
o floreio orgânico é de tela cheia, não de modal de confirmação.

## Perguntas em aberto para o dono

1. **Mostrar o número novo antes de gravar** resolve a assinatura em branco, mas o bloco "Comparar com
   hoje", logo acima na mesma página, existe justamente para mostrar esse par sem gravar nada. O
   diálogo passa a repetir a comparação, ou o fluxo vira "compare primeiro, recalcule depois" (e aí o
   diálogo só confirma)?
2. **A diferença entre os dois valores** (em R$ e/ou %) deve aparecer? Hoje o app se recusa a
   calculá-la fora do motor de preço; se a resposta for sim, é mudança de produto, não de desenho.
3. **O rótulo herdado** ("Cliente Ana · pedido 132") deve ser apenas informado no diálogo, ou editável
   ali mesmo — já que dois registros com o mesmo nome vão conviver na lista?
4. Depois de confirmar, o vendedor **continua no registro antigo** e o novo aparece em outro ponto da
   lista. Deve haver um caminho imediato para o registro recém-criado? (O toast atual não comporta
   link, então isso mudaria o desenho.)
