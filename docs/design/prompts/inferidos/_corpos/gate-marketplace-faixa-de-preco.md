# Bloco "Marketplace" trancado na calculadora (gratuito)

## O que desenhar
A seção **Marketplace** como ela aparece para quem **não é Premium**, dentro da tela Calcular — a tela principal do produto, onde o vendedor digita os custos da peça e lê o preço sugerido. Para quem assina, essa seção é onde ele escolhe canal (Shopee, Mercado Livre Clássico/Premium, Amazon), informa comissão e taxa fixa, e vê o preço de anúncio e o líquido de cada canal. Para quem não assina, a seção continua no mesmo lugar, com o mesmo título, mas **trancada**: o interruptor aparece desligado e morto, uma frase explica por quê, e logo abaixo entra uma faixa de preço com o botão "Assinar Premium". É o único ponto de compra enxertado **dentro de um formulário de cálculo** — e é isso que precisa de desenho.

## Por que este prompt existe
Ninguém desenhou este bloco. A composição atual (título normal + interruptor visível-porém-morto + frase + faixa de compra centrada) foi montada em código, e o alinhamento central só nasceu depois de **medir ~950px de distância** entre a frase que motiva a compra e o botão que a executa, na faixa full-width do desktop. Pior: o protótipo de 2026-07-02 desenha Marketplace como uma seção colável **normal e grátis** (§E4) e o §I proíbe explicitamente "paywall no cálculo (computar é sempre grátis)" — a rodada 1, item 5, chegou a corrigir os presets de taxa **para o usuário livre**. O código de hoje **contraria essa regra de desenho com todas as letras**: o marketplace virou Premium só no incremento 016 (PR-E, 2026-08-06), mais de um mês depois, por decisão de produto registrada em Clarifications datadas. O desenho nunca foi refeito para essa realidade nova. É o que este prompt pede.

## O que já existe hoje (não invente do zero — corrija)
Ordem literal do bloco, de cima para baixo (`calculator-form.tsx`, `data-testid="marketplace-premium-gate"`):

| # | Elemento | Conteúdo literal hoje |
|---|---|---|
| 1 | Título de seção + gatilho ⓘ | "Marketplace" · tooltip "Sobre o marketplace": *"Calcula o preço para anunciar em um marketplace de modo que, após a comissão e a taxa fixa, você receba o preço-base. Anúncio = (preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a taxa fixa."* |
| 2 | Linha de interruptor (rótulo à esquerda, switch à direita, largura total) | "Incluir marketplaces no preço" · switch **desligado e desabilitado**, sempre — nunca o valor do formulário |
| 3 | Legenda | "Vender em marketplaces faz parte do Premium." |
| 4 | Faixa de preço + CTA (centrada, separada por um filete no topo) | "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" + botão primário **"Assinar Premium"** |

→ **Problema 1:** o interruptor desligado e morto, com o rótulo normal ao lado, lê como *quebrado* antes de ler como *trancado*. A legenda é o único sinal de que aquilo é uma tranca. O desenho decide se o interruptor permanece (e com que afordância de cadeado/estado) ou se dá lugar a outra coisa — mas não pode fingir que ele funciona.
→ **Problema 2:** o gratuito não vê **nada** do que a seção faria. Nenhuma pista do valor: nem canais, nem a ideia de "anúncio × líquido". O tooltip ⓘ com a fórmula é a única informação, escondida atrás de um ícone.
→ **Problema 3:** a faixa de compra é visualmente idêntica à faixa dos outros teasers do app, mas aqui ela está **no meio de um formulário**, entre "Markup"/"Outros custos" e o rodapé "Como chegamos no preço". Ela interrompe a leitura do cálculo.
→ **Problema 4:** a mesma tela pode mostrar **um segundo "Assinar Premium"** — o teaser do seletor de catálogo, num Card à parte. Dois CTAs de compra na mesma rolagem já foi defeito corrigido duas vezes neste projeto.

**Onde o bloco vive.** No desktop (≥1024px) a tela é uma grade de 2 colunas; o bloco trancado é uma linha **que atravessa as duas colunas**, logo abaixo delas — porque, aninhado numa coluna, ele deixava **1.671px de buraco vazio** ao lado (medido a 1440px). No mobile é uma coluna só, e o bloco cai depois de "Markup" e "Outros custos". Depois dele vem sempre o rodapé: "Como chegamos no preço" + os cartões de preço sugerido.

## Conteúdo e dados reais
- Preços do plano (fonte única, não reescrever): mensal **R$ 15,99/mês**; anual **R$ 155,88/ano**, apresentado pelo **equivalente mensal R$ 12,99/mês**. Nunca existe "de/por" nem valor riscado — o desconto real é "~19% de economia frente ao mensal".
- O botão leva à **oferta** (mensal vs anual) dentro da tela Conta, não a um checkout direto. Deslogado, o caminho passa pelo login preservando a intenção.
- O que o assinante veria no lugar (para o desenho saber o que está sendo trancado): por canal, "Marketplace", "Modalidade", "Comissão" (%), "Taxa fixa" (R$), "Comissão mínima/item", "Frete" (R$, descontado do recebido), e o par **anúncio / recebido líquido** para varejo e atacado. Números reais do catálogo: ML Clássico **6,75 + 14%**, ML Premium **6,75 + 19%**, Amazon INDIVIDUAL **R$ 2,00**. Preço-base típico da tela: **R$ 16,16** (varejo) e **R$ 24,24** (atacado).
- O gratuito **não recebe nenhum número de canal** — nem parcial, nem de exemplo, nem borrado. A lista "Preços por canal" chega vazia por construção.

## Estados obrigatórios
1. **Repouso (não assinante, logado)** — o bloco como descrito: título, interruptor travado, "Vender em marketplaces faz parte do Premium.", faixa + "Assinar Premium".
2. **Deslogado** — visualmente igual; muda só o destino do botão (passa pelo login). Se o desenho quiser diferenciar o convite para quem nem tem conta, diga como.
3. **Foco de teclado** no botão "Assinar Premium" e no gatilho ⓘ — anel visível contra o fundo real do bloco.
4. **Hover / pressionado** do botão primário.
5. **Interruptor desabilitado** — o estado central da peça: precisa ler como "trancado", nunca como "com defeito". Rótulo "Incluir marketplaces no preço" continua legível (contraste medido, não apagado a ponto de sumir).
6. **Premium pausado (`lapsed`)** — hoje esta pessoa vê **exatamente o mesmo bloco**, com "faz parte do Premium" e "Assinar Premium", como se nunca tivesse assinado. Desenhe a variante honesta desse caso (ver Perguntas).
7. **Direito ainda sendo verificado / falha ao verificar** — o código degrada para "não tem direito" e mostra o bloco trancado. Ou seja: **uma falha de rede pode mostrar uma oferta de compra a quem já é Premium.** Desenhe o que aparece enquanto verifica (e se existe um estado de espera antes de mostrar a oferta).
8. **Assinante (comparação)** — uma prancheta com a seção destrancada e um canal preenchido, só para o contraste ficar visível lado a lado.

## Viewports
- **390px (mobile)** — obrigatório: é a jornada principal. A faixa preço + botão **quebra em duas linhas** aqui; a quebra tem que acontecer entre a legenda e o botão, **nunca entre "R$" e o valor** (defeito já pago: a linha terminava em "equivalente a R$" e a seguinte começava em "12,99/mês").
- **1280px e 1920px (desktop)** — obrigatórios: é onde o bloco atravessa as duas colunas e onde a frase e o CTA já ficaram a ~950px um do outro. Mostre a linha inteira em escala, com a grade de 2 colunas acima e o rodapé abaixo, para provar que a proximidade se sustenta em faixa larga.

## Regras que o desenho não pode quebrar
- **Freemium binário**: ou a pessoa tem o recurso inteiro, ou não tem. Nada de "prévia" com número reduzido, borrado ou de mentira. Um número inventado sob a marca do produto é pior que nenhum número.
- **A tranca é dita, não insinuada**: o motivo aparece em texto de largura total — nunca dentro de um placeholder de campo, que corta a frase.
- **Falha de rede nunca é vendida como falta de plano** e vice-versa: se o app não sabe se a pessoa é Premium, ele não pode afirmar que ela não é.
- **A procedência do número**: a linha de preço do plano mostra os valores reais do plano, sem desconto fabricado.
- **Alvo de toque ≥44px** no botão "Assinar Premium" e no gatilho ⓘ.
- **Um único CTA de compra visível por vez** na tela Calcular.
- **Zero transbordo horizontal** a 390px — a tela toda, não só o bloco.
- Contraste medido contra o fundo real do bloco (que fica dentro do fundo da página, não sobre branco).

## Armadilhas já pagas neste projeto
- **CTA órfão**: 149,6px na primeira vez, ~950px nesta faixa. Preço e botão têm que ler como **uma unidade**, e é por isso que hoje está centrado — o desenho pode resolver melhor, mas não pode reintroduzir a distância.
- **Botão nascendo fora da viewport**: 100,5px de transbordo com o botão fora da tela, achado só na imagem.
- **Quebra de linha dentro do preço** (R$ separado do valor): invisível para qualquer asserção de texto ou geometria — só a imagem vê.
- **Buraco de coluna**: 1.671px vazios quando o bloco foi aninhado numa coluna do desktop.
- **Dois "Assinar" na mesma tela** (um por trás de um overlay), já corrigido duas vezes.
- **Texto ocluso passa em teste**: oclusão não é propriedade do texto — o desenho é conferido na imagem, em 1:1.

## Entregável
Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class, não um afterthought)**:
1. Bloco trancado a **390px** — repouso.
2. Bloco trancado a **1280px** e a **1920px**, em contexto (grade de 2 colunas acima, rodapé abaixo), para provar a proximidade preço↔CTA na faixa larga.
3. Painel de estados: interruptor travado (repouso/foco/hover), botão (repouso/hover/pressionado/foco), verificando direito, **Premium pausado**.
4. Prancheta de contraste: a mesma seção **destrancada** com um canal preenchido (ML Clássico 6,75 + 14%, anúncio e líquido) ao lado da trancada.

Reutilize os primitivos existentes, sem criar novos: o **Card** para o corpo da seção, o **título de seção com gatilho ⓘ** já usado por "Custos da peça"/"Markup"/"Como chegamos no preço", o **Switch** no estado desabilitado, o **botão primário `tf-btn--primary`** para "Assinar Premium", a **legenda em texto secundário** para a frase da tranca, e o **Alert de tom `info`** caso algum estado (verificando/pausado) precise de um aviso — nunca tom de erro: não há erro nenhum em não ser assinante.

## Perguntas em aberto para o dono
1. **Premium pausado (`lapsed`)**: quem já assinou e teve o pagamento interrompido deve ver "Assinar Premium" (como hoje) ou uma variante de **reativação**, que reconheça que ele já foi cliente? Muda copy e provavelmente o desenho do bloco.
2. **Interruptor morto**: ele permanece visível como afordância travada (mostrando o que existiria), ou dá lugar a outra representação da tranca? É decisão de produto porque define se o gratuito "vê o controle que não pode usar".
3. **Prévia do valor**: o gratuito pode ver a *estrutura* do que compraria — a lista de canais suportados, ou um exemplo explicitamente rotulado como ilustrativo — ou a regra "nenhum número de canal, nem de exemplo" vale sem exceção?
4. **Enquanto o app verifica o direito**: aceitável mostrar a oferta de imediato (comportamento de hoje, que pode oferecer compra a quem já paga), ou o bloco deve exibir um estado neutro de espera antes de assumir "não assinante"?
5. **§I do protótipo** ("computar é sempre grátis") fica formalmente revogado por este desenho, ou o dono quer que alguma parte do cálculo com canal continue livre (por exemplo, um único canal)?
