# Folha de exportação PDF/CSV — e o botão "Exportar" desabilitado que diz por quê

## O que desenhar
A peça é o par **gatilho + folha** que sai do detalhe de um orçamento congelado (aba Orçamentos → um
registro aberto). O gatilho é o botão `Exportar`, que vive lado a lado com `Recalcular hoje` e
`Comparar com hoje` no rodapé de ações do registro; a folha é o painel que ele abre, onde o vendedor
escolhe **o que** exportar (o PDF do orçamento para o cliente ou o CSV de todos os seus orçamentos),
decide se o PDF vai levar o detalhamento de custos, e dispara a geração. O documento é renderizado no
servidor: sem conexão ou sem o registro sincronizado não existe arquivo — e é por isso que o botão
fica **visível e desabilitado com o motivo impresso**, nunca escondido e nunca com tooltip. É a única
superfície do app cujo resultado sai do app e chega ao cliente final do vendedor.

## Por que este prompt existe
O protótipo de 2026-07-02 conhecia só o gatilho: §E6 lista "Exportar (PDF/CSV, Premium)" e a matriz §G
dá uma linha com "disabled se free | desabilitado" — dois estados, e nenhuma palavra sobre **como** se
explica um botão morto. Tudo o que veio depois foi inferido por IA sem desenho: a folha inteira, o
seletor de formato, o switch de custos, o aviso de dano, a regra "visível-e-desabilitado com a frase
impressa por baixo", e os motivos `Premium pausado` e `registro pendente` (o protótipo só conhecia
free × premium). No canvas desktop do dono (018) existem **dois** botões `Exportar` — um no cabeçalho
da aba, outro na ficha do registro — e nenhum painel, nenhum formato, nenhum aviso, nenhuma frase de
motivo. O switch que expõe a margem do vendedor ao cliente dele nunca passou por um designer.

## O que já existe hoje (não invente do zero — corrija)

**O gatilho** (`features/history/export-sheet.tsx` + `.css`)

| Elemento | Hoje |
|---|---|
| Botão | `tf-btn--secondary`, rótulo **"Exportar"**, sem ícone no app (o canvas 018 usa ícone `download`) |
| Desabilitado | `opacity: 0.55` sobre o secundário → **contraste não medido** |
| Frase do motivo | `<p>` logo abaixo, `color: var(--text-muted)`, `0.875rem`, ligada por `aria-describedby` |
| Ausência total | conta free / deslogada / sem resposta do servidor: **o botão não é renderizado** |

→ A frase do motivo é um parágrafo solto embaixo do botão, sem contêiner, sem ícone, sem tom —
idêntica a uma legenda qualquer da página. Ela precisa **ler como a explicação daquele botão**.
→ O desabilitado a 0,55 de opacidade sobre fundo escuro precisa de tratamento desenhado
(borda/superfície), não de transparência.

**A folha** (`Sheet` = `tf-dialog--sheet-right`, `width: min(92vw, 26rem)`, altura total, X de fechar
no canto). Ordem atual, de cima para baixo:

1. Título **"Exportar"** — a mesma palavra do botão que a abriu.
2. `fieldset` com legenda **"O que exportar"** e dois radios, cada linha com `min-height: 44px`:
   **"Orçamento para o cliente (PDF)"** e **"Meus orçamentos (CSV)"**.
   → São radios HTML crus dentro de uma caixa com borda; não há primitivo desenhado para essa escolha.
3. Se o PDF estiver bloqueado (registro nunca chegou ao servidor): o radio de PDF fica desabilitado e
   ganha **sua própria** frase por baixo — **"Sincronize para exportar."** — e a folha já abre com o
   CSV selecionado.
4. Só quando o formato é PDF: linha `space-between` com o rótulo **"Incluir detalhamento de custos"**
   à esquerda e o `Switch` (`tf-switch`, trilho 44×24, alvo 44×44) à direita, **desligado sempre que
   a folha abre**.
5. O aviso de dano, colado ao switch por um `margin-block-start: calc(-1 * var(--space-3))` — uma
   gambiarra de aproximação. → O desenho deve dizer como esse par (switch + consequência) se agrupa
   de verdade: mesma caixa, mesmo tom, uma unidade.
6. A descrição do que viaja no arquivo (`SheetDescription`, texto longo).
7. Botão de submit, largura natural, rótulo que muda por formato: **"Gerar PDF"** ou **"Baixar CSV"**.

→ Não existe botão "Cancelar": a única saída é o X do canto.
→ Não existe feedback de sucesso — decisão consciente registrada em comentário: *o arquivo é o
feedback*. Não invente um "pronto!", mas mostre o que acontece quando a folha fecha.

## Conteúdo e dados reais
Textos literais em pt-BR, homologados — **copie-os, não reescreva**:

- Aviso de custos, peça única: *"Seu cliente veria as linhas gravadas — material, energia, máquina,
  falhas, acabamento, mão de obra e os seus outros custos — e poderia calcular a sua margem."*
- Aviso de custos, **kit** (o documento leva UMA linha, não o detalhe peça a peça): *"Seu cliente
  veria o custo total gravado do kit — e poderia calcular a sua margem."*
- O que viaja no PDF: *"O orçamento leva: itens, quantidades, o valor cotado, a data, a validade, o
  rótulo deste registro (impresso como “Referência”), e identifica você pelo nome e e-mail da sua
  conta."*
- Nota do CSV: *"O CSV vem da sua conta: registros ainda não sincronizados não entram nele."*
- Motivos: *"Exportar precisa do Premium ativo."* · *"Exportar precisa de conexão."* ·
  *"Sincronize para exportar."*
- Falha: *"Não foi possível gerar o arquivo."* (toast, tom `danger`)

Números reais do registro que fica **atrás** da folha: valor cotado **R$ 24,24**, Material
**R$ 3,78**, Energia **R$ 0,36**, "Validade da proposta: 7 dias", rótulo editável (ex.: "Suporte de
fone — Ana"). Arquivos gerados: `orcamento.pdf` e `historico.csv`. Os avisos têm 130 e 76 caracteres
e a descrição do PDF tem 210 — numa folha de 359px de largura útil, são o teste de fogo do desenho.

## Estados obrigatórios
**Gatilho**
1. **Repouso** — secundário habilitado, sem frase por baixo.
2. **Hover / foco visível / pressionado** — três tratamentos distintos; o foco usa o anel do DS.
3. **Desabilitado por Premium pausado** — frase *"Exportar precisa do Premium ativo."* Precedência
   máxima: é o único motivo que o vendedor não resolve esperando. Duas linhas acima já existe o
   banner *"Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar,
   renomear, excluir ou exportar, reative o Premium."* → desenhe os dois na mesma prancheta e mostre
   que **não** viram redundância barulhenta.
4. **Desabilitado por offline** — frase *"Exportar precisa de conexão."*
5. **Ausente** — conta free/deslogada: nenhum botão, nenhum espaço reservado, nenhum fantasma.

**Folha**
6. **Repouso, PDF** — radio PDF marcado, switch desligado, aviso e descrição visíveis.
7. **Repouso, CSV** — o bloco do switch e o aviso **somem** por inteiro; entra a nota do CSV. Mostre
   que o painel não fica com um buraco.
8. **PDF bloqueado (registro pendente)** — radio PDF desabilitado + *"Sincronize para exportar."*,
   CSV pré-selecionado. O motivo vale para **uma** opção, não para a folha.
9. **Switch ligado** — o aviso de dano é o mesmo texto; o que muda é o peso visual. Ligar o switch é
   uma decisão de risco: o estado ligado precisa **parecer** uma escolha assumida.
10. **Gerando** — o submit com spinner inline (`aria-busy`), rótulo mantido, cursor `progress`; os
    radios e o switch continuam onde estavam.
11. **Erro** — toast `danger` *"Não foi possível gerar o arquivo."* (ou a frase do lapso, se o
    Premium caiu no meio) e **a folha permanece aberta com as escolhas intactas**.
12. **Sucesso** — a folha fecha, sem toast. Desenhe o quadro do "depois": o registro de volta, e nada
    afirmando um arquivo que o app não consegue verificar.

## Viewports
- **Mobile 390px** — obrigatório: é onde o vendedor está. A folha ancorada à direita ocupa 92vw
  (≈359px) em altura total. → Avaliar no desenho se o mobile deveria usar a variante **bottom sheet**
  do primitivo (`tf-dialog--sheet-bottom`, `max-height: 85vh`), que o DS já tem, em vez da lateral.
- **Desktop 1280px** — o corte do redesenho 018. A folha (máx. 26rem = 416px) sobre a ficha do
  registro à direita. Mostre o gatilho **na ficha**, no rodapé de ações, junto de `Recalcular hoje`,
  `Comparar com hoje` e `Excluir`.
- 1920px reaproveita o 1280 sem mudança de composição — não precisa de prancheta própria.

## Regras que o desenho não pode quebrar
- **A frase do motivo nunca é tooltip e nunca é placeholder.** Num aparelho de toque não há hover, e
  um botão morto sem explicação lê como bug. A frase é texto persistente, em elemento de largura
  cheia (lição 016: frase honesta cortada em sufixo de placeholder já custou uma homologação).
- **Freemium é binário e o servidor é quem diz.** Free não vê o botão; `lapsed` vê o botão desabilitado
  com o motivo. Nunca inventar um estado "quase premium".
- **Falha de rede nunca é vendida como falta de Premium** — e vice-versa: são duas frases diferentes,
  e o lapso vem antes do offline na precedência.
- **A consequência mora ao lado do controle que a causa.** O aviso de exposição de margem não pode
  virar link "saiba mais", nota de rodapé, nem sumir num acordeão.
- **A palavra "margem" só aparece no aviso** — ela nunca é uma linha impressa no PDF.
- Alvos ≥44px em cada linha de radio e no switch; contraste medido contra o fundo real da folha,
  incluindo o texto `--text-muted` dos avisos e o botão desabilitado.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado.** Os três textos longos em 359px são a situação exata que
  já estourou o layout duas vezes (100,5px de overflow com botão nascido fora da viewport, E6 PR-B).
- **Texto ocluso passa em teste.** `toBeVisible` aprova um elemento coberto ou fora da área rolável;
  valide onde o submit cai quando o aviso longo empurra tudo para baixo.
- **Margem negativa de aproximação não é agrupamento.** O `-space-3` que puxa o aviso para junto do
  switch é o sintoma de um grupo que nunca foi desenhado.
- **Toast que nunca renderiza.** Já houve aqui um diálogo desmontando antes do callback e a mensagem
  nunca aparecendo. O toast de erro depende de a folha continuar aberta — mostre onde ele cai em
  relação a ela, e que não fica atrás dela.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não afterthought)**:
(1) gatilho — repouso, hover, foco, pressionado, mobile e desktop; (2) gatilho desabilitado —
Premium pausado com o banner acima, e offline; (3) folha PDF em repouso, switch desligado, em 390px e
1280px; (4) folha com o switch ligado; (5) folha em CSV; (6) folha com o PDF bloqueado por registro
pendente; (7) gerando + erro, com o toast sobre a folha aberta.

Reutilize os primitivos existentes, sem criar novos: `Button` (`tf-btn--secondary` no gatilho,
`tf-btn--primary` no submit, com o estado `loading`), `Sheet`/`SheetContent` (`tf-dialog--sheet`) com
`SheetTitle` e `SheetDescription`, `Switch` (`tf-switch`), `Alert` (`tone="info"`) para o banner de
lapso, `toast` (`tone="danger"`) para a falha, e o anel de foco do DS. Se a escolha de formato pedir
um controle melhor que dois radios crus, avalie primeiro o `Segmented` (`tf-segmented`) que já existe
— e diga por que serve ou não serve para uma escolha em que uma das opções pode estar desabilitada
com motivo próprio.

## Perguntas em aberto para o dono
1. **O canvas desktop 018 tem um segundo botão `Exportar` no cabeçalho da aba Orçamentos** (com
   `disabled={{ writeBlocked }}`), que não existe no app. Ele é o atalho do **CSV da conta inteira**?
   Se for, ele abre a mesma folha (com o PDF sempre bloqueado, porque não há registro escolhido) ou
   baixa o CSV direto? E a frase do motivo dele é qual?
2. **A folha no mobile deve virar bottom sheet?** O primitivo já suporta; a lateral em 92vw foi
   herdada, não escolhida.
3. **Falta uma saída explícita.** A folha só fecha pelo X. Entra um "Cancelar" ao lado do submit, ou
   o X é a decisão?
4. **O switch de custos deveria pedir confirmação?** Hoje é um toque só, e o dano é irreversível
   depois que o PDF chega ao cliente. Manter um toque (com o aviso ao lado) ou exigir um segundo
   passo é decisão de produto, não de desenho.
