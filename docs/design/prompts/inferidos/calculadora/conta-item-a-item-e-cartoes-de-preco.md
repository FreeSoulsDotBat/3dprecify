<!-- contextos-embutidos -->

> Cole este arquivo inteiro no Claude Design. Ele traz, nesta ordem: **(1)** o que a plataforma é e
> faz, **(2)** onde exatamente esta peça vive dentro dela, **(3)** as regras de marca e Design System
> que o desenho deve obedecer, e **(4)** o pedido de desenho propriamente dito.

---

# Contexto 1 — A plataforma

## O que é o Precifica3D

Uma **calculadora de precificação** para quem vende impressão 3D no Brasil, da marca **Truth's Forge**.
O vendedor informa seus custos e recebe um **preço sugerido com a conta aberta** — cada centavo rastreável
até a linha que o gerou. O nome da marca significa *verdade forjada em forma*: transparência não é um
adjetivo aqui, é o produto.

**Quem usa:** vendedor/maker prático, quase sempre MEI solo, frequentemente **leigo em precificação** —
sabe imprimir, não sabe formar preço. Ele erra por baixo (esquece energia, depreciação, taxa de falha,
comissão de marketplace) e descobre o prejuízo depois da venda. A interface existe para impedir isso.

**Plataforma:** PWA web instalável, **mobile-first** (390px é a largura de projeto), responsiva até
desktop com corte em **1280px**. Android via Play depois. Toda a interface é **pt-BR**.

## O que a plataforma faz — as cinco abas

| Aba | Rota | O que o vendedor faz ali |
|---|---|---|
| **Calcular** | `/calcular` | A tela central. Informa custos e markup, vê o preço sugerido recalculado ao vivo com o detalhamento item a item, e compara o preço em cada marketplace. **Grátis e ilimitado.** |
| **Catálogo** | `/catalogo` | Guarda filamentos, impressoras, produtos e kits salvos. Um item salvo **preenche a calculadora sozinho** e continua editável. **Premium.** |
| **Kits** | `/kits` | Monta um anúncio de várias peças (BOM multi-peça): cada peça tem seu próprio cálculo, e o kit soma. Ao salvar, as peças podem **virar produtos no catálogo**. **Premium.** |
| **Orçamentos** | `/historico` | Registros **congelados**: o preço de um dia, imutável, com a fórmula e as tarifas daquele momento. Consulta, compara com hoje, recalcula, exporta PDF/CSV. **Premium.** |
| **Conta** | `/conta` | Identidade, plano, assinatura, tema, privacidade, sair. |

## O que entra no preço

O motor de cálculo (`pricing-core`, roda **no dispositivo**, offline) soma:

- **Material** — custo do rolo ÷ peso do rolo × gramas usadas.
- **Energia** — consumo médio (kW) × tempo de impressão × tarifa (R$/kWh).
- **Máquina** — depreciação por hora, derivada de "quanto custou a máquina" + ritmo de uso + payback,
  ou informada direto pelo vendedor.
- **Falha** — uma taxa percentual que cobre a impressão que não deu certo.
- **Mão de obra e acabamento**, e **outros custos** nomeados (embalagem, etiqueta, frete, o que ele quiser).
- **Markup** varejo e atacado, aplicados **sobre o custo total**, não sobre o preço de venda.
- **Marketplace** — comissão, taxa fixa, frete e sobretaxas de cada canal, para chegar ao **preço de
  anúncio** e ao **líquido que sobra**.

## Os canais de marketplace

Mercado Livre, Shopee, Amazon e "Outro". As tarifas vêm de um **catálogo servido pelo servidor, cacheado
localmente e embarcado como semente** — versionado por data (`catalogVersion`). Cada canal tem sua própria
gramática: faixas progressivas de comissão, taxa fixa que às vezes é percentual do preço, comissão por
**categoria** do anúncio, perfil do vendedor (CPF/CNPJ, alto volume), sobretaxas opcionais, e subsídios de
frete que são **do marketplace, não do vendedor**. Quando uma tarifa não é publicada pelo canal, o produto
**diz que não sabe** em vez de chutar.

## A fronteira do Premium — binária, sem cota

**Calcular e ver o detalhamento é sempre grátis e ilimitado.** Qualquer **persistência ou escala** é
Premium: catálogo, kits, orçamentos salvos, exportação, simulações de marketplace.

R$ 15,99/mês, ou R$ 155,88/ano (equivalente a R$ 12,99/mês). Pagamento pelo **Mercado Pago** (Pix ou
cartão) — o cartão nunca passa pelo app. Cancelar vale até o fim do período pago.

O upsell aparece **só na fronteira da persistência**, nunca em cima do cálculo, e nunca com padrão escuro.

## Os estados que o produto vive de verdade

Não são exceções raras — são o dia a dia de quem vende do celular, no galpão, com sinal ruim:

- **Offline.** O cálculo continua funcionando inteiro (o motor é local). Leitura vem do cache local, com
  aviso de que pode estar desatualizada. Escrita vai para uma **fila (outbox)** que drena quando a conexão
  volta — o vendedor vê quantos registros estão esperando.
- **Premium pausado.** A assinatura caducou: os dados **continuam lá e legíveis**, mas escrever está
  congelado. Nada é apagado, e a interface diz isso com calma.
- **Sessão expirada.** O login venceu. A fila **não é descartada** — fica esperando o vendedor entrar de
  novo, com um caminho visível de volta.
- **Carência / cobrança recusada.** O Premium continua **ativo** enquanto o prazo de recuperação corre.
- **Degradação.** Um item do catálogo que alimentava um produto foi apagado: o produto mostra a **última
  informação conhecida**, rotulada como tal, em vez de sumir ou zerar.
- **Plano não confirmado.** O servidor não respondeu sobre o plano — o produto diz "não sei", nunca
  presume nem "grátis" nem "Premium".

## O que este produto nunca faz

Não esconde de onde veio um número. Não mistura "o preço de então" com "o preço de hoje" sem rótulo.
Não mostra `R$ 0,00` quando o que ele quer dizer é "não sei". Não vende falha de rede como recurso pago.
Não cobra por um valor que a tela não mostrou.

---

# Contexto 2 — Onde esta peça vive

## O mapa funcional de Calculadora e precificação

### A área "Calcular" (aba 1, rota `/calcular`)

**Como o vendedor chega.** `/calcular` é a porta do produto: a raiz `/` redireciona para cá e a aba é a
primeira do menu (`Calcular · Catálogo · Kits · Orçamentos · Conta` — no código: `/calcular`, `/catalogo`,
`/kits`, `/historico`, `/conta`). É a **única rota pública sem nenhum portão**: renderiza para anônimo,
grátis, Premium, online e offline. O menu é barra inferior até 425px e barra lateral acima disso (rail de
76px abaixo de 600px e a partir de 1280px por escolha do vendedor).

**O que ele vem fazer.** Digitar os custos de uma peça impressa e ler dois preços sugeridos (varejo e
atacado), com a conta aberta item a item. É a única tela do app que calcula preço a partir de campos
crus — e ela é **grátis e ilimitada**.

**Rotas da área.** Uma só: `/calcular`. Não há sub-rota; tudo o mais é folha/diálogo por cima
(a folha "Meus cenários", a folha de salvar cenário, a folha de gravar no histórico). O mesmo formulário
é *reusado* fora da área — a página de produto (`/catalogo?produto=…`) e o editor de linha de kit
(`/kits`) montam `CostsSection`, `FieldGroup`, `OtherCostsSection`, `MarketplaceSection`, `PriceResults`,
`TimeHmField` e `MachineCostFields` exatamente iguais.

**Layout.** Coluna única até 1023px, na ordem em que está escrito. A partir de `min-width:1024px` a
página sobe de 460px para 1120px e vira **duas colunas** (`.tf-calc-grid`) com um **rodapé de largura
total** (`.tf-calc-footer`, filhos capados em 720px e centrados) que carrega o resultado inteiro.

**O que a área guarda.** Nada por si só. O formulário vive em memória (React Hook Form); recarregar
perde tudo — e por isso existe um diálogo de aviso de saída quando há algo digitado. Persistir é sempre
uma ação Premium **para fora** da área: "Salvar cenário" (simulação) e "Salvar no histórico" (orçamento
congelado). O que a área lê de fora: o **catálogo de tarifas** (servido → cache local → semente
embutida, nunca bloqueia), o **entitlement** do servidor (`active` / `none` / `lapsed`), e as listas de
**filamentos e impressoras** do catálogo Premium (cache local por uid, respondem offline).

**Quem calcula.** `pricing-core`, no aparelho, sempre. O servidor nunca recalcula. Offline os preços
saem iguais; o que falha é só a atualização de tarifas e a escrita.

**O que a área alimenta depois.** Um cálculo válido vira (a) uma **simulação salva** — reabri-la traz a
Calcular preenchida de volta, com barra de contexto e selo de alterações não salvas; (b) um **orçamento
congelado** no Histórico (escrita offline vai para a fila/outbox e drena depois). No sentido inverso, o
Catálogo alimenta a Calcular pelo bloco "Usar do catálogo", e um kit reaberto como base traz um resumo
somente-leitura no lugar da conta escalar.

**Como muda por estado.**
- **Grátis / deslogado** — todos os custos, markup e os dois preços funcionam. A seção Marketplace vira
  um portão: chave desligada e desabilitada + "Vender em marketplaces faz parte do Premium." + teaser
  centrado, ocupando as **duas colunas**; "Outros custos" migra da esquerda para a direita para
  compensar. Some "Usar do catálogo" (vira um cartão de teaser com botão desabilitado) e somem os dois
  botões de gravar. "Meus cenários" continua visível para todos — é a porta honesta.
- **Premium ativo** — marketplace ligável, canais repetíveis com tarifas pré-preenchidas pelo catálogo,
  "Preços por canal" na cauda do detalhamento, e os dois botões de gravar no rodapé.
- **Premium pausado (lapsed)** — a Calcular se comporta como grátis para OFERECER (só `active` habilita);
  o que já foi salvo continua legível pela folha "Meus cenários", que exibe seu próprio aviso de plano.
- **Offline** — cálculo intacto; o selo de cada canal passa a dizer "referência embutida (offline)" e
  pode acusar "desatualizado"; um aviso não-bloqueante com "Tentar de novo" aparece no topo da lista de
  canais; gravar vai para a fila.
- **Sessão expirada** — faixa de sessão no topo do shell ("Entrar de novo"); as leituras Premium falham
  e o bloco "Usar do catálogo" pode cair no cartão de erro com "Tentar de novo"; a conta continua sendo
  feita normalmente.

## O ponto exato de inserção desta peça

- **Onde vive:** O rodapé de largura total (`.tf-calc-footer`), abaixo da grade de duas colunas — no desktop os filhos ficam centrados e capados em 720px.
- **Como o vendedor chega:** É o destino de toda a rolagem: o vendedor preenche as colunas acima e desce para ler o resultado. Aparece assim que o formulário fica válido, sem botão de calcular.
- **Vizinhança imediata:** De cima para baixo: título 'Como chegamos no preço' com ⓘ → eventual aviso de resultado → o Card do detalhamento (Material · Energia · Máquina · Falha · Acabamento · Mão de obra · uma linha por item de 'Outros custos' · Custo total em destaque · Preço varejo com o markup como sublinha · Preço atacado · e, na cauda do MESMO cartão, o bloco 'Preços por canal') → eventual aviso de atacado acima do varejo → a grade dos dois cartões de preço final, lado a lado onde couberem 210px cada e empilhados a 360px, ambos centrados e do mesmo tamanho, um com tom de destaque e outro com tom de energia → o botão 'Salvar cenário' centrado → o botão 'Salvar no histórico' centrado.
- **Dados que chegam (e o que ela devolve):** O resultado calculado localmente pelo motor a partir de todos os campos das duas colunas; as linhas de 'Outros custos' herdam o nome digitado (nome em branco cai num rótulo neutro).
- **O que acontece depois:** Daqui saem as duas escritas Premium: salvar como simulação (reabrível na Calcular) e congelar como orçamento no Histórico — offline, essa escrita entra na fila e drena depois. Não existe controle segmentado Varejo|Atacado: os dois são sempre mostrados juntos.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

---

# Contexto 3 — Regras de marca e Design System (obrigatórias)

> Este bloco **não é inspiração, é contrato**. A marca, os tokens e os primitivos abaixo já existem e já
> estão implementados no produto. O desenho compõe com eles; não os substitui, não os recolore, não cria
> equivalente próprio. Quando algo genuinamente não existir no sistema, **diga explicitamente que é novo**
> em vez de introduzi-lo em silêncio.

## 1. Marca — Truth's Forge

**Personalidade:** confiante, precisa, energética, premium. Nunca corporativa-estéril, nunca grunge.
**Humor visual:** ousado, moderno, alto contraste, superfícies chapadas e foscas, espaço negativo generoso.

**Logo:** monograma da forja (lâmina + arco de faísca laranja + faixa curva roxa) + a marca nominal
empilhada **"TRUTH'S FORGE"**. O lockup horizontal é o primário; o símbolo sozinho serve para espaços
reduzidos (ícone, favicon, nav). Respeite o espaçamento livre (≥2,5× o módulo). **Nunca** deforme,
recolora ou aperte o logo.

**Grafismos:** kit de formas curvas derivadas do logo — *arco* (energia), *espada* (o resultado forjado),
*linha curva* (conexão), *onda* (divisor). Use **um** floreio orgânico por tela para quebrar a geometria;
ótimo em estado vazio e cabeçalho. **Nunca dois.**

## 2. Cor

| Papel | HEX |
|---|---|
| Roxo — assinatura (CTA, ativo, destaque) | `#7800ff` |
| Laranja — energia (secundário, badge) | `#f7931e` |
| Ciano — apoio (info, link) | `#15bddc` |
| Roxo profundo (pressionado) | `#5a16a6` |
| Âmbar profundo (pressionado) | `#bd6c0e` |
| Teal profundo (link no claro) | `#0b8196` |

**Regra de aplicação:** color-blocking **chapado, ZERO gradiente**. Planos grandes de preto/branco carregam
a estrutura; o acento saturado entra com parcimônia — **um acento por zona**. Texto sobre roxo é branco;
texto sobre laranja e ciano é **preto**.

**Tema escuro é o padrão da v1; o claro é first-class.** Use sempre o token semântico, nunca a cor crua —
é o que faz os dois temas funcionarem sozinhos:

`--bg-base` `--bg-subtle` `--bg-muted` `--bg-inverse` · `--surface-card` `--surface-raised`
`--surface-sunken` `--surface-overlay` · `--text-strong` `--text-body` `--text-muted` `--text-faint`
`--text-on-accent` `--text-on-energy` `--text-link` · `--border-subtle` `--border-default` `--border-strong`
`--border-accent` · `--accent` `--accent-hover` `--accent-active` `--accent-soft` `--accent-text` ·
`--energy` `--energy-hover` `--energy-contrast` · `--success` `--danger` `--info` `--warning`, cada um com
`-soft` (fundo) e `-text` (texto) · `--focus-ring`.

**Claro:** `--bg-base:#ffffff` · `--surface-card:#ffffff` · `--text-strong:#0b0c0f` · `--text-body:#1f2128`
· `--text-muted:#4d505c` · `--border-subtle:#d7d8e0` · `--accent-text:#7800ff` · `--text-link:#0b8196` ·
`--info-text:#0a6d80`.

**Escuro:** `--bg-base:#000000` · `--surface-card:#14151a` · `--surface-raised:#1f2128` ·
`--text-strong:#ffffff` · `--text-body:#e4e4ea` · `--text-muted:#8c8f9d` · `--border-subtle:#1f2128` ·
`--accent-text:#b79aff` · `--text-link:#15bddc` · `--focus-ring:#9a4bff`.

## 3. Tipografia

- **Peace Sans** — display e nome da marca, sempre **CAIXA ALTA + bold**. (Substituída por **Paytone One**
  enquanto o `.woff2` real não é embarcado.)
- **Lilita One** — títulos secundários, majoritariamente caixa alta.
- **Inter** — corpo, formulário, rótulos, e **todos os números**, com algarismos tabulares
  (`font-feature-settings:"tnum"`). **Não existe monospace** no sistema tipográfico.
- **Nunca abaixo de 12px.**

## 4. Geometria e movimento

- Grade de **4px**. Espaçamentos: 4·8·12·16·20·24·28·32·40·48·56·64px.
- Raios: `xs 6` · `sm 10` · `md 14` (campos e botões) · `lg 18` (cards) · `xl 24` (folhas e painéis herói) ·
  `2xl 32` · `pill 999` (chips, segmented).
- Alturas de controle: 36 / 48 / 56px. **Alvo de toque ≥44px, sempre.**
- Cards **foscos**: borda de 1px + sombra curta. Brilho roxo opcional em **um** CTA focal por zona.
- Movimento 130/190ms, ease-out, toque escala 0,97, respeita `prefers-reduced-motion`.
- Foco: **anel roxo de 3px**, `:focus-visible`, jamais removido.
- Ícones **Lucide**, traço 2px, por máscara CSS com `currentColor`. **Nenhum emoji.**

## 5. Primitivos que já existem — reutilize, não reinvente

Prefixo de classe `tf-`. Nomeie qual primitivo usa em cada parte do desenho.

`tf-btn` (`--primary --secondary --ghost --danger --danger-ghost --glow --sm --lg --loading`) ·
`tf-card` (`--flat --outline --accent --inverse --ghost --interactive --pad-sm/lg/none`) ·
`tf-field` + `tf-inputwrap` (`--sm --lg --error --disabled`) + `tf-input` (`--num`) · `tf-select` ·
`tf-switch` · `tf-segmented` (`--sm --md`) · `tf-badge` (`--info --success --danger --neutral`) ·
`tf-alert` (`--info --success --danger --neutral`) · `tf-toast` (`--info --success --danger`) ·
`tf-dialog` (`--sheet-bottom --sheet-right --sheet-left`) · `tf-price` (herói de preço:
`--lg --md --accent --energy --success --inverse --center --plain`) · `tf-brow` (linha do detalhamento:
`--accent --muted --negative --total`) · `tf-empty` · `tf-spinner` · `tf-icon` · `tf-logo` (`--full --mark`)
· `tf-grafismo` · `tf-title` · `tf-display` · `tf-tnum`.

## 6. Acessibilidade — WCAG 2.2 AA, não negociável

- Contraste ≥4,5:1 **medido contra o fundo real do elemento**, não contra o card atrás dele. Um texto de
  status dentro de um badge tem como fundo o `*-soft` já composto sobre o card — é esse o pior caso, e é
  esse que o olho vê.
- Alvo de toque ≥44px. Todo campo rotulado. Foco visível e nunca removido.
- Ordem de leitura coerente com a ordem visual; nada essencial comunicado só por cor.

## 7. Conteúdo e honestidade — as regras que este produto paga caro para manter

1. **Todo número tem procedência.** Valor vindo de tabela de tarifa, catálogo salvo ou cálculo congelado
   diz de onde veio. "Preço de então" e "preço de hoje" **nunca** se misturam sem rótulo.
2. **Degradação é dita, não escondida.** Item apagado ou indisponível mostra a última informação conhecida
   com legenda honesta — nunca campo vazio silencioso, nunca `R$ 0,00` que na verdade é "não sei".
3. **Falha de rede nunca é upsell.** Erro de conexão jamais aparece como "isso é Premium".
4. **A frase honesta mora em elemento de largura total**, nunca dentro de um `placeholder` — ele corta onde
   a caixa acaba, e a explicação some. Placeholder carrega só número ou exemplo.
5. **Dinheiro em pt-BR:** `R$ 1.234,56` — separador de milhar, vírgula decimal, sempre com centavos.
   Unidades como sufixo do campo: `g`, `kg`, `kWh`, `h`, `%`.
6. **Upsell sem padrão escuro:** sem contagem regressiva falsa, sem "última chance", sem esconder o fechar,
   sem cobrar por valor que a tela não mostrou.
7. **Nove estados por superfície interativa:** repouso · foco · hover · pressionado · desabilitado ·
   carregando · vazio · erro · offline. Um desenho sem os nove está incompleto.

## 8. O que não fazer

Sem gradiente por padrão. Sem esqueuomorfismo. Sem cor fora da paleta. Sem deformar ou recolorir o logo.
Sem enterrar o resultado. Sem abrir todos os campos avançados de uma vez (intimida o leigo). Sem emoji.
Sem erro cru ou stack para o usuário. Sem inventar primitivo que já existe com outro nome.

---

# O pedido

# “Como chegamos no preço” + os dois cartões de preço final

## O que desenhar
O rodapé de resultado da calculadora (`apps/web/src/features/calculator/calculator-form.tsx`,
componente `PriceResults`, renderizado dentro de `.tf-calc-footer` na aba **Calcular**). É a última
coisa que o vendedor lê antes de fechar a tela: a conta item a item que soma até o custo total, os
preços derivados por markup, os preços por canal de marketplace (quando Premium e com canal ativo) e,
no fim, os dois cartões grandes — varejo e atacado — que o vendedor tira foto e manda pro cliente.
Vive sempre abaixo do formulário; no desktop atravessa as duas colunas do grid, centralizado e limitado
a 720px de largura. Depois dele só vêm os botões “Salvar cenário” e “Registrar orçamento” (ambos
Premium, ausentes sem assinatura) e a frase freemium.

## Por que este prompt existe
Autoridade: **PROTÓTIPO PARCIAL**. O protótipo de 2026-07-02 (`CalculatorScreen.jsx` §E4/§F.3)
desenhou o breakdown itemizado e mandou, com todas as letras: “Varejo × Atacado: desktop = 2 colunas
lado a lado; **mobile = segmented control (Varejo|Atacado) + linha-resumo**”; §D.2 chegou a **criar** o
primitivo “Segmented control — pill” só para isso. **O app nunca construiu esse controle.** O que
existe hoje foi ajustado por medição de overflow, não por desenho: uma grade `auto-fit` que empilha os
dois cartões a 360px. O protótipo também mostrava bolinhas de cor nas linhas do breakdown; elas foram
removidas em 016 (FR-907-AC2, decisão registrada). E o breakdown ganhou linhas que o protótipo não
tinha (acabamento, mão de obra, N linhas de “Outros custos”) mais uma cauda inteira — “Preços por
canal” — dentro do mesmo cartão. Ou seja: o código **contraria** uma regra de desenho explícita em três
pontos verificáveis, e ninguém desenhou a peça que ele virou.

## O que já existe hoje (não invente do zero — corrija)
Ordem exata na tela, de cima para baixo:

1. Título de seção **“Como chegamos no preço”** com um ⓘ ao lado (rótulo assistivo “Sobre o cálculo do
   preço”, corpo “Cada linha em reais soma exatamente ao custo total; os preços vêm do custo total ×
   markup.”).
2. Um alerta tom `info`, só quando dispara a checagem de plausibilidade do RESULTADO. O caso real:
   “O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender.
   Confira os campos de custo que ficaram zerados. Nada foi recusado.”
3. Um `Card` com as linhas (`tf-brow`), rótulo à esquerda, valor tabular à direita:

| Linha | Rótulo literal | Ênfase hoje | Observação |
|---|---|---|---|
| 1 | “Material” | normal | sempre presente |
| 2 | “Energia” | normal | sempre presente |
| 3 | “Máquina” | normal | sempre presente |
| 4 | “Falha / perdas” | `muted` quando 0,00 | opcional |
| 5 | “Acabamento” | `muted` quando 0,00 | opcional |
| 6 | “Mão de obra” | `muted` quando 0,00 | opcional |
| 7..N | nome digitado pelo vendedor (“Embalagem”, “Etiqueta”…) ou “Outros custos” se em branco | normal | 0..N linhas |
| N+1 | “Custo total” | `total` | soma exata das anteriores |
| N+2 | “Preço varejo” + sub-rótulo “markup 50%” | `accent` | derivado |
| N+3 | “Preço atacado” + sub-rótulo “markup 30%” | normal | derivado |

4. → Ainda **dentro do mesmo cartão**, separada por um divisor: a legenda “Preços por canal” e, por
   canal ativo, o nome do marketplace + “· modalidade”, e para cada nível (legendas “Varejo” e
   “Atacado”): “Preço para anunciar”, “Frete” (valor negativo, `muted`, só quando > 0) e “Recebido
   líquido”. Se o líquido for negativo ele fica em tom negativo e ganha a frase “Canal não-lucrativo
   neste preço (frete maior que a margem).”. Quando há frete: “Descontado do valor recebido (não é
   embutido no anúncio).”. Esse bloco some inteiro sem canal ativo / sem Premium.
5. Alerta `info` quando atacado > varejo: “O preco de atacado ficou acima do varejo. Nada foi recusado
   — so confira se e isso mesmo.” → **esta frase está sem acentos no produto** (“preco”, “so”, “e”).
   É defeito de texto, não de desenho, mas o desenho deve mostrá-la já corrigida: “O preço de atacado
   ficou acima do varejo. Nada foi recusado — só confira se é isso mesmo.”
6. Os dois cartões finais, em grade `repeat(auto-fit, minmax(210px, 1fr))`: **“Preço varejo”** (fundo
   accent) e **“Preço atacado”** (fundo energy), ambos no MESMO tamanho (`md`), ambos centralizados,
   cada um com legenda “markup 50%” / “markup 30%”. Lado a lado a partir de ~450px, empilhados a 360px.

→ Problemas a resolver no desenho: **(a)** os dois cartões têm peso visual idêntico — o produto não diz
qual preço é o principal, e o canvas do 018 (aba Kits) mostra a opinião posterior do dono: varejo grande
em accent, atacado menor e apagado; **(b)** “Preço varejo” e “Preço atacado” aparecem **duas vezes** com
o mesmo número a menos de uma rolagem de distância (linhas do breakdown + cartões); **(c)** não existe o
segmented control Varejo|Atacado em lugar nenhum; **(d)** a cauda “Preços por canal” pendurada no mesmo
cartão faz a distância entre “Custo total” e os cartões finais crescer com o número de canais.

## Conteúdo e dados reais
Use os números da semente do produto, que fecham de verdade (custo × markup):

- Material R$ 8,40 · Energia R$ 0,54 · Máquina R$ 1,82 · Falha / perdas R$ 0,20 · Acabamento R$ 2,00 ·
  Mão de obra R$ 3,00 · Embalagem R$ 0,20 → **Custo total R$ 16,16**.
- **Preço varejo R$ 24,24** (markup 50%) · **Preço atacado R$ 21,01** (markup 30%).
- Canal de exemplo: “Mercado Livre · Clássico” → “Preço para anunciar R$ 34,36”, “Recebido líquido
  R$ 24,24”. Caso frete: “Shopee · Frete grátis” → “Frete −R$ 20,00” e líquido “−R$ 3,80” em tom
  negativo com a frase do canal não-lucrativo.
- Todo dinheiro em pt-BR com dois decimais e milhar por ponto: `R$ 1.234,56`. Números em fonte tabular.
- Caso de estresse obrigatório: **R$ 950.096,00** num cartão a 360px (é o valor que já quebrou
  no meio do dígito neste projeto).
- O sub-rótulo do markup é a string minúscula “markup” + o percentual digitado; com o campo vazio o
  produto imprime “markup 0%”.

## Estados obrigatórios
- **Repouso** — tudo válido, com e sem canais, com e sem linhas opcionais.
- **Formulário inválido** — `PriceResults` não renderiza NADA; no lugar dele um alerta `danger`:
  “Confira os campos destacados para ver o preço.” Desenhe esse estado.
- **Linhas opcionais em zero** — “Falha / perdas”, “Acabamento”, “Mão de obra” em R$ 0,00 aparecem
  apagadas, não somem. Mostre a diferença entre apagado e normal.
- **Aviso de resultado** (`info`) — custo/preço zerados, com a frase inteira acima.
- **Atacado acima do varejo** (`info`) — nunca em vermelho: nada foi recusado.
- **Canal sem tarifa da faixa** — “Sem tarifa publicada para a faixa de preço deste anúncio — informe a
  comissão do canal para precificar.” no lugar dos números daquele nível.
- **Canal sem comissão informada** — “Informe a comissão do canal para ver os preços.”
- **Canal com campo errado** — “Corrija os campos deste canal para ver os preços.” (nunca preço velho).
- **Sem Premium / deslogado** — o bloco “Preços por canal” está **ausente inteiro**; o breakdown e os
  dois cartões continuam completos e gratuitos. Não desenhe cadeado nem número borrado aqui.
- **Foco de teclado** no ⓘ do título e nos botões abaixo; **hover/pressionado** só existe nesses
  mesmos elementos — as linhas e os cartões não são clicáveis hoje.

## Viewports
- **390px** (mobile de referência) e **360px** (o estresse medido: é onde a grade empilha e onde o
  valor de seis dígitos já quebrou). Ambos obrigatórios — a peça nasceu no mobile.
- **1280px** — a peça atravessa as duas colunas do formulário, centralizada, com no máximo 720px de
  largura útil; os dois cartões cabem lado a lado com folga. Desenhe também aqui, porque é onde o
  protótipo pedia “2 colunas lado a lado” e é onde a hierarquia entre varejo e atacado fica mais visível.

## Regras que o desenho não pode quebrar
- **Toda linha em reais soma exatamente ao custo total** — a soma é a promessa da seção; nenhuma linha
  decorativa, nenhum arredondamento inventado.
- **Freemium é binário**: calcular custo, markup e ver a conta é grátis e completo; marketplace, salvar
  e exportar são Premium. O que é Premium **está ausente**, nunca borrado ou falso.
- **Falha de rede nunca é vendida como “não é premium”** — se o catálogo de tarifas falhou, a mensagem
  fala de tarifa, não de assinatura.
- **Aviso nunca vira validação**: tom `info`, texto descritivo (“ficou acima”, “confira”), nunca
  corretivo, e sempre termina em “Nada foi recusado.”.
- **Frase honesta nunca dentro de placeholder** — ela ocupa elemento próprio de largura total.
- Alvos de toque ≥ 44px (o ⓘ do título inclusive) e contraste medido contra o fundo REAL dos cartões
  (accent e energy são fundos cheios, com texto sobre eles), em tema escuro **e** claro.
- Procedência do número: quando o preço do canal vem de tabela de referência, o selo/legenda que diz
  isso não pode ser cortado.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não estimado**: a grade fixa de duas colunas dava 108px a um valor que
  precisava de 124px e o número quebrava no meio (`950.096` em duas linhas). Qualquer proposta precisa
  sobreviver a seis dígitos a 360px.
- **Scroll no eixo vertical dentro do cartão de preço**: a altura do número com `line-height: 1`
  produzia barra clássica de 15px que deslocava o valor do centro. Não aperte a caixa do valor.
- **Texto ocluso passa em teste**: a legenda “markup 50%” e as frases de canal precisam caber por
  geometria, não por sorte.
- **Placeholder que corta a frase**: já aconteceu com um sufixo de honestidade cortado dentro de um
  campo; frases explicativas moram fora de inputs.
- **Duas fontes para o mesmo número**: hoje varejo e atacado aparecem no breakdown e nos cartões. Se o
  desenho mantiver os dois, eles têm que se ler como “derivação” e “resultado”, não como repetição.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. **390px — repouso completo**, com canal ativo, uma linha de “Outros custos” e os dois cartões finais.
2. **360px — estresse**, com R$ 950.096,00 e o valor mais longo de canal.
3. **390px — estados**, empilhados numa prancheta: formulário inválido, aviso de resultado zerado,
   atacado acima do varejo, canal não-lucrativo, canal sem tarifa da faixa, sem Premium.
4. **1280px — repouso**, mostrando a hierarquia entre varejo e atacado que o mobile também vai herdar.
5. **Proposta do segmented control Varejo|Atacado** (o que o protótipo criou e o app nunca construiu):
   pílula com dois segmentos + linha-resumo, no mobile — desenhada ao lado da alternativa atual
   (dois cartões empilhados), para o dono escolher.

Reutilize os primitivos existentes, sem criar novos: `tf-brow` (linha do breakdown, com suas ênfases
`muted` / `total` / `accent` / `negative`) para cada linha da conta; `tf-price` nos dois cartões finais
(`--md` hoje, `--lg` se o varejo virar o principal; tons `--accent` e `--energy`); `tf-card` como
recipiente do breakdown; `tf-alert` (`info` / `danger`) para os avisos; o `tf-infotip` no título. Se
propuser o segmented control, apresente-o como um primitivo novo do DS, nomeado e com todos os estados.

## Perguntas em aberto para o dono
1. **Qual dos dois preços é o principal?** Hoje varejo e atacado têm exatamente o mesmo peso; o canvas
   do 018 (Kits) sugere varejo grande em accent e atacado menor/apagado. Isso vale para a calculadora?
2. **O segmented control Varejo|Atacado do protótipo entra ou é abandonado formalmente?** E se entrar,
   ele também governa “Preços por canal” (que hoje mostra os DOIS níveis de cada canal ao mesmo tempo)?
3. **As linhas “Preço varejo” e “Preço atacado” continuam no breakdown**, mesmo com os cartões logo
   abaixo? Elas existem para mostrar a derivação pelo markup — mas repetem o número.
4. **“Preços por canal” continua dentro do mesmo cartão** ou volta a ser seção própria? Com 3 canais a
   distância entre “Custo total” e os cartões finais passa de uma tela inteira no mobile.
5. **As bolinhas de cor voltam?** Foram removidas em 016 por lerem como “chrome de gráfico”; se o
   desenho introduzir comparação visual, a decisão precisa ser reaberta explicitamente.
