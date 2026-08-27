# A legenda do subsídio de frete da Shopee, sob a grade de taxas

## O que desenhar
Uma legenda informativa que aparece dentro do cartão de um canal Shopee na aba **Calcular**, logo abaixo da grade de taxas (Comissão · Taxa fixa · Comissão mínima/item · Frete) e antes das sobretaxas opcionais e dos selos de procedência. Ela diz ao vendedor que a Shopee dá cupons de frete grátis até um teto **que depende da faixa de preço do anúncio que está na tela**, que esse custo é da Shopee e não dele, e que o campo "Frete" logo acima serve só para o que sobrar para ele. Quem lê é um vendedor leigo, no momento em que está conferindo por que o preço sugerido daquele canal ficou no valor que ficou.

## Por que este prompt existe
Nenhum protótipo do projeto modela frete em canal nenhum — as quatro autoridades de desenho só conhecem "taxa fixa + comissão", e o canvas 018 não cobre a aba Calcular. Esta peça nasceu inteira em código, no hotfix 016/A2 (2026-08-07), corrigindo um erro de R$ 20 a R$ 40 **por venda** que ficou meses no produto: o modelo antigo cobrava o cupom do vendedor num campo que exibia R$ 0,00. Foram decididos sem desenho: que a verdade nova seria uma **legenda** e não um valor de campo; sua vizinhança (embaixo da legenda de faixa, acima das sobretaxas); e — o ponto que continua em aberto — **como impedir que o vendedor leia o teto do cupom como um desconto que ele deveria digitar**. Autoridade de desenho: NENHUMA.

## O que já existe hoje (não invente do zero — corrija)
Um único `<p>` de largura total, tipografia `--fs-caption` em `--text-muted`, sem ícone, sem fundo, sem borda, sem separador — visualmente idêntico à legenda de faixa que fica imediatamente acima dele. Duas frases concatenadas com um espaço:

1. `"A Shopee oferece cupons de frete grátis (até R$ 20,00 nesta faixa de preço) — o custo é da Shopee, não seu. Informe no campo Frete só o que sobrar para você, se houver."`
2. `"Fonte: Central de Educação do Vendedor Shopee — Programa de Frete Grátis (subsídio oferecido pela Shopee a todos os vendedores), vigente desde 01/03/2026."`

Ordem real dentro do cartão do canal: seletor de Marketplace + botão ✕ → (modalidade/categoria quando houver) → "Você vende como" e "Mais de 450 pedidos nos últimos 90 dias?" (só Shopee) → grade de taxas em **duas colunas** → legenda de faixa `"Tabela por faixa de preço — valores da faixa do seu anúncio."` (+ a frase da regra de taxa fixa quando existir) → **esta legenda** → sobretaxa opcional (caixa de seleção) → selos de procedência → avisos Shopee.

→ Problemas a resolver no desenho: **(a)** a frase diz "no campo Frete", mas o campo Frete é a **quarta célula** da grade de duas colunas (coluna direita, segunda linha) — a legenda aponta para cima e para a esquerda, sem nenhuma âncora visual; **(b)** duas legendas de mesmo peso empilhadas — a de faixa e esta — e a segunda carrega dinheiro, não contexto; **(c)** a frase de fonte tem 106 caracteres de nome de fonte e engole a frase que importa; **(d)** existe um `sourceUrl` publicado (`seller.shopee.com.br/edu/article/23431`) que a tela **nunca** usa; **(e)** o número "até R$ 20,00" é o único valor em dinheiro da legenda e não tem nenhuma marca que o separe dos valores que o vendedor pode editar.

## Conteúdo e dados reais
| Dado | Origem | Valor real hoje |
| --- | --- | --- |
| Teto do cupom (`ceiling`) | catálogo, faixa resolvida pelo preço do anúncio varejo | anúncio < R$ 80,00 → **R$ 20,00** · R$ 80,00 a R$ 200,00 → **R$ 30,00** · ≥ R$ 200,00 → **R$ 40,00** |
| Preço que resolve a faixa | resultado do canal (preço de anúncio varejo) | ex.: R$ 24,24 → faixa R$ 20,00 |
| Fonte (`source`) | catálogo | "Central de Educação do Vendedor Shopee — Programa de Frete Grátis (subsídio oferecido pela Shopee a todos os vendedores)" |
| Vigência (`effectiveDate`) | catálogo | 01/03/2026 |
| Última revisão (`lastReviewed`) | catálogo | 07/08/2026 — **existe no dado e não é mostrado** |
| Link da fonte (`sourceUrl`) | catálogo | existe e **não é mostrado** |

O teto **não entra em conta nenhuma** — mexer nele no catálogo não move um centavo do resultado (há teste de propriedade garantindo isso). O único desconto possível continua sendo o que o vendedor digita no campo "Frete" (moeda, opcional, vazio por padrão, mostra `R$ 1.234,56` com máscara de milhar no blur). Nenhum número desta legenda pode ser desenhado como fixo: os três tetos vêm do dado e mudam sem tocar em código.

## Estados obrigatórios
- **Repouso, com teto resolvido** — três variantes a desenhar: R$ 20,00, R$ 30,00 e R$ 40,00 (o desenho tem que sobreviver ao teto que muda quando o preço muda de faixa).
- **Empilhada com a legenda de faixa** — "Tabela por faixa de preço — valores da faixa do seu anúncio." imediatamente acima, e, quando a faixa tem regra, também "Nesta faixa, a taxa fixa é 50% do preço do anúncio — o placeholder mostra o valor já calculado." Três blocos de texto miúdo seguidos: mostre como se distinguem.
- **Ausente (e é isto que o desenho precisa julgar)** — a legenda não renderiza quando o canal não é Shopee, quando o catálogo não publica o subsídio, **ou quando ainda não há preço calculado no canal**. Ou seja: existe um momento em que o campo "Frete" está editável e a verdade sobre o cupom não está na tela.
- **Com o campo "Frete" preenchido** — o vendedor digitou, por exemplo, R$ 5,00; o resultado passa a mostrar a linha "Frete" e a legenda "Descontado do valor recebido (não é embutido no anúncio)." Desenhe a coexistência: um valor que desconta e um teto que não.
- **Degradado / offline** — o catálogo veio do cache do dispositivo ou da referência embutida; ao lado, os selos de procedência dizem isso. A legenda continua verdadeira, mas o desenho precisa deixar claro que a data mostrada é de vigência, não de sincronização.
- **Falha ao atualizar taxas** — o alerta "Não foi possível atualizar as taxas" / "Usando a referência salva no dispositivo — o cálculo continua funcionando." aparece acima, com "Tentar novamente". A legenda permanece.
- **Sem permissão (Premium pausado ou plano gratuito)** — a seção de marketplaces inteira fica indisponível com "Vender em marketplaces faz parte do Premium.": a legenda **não** aparece. Desenhe o que o vendedor vê nesse lugar.
- **Vizinhança de avisos** — logo abaixo vem sempre o aviso compacto em tom informativo "Frete aferido pode gerar cobrança retroativa" com o gatilho "Sobre o frete aferido"; e, para CPF de alto volume sem preço, "A Shopee não publica a fórmula completa desta taxa". A legenda não pode competir nem se confundir com eles.
- **Foco / hover / pressionado** — só se o desenho propuser um alvo interativo (link para a fonte ou gatilho de dica). Nesse caso, alvo ≥ 44px e foco visível contra o fundo real do cartão.

## Viewports
Desenhar **390px** (é onde o vendedor usa a calculadora, e onde a grade de duas colunas deixa cada célula com ~150px — a frase "no campo Frete" tem que achar seu alvo numa tela estreita) e **1280px** (a calculadora existe no desktop; com o cartão largo, uma legenda de duas linhas em texto miúdo vira uma faixa cinza fácil de pular). 1920px só se a solução mudar de forma nessa largura.

## Regras que o desenho não pode quebrar
- **O teto não é desconto.** Nada no desenho pode sugerir que o número seja digitável, subtraível ou que já esteja aplicado. Se ele ganhar destaque visual, precisa ganhar junto a marca de que é informação de terceiro.
- **Procedência sempre junto do número** — fonte e data acompanham o teto; um teto sem fonte não pode ser desenhado.
- **Frase honesta nunca em placeholder nem cortada.** Esta lição já foi paga: um sufixo de placeholder cortou "2,50 (= 50" e produziu exatamente a leitura errada que a frase existia para impedir. Texto de honestidade vive em elemento de largura total, quebrando linha à vontade.
- **Falha de rede nunca vendida como falta de premium**, e degradação dita, não escondida.
- **Freemium binário**: sem entitlement ativo não existe meia-legenda — ou a seção é premium e verdadeira, ou é teaser honesto.
- **Zero número no desenho como constante**: 20/30/40 são exemplos de dado, não rótulos.
- Contraste medido contra o fundo real do cartão do canal (não contra o fundo da página), em tema escuro e claro.

## Armadilhas já pagas neste projeto
- Texto que passa em teste e é ilegível na tela: `toBeVisible` passa em elemento ocluso ou estourado — o que reprova esta peça é o olho, não a asserção.
- Overflow horizontal medido nos **dois** eixos: uma legenda de linha única com nome de fonte de 106 caracteres é candidata natural a estouro em 390px.
- Valor grande estourando a coluna: se um teto futuro vier como R$ 1.234,56, a linha tem que quebrar, não empurrar.
- Legenda de menor peso visual ao lado de um preço já descontado foi, literalmente, o defeito anterior desta mesma tela: a explicação era o elemento mais fraco do painel.

## Entregável
Pranchetas em **tema escuro (padrão) e claro (first-class)**: (1) o cartão do canal Shopee completo em 390px, com preço na faixa de R$ 20,00, mostrando a pilha legenda-de-faixa → legenda-do-subsídio → sobretaxa → selos → aviso de frete aferido; (2) a mesma peça em 1280px; (3) as três faixas (R$ 20,00 / R$ 30,00 / R$ 40,00) lado a lado; (4) o estado com "Frete" preenchido em R$ 5,00 e a linha de desconto no resultado; (5) o estado sem preço calculado — sua proposta para o vazio; (6) degradado/offline com os selos de procedência. Reutilize os primitivos existentes: o cartão do canal é o `tf-card`; a legenda deve continuar usando o tamanho de legenda e a cor de texto discreto do sistema; se propuser destaque, use o alerta informativo compacto (mesma família do aviso "Frete aferido pode gerar cobrança retroativa") e o gatilho de dica já existente, em vez de criar um componente novo; selos de procedência reaproveitam o selo de honestidade do slot. Marque explicitamente qual primitivo cada parte usa e o que muda em relação ao que existe hoje.

## Perguntas em aberto para o dono
1. O teto (R$ 20,00) deve ganhar peso visual — número destacado, ícone, faixa informativa — ou continuar em texto miúdo? Destacar melhora a leitura e **aumenta** o risco de o vendedor tratá-lo como desconto; essa troca é decisão de produto.
2. A fonte deve virar link para o artigo publicado (`sourceUrl` existe e hoje é ignorado), colapsar dentro de um gatilho de dica como o aviso de frete aferido, ou continuar por extenso na legenda?
3. Quando ainda **não há preço calculado** no canal, deve aparecer uma versão sem teto ("a Shopee subsidia o frete; o teto depende da faixa do seu preço") ou a legenda continua ausente, deixando o campo "Frete" sem contexto?
4. Quando o vendedor digita um valor no campo "Frete", a legenda deve mudar de texto ou ganhar uma confirmação ("este valor é seu; o cupom não") — ou permanece idêntica?
5. Mostrar a data de última revisão do dado (07/08/2026) além da vigência (01/03/2026), ou só a vigência?
