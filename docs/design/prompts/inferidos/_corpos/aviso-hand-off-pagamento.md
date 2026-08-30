# Aviso de hand-off de pagamento (a garantia que cerca o botão "Assinar Premium")

## O que desenhar
O bloco de texto de confiança que acompanha o botão de assinatura do Premium — hoje duas frases: "Você paga no Mercado Pago (Pix ou cartão)." e "O cartão nunca passa pelo nosso app." Ele vive dentro do painel de oferta (`OfferPanel`), que aparece em dois lugares: no **mobile**, numa folha (Sheet) intitulada "Assinar o Premium", aberta da aba **Conta**; no **desktop (≥1280px)**, como um cartão inline na própria página da Conta, logo abaixo da linha "Plano". Quem lê é o vendedor leigo, no segundo exato em que ele decide entregar dinheiro — depois de ler o preço, antes de tocar no botão que o joga para fora do app, para o checkout hospedado do Mercado Pago. É a única coisa no produto que explica para onde ele está indo e por que o app não vê o cartão dele.

## Por que este prompt existe
As duas frases foram inferidas por IA em **conteúdo, posição e forma**: viraram dois parágrafos idênticos e consecutivos, cinza, alinhados à esquerda, sem ícone, sem logo do Mercado Pago, sem selo — e renderizados **DEPOIS** do botão. Autoridade real: `PROTOTIPO_PARCIAL`. O protótipo de 2026-07-02 (`PremiumScreen.jsx`) desenhou o slot explicitamente e o desenhou **ACIMA** do CTA: uma linha só, centrada, `--fs-caption` / `--text-faint`, sem ícone e sem logo, dizendo "Pagamento via Mercado Pago. Cancele quando quiser." — e logo abaixo o botão. **O código faz o oposto do único desenho que existe** (duas linhas, à esquerda, depois do botão) e nenhuma autoridade ratificou a inversão. O canvas 018 do dono, que é a autoridade mais recente, encerra o bloco no botão e **não mostra aviso nenhum** — então o desenho tem que decidir isso, não herdar por acidente.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual do painel de oferta, de cima para baixo:

| # | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Lead | "A calculadora é grátis e continua grátis." |
| 2 | Corpo | "O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar." |
| 3 | Cartão de plano (selecionado) | "Plano anual" + selo "recomendado" + "R$ 155,88/ano" + "equivalente a R$ 12,99/mês" + "~19% de economia frente ao mensal" |
| 4 | Cartão de plano | "Plano mensal" + "R$ 15,99/mês" + "cobrança todo mês, cancele quando quiser" |
| 5 | Botão primário | "Assinar Premium" |
| 6 | Aviso, parágrafo 1 | "Você paga no Mercado Pago (Pix ou cartão)." |
| 7 | Aviso, parágrafo 2 | "O cartão nunca passa pelo nosso app." |

→ **Posição**: os itens 6 e 7 chegam depois do botão. Quem toca no botão sem rolar nunca leu a garantia. O protótipo punha a garantia antes; decida e desenhe a composição, não deixe o acaso decidir.
→ **Forma**: 6 e 7 são dois `<p>` com a MESMA classe, mesmo tamanho (13px), mesma cor (`--text-muted`), sem separador. Lidos em sequência parecem uma nota de rodapé duplicada, não uma unidade de garantia. Desenhe se são **uma unidade** (um bloco com duas linhas, ou uma linha só) ou **dois itens** distintos.
→ **Marca**: não há logo do Mercado Pago, nem ícone de cadeado, nem selo. A frase diz o nome do provedor em texto puro. O nome do provedor É o argumento de confiança do vendedor brasileiro — vale desenhar como ele aparece.
→ **Peso**: 13px em `--text-muted` é o menor e mais apagado bloco do painel. É também o único que responde "meu cartão está seguro?".
→ A frase "Cancele quando quiser" do protótipo **não existe** mais aqui — ela migrou para dentro do cartão mensal ("cobrança todo mês, cancele quando quiser"), o que é honesto e não precisa voltar ao aviso.

## Conteúdo e dados reais
- Frases do aviso, literais e já homologadas (não reescrever sem decisão do dono): **"Você paga no Mercado Pago (Pix ou cartão)."** e **"O cartão nunca passa pelo nosso app."**
- Rótulo do botão que o aviso acompanha: **"Assinar Premium"**.
- Preços reais, fonte única (`BILLING_PLANS`): **R$ 155,88/ano** (equivalente a **R$ 12,99/mês**, ~19% de economia) e **R$ 15,99/mês**. O espaço entre `R$` e o número é NBSP — nunca quebre a linha entre símbolo e valor.
- O valor R$ 191,88 (12 × 15,99) **nunca** aparece riscado: não existe "de/por" neste produto.
- O aviso é **estático**: não tem dado variável, não vem do servidor, não depende de plano selecionado. É constante nos dois planos.
- Meios de pagamento citados: **Pix ou cartão** — é o que o texto promete; o desenho não deve exibir bandeiras/ícones de meios que o texto não nomeia.

## Estados obrigatórios
- **Repouso** — as duas frases visíveis junto ao botão "Assinar Premium" habilitado.
- **Enviando (o próprio CTA em `loading`)** — o botão mostra spinner e a espera é "Abrindo o Mercado Pago…". O aviso continua legível e não se mexe: é exatamente agora que a frase "Você paga no Mercado Pago" vira explicação do que está acontecendo. Desenhe sem salto de layout.
- **Erro 409 (pagamento em andamento)** — abaixo do botão surge um alerta de tom perigo com "Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e tente de novo." Mostre onde o aviso fica quando o alerta ocupa esse espaço.
- **Erro / indisponível (503, offline, resposta inválida)** — alerta perigo com "O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado." Mesma pergunta de empilhamento: alerta e aviso não podem competir nem se confundir.
- **Já é Premium** — o painel inteiro colapsa para uma frase, "Você já é Premium.", **sem** planos, **sem** botão e **sem** o aviso. Desenhe esse estado curto para mostrar que a garantia some junto com a venda.
- **Deslogado** — o botão não abre checkout: leva para entrar primeiro. O aviso é o mesmo texto; verifique se ele ainda faz sentido antes de a compra começar.
- **Foco por teclado** — o anel de foco pertence ao botão e a nenhum elemento do aviso (o aviso é texto, não é alvo). Se o desenho transformar o nome "Mercado Pago" em algo clicável, isso é decisão nova → vá para "Perguntas em aberto".

## Viewports
- **Mobile 390px** — obrigatório: é o caminho principal, dentro da folha "Assinar o Premium" aberta da Conta. Mostre a folha inteira em duas alturas: com o aviso visível sem rolar e com ele empurrado abaixo da dobra pela altura dos dois cartões de plano (é o cenário que hoje esconde a garantia).
- **Desktop 1280px** — obrigatório: aqui a oferta é um cartão inline na página da Conta, com os dois planos lado a lado numa grade de 2 colunas e o botão alinhado à esquerda (não ocupa a largura toda). O aviso precisa de uma ancoragem definida em relação a um botão que não é full-width — sob o botão? à direita dele? antes dele? Desenhe a resposta.
- **1920px** — opcional, só se a decisão de ancoragem mudar quando a coluna da Conta fica mais larga.

## Regras que o desenho não pode quebrar
- **Nunca sugerir que o pagamento acontece dentro do app.** Nenhum campo de cartão desenhado, nenhum ícone de formulário de cartão, nenhuma bandeira que insinue captura local — a promessa do produto é que o cartão sai daqui.
- **Nada de selo de segurança fabricado.** Cadeado genérico, "site seguro", "SSL 256 bits", "compra 100% garantida" — se não houver certificação real por trás, é mentira visual. O único fato verdadeiro é: quem processa é o Mercado Pago.
- **Freemium binário e honesto**: "A calculadora é grátis e continua grátis." não pode ser reduzida a letra miúda para dar peso ao aviso.
- **Falha de rede nunca vira "não é premium"** — as duas mensagens de erro dizem explicitamente "nada foi cobrado"; esse alívio não pode sumir ou virar `caption` apagada.
- **A frase honesta não mora em placeholder** nem em `title`/tooltip: tem que estar em elemento de largura cheia, renderizada, legível.
- **Alvo ≥44px** para o botão e para qualquer link novo que o aviso introduza.
- **Contraste medido contra o fundo real** do cartão/folha nos dois temas — se a garantia for a peça mais apagada da tela, ela falha no único trabalho que tem.
- **Sem urgência, sem escassez, sem contagem regressiva** perto do botão de pagar.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido**: no mobile, a 390px, uma linha de preço já quebrou ENTRE "R$" e "12,99" — nenhuma asserção de texto ou geometria viu; só a imagem. Se o aviso ficar ao lado do preço ou do botão, meça a largura real.
- **Texto ocluso passa em teste**: `toBeVisible` aprova elemento totalmente coberto. Se algo (alerta, sombra da folha, barra fixa) puder cobrir o aviso, o desenho precisa reservar o espaço.
- **Legenda cortada por sufixo/placeholder**: já perdemos uma frase honesta por vivê-la num campo estreito. O aviso ocupa a largura do bloco, ponto.
- **Controle que estica**: nesta mesma tela o radio nativo virou uma barra de 292–350px por herdar `stretch`. Qualquer ícone novo no aviso precisa de tamanho declarado.
- **Deriva silenciosa de desenho**: este bloco já inverteu a posição do protótipo sem ninguém decidir. O que sair daqui vira a referência — nomeie a posição explicitamente na prancheta.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como par de primeira classe** de cada uma:
1. **Mobile 390px — folha de oferta completa**, com a composição proposta (aviso acima do CTA, se essa for a recomendação), planos empilhados, botão full-width.
2. **Mobile 390px — o mesmo bloco com o alerta de erro** ("O Mercado Pago não respondeu agora…") posicionado, mostrando quem cede espaço.
3. **Desktop 1280px — cartão inline na Conta**, planos em 2 colunas, botão alinhado à esquerda, aviso ancorado.
4. **Detalhe 1:1 do bloco de aviso**, em duas variantes para o dono escolher: (a) **uma unidade** — um bloco com as duas frases como um par visual coeso; (b) **linha única condensada** — as duas frases fundidas numa sentença, marcando qual palavra ganha ênfase. Em ambas, mostre a versão com e sem marca do Mercado Pago.
5. **Estado "Você já é Premium."** — para provar que a garantia desaparece com a venda.

Reutilize os primitivos existentes, sem criar novos: `tf-btn--primary tf-btn--lg` para "Assinar Premium"; `tf-billing-offer__plan` (+ `--selected`) para os cartões de plano; `tf-badge` para "recomendado"; o `Alert` de tom perigo para 409/503; e para o aviso use o padrão de legenda do sistema (`--fs-caption` / `--text-faint` do protótipo, ou `--text-muted` do código) — indique qual dos dois você escolheu e por quê, em vez de inventar um estilo de texto novo.

## Perguntas em aberto para o dono
1. **A garantia vem antes ou depois do botão?** O protótipo diz antes (e é o que protege quem não rola); o código diz depois; o canvas 018 não mostra nada. Qual vale?
2. **O logo do Mercado Pago aparece?** Usar a marca do provedor aumenta a confiança do vendedor brasileiro, mas traz regras de uso de marca de terceiro — decisão de produto/jurídico, não de desenho.
3. **Uma frase ou duas?** "Você paga no Mercado Pago (Pix ou cartão)." + "O cartão nunca passa pelo nosso app." podem virar uma linha só. Fundir muda copy já homologada — precisa da sua palavra.
4. **"Pix ou cartão" continua verdade nos dois planos?** Se o plano anual (assinatura recorrente) não aceitar Pix no checkout do Mercado Pago, a frase mente para metade dos compradores e o desenho precisa de duas variantes por plano.
