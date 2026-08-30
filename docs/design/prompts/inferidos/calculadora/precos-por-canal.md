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

- **Onde vive:** No RODAPÉ de largura total, na CAUDA do mesmo Card 'Como chegamos no preço' — depois da última linha do detalhamento (Atacado) e antes de o cartão fechar. Não tem seção própria e não mora na seção Marketplace.
- **Como o vendedor chega:** O vendedor termina de configurar os canais na coluna direita e desce até o rodapé: é lá, junto do detalhamento, que os preços de cada canal são lidos.
- **Vizinhança imediata:** Dentro do cartão, acima: as linhas 'Preço varejo' e 'Preço atacado' do detalhamento. Aqui: um rótulo 'Preços por canal' e, abaixo dele, um bloco por canal separado por uma linha divisória superior. Cada bloco: título 'Mercado Livre · Clássico' (a modalidade em peso normal e cor apagada) e então, para varejo e depois para atacado, as linhas 'Preço do anúncio' / '(Frete −R$ X)' quando digitado / 'Recebido líquido'. Fora do cartão, abaixo: o eventual aviso de atacado acima do varejo e os dois cartões de preço final.
- **Dados que chegam (e o que ela devolve):** Um resultado por canal, calculado localmente pelo motor a partir das taxas do cartão de canal correspondente; some por inteiro quando a chave mestra está desligada ou não há canal.
- **O que acontece depois:** É o número que o vendedor leva para o anúncio. Salvar cenário ou gravar no histórico congela exatamente esses valores.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Preços por canal — a comparação que hoje é uma pilha

## O que desenhar

O bloco **"Preços por canal"**, que vive hoje na CAUDA do card da seção **"Como chegamos no preço"**, na
tela Calcular (e nas mesmas seções reaproveitadas em Produto e em Kits). É o último número que o vendedor
lê antes de decidir: depois de ver o custo se formar linha a linha e o preço de venda sair do markup, ele
precisa saber **por quanto anunciar em cada marketplace e quanto sobra em cada um**. Quem usa: o vendedor
que já cadastrou 1 a N canais (Mercado Livre, Shopee, Amazon, Outro) com suas taxas, no momento em que
compara onde vale a pena anunciar. Desenhe o bloco e a sua relação com o card do detalhamento que o
antecede e com os dois cards de preço final que o sucedem.

## Por que este prompt existe

A forma atual foi inferida por IA, não desenhada: até 016/US5 o bloco era uma **seção titulada própria**;
a implementação a fundiu DENTRO do card do detalhamento, empilhou os canais separados por uma linha de
1px, e repetiu o par varejo+atacado dentro de cada canal. O protótipo de 2026-07-02 (`CalculatorScreen.jsx`,
§E4) desenha "taxa de marketplace (negativa) → líquido" como duas linhas de um breakdown ÚNICO, **para um
canal só** — ele nunca resolveu multicanal. E o próprio dono, quando desenhou este conteúdo no canvas
desktop de 018 (aba Orçamentos e aba Kits), o fez como **card SEPARADO ao lado do "Detalhamento"**, com
nome do canal + anúncio + líquido, **sem** o par varejo/atacado. Ou seja: existe forma desenhada para este
conteúdo, em outra aba, e a Calcular não a segue. Este prompt existe para resolver essa contradição.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual dentro do único card de "Como chegamos no preço":

1. Linhas de custo: "Material", "Energia", "Máquina", "Falha / perdas", "Acabamento", "Mão de obra",
   0..N linhas de "Outros custos" nomeadas pelo usuário (fallback "Outros custos").
2. "Custo total" (ênfase `total`).
3. "Preço varejo" (ênfase `accent`, sublinha "markup 100%") e "Preço atacado" (sublinha "markup 50%").
4. **→ Aqui, colado, sem respiro:** um divisor `borderTop 1px` e o rótulo pequeno **"Preços por canal"**
   (mesmo peso/tamanho de um rótulo de canal — não parece um título de bloco).
5. Para cada canal, em pilha vertical, separados por outro `borderTop 1px`:
   - Cabeçalho: **"Mercado Livre · Clássico"** — nome em `--fw-semibold`/`--text-strong`, modalidade em
     peso regular e `--text-muted`, coladas por " · ".
   - Legenda **"Varejo"**, depois as linhas "Preço para anunciar", opcionalmente "Frete" (negativa, só
     se o vendedor digitou frete), "Recebido líquido".
   - Legenda **"Atacado"**, com as mesmas três linhas.
   - Se houve frete: a legenda "Descontado do valor recebido (não é embutido no anúncio)."

**→ Problemas a resolver no desenho:**

- **→ Não há comparação.** Três canais viram três pilhas idênticas de 6–8 linhas; o vendedor precisa
  varrer verticalmente ~50 linhas para responder "onde recebo mais?". O take-away do multicanal não tem
  forma.
- **→ O bloco está dentro de um card que já carrega 10+ linhas de custo**, com a mesma tipografia de
  linha (`tf-brow`), então "Recebido líquido" pesa visualmente o mesmo que "Energia".
- **→ O rótulo "Preços por canal" não se distingue** do rótulo de cada canal logo abaixo — mesmo estilo.
- **→ A procedência mora longe do número:** os selos de honestidade ("Referência", "atualizada em…",
  "ajustado por você", "estimativa de frete") ficam no card de ENTRADA do canal, acima; a linha de preço
  aparece sem nenhuma marca de onde veio a taxa.

## Conteúdo e dados reais

| Elemento | Rótulo literal | Tipo / formato | Observação |
|---|---|---|---|
| Título do bloco | "Preços por canal" | texto | hoje minúsculo demais |
| Canal | "Mercado Livre" · "Shopee" · "Amazon" · "Outro" | texto | fallback: "Canal" |
| Modalidade | "Clássico" · "Premium" · "Profissional" · "Individual" | texto, opcional | pode não existir (Shopee) |
| Nível | "Varejo" / "Atacado" | legenda | sempre os dois |
| Anúncio | "Preço para anunciar" | R$ pt-BR, 2 casas | ex.: R$ 34,63 |
| Frete | "Frete" | R$ negativo, ênfase `muted` | **só existe se o vendedor digitou frete** |
| Líquido | "Recebido líquido" | R$ pt-BR | ex.: R$ 24,24; pode ser NEGATIVO |

Exemplo verdadeiro e completo para as pranchetas (custo total R$ 12,12, markup varejo 100% ⇒ preço varejo
R$ 24,24, atacado 50% ⇒ R$ 18,18):

- **Mercado Livre · Clássico** — Varejo: anunciar R$ 34,63 · Recebido líquido R$ 24,24. Atacado:
  anunciar R$ 26,44 · Recebido líquido R$ 18,18.
- **Shopee** — Varejo: anunciar R$ 31,50 · Frete −R$ 12,00 · Recebido líquido R$ 12,24. Atacado:
  anunciar R$ 24,90 · Frete −R$ 12,00 · **Recebido líquido −R$ 1,20** (caso real e obrigatório).
- **Amazon · Individual** — Varejo sem tarifa publicada para a faixa (estado abaixo).

Caso extremo que precisa caber: **R$ 6.000.061,60** (o produto já produz esse número — há aviso próprio
para custo absurdo). Desenhe a coluna de valor com esse comprimento em mente.

## Estados obrigatórios

- **Canal precificado (repouso)** — as linhas acima.
- **Canal sem comissão informada** — nada de números; a frase exata: *"Informe a comissão do canal para
  ver os preços."*
- **Canal com erro nos campos** — *"Corrija os campos deste canal para ver os preços."* (o canal irmão
  continua mostrando preços; um canal ruim nunca apaga os outros).
- **Nível sem tarifa publicada** (só varejo, só atacado, ou os dois — eles caem em faixas diferentes) —
  em tom de alerta: *"Sem tarifa publicada para a faixa de preço deste anúncio — informe a comissão do
  canal para precificar."* **Jamais R$ 0,00 no lugar.**
- **Líquido negativo** — o valor em `--danger-text` com o sinal "−", e abaixo: *"Canal não-lucrativo neste
  preço (frete maior que a margem)."*
- **Com frete digitado** — a linha "Frete" negativa em `muted` + a legenda *"Descontado do valor recebido
  (não é embutido no anúncio)."*
- **Bloco ausente** — sem canal ativo (toggle desligado ou nenhum slot) o bloco e seu título **somem por
  inteiro**; nada de card vazio.
- **Sem permissão (free)** — o vendedor sem Premium não chega aqui: o toggle "Incluir marketplaces no
  preço" fica desabilitado com a razão ao lado, *"Vender em marketplaces faz parte do Premium."*.
  Desenhe esse estado do bloco: ausência total, não números borrados/censurados.
- **Referência desatualizada / offline** — a taxa vem do catálogo salvo no aparelho; o número existe e é
  honesto. Desenhe onde a marca de procedência ("Referência · atualizada em 06/08/2026", "referência
  embutida (offline)", "ajustado por você", "estimativa de frete") aparece **perto do preço**, não só no
  campo de entrada.
- **Aviso irmão logo abaixo do card** — quando atacado > varejo: *"O preço de atacado ficou acima do
  varejo. Nada foi recusado — só confira se é isso mesmo."* (tom `info`, nunca erro).

## Viewports

- **390px** — obrigatório: é a tela primária do produto e onde a pilha dói mais. Mostre 3 canais.
- **1280px** — obrigatório: a Calcular também roda no desktop, e é onde a comparação lado a lado se torna
  possível; concilie com a forma que o dono já desenhou em 018 (card "Preços por canal" **ao lado** do
  card "Detalhamento", numa grade 1fr-1fr).
- **1920px** opcional, só se a solução de 1280 mudar de forma.

## Regras que o desenho não pode quebrar

- **Freemium é binário:** ou o bloco existe inteiro, ou não existe. Nada de preview desfocado.
- **Procedência do número:** todo preço de canal nasce de uma taxa que tem origem e data; se a origem é
  fraca (referência embutida, estimativa, ajustado pelo usuário), isso é dito por escrito.
- **Degradação dita, nunca escondida:** faixa sem tarifa publicada vira frase, nunca R$ 0,00.
- **Falha de rede nunca vira "não é premium":** catálogo desatualizado continua calculando.
- **Frase honesta nunca em placeholder** e nunca em elemento estreito que a corte — elas vivem em
  elementos de largura total.
- **Alvo ≥44px** para qualquer coisa clicável (um seletor/aba de canal, se você propuser um).
- **Contraste medido contra o fundo real do card**, incluindo o `muted` da modalidade e da linha de frete.

## Armadilhas já pagas neste projeto

- **Grade fixa 1fr-1fr estourou preço de 6 dígitos** em 360px: o número quebrou no meio do dígito para a
  página não rolar. Qualquer coluna de valor precisa de piso medido, não chutado.
- **Overflow horizontal medido:** o eixo Y também — headless não enxerga scrollbar clássica. Nada pode
  criar rolagem lateral em 390px.
- **Texto ocluso passa em teste**: `toBeVisible` não vê elemento coberto; a legibilidade aqui é geometria,
  não string.
- **Divisor de 1px como única hierarquia** já produziu leituras erradas: o rótulo "Preços por canal" hoje
  é indistinguível de um nome de canal.

## Entregável

Pranchetas, tema **escuro como padrão** e **claro como first-class** (o mesmo conjunto nos dois):

1. **390px — repouso**, 3 canais precificados, incluindo um com frete e um com líquido negativo.
2. **390px — estados**: canal sem comissão, canal com erro, nível sem tarifa publicada.
3. **1280px — a comparação**: o bloco como card próprio ao lado do "Detalhamento", coerente com o canvas
   018; mostre como 3 canais se comparam sem varredura vertical.
4. **1280px — bloco ausente** (free / toggle desligado) mostrando o que o card do detalhamento vira.

Reutilize os primitivos existentes, sem criar novos: `Card` para o contêiner, `tf-brow` (`BreakdownRow`)
com `label`/`sublabel`/`value` e as ênfases que já existem — `muted` para o frete, `negative` para o
líquido negativo, `accent`/`total` reservadas ao que já as usa —, `Alert tone="info"` para o aviso de
atacado acima do varejo, e o selo de taxa (`FeeSeal`) para a procedência. Se propuser uma nova forma de
comparação (tabela, abas de canal, colunas), construa-a com esses mesmos primitivos e explique em uma
linha por que a pilha atual não serve.

## Perguntas em aberto para o dono

1. **Varejo + atacado por canal, ou só um nível?** O canvas 018 (Orçamentos e Kits) mostra por canal
   apenas "anúncio" e "líquido" — sem o par varejo/atacado. A Calcular mostra os dois. Qual é a verdade?
   (Se for só um nível, qual: o varejo?)
2. **Card próprio ao lado do "Detalhamento" também na Calcular**, como no canvas 018, ou o bloco continua
   fundido na cauda do mesmo card (decisão de 016/US5)?
3. **Existe canal "vencedor"?** Marcar visualmente o de maior líquido ajudaria a decisão — mas é uma
   recomendação do produto, e "maior líquido" pode não ser o melhor canal (volume, prazo, risco). O dono
   quer que o produto aponte, ou apenas apresente?
