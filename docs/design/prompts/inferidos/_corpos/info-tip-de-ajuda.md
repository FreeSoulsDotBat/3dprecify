# Dica de ajuda ⓘ (InfoTip) — gatilho e cartão aberto

## O que desenhar
O ⓘ que explica **como a conta é feita**. É a peça mais repetida do produto: aparece ao lado do título de cada seção da Calculadora ("Custos da peça", "Detalhamento", "Marketplace", "Outros custos"), ao lado do rótulo de nove campos numéricos (gramas, consumo médio, tarifa, vida útil da máquina, manutenção, taxa de falha, tempo e valor de acabamento, horas e valor da mão de obra) e, desde 016/PR-F, como o **único lugar onde mora o corpo de um aviso da Shopee que foi colapsado para caber**. Quem usa é o vendedor leigo, no meio do preenchimento, quando não sabe o que o campo quer ou desconfia do número que saiu. É o coração da promessa de transparência: se o ⓘ não abre bem, o produto vira uma caixa-preta que cospe preço.

## Por que este prompt existe
O gatilho foi inferido inteiro pela IA: pílula de 28×28, glifo `info` cinza, fundo `--accent-soft` quando aberto, área de toque esticada por um pseudo-elemento assimétrico, abertura por hover com 80 ms de atraso e a regra do Escape que suprime o hover. O protótipo de 2026-07-02 (`CalculatorScreen.jsx:68-69`) desenhou **só metade**: um `circle-help` de 15px em `--text-faint` na linha do rótulo, à direita do texto, com o mesmo papel ("explicar como o campo entra na conta"). Ou seja: **posição e papel têm autoridade; o cartão ABERTO nunca foi desenhado por ninguém** — nem largura, nem hierarquia, nem o que acontece com um texto de 330 caracteres a 360px. O `Tooltip` do kit foi citado no readme mas nunca exportado. E as quatro abas desktop redesenhadas (`Abas-Desktop.dc.html`) têm **zero** ⓘ — o desenho do desktop simplesmente não considerou esta peça.

## O que já existe hoje (não invente do zero — corrija)

**Gatilho** (`shared/ui/info-tip.tsx` + `.css`)

| Propriedade | Valor real hoje |
|---|---|
| Caixa pintada | 28 × 28 px, `border-radius: var(--radius-pill)`, fundo transparente |
| Glifo | ícone `info` (círculo + haste + ponto), 16 px, `--text-muted` |
| Hover / aberto | cor `--accent-text`, fundo `--accent-soft` |
| Área clicável | esticada por um retângulo invisível `inset: -12px -8px -4px` → 8+28+8 = 44 de largura, 12+28+4 = 44 de altura |
| Posição | na mesma linha do título da seção (`gap: 4px`) ou como `labelAddon`, irmão do `<label>`, **nunca dentro dele** |

→ o gatilho **não tem estado de foco desenhado**: hoje ele herda o anel padrão e ninguém verificou como esse anel se comporta sobre um alvo de 28px cujo alvo real é 44 (o anel desenha na caixa pintada, não na área de toque — decida isso no desenho).
→ o retângulo de toque é **assimétrico** (−12 em cima, −4 embaixo) porque abaixo dele há só 8px até o campo. Isso não é enfeite: é uma regra de não-colisão que o desenho precisa respeitar, não "arredondar para 44 de todos os lados".

**Cartão aberto**

| Propriedade | Valor real hoje |
|---|---|
| Largura máxima | `min(20rem, 100vw − 2 × gutter)` — 320px no desktop, ~326px a 360px |
| Caixa | `--surface-card`, borda 1px `--border-subtle`, `--radius-lg`, `--shadow-md` |
| Espaçamento | `--space-3` em cima/baixo, `--space-4` nas laterais |
| Texto | `--fs-body-sm`, `--lh-normal`, `--text-body` — **um único bloco de corpo, sem título** |
| Seta | preenchida com `--surface-card` (não acompanha a borda) |
| Posição | lado preferido `top`, centralizado, 6px de folga, 12px de margem anticolisão; o Radix vira o cartão sozinho |

→ **o cartão não repete o assunto.** O `label` ("Sobre a tarifa de energia") existe só como nome acessível do botão — quem enxerga abre e lê um parágrafo solto, sem cabeçalho. Para um corpo de 3 frases com fórmula dentro, isso é um muro de texto. Decidir no desenho: título dentro do cartão, sim ou não.
→ a seta é `--surface-card` sem contorno: no tema claro, sobre um fundo claro, ela some do recorte da borda. Desenhe a seta com a borda incluída.

## Conteúdo e dados reais
Todo texto abaixo é **literal e homologado** — não reescreva, desenhe para ele.

- Rótulos dos gatilhos (nome acessível): `"Sobre os custos da peça"`, `"Sobre mão de obra e custos"`, `"Sobre outros custos"`, `"Sobre o markup"`, `"Sobre o cálculo do preço"`, `"Sobre o marketplace"`, `"Sobre as gramas usadas"`, `"Sobre o consumo médio"`, `"Sobre a tarifa de energia"`, `"Sobre a vida útil da máquina"`, `"Sobre a reserva de manutenção"`, `"Sobre a taxa de falha"`, `"Sobre o tempo de acabamento"`, `"Sobre o valor do acabamento"`, `"Sobre a mão de obra (horas)"`, `"Sobre o valor da hora"`, `"Sobre o frete aferido"`.
- **Corpo curto (piso, 92 caracteres)** — use para provar que o cartão não fica gordo com pouco texto:
  `"Cada linha em reais soma exatamente ao custo total; os preços vêm do custo total × markup."`
- **Corpo com FÓRMULA** — a hierarquia mais difícil, porque a fórmula precisa ser lida sem quebrar no meio:
  `"O custo de produção da peça. Material = (custo do rolo ÷ peso do rolo) × gramas usadas. Energia = tempo de impressão × consumo médio × tarifa. Máquina = (valor da máquina ÷ vida útil em horas) × tempo de impressão."`
  e `"Anúncio = (preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a taxa fixa."`
- **Corpo longo com dinheiro e exemplo (teto, 355 caracteres)** — desenhe o cartão COM ele:
  `"É quanto vale uma hora do seu trabalho. Sem esse número, você entrega horas de graça no preço. Descubra o seu assim: quanto quer ganhar por mês ÷ horas que pretende trabalhar no mês. Ex.: R$ 3.000 ÷ 160 h = R$ 18,75. Só para comparar, o salário mínimo dá R$ 7,37 a hora."`
  e `"…Sem a conta em mãos, a média do país fica perto de R$ 0,85."` (os dois valores em reais são **constantes datadas** injetadas no texto — no desenho eles são números de verdade, não `{placeholder}`).
- **Corpo do aviso Shopee** (o caso em que o ⓘ carrega o conteúdo inteiro de um alerta, não uma explicação de conta):
  linha visível `"Frete aferido pode gerar cobrança retroativa"` + ⓘ; dentro do cartão:
  `"Se o peso ou as dimensões cadastrados forem menores que os aferidos pela transportadora, a Shopee pode recobrar a diferença depois da entrega. Isso não entra no cálculo — é um risco a considerar ao cadastrar o anúncio."`
  Esse gatilho vive numa linha `tf-alert--compact` (ícone `info` de 20px + título + ⓘ), alinhada ao centro, `--space-2`/`--space-3` de padding — ou seja: **dois glifos de informação na mesma linha**, um decorativo de 20px e o clicável de 16px. → isso lê como ruído e é um problema a resolver no desenho.

## Estados obrigatórios
1. **Repouso** — glifo `--text-muted` sobre fundo transparente, sem caixa. Precisa parecer clicável no toque, onde não existe hover para dar a pista (é o impacto declarado na auditoria).
2. **Hover** (só ponteiro fino) — cor `--accent-text`, fundo `--accent-soft` na pílula.
3. **Foco por teclado** — anel de foco visível sobre uma pílula de 28px encostada no rótulo; mostre a folga que impede o anel de cortar o texto ao lado.
4. **Pressionado / aberto** — mesmo tratamento do hover, mantido enquanto o cartão estiver aberto (o gatilho é a âncora visual da seta).
5. **Cartão aberto — corpo curto** (1 frase) e **corpo longo** (355 caracteres, com `R$ 18,75` dentro).
6. **Cartão aberto acima e abaixo** — o lado padrão é acima; quando não cabe, o Radix vira para baixo e a seta troca de ponta. Desenhe os dois.
7. **Cartão colidindo com a borda** — a 360/390px o cartão para a 12px da borda e a seta desalinha do centro do gatilho. Desenhe esse desalinhamento, não a versão ideal centralizada.
8. **Fechado = ausente** — quando fechado, o cartão não existe na tela (nada de conteúdo escondido por opacidade).
9. **Variante alerta compacto (Shopee)** — a linha inteira em repouso e com o cartão aberto sobre ela.

Não existem estados de carregando, erro, offline, vazio, degradado nem premium pausado nesta peça: o conteúdo é texto estático embutido. Não invente nenhum deles.

## Viewports
- **390px (obrigatório)** — é onde a peça vive de verdade e onde o cartão bate na borda; mostre gatilho + cartão longo aberto no mesmo quadro, com a medida da margem sobrando.
- **360px (obrigatório)** — o piso medido do projeto e a largura em que a linha Shopee foi colapsada; é o caso que mais aperta.
- **1280px** — a Calculadora e o formulário de produto também rodam no desktop, onde o hover existe e o cartão de 320px é confortável. Mostre pelo menos o gatilho na linha do rótulo com o cartão aberto acima.
- Não precisa de 1920px: as quatro abas desktop do 018 não têm ⓘ hoje, e decidir se elas passam a ter é pergunta do dono (abaixo).

## Regras que o desenho não pode quebrar
- **O clique é o caminho universal; o hover é enfeite.** Todo conteúdo tem de ser alcançável por toque e por teclado — nenhuma explicação pode depender de passar o mouse.
- **Alvo ≥44px sem inflar o desenho.** A caixa pintada continua 28×28; o alvo cresce por fora e é assimétrico para não roubar o toque do campo que está 8px abaixo.
- **A frase honesta nunca cabe em placeholder nem em texto cortado.** O corpo do cartão é o lugar onde o produto explica a conta — se ele trunca, o produto mentiu por omissão. Sem `line-clamp`, sem "ver mais".
- **Nada de número inventado no desenho.** `R$ 0,85` e `R$ 7,37` são constantes datadas com revisão anual; use exatamente esses e nenhum outro valor de referência.
- **O cartão não é modal.** Não escurece a página, não prende o foco, não bloqueia o formulário atrás.
- **O gatilho nunca entra dentro do `<label>`.** Ele fica na linha do rótulo como elemento irmão — juntar os dois já quebrou o nome acessível do campo uma vez ("Vida útil da máquina Sobre a vida útil da máquina").
- **Contraste medido contra o fundo real** do cartão (`--surface-card`), nos dois temas, incluindo a seta.

## Armadilhas já pagas neste projeto
- **O ⓘ na linha do controle esmagou o campo** (016/PR-C, achado B4): disputando a linha com um sufixo de unidade largo (`/kWh`), a "Tarifa de energia" ficou com **1px** de input visível a 360/390px. Por isso ele mora na linha do RÓTULO. Não devolva o ⓘ para a linha do input.
- **Escape que se desfazia sozinho** (016/PR-C, R3): fechar com Escape sem mover o mouse reabria o cartão na hora. O desenho precisa deixar claro que o gatilho aberto é um estado do gatilho, e que fechar é fechar.
- **Texto que passa em teste e não aparece na tela**: `toBeVisible` passa em texto ocluso ou estourado. Meça caixas — largura do cartão, distância até a borda, altura da linha compacta.
- **Overflow horizontal medido nos dois eixos**: o headless não enxerga barra de rolagem clássica; se o cartão empurrar a página a 360px, ninguém vê no teste.
- **Alerta que ocupava 1248px de altura** a 360px foi o que criou a variante compacta — o ⓘ virou compressor de conteúdo. Desenhe essa variante sabendo que ela é uma solução de espaço, não uma explicação de conta.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro em paridade** (os dois com a seta e a sombra verificadas):
1. Gatilho em 4 estados lado a lado (repouso, hover, foco por teclado, aberto), com a área de toque de 44×44 desenhada como sobreposição cotada.
2. Cartão aberto com o corpo curto e com o corpo longo (`R$ 18,75`), a 390px, lado `top`.
3. Cartão virado para baixo e cartão colidindo com a borda a 360px, com a seta fora do centro.
4. Cartão com fórmula (`Anúncio = (preço + taxa fixa) ÷ (1 − comissão%)`) — mostrando como a fórmula não quebra no meio.
5. A linha `tf-alert--compact` da Shopee em repouso e aberta.
6. Desktop 1280px: a linha de rótulo do campo "Tarifa de energia" com sufixo `/kWh` no input e o ⓘ no rótulo, cartão aberto.

Reutilize os primitivos existentes: o **ícone `info` do conjunto da casa** (16px no gatilho, 20px no ícone decorativo do alerta), a **superfície de cartão** e a **sombra média** já definidas para popovers, o **raio pill** no gatilho e o **raio lg** no cartão, o **tom `--accent-soft`/`--accent-text`** para o estado aberto e o **corpo pequeno** para o texto. Não crie um novo componente de tooltip nem um novo tom de fundo.

## Perguntas em aberto para o dono
1. **O cartão ganha título?** Hoje o `label` ("Sobre a tarifa de energia") só é lido por leitor de tela; quem enxerga recebe um parágrafo sem cabeçalho. Repetir o label como título dentro do cartão é decisão de produto.
2. **A mesma peça serve para dois papéis?** Explicar a conta (ⓘ ao lado do título/rótulo) e esconder o corpo de um aviso comprido (Shopee) são coisas diferentes; se forem a mesma, a linha compacta fica com dois glifos de informação — se forem duas, precisamos de um segundo desenho.
3. **As quatro abas desktop do 018 passam a ter ⓘ?** Hoje têm zero. Catálogo, Kits, Orçamentos e Conta também mostram números derivados que ninguém explica.
4. **Na variante compacta, o ícone decorativo de 20px continua?** Ele duplica o glifo do gatilho na mesma linha.
