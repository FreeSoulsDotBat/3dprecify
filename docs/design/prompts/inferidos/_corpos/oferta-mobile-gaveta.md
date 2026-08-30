# Gaveta "Assinar o Premium" (mobile, abaixo de 1280px)

## O que desenhar
A superfície de COMPRA do Precifica3D no mobile: uma gaveta que sobe sobre a tela de Conta com o título "Assinar o Premium", os dois planos (anual e mensal), o botão "Assinar Premium" e os avisos de que o pagamento acontece no Mercado Pago. Ela abre por dois caminhos: o vendedor toca no botão de assinar na linha do plano (aba **Conta**), ou chega de um dos quatro teasers premium (Catálogo, Kits, Orçamentos, Simulações) por `/conta?assinar=1` — nesse segundo caso a gaveta já aparece ABERTA assim que a página de Conta pinta, sem nenhum toque. É o único lugar do app onde alguém paga, e abaixo de 1280px é onde está a maioria dos vendedores.

## Por que este prompt existe
Nunca houve desenho desta gaveta. O que existe hoje é o mesmo bloco de oferta composto para o desktop de 1920px, jogado dentro de um painel lateral, com altura e rolagem que ninguém compôs. Existe SIM um desenho mobile de oferta — `PremiumScreen.jsx` (2026-07-02) — mas ele é outra peça: tela cheia com overlay, coroa + h1, bloco "NO PLANO GRÁTIS VOCÊ TEM" com quatro benefícios marcados, controle segmentado mensal/anual, UM preço grande, CTA `primary size=lg full glow` e um `ghost full` "Agora não". **Nada disso sobreviveu no código**: virou fieldset de rádios com dois cartões, sem benefícios listados, sem segmentado, sem "Agora não". As perguntas que decidem a peça — o que fica acima da dobra, se o CTA gruda no rodapé, como se sai sem comprar — continuam sem resposta em qualquer autoridade.

## O que já existe hoje (não invente do zero — corrija)
A gaveta é o primitivo `Sheet`/`SheetContent` do DS, **ancorado à DIREITA por padrão** (o código não passa `side`), altura total da tela, largura `min(92vw, 26rem)` — a 390px isso dá **358,8px**, com uma faixa do fundo visível à esquerda. O conteúdo rola dentro dela (`overflow: auto`), sem cabeçalho fixo nem rodapé fixo.

→ Primeiro problema a resolver: **uma tela de compra no celular entrando pela lateral, ocupando 92% da largura e 100% da altura, não é nem gaveta de fundo nem tela cheia** — é um meio-termo que ninguém escolheu. Decida a ancoragem no desenho (o DS já oferece `bottom`, com `max-height: 85vh` e cantos superiores arredondados).

Ordem atual do conteúdo, de cima para baixo:

| # | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Título da gaveta (`SheetTitle`, caixa alta, `--fs-lg`, com espaço reservado à direita para o X) | "Assinar o Premium" |
| 2 | Botão fechar, ≥44×44px, canto superior direito | rótulo acessível "Fechar" |
| 3 | Lead, cor `--text-muted`, 15px | "A calculadora é grátis e continua grátis." |
| 4 | Corpo | "O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar." |
| 5 | `fieldset` com legenda invisível | legenda = "Assinar o Premium" → **repete o título palavra por palavra** |
| 6 | Cartão de plano 1 | **Plano mensal** (veja a ordem abaixo) |
| 7 | Cartão de plano 2 | **Plano anual** |
| 8 | Botão primário, largura automática (não é `full`, não tem `glow`) | "Assinar Premium" |
| 9 | Aviso 1, 13px, muted | "Você paga no Mercado Pago (Pix ou cartão)." |
| 10 | Aviso 2, 13px, muted | "O cartão nunca passa pelo nosso app." |

→ **O cartão pré-selecionado é o SEGUNDO da lista.** O anual nasce marcado e carrega o selo "recomendado", mas é renderizado depois do mensal. O vendedor lê primeiro o plano que o produto não recomenda, e encontra a marcação já feita embaixo.
→ Não existe nenhuma dispensa explícita: o "Agora não" do protótipo sumiu, e a única saída é o X, o Esc ou tocar fora.
→ Os dois cartões ficam SEMPRE empilhados (coluna, em qualquer largura). Isso está certo no mobile; registre no desenho que é intencional, não um colapso acidental do lado a lado do desktop.
→ Se o vendedor já é Premium, a gaveta abre com o título "Assinar o Premium" e uma única frase, "Você já é Premium.", num painel de altura inteira. Um painel quase vazio anunciando uma venda que não vai acontecer.

## Conteúdo e dados reais
Os preços vêm de uma constante única de produto — dois preços diferentes na mesma tela é bloqueador de release. São estes, exatos:

**Plano anual** (marcado por padrão, selo verde "recomendado"): preço "R$ 155,88/ano"; abaixo, "equivalente a R$ 12,99/mês"; abaixo, "~19% de economia frente ao mensal".
**Plano mensal**: preço "R$ 15,99/mês"; abaixo, em muted 14px, "cobrança todo mês, cancele quando quiser".

O preço do cartão usa a fonte de título, `--fs-md`, cor `--text-strong`. O card inteiro é o alvo de toque (≥44px), não só a bolinha do rádio — o rádio tem 18×18px e mora NA MESMA LINHA do nome do plano, à esquerda dele; o selo "recomendado" fica na ponta oposta da mesma linha. R$ 191,88 (12 × 15,99) **nunca** aparece riscado: não existe "de/por" nesta peça, porque um desconto que nunca existiu seria mentira. Não há contagem regressiva, "última chance" nem qualquer urgência.

## Estados obrigatórios
- **Repouso** — anual marcado, mensal não marcado. Mostre a diferença visual entre marcado e não marcado além do rádio: hoje é só a borda que muda para a cor de destaque.
- **Foco de teclado** — o anel de foco pertence à caixa do rádio, nunca ao cartão inteiro; desenhe-o visível sobre o fundo escuro E sobre o claro.
- **Pressionado / toque no cartão** — o toque em qualquer ponto do cartão troca a seleção.
- **Enviando** — ao tocar "Assinar Premium" o botão fica ocupado com um spinner inline **e o rótulo continua sendo "Assinar Premium"**, até o navegador sair do app para o Mercado Pago. A frase "Abrindo o Mercado Pago…" existe na copy do produto mas **não aparece nesta peça** → decida no desenho se ela deve aparecer (é a frase honesta: está criando a assinatura, não "processando pagamento").
- **Erro: já existe pagamento em andamento** — alerta de perigo logo abaixo do botão: "Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e tente de novo."
- **Erro: Mercado Pago indisponível / sem rede** — mesmo lugar, mesmo tom: "O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado."
- **Deslogado** — o toque no CTA não compra nada: leva para a tela de entrar e a gaveta desaparece. Desenhe o que o vendedor vê no instante da saída (nada de tela branca sem explicação).
- **Já é Premium** — hoje só "Você já é Premium." Componha esse estado de propósito ou decida que a gaveta simplesmente não abre.
- **Premium pausado** (assinatura lapsa ou cancelada) — a gaveta ABRE para esses vendedores, com o mesmo conteúdo de venda. O contexto de que ele já foi Premium não aparece em lugar nenhum.
- **Rolagem** — desenhe a peça com o conteúdo rolado até o fim e com ele no topo: precisamos ver se o CTA fica alcançável sem rolar e o que acontece com os dois avisos no rodapé.

## Viewports
- **390 × 844** — obrigatória, é a razão de existir do prompt. Desenhe também com a altura curta (**390 × 667**), porque é aí que o CTA cai abaixo da dobra.
- **768** (tablet retrato) — a gaveta ainda é o caminho até 1279px; a 768 a largura vira 26rem = 416px e sobra muito fundo visível. Vale uma prancheta.
- **Não desenhe 1280px+**: acima do corte a mesma oferta abre INLINE, dentro de um cartão na coluna do plano, e o botão só rola até ela. Essa é outra peça.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto**: "A calculadora é grátis e continua grátis." é promessa de produto, não isca — não a coloque em cinza fraquinho no rodapé nem em placeholder.
- **Nenhum toque liga o Premium antes do servidor confirmar.** O botão nunca fica verde de "ativo" ao ser tocado.
- **Falha de rede nunca é vendida como falta de assinatura**: erro do Mercado Pago mostra a frase de erro, jamais um "você não é Premium".
- **"Nada foi cobrado" precisa caber inteiro** na largura real — frase honesta mora em elemento de largura cheia, nunca em placeholder nem truncada.
- **Zero transbordo horizontal a 390px.** Esta tela já custou 100,5px de transbordo com um botão nascendo fora da viewport, na aba Conta, a 8px daqui.
- **Alvo ≥44×44px** para o cartão de plano, o CTA e o fechar.
- **Contraste medido contra o fundo real da gaveta**, não contra o fundo da página — os avisos de 13px em `--text-muted` são o ponto mais frágil.

## Armadilhas já pagas neste projeto
- **Quebra de linha dentro do preço**: já aconteceu de a linha terminar em "equivalente a R$" e a seguinte começar em "12,99/mês". Nenhuma asserção de texto ou de geometria enxerga isso (não há corte, não há transbordo) — só a imagem. Numa linha de preço, separar o símbolo do valor é a única quebra proibida. Desenhe as três linhas do cartão anual na largura real de 358,8px menos os paddings.
- **O rádio esticado**: como item de uma coluna flex, o rádio nativo já virou uma barra de 292–350px de largura com 13px de altura. Deixe explícito no desenho que ele é um quadrado de 18px alinhado ao topo do texto do nome.
- **Elemento ocluído passa em teste**: `toBeVisible` passa em coisa coberta ou fora da tela. Se o CTA ficar sob a dobra, isso só aparece na prancheta — desenhe a dobra.
- **PNG/asset que some do cache**: se a peça ganhar qualquer ícone novo (coroa, cheques), ele precisa ser um primitivo do DS, não um arquivo novo.

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro (first-class)** para: (1) repouso a 390×844; (2) repouso a 390×667 mostrando a dobra; (3) mensal selecionado; (4) enviando (spinner no CTA); (5) erro "pagamento em andamento"; (6) erro "Mercado Pago não respondeu"; (7) já é Premium; (8) 768 retrato. Reutilize os primitivos existentes: `Sheet`/`SheetContent` para a gaveta e seu fechar de 44×44, `Card`/rótulo clicável para cada plano, `Badge` tom `success` para "recomendado", `Button` primário para "Assinar Premium", `Alert` tom `danger` para os dois erros, `Spinner` inline no botão. **Não crie primitivo novo** — se o desenho pedir algo que não existe (um rodapé fixo dentro da gaveta, por exemplo), marque como pedido explícito em vez de inventar o componente.

## Perguntas em aberto para o dono
1. **A gaveta deve subir do RODAPÉ (85% da altura, cantos arredondados no topo) em vez de entrar pela direita?** O código herdou "direita" por ser o padrão do primitivo, não por decisão.
2. **Volta o "Agora não"?** O protótipo de 2026-07-02 tinha uma dispensa explícita; hoje só existe o X.
3. **O anual deve vir PRIMEIRO na lista**, já que é o recomendado e o pré-marcado — ou a ordem mensal→anual é intencional?
4. **Os quatro benefícios do protótipo ("NO PLANO GRÁTIS VOCÊ TEM" + linhas com cheque) voltam** para dentro da gaveta, ou o corpo de uma linha ("O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar.") é a versão final?
5. **Quem já é Premium ou está com o Premium pausado deve ver esta gaveta?** Hoje o pausado vê a oferta idêntica à de quem nunca assinou, e o ativo vê um painel de altura inteira com uma frase.
6. **"Abrindo o Mercado Pago…" deve aparecer no CTA enquanto envia?** A frase existe na copy e nenhuma superfície a mostra.
