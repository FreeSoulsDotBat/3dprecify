# Ações do registro travado — [Tentar novamente] / [Descartar] e a confirmação do descarte

## O que desenhar
O par de ações que um orçamento **preso na fila** oferece ao vendedor, e o diálogo que confirma o
descarte. Um orçamento é salvo primeiro no aparelho e só depois enviado para a conta; quando esse
envio não acontece — Premium não ativo, sessão expirada, servidor recusou — o registro fica travado.
Sem uma saída ali, ele nunca sincroniza e nunca some: envenena todo sign-out futuro (o app volta a
avisar "você tem registros não sincronizados" para sempre). O mesmo par aparece em **dois lugares**
da aba Orçamentos: dentro do card da lista (que é inteiro clicável e abre o registro) e dentro do
alerta de estado, na tela/coluna de detalhe. Quem usa: o vendedor, no momento em que descobre que a
cotação que ele acabou de fazer não subiu.

## Por que este prompt existe
A peça nasceu de texto (`ux-history.md` §1.5 dá só a copy da confirmação; §9.2/G5 diz "Dialog +
Button danger" como padrão dos confirms destrutivos) e de uma revisão de código — nunca de um
desenho. Nenhuma das três autoridades desenhadas tem fila, logo nenhuma tem ação de fila: o protótipo
§E6 é lista mock + vazio + detalhe + Exportar, a matriz §G do Histórico não tem coluna para isto, e o
card do canvas do dono (linhas 281–292) foi relido botão a botão — tem rótulo, badge, meta e a linha
de dinheiro, e **nenhum botão dentro**. Ou seja: a decisão de enfiar dois botões, um deles destrutivo
e vermelho sólido, dentro de um card inteiramente clicável em 390px, foi tomada por uma IA sem
desenho.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/history/entry-actions.tsx`, com os contextos em
`pages/historico/historico-page.tsx` (card da lista) e `pages/historico/snapshot-detail-page.tsx`
(alerta do detalhe).

| Contexto | O que envolve os botões | Estados em que aparecem |
|---|---|---|
| Card da lista | um card que é **um link inteiro** — qualquer toque abre o registro | só travado: Premium pausado, sessão expirada, recusado pelo servidor |
| Alerta do detalhe | bloco de alerta (tom informativo, ou vermelho quando recusado), abaixo do texto do estado | todos os não sincronizados, **inclusive o apenas pendente** |

Comportamento e textos literais de hoje:

- Botão de retry com rótulo **variável**: "Tentar agora" quando o registro está apenas pendente
  (acontece só no detalhe) e "Tentar novamente" nos demais casos. → dois rótulos para a mesma ação,
  diferença que ninguém desenhou nem explicou.
- O retry **some** quando o registro está pendente e o aparelho está offline (um retry offline não
  faria nada). → o botão desaparece sem dizer por quê, e o vizinho "Descartar" pula de lugar.
- Botão "Descartar" em vermelho **sólido**, dentro do card. → é este o problema central: vermelho
  cheio, alvo de 44px, dentro de uma área em que qualquer toque navega. O DS já tem o precedente da
  correção — a variante contornada vermelha nasceu em 2026-08-03 exatamente para "o destrutivo que
  NÃO é a ação padrão".
- Confirmação (diálogo centralizado, sem botão de fechar): título "Descartar este registro?", corpo
  "Ele não foi enviado para a sua conta e não poderá ser recuperado.", e no rodapé, à direita,
  "Voltar" (contornado) + "Descartar" (vermelho sólido).
- Os dois botões engolem o clique para o card não navegar. Isso é invisível no desenho, mas explica
  por que eles precisam de **folga clara** em volta — o dedo erra por milímetros.
- Não há nenhuma confirmação de sucesso: depois de "Tentar novamente" a lista só se refaz. Se deu
  certo, a insígnia some; se falhou de novo, a insígnia vira "Não foi possível registrar". → o
  desenho precisa dizer o que aparece durante e depois.
- No desktop (≥1280px) a aba é mestre-detalhe: lista à esquerda (520px em 1920px), registro à
  direita. O **mesmo registro** mostra o par de botões duas vezes ao mesmo tempo — no card marcado e
  no alerta da direita. → ninguém desenhou essa duplicação.

## Conteúdo e dados reais
- Card em volta (para compor a prancheta): rótulo do registro (uma linha, corta com reticências),
  insígnia de estado, "Cotado em 12/08/2026 · Peça única", e a linha de dinheiro "Valor cotado" à
  esquerda com **R$ 24,24** à direita, e abaixo a legenda "preço de varejo".
- Insígnias por estado (texto exato): "Pendente neste dispositivo" · "Envio pausado · precisa de
  Premium" · "Envio pausado · sessão expirada" · "Não foi possível registrar".
- Alertas do detalhe (título + corpo, verbatim): "Ainda não sincronizado" / "Este registro está só
  neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar
  online." · "Envio pausado" / "Este registro não foi enviado para a sua conta: o Premium não está
  ativo. Ele continua aqui, neste dispositivo. Assim que o Premium voltar a ficar ativo, ele é
  enviado automaticamente." · "Sessão expirada" / "Este registro não foi enviado para a sua conta:
  sua sessão expirou. Ele continua aqui, neste dispositivo. Entre de novo para enviá-lo." · "Não foi
  possível registrar" / "O servidor não aceitou este registro. Ele não será reenviado sozinho. Você
  pode tentar de novo ou descartar."
- No estado recusado o alerta ainda imprime, em texto secundário, "Código de suporte: 422".
- No estado de sessão expirada existe, ao lado das ações, um link com cara de botão contornado:
  "Entrar de novo".
- Nada aqui é editável e nada tem unidade: são duas ações e uma confirmação. Os únicos números na
  peça são o valor cotado do card e o código de suporte.

## Estados obrigatórios
1. **Repouso — pendente (só no detalhe, online):** "Tentar agora" contornado + "Descartar".
2. **Repouso — pendente e offline:** o retry **não existe**; sobra "Descartar" sozinho. Desenhe como
   fica esse alinhamento solitário — é o estado mais fácil de errar.
3. **Repouso — Premium pausado / sessão expirada / recusado:** "Tentar novamente" + "Descartar",
   no card e no alerta.
4. **Foco por teclado** em cada botão — anel visível sobre o fundo do card E sobre o fundo do alerta
   (os dois fundos são diferentes; meça os dois).
5. **Hover** (desktop) e **pressionado** (leve escala no toque) — inclusive mostrando que o hover do
   botão **não** acende o card inteiro por baixo.
6. **Retry carregando:** rodinha dentro do botão, rótulo mantido, botão inerte.
7. **Descarte carregando:** o mesmo, no botão de confirmar do diálogo.
8. **Diálogo de confirmação** em repouso, com o foco no botão seguro.
9. **Depois do descarte, no desktop:** o registro aberto à direita deixou de existir — a coluna passa
   a mostrar o aviso "Registro não encontrado." Desenhe esse encadeamento.
10. **Depois de um retry que falhou de novo:** a insígnia volta para "Não foi possível registrar" e
    os botões continuam ali.

## Viewports
- **Mobile 390px** — obrigatório, e é onde mora o risco: card inteiro clicável, polegar, e dois
  botões que quebram para a segunda linha quando o espaço acaba.
- **Desktop 1280px e 1920px** — a aba vira mestre-detalhe (coluna da lista de 520px em 1920px, mais
  estreita em 1280px). É preciso resolver a duplicação: mesmas ações no card marcado e no painel.
- Não desenhe tablet: o corte é binário em 1280px, não existe terceiro layout.

## Regras que o desenho não pode quebrar
- **A falha nunca é vendida como upgrade.** "Envio pausado · precisa de Premium" é uma coisa; sessão
  expirada e recusa do servidor são outras. Nenhuma das três pode virar convite para assinar, e
  nenhuma pode ser explicada como "sem conexão" quando a conexão está intacta.
- **Descartar é irreversível, e o desenho tem de dizer isso antes do toque**, não só no diálogo.
- **O destrutivo dentro de um card clicável não pode ter o peso de um botão cheio** — use a variante
  contornada; o vermelho sólido fica reservado ao confirmar do diálogo, onde o vendedor já pediu.
- Nada de "Cancelar" em lugar nenhum: a saída segura se chama "Voltar" (regra de copy do projeto).
- Alvo mínimo de 44×44px mesmo nos botões pequenos, e **espaço morto entre o botão destrutivo e a
  borda do card** — a área de toque de "Descartar" não pode encostar na do card.
- Contraste medido contra o fundo real de cada contexto: o card e o alerta vermelho não têm o mesmo
  fundo, e o mesmo botão precisa passar nos dois, em tema escuro e claro.
- Botão que não pode funcionar não é desenhado desabilitado e mudo: hoje o retry pendente offline
  simplesmente some — se ele passar a ficar visível, precisa de uma frase que diga por quê.

## Armadilhas já pagas neste projeto
- Frase honesta em campo estreito é frase cortada: qualquer explicação ("não poderá ser recuperado")
  vive em elemento de largura cheia, nunca espremida ao lado de um botão.
- Rótulo longo estoura coluna: "Tentar novamente" + "Descartar" lado a lado em 390px, dentro de um
  card com preenchimento pequeno, é o caso clássico de overflow horizontal medido. Desenhe a quebra.
- Elemento visível em teste e ocluso na tela: os botões ficam no fim do card, logo acima do card
  seguinte — mostre a folga real, medida, entre um card e outro.
- Ação sem retorno visível: já custou um defeito neste projeto um botão cuja confirmação nunca
  aparecia. Se a decisão for não ter aviso de sucesso, o desenho precisa mostrar qual sinal substitui
  isso (a insígnia sumindo, o card saindo da lista).

## Entregável
Pranchetas, em **tema escuro (padrão) e claro (igualmente acabado)**:
1. Card da lista travado em 390px, nos três estados travados, com os botões em repouso.
2. O mesmo card com foco por teclado, hover e pressionado — e o card por baixo em hover.
3. O bloco de ações dentro do alerta do detalhe, nos quatro estados (incluindo pendente offline, sem
   retry, e sessão expirada com "Entrar de novo" ao lado).
4. Retry carregando.
5. O diálogo "Descartar este registro?" — repouso e confirmando (carregando).
6. Desktop 1920px: a tela inteira com lista + detalhe e o registro travado marcado, resolvendo a
   duplicação das ações.

Reutilize os primitivos existentes, sem criar nada novo: `tf-btn` tamanho pequeno para as duas ações
(contornado no retry, contornado-vermelho no descartar do card, vermelho sólido só no confirmar do
diálogo), `tf-badge` para a insígnia de estado, `tf-alert` para o bloco do detalhe, `tf-card` para o
item da lista e `tf-dialog` centralizado para a confirmação.

## Perguntas em aberto para o dono
1. Os dois rótulos de retry ("Tentar agora" para pendente × "Tentar novamente" nos travados) devem
   continuar diferentes, ou vira uma frase só? A diferença apareceu no código, não numa decisão.
2. As ações destrutivas devem continuar dentro do card da lista, ou o card só abre o registro e o
   descarte passa a viver apenas no detalhe (um toque a mais para o vendedor, zero descarte
   acidental)?
3. No desktop, quando o registro travado está aberto à direita, o par de botões do card deve
   desaparecer (mantendo só os do painel), ou os dois ficam?
4. Um retry bem-sucedido deve avisar em algum lugar ("Registro sincronizado.", frase que já existe no
   app), ou o sumiço da insígnia basta?
