# Recibo "O que este kit fez no seu catálogo"

## O que desenhar
O bloco de confirmação que nasce **dentro do cartão de salvar** do compositor de Kits (`/kits`), logo abaixo
do botão "Salvar kit", e **só depois de um 2xx real do servidor**. Ele é o único lugar do produto em que o
vendedor descobre duas verdades: (1) salvar um kit **escreveu peças novas no catálogo dele**, e (2) numa peça
que já existia no catálogo, **os valores que ele acabou de digitar foram descartados** em favor dos valores do
produto salvo. Quem lê é o vendedor Premium ativo, no segundo exato em que termina de montar o kit — no
celular, ou no desktop com a coluna direita rolando. Origem no código: `apps/web/src/pages/bom/bom-page.tsx`
(cartão de salvar, o último da coluna direita no desktop) + `apps/web/src/pages/bom/bom-page.css`.

## Por que este prompt existe
Autoridade de desenho: **NENHUMA**. Nenhum artboard, em nenhuma versão, jamais mostrou um estado
pós-salvamento de kit — no canvas o cartão de salvar termina no botão e na dica, e o protótipo de 2026-07 só
tem o padrão genérico "Toast — feedback efêmero" (§D.2), com §E sem kits. A única autoridade é **textual**:
`ux-bom.md` §1.9 (um esboço ASCII no amendment de 2026-07-12) e **ADR-0017 §3** (a regra de que a referência
vence os valores digitados) — decisão, não desenho. Foi inferido sem desenho: se isto é bloco inline que
empurra o layout, folha, toast expandido ou tela; a hierarquia entre *criado* e *referenciado*; por quanto
tempo permanece; e como fica com 8–10 peças dentro de uma coluna de 480px que já rola sozinha.

## O que já existe hoje (não invente do zero — corrija)
Ordem real dentro do cartão bordado de salvar (borda 1px `--border`, raio de cartão, padding 16, gap 12):

| # | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Field obrigatório | "Nome do kit" · placeholder "Kit suporte + base" | pré-existente |
| 2 | Alert de erro | mensagem honesta do servidor | `tone="danger"`; vira `tone="info"` se Premium pausado |
| 3 | Botão primário | "Salvar kit" / "Salvando…" | desabilitado enquanto salva |
| 4 | Título do recibo | **"O que este kit fez no seu catálogo"** | parágrafo 14px, peso medium, **sem ícone e sem régua** — o esboço do ux tinha um separador, o código não → decidir no desenho |
| 5 | Lista | **"{nome} — criado no catálogo"** · **"{nome} — já existia no catálogo, referenciado"** | lista **sem teto de altura**, gap 4px, 14px em `--text-muted`, **sem marcador e sem nenhuma distinção visual entre criado e referenciado** → a diferença mais importante do bloco está só na palavra |
| 6 | Alert `tone="info"` | **"As peças referenciadas usam os valores do produto que já estava salvo, não os que você digitou aqui."** | aparece só quando ao menos uma peça foi referenciada |
| 7 | Botão secundário | **"Ver meus kits"** | navega para `/catalogo?tab=kits` |

→ No mesmo instante do 2xx dispara também um **toast `success` "Kit salvo." (5s)**. São **duas confirmações
simultâneas** que nunca foram desenhadas juntas: o toast pode cobrir o recibo, e no desktop o recibo pode
nascer fora da área visível enquanto o toast é a única coisa que o vendedor vê.
→ O recibo é **apagado no início de cada novo "Salvar"** (o estado volta a nulo antes da requisição): quem
salva de novo vê o recibo sumir — e ele não volta se der erro.
→ O que vem **acima** no mesmo eixo: o resumo do kit (total e preços por canal) e o botão secundário
"Salvar em Orçamentos". O recibo é o **último** conteúdo da coluna.

## Conteúdo e dados reais
- Uma linha por peça do kit, **na ordem das peças**, vinda de `materializations[]`: `position` (inteiro),
  `productId` (uuid — **chega e hoje não é usado na tela**) e `action` ∈ `created` | `referenced`.
- O `{nome}` é o campo "Nome da peça no catálogo" da linha, pré-preenchido **"Peça {n} · {kit}"**. Exemplos
  verdadeiros: `Peça 1 · Kit Suporte + base` · `Base do suporte` · e o caso ruim real
  `Peça 3 · Kit suporte + base para Galaxy S23 Ultra` (48 caracteres numa coluna de 480px).
- Quantidade de linhas: **mínimo 1** (o servidor recusa kit vazio), **sem máximo** — 8–10 peças é plausível.
- Se o `position` não casar com nenhuma linha na tela, o nome sai **vazio**: a linha vira " — criado no
  catálogo". → estado feio real, o desenho precisa não quebrar nele.
- **Não há dinheiro neste bloco.** O preço vive no resumo acima (ex.: total do kit `R$ 1.234,56`). Não invente
  valor aqui — se o desenho quiser lembrar o preço, isso é pergunta para o dono, não decisão sua.

## Estados obrigatórios
1. **Ausente** — antes do primeiro 2xx nada existe; o cartão termina no botão.
2. **Salvando** — botão "Salvando…" desabilitado e o **recibo anterior já apagado**; nada de esqueleto que
   prometa conteúdo que pode não vir.
3. **Sucesso — tudo criado**: só a lista, **sem** o alerta info.
4. **Sucesso — tudo referenciado**: lista + alerta info com a frase do supersede.
5. **Sucesso — misto** (o caso mais comum e o mais difícil): criadas e referenciadas na mesma lista.
6. **Sucesso — lista vazia**: quando `materializations` volta vazio, o bloco **hoje aparece com título, lista
   vazia e o botão** → um recibo que não diz nada. Desenhe o que essa caixa deve ser.
7. **Lista longa** — 9 peças, dentro da coluna que já rola.
8. **Erro de salvamento** — Alert `danger` e **nenhum** recibo: "Salvar faz parte do Premium." ·
   "Você não tem acesso a este recurso." · erro desconhecido.
9. **Offline** — Alert `danger` com **"Criar e editar precisam de conexão."**; falha de rede **nunca** é
   vendida como "não é Premium".
10. **Premium pausado** — banner calmo **"Premium pausado — você pode reabrir e recalcular este kit. Salvar
    precisa do Premium ativo."**, e a recusa de salvar chega em `tone="info"`, não em vermelho.
11. **Foco, hover e pressionado** de "Ver meus kits" (alvo ≥ 44px, foco visível contra o fundo do cartão).

## Viewports
- **390px (obrigatório)** — o cartão está em fluxo único; o resumo do kit é uma **barra fixa no rodapé**, então
  o recibo pode nascer **atrás dela**. Desenhe o recibo com essa barra presente na prancheta.
- **1280px (obrigatório)** — é o corte do 018: coluna direita de **480px**, grudada (`sticky`), com altura
  máxima de uma tela e rolagem própria. O recibo cresce no **fim** dessa coluna: com 9 peças ele nasce abaixo
  da dobra da própria coluna.
- **1920px** — mesma composição, mais respiro; mostre se a lista do recibo ganha duas colunas ou não.

## Regras que o desenho não pode quebrar
- **Só depois do 2xx.** Nada otimista, nada de "salvando com sucesso" antecipado.
- **A frase do supersede (ADR-0017 §3) é texto de primeira classe** — nunca placeholder, nunca tooltip, nunca
  toast efêmero. É a verdade mais surpreendente do fluxo e o vendedor não pode descobri-la reabrindo o kit e
  achando outros números.
- **"criado no catálogo" não pode ficar atrás de um "ver detalhes".** Escrever no catálogo do vendedor é o
  fato, não o detalhe.
- Falha de rede ≠ falta de Premium; recusa por plano pausado é calma, não punitiva.
- Alvo de toque ≥ 44px; contraste do texto muted medido contra o **fundo do cartão**, não contra o fundo da
  página.
- Zero rolagem horizontal a 360px com o nome de peça longo.

## Armadilhas já pagas neste projeto
- **Botão nascido fora da viewport** (E6 PR-B, 100,5px de overflow medidos): aqui o risco é literal — o recibo
  é o último filho de uma coluna que já rola; com 9 peças, "Ver meus kits" pode nascer fora da área visível.
- **Rolagem no eixo Y invisível em headless** (016/PR-B): a coluna de 480px rola sozinha; mostre no desenho
  onde a rolagem começa e o que fica escondido.
- **Texto ocluso passa em teste** (014): o toast "Kit salvo." pode cobrir o topo do recibo e nenhum teste vê.
- **Nome grande estoura a coluna** (E4, o PDF): desenhe a linha com o nome de 48 caracteres, não com "Base".
- **Frase honesta cortada** (016/PR-F): o alerta info tem 108 caracteres — ele precisa de largura total e de
  quebra em 2–3 linhas a 390px, jamais de truncamento com reticências.

## Entregável
Pranchetas, tema **escuro (padrão)** e **claro (first-class)**:
1. 390px — recibo misto com 3 peças, barra de resumo fixa visível;
2. 390px — lista longa com 9 peças + o alerta info;
3. 1280px — a coluna direita inteira (resumo → "Salvar em Orçamentos" → cartão de salvar com o recibo),
   mostrando a rolagem e onde "Ver meus kits" cai;
4. 1280px — a trinca de estados: salvando · erro em `danger` · Premium pausado em `info`;
5. 1280px — o caso de lista vazia;
6. 1920px — a composição final.

Reutilize os primitivos existentes, sem criar novos: a caixa é o **cartão bordado que já existe** (`tf-card` /
borda `--border` + raio de cartão); o aviso do supersede é **`tf-alert--info`** com o ícone que o primitivo já
traz; "Ver meus kits" é **botão secundário `tf-btn`**; se propuser um selo para separar *criado* de
*referenciado*, use **`tf-badge`**; ícones só do conjunto `Icon` já existente. O título é tipografia de bloco,
não um `tf-price`.

## Perguntas em aberto para o dono
1. **Permanência**: hoje o recibo fica na tela até o próximo "Salvar" (ou até a página re-hidratar) e some se o
   vendedor sair. Ele deve reaparecer quando o kit for reaberto depois? Deve poder ser fechado?
2. **Cada peça criada vira link para o produto no catálogo?** O `productId` chega na resposta e não é usado —
   transformar a linha em link é decisão de produto (abre uma saída competindo com "Ver meus kits").
3. **Hierarquia criado × referenciado**: uma lista única (como hoje), dois grupos com títulos, ou selos? A
   escolha muda o que o vendedor entende ser "novo no meu catálogo".
4. **Lista vazia**: mostrar a caixa vazia como hoje, mostrar uma frase ("nenhuma peça nova foi criada") ou não
   mostrar nada?
5. **Toast + recibo ao mesmo tempo**: mantém as duas confirmações, ou o toast some quando o recibo aparece?
