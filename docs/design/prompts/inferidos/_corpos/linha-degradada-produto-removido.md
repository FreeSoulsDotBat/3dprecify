# Peça de kit que perdeu o produto vinculado

## O que desenhar
O card de UMA peça dentro do compositor de kits (aba **Kits**, rota `/kits?id=…`, quando o vendedor reabre um kit já salvo) no estado em que o produto do catálogo que aquela peça referenciava foi apagado depois do salvamento. A peça não some e não quebra: ela reabre com os últimos valores conhecidos, continua editável, continua entrando no total do kit — mas deixou de acompanhar o catálogo, e isso aconteceu **sem nenhuma ação do vendedor**, entre uma visita e outra. É o único momento do produto em que um card muda de natureza sozinho. Quem vê é o vendedor premium que volta para recalcular um kit montado semanas atrás.

## Por que este prompt existe
Este estado nunca foi desenhado — foi decidido em texto (`specs/008-e3-multi-piece-bom/ux-bom.md` §1.2-D, "decisão T021", 2026-07-12) e implementado direto. O canvas de desenho existente até desenha a peça **nascida** avulsa (`titulo: "Peça 2 (avulsa)"`, `origem: "— Manual —"`), mas não a peça que **degradou**: não há nele nenhum dado, marcador ou legenda de "valores mantidos", e a transição — o mesmo card que dizia "do catálogo: Suporte de fone" e agora diz "(avulsa)" — não é representável num quadro que ninguém desenhou. O que existe hoje é uma legenda emprestada do formulário de produto, num `<p>` cinza de 14px idêntico às outras quatro legendas possíveis no mesmo card. O que falta é o desenho de como se sinaliza uma mudança que o usuário não causou **sem alarmar** — e se ela merece marcador no resumo do kit e na lista de kits (hoje não tem nenhum).

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/bom/bom-line-card.tsx`, `apps/web/src/pages/bom/bom-page.tsx`, `apps/web/src/widgets/bom-line-editor/bom-line-editor.tsx`.

O card **colapsado**, de cima para baixo:

| Elemento | Texto/valor literal hoje | Observação |
|---|---|---|
| Cabeçalho (botão que expande) | `Peça 2 · (avulsa)` | chevron 16px à esquerda; a palavra "(avulsa)" é a MESMA de uma peça nascida manual |
| Quantidade | campo numérico, sufixo `un`, placeholder `1` | valor real do kit salvo, ex. `5` |
| Remover | botão fantasma com ícone `x` | rótulo acessível `Remover peça` |
| Linha de dinheiro | `R$ 24,24 /un · Total da linha (5×) R$ 121,20` | 14px, `--text-muted` |
| **Legenda da degradação** | `Os valores atuais foram mantidos e continuam editáveis.` | 14px, `--text-muted` — **emprestada** do formulário de produto |

→ Problema 1: essa legenda é a **quinta** frase possível nesse mesmo card, todas com a mesma tipografia e a mesma cor: `Quantidade 0 — não entra no total.`, o aviso de quantidade absurda (esse sim em `--info-text`), `Confira os campos desta peça — ela não entra no total até ser corrigida.` e a linha de dinheiro. Nada distingue "você digitou algo errado" de "o mundo mudou embaixo desta peça".
→ Problema 2: a legenda fala do que foi **mantido** e nunca do que foi **perdido** — que os números desta peça pararam de acompanhar o catálogo. Se ela não for lida, o vendedor segue achando que a peça continua vinculada.
→ Problema 3: expandindo o card, o seletor `Usar produto salvo` volta para `— Manual —` e some o selo `do catálogo: {nome}`. Esses dois sinais (o único par que realmente conta a história) estão dentro do conteúdo expandido, longe da legenda, e invisíveis com o card fechado.
→ Problema 4: no fim do card expandido aparece o campo `Nome da peça no catálogo` (placeholder `Peça 2 · Kit suporte + base`) — porque, no próximo salvamento, esta peça vira um produto NOVO no catálogo em vez de uma referência. É uma consequência real e nada a liga visualmente à legenda.
→ Problema 5: nem o resumo do kit (`Total do kit`, `{n} peça(s) fora do total — confira os avisos nas peças acima.`) nem a linha da lista de kits no Catálogo (que diz só `2 peça(s)`) mencionam que alguma peça degradou. Quem abre pela lista não tem aviso nenhum antes de entrar.

## Conteúdo e dados reais
- Nome da peça: `Peça {n} · {nome do produto}` quando viva; `Peça {n} · (avulsa)` quando degradada. Nunca "— Manual —" como rótulo de estado ("— Manual —" é só o valor do seletor).
- Quantidade: inteiro ≥ 0, sufixo `un`. `0` é permitido e legendado (`Quantidade 0 — não entra no total.`).
- Dinheiro sempre pt-BR com centavos: custo unitário `R$ 24,24`, total da linha com 5 unidades `R$ 121,20`; um kit de três peças chega fácil a `R$ 1.234,56` no `Total do kit`.
- A peça degradada continua **priceável**: os últimos valores conhecidos (custo do rolo, peso, tempo de impressão, etc.) viraram campos editáveis comuns, com os mesmos rótulos do formulário da calculadora.
- Seletor `Usar produto salvo`: opções = `— Manual —` + os produtos salvos. Selecionar um produto **aposenta a legenda** na hora (a peça voltou a ser referência viva) e mostra `do catálogo: {nome}` ou `do catálogo: {nome} · ajustado por você`.
- Nada aqui é derivado de preço guardado: o kit nunca armazenou dinheiro, todo número é recalculado na abertura.

## Estados obrigatórios
1. **Degradada, colapsada (repouso)** — o estado padrão desta peça. Mostra `Peça 2 · (avulsa)`, a quantidade, a linha de dinheiro e a frase `Os valores atuais foram mantidos e continuam editáveis.`
2. **Degradada, expandida** — mesma frase + seletor em `— Manual —` + campos com os últimos valores + o campo `Nome da peça no catálogo`.
3. **Foco / hover / pressionado** no cabeçalho expansível e no botão remover — o cabeçalho inteiro é alvo de toque ≥44px; anel roxo de 3px no foco.
4. **Degradada + inválida** — as duas legendas empilhadas (`Confira os campos desta peça — ela não entra no total até ser corrigida.` acima ou abaixo da frase de degradação: **decida a ordem e mostre**), e a peça fora do total.
5. **Degradada + quantidade 0** — `Quantidade 0 — não entra no total.` somada à legenda.
6. **Resolvida** — o vendedor escolheu um produto salvo no seletor: a legenda desaparece e entra `do catálogo: Suporte de fone`. Desenhe esse "depois", porque hoje o alívio é só um silêncio.
7. **Premium pausado** — a página traz a faixa `Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo.`; a peça degradada continua legível e recalculável, mas o caminho de conserto (salvar de novo) está fechado. Precisa conviver sem virar duas tarjas competindo.
8. **Tarifas offline** — a página pode exibir `Não foi possível atualizar as taxas` / `Usando a referência salva no dispositivo — o cálculo continua funcionando…` com `Tentar novamente`. Duas honestidades diferentes na mesma tela; mostre que não se confundem.
9. **Carregando** — enquanto o kit ainda não chegou do servidor não existe peça alguma: nada pode piscar "(avulsa)" antes da resposta.

## Viewports
- **390px (mobile)** — obrigatório: é o layout onde o card ocupa a largura toda, as legendas quebram em duas ou três linhas e o cabeçalho já disputa espaço com a quantidade e o botão remover.
- **1280px (desktop)** — obrigatório: acima desse corte a página vira duas colunas (peças à esquerda em `minmax(0, 1fr)`, resumo do kit fixo à direita em 480px). É aqui que se decide se o resumo da direita ganha ou não uma menção às peças degradadas.
- **1920px** — opcional, só se a proposta mudar de forma (a coluna de peças fica bem mais larga e a legenda pode virar uma linha só).

## Regras que o desenho não pode quebrar
- **Nunca dizer "removido", "excluído" ou "deletado".** Existe um teste que trava qualquer regressão para essas palavras. O produto pode ter sido apagado noutra sessão, por outra pessoa; a interface não conta um evento que não presenciou.
- **Nada de `tf-alert` para esta peça.** A decisão homologada é legenda calma, não alerta: degradar é normal e recuperável, e um alerta grita "algo aconteceu com você". Se a proposta precisar de mais peso, o peso tem que vir de hierarquia (posição, ícone, um `tf-badge` discreto), não de tom de erro.
- **Peça nascida manual e peça degradada são o MESMO estado honesto** — por design, os dados não distinguem uma da outra. O que se pode sinalizar é a mudança percebida na sessão, nunca uma origem que o app não sabe.
- **Degradação é dita, não escondida**: nada de campo vazio silencioso, nada de `R$ 0,00` que na verdade é "não sei". Os últimos valores conhecidos aparecem como números normais e editáveis.
- Frase honesta em elemento de largura total, jamais dentro de `placeholder`.
- Contraste medido contra o fundo real do card (`--surface-card`), nos dois temas — a legenda hoje usa `--text-muted`, que no escuro é `#8c8f9d`.

## Armadilhas já pagas neste projeto
- **Legenda cinza indistinguível**: este projeto já mediu que `toBeVisible`/`toContainText` passam em texto que ninguém consegue ler ou achar. Uma quinta frase igual às outras quatro é aprovada por todo teste e falha com o vendedor.
- **Rótulo repetido**: o nome que uma peça materializada recebe já começa com `Peça {n} · …`, então concatenar o prefixo de novo produz `Peça 1 · Peça 1 · Kit X`. Qualquer marcador novo no cabeçalho tem que caber depois de um nome já longo.
- **Overflow horizontal medido**: números grandes (`R$ 1.234.567,89`) e nomes de kit longos já estouraram colunas aqui. A 390px, o cabeçalho + quantidade + botão remover não podem empurrar nada para fora.
- **Placeholder que corta a frase**: já aconteceu em 2026-08-06 — a parte honesta do texto sumiu dentro de um campo estreito.
- **Legenda que se retira sozinha**: quando o vendedor revincula, tudo simplesmente some. Um sumiço sem confirmação já foi lido como bug em outra tela deste app.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. `390px` — card degradado colapsado, em contexto: uma peça viva acima e uma peça degradada abaixo, para que a diferença entre as duas seja o objeto do desenho.
2. `390px` — card degradado expandido, com o seletor em `— Manual —`, os campos com últimos valores e o campo `Nome da peça no catálogo`.
3. `390px` — as combinações: degradada + inválida, degradada + quantidade 0, e o estado resolvido (`do catálogo: Suporte de fone`, sem legenda).
4. `1280px` — a página de kits em duas colunas com uma peça degradada na lista, mostrando o que (se algo) o resumo da direita e o `Total do kit` dizem a respeito.
5. `1280px` — a linha da lista de kits no Catálogo (`Kit suporte + base` · `2 peça(s)`), com e sem a proposta de marcador, para o dono comparar.

Componha com os primitivos existentes: `tf-card --pad-md` para a peça; `tf-field` + `tf-inputwrap` + `tf-input --num` para a quantidade; `tf-select` para `Usar produto salvo`; `tf-btn --ghost --sm` para remover; `tf-icon` (Lucide, traço 2px) para o chevron e para qualquer marcador; `tf-tnum` em todo dinheiro; `tf-badge --neutral` ou `--info` se a proposta incluir marcador de linha; `tf-brow` para o detalhamento do preço da peça. **Não crie primitivo novo** — e, se criar, diga em voz alta que é novo e por que nenhum dos existentes serve. Um floreio de grafismo, no máximo, e não neste card.

## Perguntas em aberto para o dono
1. A peça degradada merece um **marcador de linha** (ícone ou `tf-badge` no cabeçalho, visível com o card fechado), ou a legenda calma continua sendo o único sinal? A decisão de 2026-07-12 escolheu só a legenda; a auditoria questiona se ela é lida.
2. O **resumo do kit** e a **linha da lista de kits** devem contar quantas peças estão nesse estado (algo como "1 peça sem vínculo"), ou isso vira alarme sobre um estado que é recuperável e comum?
3. Quando o vendedor **revincula** um produto e a legenda some, deve haver uma confirmação positiva (um selo momentâneo, um toast) ou o silêncio basta?
4. A consequência "esta peça vai virar um produto novo no catálogo no próximo salvamento" deve ser dita **na peça degradada** — como já é dita para a peça ajustada (`Você ajustou esta peça — ela será salva como uma peça nova no catálogo.`) — ou fica só implícita no campo `Nome da peça no catálogo`?
