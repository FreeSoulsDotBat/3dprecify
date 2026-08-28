# Card da peça recolhido — a linha do kit

## O que desenhar

A unidade que se repete na aba **Kits** (`/kits`, "Monte seus kits"): cada peça do kit é um card que,
recolhido, mostra **quem é a peça, quantas unidades e quanto ela custa**, e que expande para hospedar o
editor completo daquela peça. O vendedor vê de três a dez destes empilhados, um embaixo do outro, com um
botão "Adicionar peça" abaixo da pilha e o resumo "Total do kit" ao lado (desktop) ou depois (mobile). É a
peça que ele mais repete na tela e a única que ele compara entre si — se a linha não deixa comparar
"quanto custa a Peça 1 contra a Peça 3", o kit inteiro fica ilegível.

## Por que este prompt existe

A anatomia que está no ar nunca foi desenhada: ela foi montada a partir de requisito textual em 2026-07-12
(008/T005) e nunca passou por prancheta em nenhuma largura. Existe **um** desenho parcial — o canvas de
018 (`Abas-Desktop.dc.html`, artboard de 1920px) — e ele é **outro card**: cabeçalho com rótulo + selo de
origem lado a lado, a palavra "Quantidade" **visível**, ícone de **lixeira** para remover, uma grade de
quatro métricas e dois botões de rodapé. Esse card **não foi implementado** (018/US3 mexeu só na variante
do resumo e no CSS da grade da página). Abaixo de 1280px não existe desenho nenhum. Este prompt pede as
duas larguras e a reconciliação entre o que está no ar e o que o canvas já prometeu.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/bom/bom-line-card.tsx` (a linha) · `pages/bom/bom-page.tsx` (a pilha) ·
`specs/018-abas-desktop/design/Abas-Desktop.dc.html`, linhas 184-198 e 516-518 (o desenho de 1920px).

Card recolhido, hoje, de cima para baixo — **tudo empilhado com o mesmo peso tipográfico**:

| Elemento | Como está no ar | Como o canvas de 1920px desenhou |
|---|---|---|
| Rótulo | Botão de linha inteira, altura mín. 44px, chevron de 16px + `"Peça 1 · Vaso G"` (14px, medium) | `"Peça 1 · Vaso G"` em 16px forte, **com a origem ao lado** |
| Origem | **Não aparece recolhida** — `"do catálogo: Vaso G"` / `"— Manual —"` só existem dentro do editor expandido | `"do catálogo: Vaso G"` em 13px muted, na mesma linha do rótulo |
| Peça avulsa | `"Peça 2 · (avulsa)"` (o código concatena o `·`) | `"Peça 2 (avulsa)"` — sem o `·`. → duas grafias para a mesma coisa |
| Quantidade | Campo de **96px**, sufixo `"un"`, placeholder `"1"`, **sem rótulo visível** — só o `aria-label` "Quantidade — Peça 1 · Vaso G" | Rótulo `"Quantidade"` visível antes de um campo de **104px** |
| Remover | Botão fantasma com ícone **"x"** de 16px | Botão fantasma com ícone de **lixeira**, alvo mín. 44px, dica "Remover peça" |
| Dinheiro | Um parágrafo cinza, texto corrido: `"R$ 21,84 /un · Total da linha (2×) R$ 43,68"` | Grade de 4 métricas rotuladas: Gramas · Impressão · Custo unitário · Total da linha (2×) |
| Legendas | Até quatro parágrafos cinzas de 14px, iguais entre si e iguais ao dinheiro | Alerta de perigo para a peça inválida; legendas separadas |
| Ações | Nenhuma visível — "Editar esta peça"/"Recolher" existem **só** no `aria-label` do chevron | Rodapé com `"Editar esta peça"` e `"Usar produto salvo"` |

→ Problemas a resolver no desenho: (1) **hierarquia zero** — o número que importa (Total da linha) tem o
mesmo tamanho, cor e peso do aviso de plausibilidade e da legenda de degradação; (2) `"R$ 21,84 /un"`
**não diz que é CUSTO** (é o custo unitário calculado, não preço) — procedência silenciada; (3) a origem da
peça (catálogo × manual) some justamente quando a linha recolhe, que é quando o vendedor compara; (4) a
palavra "Quantidade" só existe para leitor de tela; (5) nada define o comportamento com nome longo.

## Conteúdo e dados reais

- **Rótulo**: `"Peça {n} · {nome do produto}"`; sem produto vinculado, `"Peça 2 · (avulsa)"`. O nome vem do
  catálogo e pode ser longo — desenhe com `"Suporte articulado para celular com base pesada e regulagem"`.
- **Quantidade**: inteiro, obrigatório, `1` é o valor sugerido pelo placeholder; teto real **2.147.483.647**.
- **Custo unitário** (derivado, nunca digitado): `R$ 21,84`. **Total da linha**: custo unitário × quantidade —
  `R$ 43,68` para 2 un. A faixa plausível vai de `R$ 0,87` a `R$ 1.234,56`; o aviso de absurdo só dispara
  acima de `R$ 100.000,00`.
- **Métricas do canvas** (existem hoje dentro do editor e podem subir para a linha): Gramas `42 g`,
  Impressão `3 h 30 min`, e o caso incompleto `— g` / `—`.
- **Origem**: `"do catálogo: Vaso G"`, `"do catálogo: Vaso G · ajustado por você"`, `"— Manual —"`.

## Estados obrigatórios

1. **Recolhida em repouso, peça válida e vinculada** — rótulo, origem, quantidade, custo unitário e total.
2. **Recolhida, peça avulsa** — `"Peça 2 · (avulsa)"`, sem selo de catálogo. Não é erro: é uma peça legítima.
3. **Expandida** — o card vira cabeçalho + editor completo abaixo, chevron apontando para cima. O cabeçalho
   precisa continuar legível sem virar um título de seção.
4. **Foco de teclado** — anel de 3px no botão do cabeçalho (que ocupa a linha inteira), no campo de
   quantidade e no botão de remover, sem que a borda do card ou o card vizinho corte o anel.
5. **Hover e pressionado** do cabeçalho e do botão de remover — o cabeçalho é um alvo largo; deixe claro que
   ele é clicável inteiro e que o botão de remover **não** dispara ao tocar na linha.
6. **Quantidade 0** — legenda `"Quantidade 0 — não entra no total."`, com a linha visivelmente fora da soma.
7. **Aviso de plausibilidade** — quantidade acima do teto: *"Confira a quantidade: 3.000.000.000. O máximo
   por peça é 2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."* É **aviso, nunca
   recusa**: o campo continua editável e a peça continua no kit.
8. **Peça inválida** — *"Confira os campos desta peça — ela não entra no total até ser corrigida."* O canvas
   usa um alerta de perigo e uma borda de perigo no card; hoje é um parágrafo cinza igual aos outros.
9. **Degradada** (o produto do catálogo foi apagado depois de o kit ser salvo) — *"Os valores atuais foram
   mantidos e continuam editáveis."* Tom calmo, **nunca** "produto removido/excluído"; a linha volta a ser
   manual e segue editável.
10. **Nome longo** — como o rótulo se comporta em 390px sem empurrar quantidade e remover para fora.
11. **Valor grande** — `R$ 1.234,56 /un · Total da linha (999×) R$ 1.234.325,44` na coluna estreita.

Estados que esta peça **não** tem, e é bom saber: não existe variante grátis nem premium pausado (a página
inteira vira teaser antes de qualquer linha existir), não existe carregando (o cálculo é local e imediato) e
não existe offline (calcular funciona offline; a linha não muda). Não invente nenhum dos três.

## Viewports

- **390px** — obrigatório, e é o caso não desenhado mais crítico: cabeçalho + campo de 96px + botão de
  remover competem na mesma linha, e abaixo vêm até quatro legendas do mesmo peso.
- **1280px** — o corte do layout desktop. A coluna de peças é a flexível ao lado de uma coluna fixa de 480px
  com 24px de gap; com a barra lateral aberta (240px) sobram **≈490px** para o card. É a largura em que o
  cabeçalho do canvas (rótulo + origem + "Quantidade" + campo de 104px + lixeira) precisa provar que cabe.
- **1920px** — a largura em que o canvas foi desenhado; a coluna de peças chega a ≈1200px e a grade de quatro
  métricas respira. Mostre o mesmo card nas três larguras, para que a degradação seja decisão e não acaso.

## Regras que o desenho não pode quebrar

- **Procedência do número**: todo dinheiro na linha diz o que é. `"/un"` sozinho não distingue custo de preço;
  se o número é custo, a palavra "custo" aparece.
- **Degradação dita, não escondida**: a peça cujo produto sumiu continua no kit com os valores que tinha, e o
  desenho conta isso — sem alarme vermelho e sem sumir com a linha.
- **Aviso nunca vira erro**: o aviso de quantidade não pode receber a mesma cor e o mesmo ícone da peça
  inválida — um bloqueia o total, o outro não bloqueia nada.
- **Frase honesta fora de placeholder**: nenhuma dessas legendas pode viver dentro do campo de quantidade; o
  campo carrega só o número e o sufixo `"un"`.
- **Alvos ≥44px** no cabeçalho, no campo e no botão de remover, inclusive quando o card aperta em 390px.
- **Contraste ≥4.5:1 medido contra o fundo do card**, não contra o fundo da página.
- **Remover é destrutivo e imediato** — o alvo não pode ficar colado no chevron a ponto de o polegar errar.

## Armadilhas já pagas neste projeto

- **Overflow horizontal se mede, não se olha**: em 016 um card de kit estourou a coluna e o teste passou.
  Desenhe o caso "nome longo + total de sete dígitos" e mostre onde o texto quebra.
- **Texto ocluso passa em teste**: um rótulo truncado é aprovado por qualquer verificação de visibilidade. Se
  o nome trunca, diga com quantos caracteres e o que resta legível.
- **Máscara de milhares que estoura o campo** (016/PR-C): o campo de quantidade precisa comportar
  `2.147.483.647` sem cortar.
- **Uma pilha de parágrafos cinzas iguais é invisível**: com quatro legendas do mesmo peso juntas, o vendedor
  não lê nenhuma.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como par obrigatório**:

1. A linha recolhida em repouso, nas três larguras (390 / 1280 / 1920), com a peça vinculada ao catálogo.
2. Uma pilha de **três** linhas em 1280px — vinculada, avulsa e inválida — provando a comparação entre elas.
3. A matriz de estados em 390px: quantidade 0 · aviso de plausibilidade · inválida · degradada · nome longo ·
   valor de sete dígitos.
4. A linha expandida (cabeçalho + as primeiras linhas do editor, só para mostrar a transição).
5. Foco, hover e pressionado do cabeçalho e do botão de remover.

Reutilize os primitivos existentes, sem criar novos: `tf-card` para o card; `tf-inputwrap tf-inputwrap--sm`
com `tf-inputwrap__affix` = `"un"` para a quantidade; `tf-btn tf-btn--ghost tf-btn--sm` para remover;
`tf-tnum` em todo número; `tf-alert tf-alert--danger` para a peça inválida; `tf-field__aviso` para o aviso de
plausibilidade; `tf-field__hint` para as legendas calmas; `tf-badge` se a origem virar selo.

## Perguntas em aberto para o dono

1. A grade de quatro métricas do canvas (Gramas · Impressão · Custo unitário · Total da linha) vale para as
   três larguras, ou em 390px a linha recolhida fica só com **Total da linha**? São dois produtos diferentes.
2. Os dois botões de rodapé do canvas ("Editar esta peça" / "Usar produto salvo") entram na linha recolhida —
   e, se entrarem, "Editar esta peça" passa a ser um botão além do chevron, ou substitui o chevron?
3. `"Peça 2 · (avulsa)"` (código) ou `"Peça 2 (avulsa)"` (canvas)? Uma das duas grafias morre.
4. A origem (`"do catálogo: Vaso G"` / `"— Manual —"`) deve ser visível na linha recolhida, ou continua só
   dentro do editor? O canvas diz que sim; o produto no ar diz que não.
