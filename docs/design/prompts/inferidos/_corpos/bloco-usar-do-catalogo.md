# Bloco "Usar do catálogo" no topo da Calcular — e as três identidades da mesma faixa

## O que desenhar

Uma faixa fixa no topo do formulário de **Calcular preço**, logo acima da seção "Custos da peça"
(e, no desktop, acima da grade de duas colunas custos/markup). Ela é a ponte entre o Catálogo
premium e o cálculo: quem tem filamentos e impressoras salvos escolhe um em cada seletor e os
campos do formulário se preenchem sozinhos. É o primeiro elemento que o vendedor vê ao abrir a
tela para orçar uma peça — antes de digitar qualquer número. O problema de desenho é que **essa
mesma faixa, na mesma posição, tem três identidades completamente diferentes** (seletores /
convite de venda / erro de leitura) e uma quarta situação em que ela simplesmente não existe.
Elas nunca foram desenhadas juntas.

## Por que este prompt existe

A ficha da auditoria classifica esta peça como `PROTOTIPO_PARCIAL`: dois dos três estados têm
ancestral desenhado — o protótipo de 2026-07-02 (§E4, linhas 245-246) pedia "dropdowns Filamento ▾
e Impressora ▾ **+ link 'inserir manualmente' como fallback sempre disponível**", e o
`-fixes.md` item 1 desenhou o card de teaser compacto do usuário grátis com o link **"Ver
Premium"**. Nunca foram desenhados: (1) o estado de **falha de leitura com retentativa**, que
nasceu em 016/T072-A8; (2) a troca do link "Ver Premium" por um **botão desabilitado**; (3) o
**sumiço silencioso** quando a conta é premium mas não tem nenhum item salvo; (4) o "inserir
manualmente", que o protótipo exigia e que o `CalculatorScreen.jsx` exportado nem chegou a
implementar. O item (2) é o caso em que **o código contraria uma decisão de desenho explícita**:
onde havia um link para o Premium, hoje há um botão cinza inerte.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/calcular/calcular-page.tsx` (linhas 397-467),
`apps/web/src/features/calculator/catalog-prefill.ts`,
`apps/web/src/shared/billing/premium-teaser.tsx`, textos em
`apps/web/src/shared/i18n/messages.pt-br.ts`.

**Montagem (a) — premium com itens salvos.** Um card com, nesta ordem: título de seção
"Usar do catálogo" · legenda "Preenche os campos com o item salvo — você ainda pode editar tudo."
· uma grade **fixa de duas colunas iguais** com dois selects rotulados "Filamento salvo" e
"Impressora salva", ambos com o placeholder "Escolher…".
→ A grade é `1fr 1fr` **também no mobile de 390px**: dois selects de ~170px lado a lado, tendo
que exibir nomes como "PLA Preto Voolt 1,75mm" ou "Creality Ender 3 V3 SE (oficina)".
→ Se o vendedor salvou só filamentos, **um select ocupa metade e a outra metade fica vazia**.
→ Depois de escolher, **nada na tela diz que os campos abaixo vieram daquele item**; se o vendedor
editar "Custo do rolo" à mão, o select continua exibindo o nome do filamento, agora mentindo.
→ O hook de leitura tem uma bandeira `stale` (lista servida do cache offline depois de a leitura
online falhar) e **a tela não a lê**: uma lista possivelmente desatualizada aparece idêntica a uma
lista fresca. Há um comentário no código afirmando que o card mostra esse aviso; ele não mostra.
→ O hook tem `isLoading`, e **não há estado de carregamento**: o card aparece de repente quando os
itens chegam, empurrando o formulário para baixo.

**Montagem (b) — conta grátis ou deslogada.** Um card com o teaser premium unificado: título
"Preencha o cálculo com um toque" · subtítulo "O catálogo guarda seus filamentos e impressoras
salvos: no Premium, eles preenchem os campos abaixo sozinhos — e continuam editáveis." · a linha
de preço "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" com o botão primário
"Assinar Premium" · a legenda "O cálculo de custo e markup continua grátis." · e, por último, a
afordância desabilitada: um **botão secundário inerte escrito "Usar do catálogo"**.
→ Esse botão é o item inferido. Ele é o único elemento cinza-inerte da tela, fica **abaixo** do
"Assinar Premium" (duas afordâncias de topo competindo) e não tem estado de foco nem explicação
própria — é preciso ler o subtítulo três linhas acima para saber por que ele está morto.

**Montagem (c) — falha real de leitura, sem cache.** Um card contendo um alerta de tom **perigo**
com o título "Não foi possível carregar seus itens salvos agora." e, dentro dele, um botão
secundário pequeno "Tentar novamente".
→ Só aparece para conta autenticada e **só quando há falha de verdade**; um 403 de direito
(conta sem premium) nunca cai aqui, e "você ainda não salvou nada" é silêncio proposital.
→ Não há estado de "tentando de novo" no botão: o clique dispara duas releituras e a tela não muda.

**Situação (d) — silêncio.** Conta premium, catálogo vazio: **nenhum card**. O formulário começa
direto em "Custos da peça" e nada convida a cadastrar o primeiro filamento.

## Conteúdo e dados reais

| Elemento | Conteúdo real | Observação |
|---|---|---|
| Select "Filamento salvo" | opções = nomes salvos; 1ª opção "Escolher…" | pode ter 0, 1 ou dezenas |
| Select "Impressora salva" | idem | independente do de filamento |
| Campos que o filamento preenche | "Custo do rolo" (R$ 110,00) · "Peso do rolo" (1,000 kg) | continuam editáveis |
| Campos que a impressora preenche | "Valor da máquina" (R$ 1.899,00) · "Vida útil da máquina" (2.000 h) · "Consumo médio" (0,12 kW) · "Reserva de manutenção" (R$ 0,35/h) | 4 campos de uma vez |
| Linha de preço do teaser | "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" | texto único, nunca recomposto |
| Erro | "Não foi possível carregar seus itens salvos agora." + "Tentar novamente" | tom perigo |

Nomes de itens são texto livre do vendedor: desenhe com um nome curto ("PLA Preto") **e** com um
nome longo real ("PLA Silk Bicolor Azul/Prata 1,75mm — rolo da promoção") na mesma prancheta.
Nenhum campo desta peça é obrigatório: escolher do catálogo é sempre opcional.

## Estados obrigatórios

1. **Repouso premium com os dois seletores** — nada escolhido, ambos em "Escolher…".
2. **Premium com apenas um seletor** (só filamentos salvos, ou só impressoras) — resolva a metade vazia.
3. **Item escolhido** — o select mostra o nome; decida se e como a peça declara "estes 2 (ou 4)
   campos abaixo foram preenchidos a partir daqui".
4. **Foco e hover no select** — anel de foco visível sobre o fundo do card, não sobre o da página.
5. **Carregando** — a lista ainda não chegou (hoje inexistente; o card materializa do nada).
6. **Lista servida do cache / possivelmente desatualizada** (`stale`) — hoje invisível.
7. **Erro de leitura com retentativa** — "Não foi possível carregar seus itens salvos agora." +
   "Tentar novamente", e o estado do botão **durante** a retentativa.
8. **Grátis/deslogado (teaser)** — com o botão "Usar do catálogo" desabilitado: mostre repouso,
   foco (um alvo desabilitado ainda precisa ser explicável) e a versão deslogada.
9. **Premium sem nenhum item salvo** — hoje é ausência total; desenhe a alternativa para o dono decidir.

## Viewports

- **390px (mobile)** — obrigatório: é onde a grade `1fr 1fr` aperta dois nomes longos em ~170px
  cada, e onde o card do teaser (título + subtítulo + preço + botão + legenda + botão inerte)
  empilha seis elementos antes do primeiro campo do formulário.
- **1280px (desktop, o corte do 018)** — obrigatório: a faixa é **largura total**, acima da grade
  de duas colunas do formulário; dois selects sozinhos numa faixa larga precisam de uma proporção
  decidida, não esticada.
- **1920px** — mostre a mesma faixa no limite superior, onde o risco é o oposto: dois selects
  perdidos num campo de largura enorme e um teaser centralizado com muito ar.

## Regras que o desenho não pode quebrar

- **Freemium binário**: quem não é premium não vê seletor funcionando "com um item de exemplo".
  Ou tem acesso, ou vê o convite. Nada de meia-porta.
- **Falha de rede nunca é vendida como falta de assinatura**: a montagem (c) não pode se parecer
  com a montagem (b). São a mesma posição da tela — precisam ser inconfundíveis à distância.
- **Ausência de itens não é erro**: o vendedor que ainda não cadastrou nada não pode ver tom de
  perigo nem texto de falha.
- **Preencher nunca é travar**: os campos preenchidos continuam editáveis, e o desenho não pode
  sugerir cadeado, campo somente-leitura ou valor "oficial".
- **Procedência do número**: se a peça declarar de onde veio o valor, essa declaração é de texto
  corrido no card, **nunca dentro de um placeholder** (uma frase honesta em placeholder some ao
  digitar e é cortada pela largura do campo — já pago no 016/PR-F).
- **Alvos ≥44px** para os dois selects e para os botões, inclusive o desabilitado.
- **Contraste medido contra o fundo real do card**, não contra o fundo da página — o card tem
  superfície própria, e o botão desabilitado é o elemento de menor contraste da tela.

## Armadilhas já pagas neste projeto

- **Grade de duas colunas fixa no mobile**: `1fr 1fr` não vira uma coluna a 390px. Nome longo =
  texto cortado ou estouro horizontal medido em pixels, e `toBeVisible` passa em cima disso.
- **Dois CTAs de compra na mesma tela**: este teaser já ficou visível atrás da folha de Simulações,
  cada um com o seu "Assinar" (016/T010-A3, mesma classe do E6/T038-D4). Se o desenho propuser o
  teaser em posição fixa ou sobreposta, ele reabre isso.
- **Card que desaparece em silêncio**: foi exatamente o defeito 016/T072-A8. Sumir é uma decisão
  de desenho, não um efeito colateral.
- **Frase honesta cortada**: a legenda "Preenche os campos com o item salvo — você ainda pode
  editar tudo." precisa de largura total do card; não a coloque ao lado de um select.
- **Valor grande estourando a coluna**: "R$ 1.899,00" e "2.000 h" chegam juntos nos quatro campos
  da impressora logo abaixo — desenhe a faixa sabendo o que ela empurra.

## Entregável

Pranchetas, **tema escuro como padrão e tema claro em pé de igualdade**:

1. Premium, dois seletores, repouso — 390 · 1280 · 1920.
2. Premium, um seletor só, e a versão com item escolhido (nome longo).
3. Carregando + lista desatualizada (`stale`) — a proposta para os dois buracos de hoje.
4. Erro com retentativa (incluindo o botão em retentativa) — 390 · 1280.
5. Grátis/deslogado com a afordância desabilitada — 390 · 1280 — e, ao lado, a **alternativa**
   ao botão inerte (o link "Ver Premium" que o protótipo previa), para o dono comparar.
6. Premium sem itens: o silêncio de hoje vs. a proposta de convite ao Catálogo.

Reutilize os primitivos existentes, sem criar novos: o contêiner é o **card** com padding médio;
o título usa o estilo de **rótulo de seção** e a legenda o de **caption**; os seletores são
**Field + Select** com rótulo justo; o erro é o **Alert de tom perigo** com **Button secundário
pequeno** dentro; o convite é o **PremiumTeaser** já unificado (título, subtítulo, linha de preço +
"Assinar Premium", legenda, afordância) — a estrutura dele é fechada e não deve ser rearranjada,
apenas posicionada.

## Perguntas em aberto para o dono

1. O protótipo pedia um link **"inserir manualmente" sempre disponível** ao lado dos seletores.
   Hoje ele não existe (os campos já são editáveis). Ele volta como afordância explícita, ou a
   editabilidade dos campos basta?
2. Conta premium com **catálogo vazio**: continua silêncio total, ou ganha um convite discreto
   para cadastrar o primeiro filamento/impressora?
3. A afordância do gate deve ser o **botão desabilitado "Usar do catálogo"** (o que existe) ou o
   **link "Ver Premium"** (o que foi desenhado)? A troca nunca foi decidida por ninguém.
4. Depois de escolher um item, a peça deve **declarar a procedência** dos campos preenchidos — e,
   se o vendedor editar um deles à mão, o nome escolhido deve continuar exibido?
5. Lista servida do cache offline (`stale`): mostra aviso de "pode estar desatualizado" dentro do
   card, ou o catálogo salvo é considerado estável o bastante para não avisar?
