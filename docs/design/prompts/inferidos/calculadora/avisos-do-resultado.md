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

- **Onde vive:** Dois alertas informativos no rodapé de largura total: o primeiro entre o título 'Como chegamos no preço' e o Card do detalhamento; o segundo entre o Card do detalhamento e a grade dos dois cartões de preço final.
- **Como o vendedor chega:** Não são acionados: aparecem quando o RESULTADO denuncia algo que nenhum campo isolado poderia denunciar — custo total R$ 0,00 e preço R$ 0,00 (a persona que zera tudo que não entende), ou um preço absurdo, ou preço de atacado maior que o de varejo.
- **Vizinhança imediata:** O de cima fica colado abaixo do título da seção e acima da primeira linha do detalhamento (Material); ele concatena N frases num parágrafo só. O de baixo fica exatamente entre a borda inferior do Card do detalhamento e os dois cartões PriceHero. Ambos com tom informativo, nunca de perigo.
- **Dados que chegam (e o que ela devolve):** Vêm do resultado calculado, não dos campos; a comparação atacado×varejo é feita sobre os PREÇOS resultantes, não sobre os markups digitados.
- **O que acontece depois:** Nada é recusado — o preço continua ali, abaixo. O tom informativo é decisão registrada: escrito como erro, o vendedor conclui que o produto recusou o cálculo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Avisos que só o resultado denuncia

## O que desenhar

O bloco de avisos que aparece **dentro do resultado da calculadora**, depois que o formulário já está
válido e o preço já foi calculado. São avisos que **nenhum campo isolado poderia dar**, porque cada campo,
sozinho, está perfeitamente correto: o vendedor zerou tudo o que não entendia e chegou a um preço de venda
de R$ 0,00; ou errou uma casa decimal em três campos diferentes e chegou a um custo de R$ 6.000.061,60; ou
digitou um markup de atacado maior que o de varejo. O produto **não recusa** nenhum desses casos — ele
calcula, entrega o número e avisa. Quem lê é o vendedor leigo, no momento em que ele está prestes a fechar
a tela e anunciar o preço. Vive na aba **Calcular** (`/calcular`), no rodapé de resultados, e reaparece
igual na ficha de produto do Catálogo e no editor de linha de kit.

## Por que este prompt existe

Estes avisos nunca foram desenhados. Nenhuma das quatro autoridades de desenho prevê aviso sobre o
RESULTADO: o §G trata o resultado como sempre-verdadeiro ("success: preço + breakdown", "recompute ao
vivo"), e o único estado de recusa desenhado é peso = 0, que é validação de campo. A peça nasceu de uma
homologação automatizada (achados CF-001-LEIGO-D-P5 e D-P6) e de uma decisão do dono (015/A8), ambas
**depois** da construção — registro, não protótipo. O que foi inferido sem desenho: que os dois avisos são
`info` e não erro, sua posição relativa ao detalhamento e aos cartões de preço, e a decisão de **concatenar
N frases num parágrafo único**. O resultado é que a frase que impede um anúncio por R$ 0,00 tem hoje
exatamente o mesmo peso visual de qualquer outra nota informativa da tela.

## O que já existe hoje (não invente do zero — corrija)

A ordem atual dentro do rodapé de resultados, de cima para baixo:

1. Título de seção **"Como chegamos no preço"** com ⓘ.
2. **Aviso de resultado** — um bloco `info` (fundo ciano suave, ícone ⓘ, texto corrido), presente só quando
   há avisos. → **Todas as frases disparadas viram um parágrafo só, separadas por espaço.** Com dois avisos
   ativos (preço zero + custo absurdo é impossível junto, mas custo absurdo + gramas absurdas não é) o
   bloco vira um muro de texto sem hierarquia.
3. O Card do detalhamento: Material · Energia · Máquina · Falha / perdas · Acabamento · Mão de obra ·
   linhas de "Outros custos" · **Custo total** · Preço varejo (`markup 60%`) · Preço atacado
   (`markup 30%`) · opcionalmente "Preços por canal".
4. **Aviso de atacado acima do varejo** — outro bloco `info`, solto **entre** o Card e os cartões de preço.
5. Os dois cartões finais `tf-price-hero` centralizados: "Preço varejo" (tom accent) e "Preço atacado"
   (tom energy), grade `auto-fit` com piso de 210px (empilha a 360px).

Textos literais de hoje, a citar sem reescrever (exceto onde marcado):

| Gatilho | Frase exata hoje |
|---|---|
| Custo e preço zerados (peça existe) | "O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado." |
| Custo total > R$ 100.000 | "Confira os custos: R$ {v} para uma peça é muito acima do que costuma acontecer. Normalmente é uma casa decimal a mais em algum campo. Nada foi recusado." |
| Atacado > varejo | "O preco de atacado ficou acima do varejo. Nada foi recusado — so confira se e isso mesmo." |
| Formulário inválido (sem resultado) | "Confira os campos destacados para ver o preço." (bloco `danger`, ocupa o lugar de todo o resultado) |

→ **A frase do atacado está sem acentuação no código** ("preco", "so confira se e isso mesmo"). É defeito
de texto, não de desenho — mas o desenho deve mostrar a forma acentuada correta: "O preço de atacado ficou
acima do varejo. Nada foi recusado — só confira se é isso mesmo."

→ **Os dois avisos estão em lugares diferentes da mesma pilha** (um antes do Card, outro depois) sem que
nada explique a diferença ao leitor.

→ **Não existe tom intermediário no DS.** O `tf-alert` tem `neutral`, `info`, `success` e `danger`. Existem
tokens `--tf-warning` / `--tf-warning-soft` (laranja) mas **não existe** `--warning-text` nem
`tf-alert--warning`. Hoje o aviso é `info` por eliminação, não por escolha.

## Conteúdo e dados reais

- **Preço zero**: dispara quando `custo total = R$ 0,00` **e** `preço varejo = R$ 0,00`, e **só** se a peça
  existir (gramas > 0 ou tempo > 0) — formulário recém-aberto e vazio não é erro.
- **Custo absurdo**: dispara acima de **R$ 100.000,00** de custo de uma peça. Exemplo real medido na
  homologação: **R$ 6.000.061,60**. O número entra na frase formatado em pt-BR com até 4 casas.
- **Atacado acima do varejo**: comparação entre os **preços resultantes**, não entre os markups digitados.
  Exemplo verdadeiro: varejo R$ 24,24 (markup 60%) e atacado R$ 30,30 (markup 100%).
- Os mesmos blocos podem coexistir com avisos **de campo** (mesma família de texto, mesma cor `--info-text`,
  mas renderizados como legenda solta abaixo do input, sem caixa) — ex.: "Confira o consumo: 120 kW. Acima
  de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer
  watts: 120 W são 0,12 kW. Nada foi recusado."
- Toda frase da família termina em **"Nada foi recusado."** e toda frase **ensina a converter**. Isso é
  regra escrita, não estilo: o desenho não pode encurtar a frase a ponto de perder a conversão.
- Cifras longas de verdade a testar no layout: `R$ 6.000.061,60`, `R$ 950.096,00`, `R$ 0,00`.

## Estados obrigatórios

- **Ausente** (o normal): nenhum aviso dispara, nada ocupa espaço, o resultado é só preço + detalhamento.
- **Um aviso**: o caso comum. Mostre com a frase inteira, legível, sem truncar.
- **Vários avisos juntos**: hoje concatenados num parágrafo. Desenhe a alternativa — cada frase como item
  próprio, com hierarquia entre elas — e mostre o pior caso com três frases longas.
- **Atacado acima do varejo**: aviso independente dos anteriores, pode aparecer sozinho ou somado a eles.
- **Sem resultado (formulário inválido)**: bloco `danger` "Confira os campos destacados para ver o preço."
  substitui todo o resultado — desenhe para provar que o aviso de resultado **é visualmente diferente da
  recusa**, porque essa distinção é a razão de ele existir.
- **Coexistência com o aviso de campo**: prancheta mostrando um aviso ⓘ abaixo de um input **e** o aviso de
  resultado ao mesmo tempo, para provar que não lêem como duplicata.
- **Foco de teclado e leitura assistiva**: o bloco é região `status` (polido, não assertivo). Se o desenho
  propuser qualquer elemento interativo dentro dele (link "ver campo", botão de recolher), esse elemento
  precisa de estado de foco visível e alvo ≥ 44px.
- **Recolhido / compacto**: existe precedente na casa (`tf-alert--compact`: ícone + título curto numa linha
  + ⓘ que abre o corpo inteiro). Mostre se ele serve aqui — e se não servir, diga por quê.

## Viewports

- **Mobile 390px** — obrigatório: é onde a peça mais dói. As frases têm 150–230 caracteres e caem em 5–8
  linhas; com dois avisos concatenados o bloco empurra os cartões de preço para fora da primeira dobra.
- **Mobile 360px** — o piso medido do projeto, onde os cartões de preço já empilham e uma cifra de seis
  dígitos já quebrou no meio do número em regressão passada.
- **Desktop 1280px** — a peça vive no rodapé de resultados também no desktop, num container mais largo: o
  bloco de aviso vira uma faixa muito larga e curta, e a relação de peso com os cartões de preço muda.

## Regras que o desenho não pode quebrar

- **Aviso nunca vira validação.** O produto calculou, o produto salva, nada foi recusado. Se o desenho
  fizer o bloco parecer erro, o vendedor conclui que o produto recusou — e a decisão do dono (2026-08-03)
  é explicitamente a oposta.
- **Mas o aviso também não pode ficar invisível.** É a única coisa entre o vendedor e um anúncio por
  R$ 0,00. Um bloco `info` com o mesmo peso de qualquer nota da tela já falhou nesse trabalho.
- **A frase honesta nunca mora em placeholder nem em tooltip fechado** — placeholder carrega número, não
  promessa. Se o desenho recolher o corpo, o que fica visível tem que ser suficiente para o vendedor saber
  que algo está errado no preço.
- **Nenhum número é inventado nem arredondado para caber.** Se `R$ 6.000.061,60` não cabe, o layout cede,
  nunca o número.
- **Contraste medido contra o fundo real do bloco** (fundo tonal suave, não o fundo da página), nos dois
  temas.

## Armadilhas já pagas neste projeto

- **Overflow horizontal medido, nos dois eixos.** A seção Shopee mediu 1248px de altura a 360px, com 48%
  dela ocupada por dois avisos — foi o que obrigou a criar o alerta compacto. Um bloco de aviso é a peça
  que mais cresce quando ninguém mede.
- **Texto ocluso passa em teste.** `toBeVisible` aprova um aviso empurrado para fora da coluna. Layout aqui
  se prova com caixas, não com asserção de texto.
- **Número grande quebra no meio do dígito** antes de a página estourar — foi exatamente o que aconteceu
  com os cartões de preço a 360px. O aviso de custo absurdo é justamente o que carrega o maior número da
  tela.
- **Frase cortada por sufixo** — uma frase de honestidade já foi clipada por viver num elemento estreito.
  Estes textos precisam de largura total.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. **Estado ausente** — o rodapé de resultado limpo, para referência de contraste (390px).
2. **Um aviso** — preço zero, 390px e 1280px.
3. **Vários avisos** — custo absurdo + gramas absurdas + atacado acima do varejo, no pior caso a 360px.
4. **Aviso vs. recusa** — lado a lado: o bloco de resultado com aviso e o bloco `danger` "Confira os campos
   destacados para ver o preço.", provando que se lêem como coisas diferentes.
5. **Variante compacta**, se você propuser uma: fechada e aberta.

Reutilize os primitivos existentes, nomeando-os: o bloco é `tf-alert` (com a variante `tf-alert--compact`
quando couber, ícone `info` de 20px, corpo em `--fs-body-sm`); as cifras dentro do detalhamento são
`tf-breakdown-row`; os cartões finais são `tf-price-hero` (tons `accent` e `energy`, tamanho `md`,
centralizados); o detalhamento vive dentro de um `tf-card` com padding `md`; qualquer detalhe recolhido usa
o `tf-info-tip` da casa (já é acessível por teclado e toque). **Não crie um primitivo novo** — se a peça
precisar de um tom que o `tf-alert` não tem, diga isso explicitamente como uma variante nova do `tf-alert`
(ex.: `tf-alert--warning` sobre `--tf-warning-soft`), não como um componente inédito.

## Perguntas em aberto para o dono

1. **Estes avisos devem ter um tom próprio, entre `info` e `danger`?** O DS já tem os tokens laranja
   (`--tf-warning` / `--tf-warning-soft`) mas nenhum tom de alerta os usa, e falta o par de texto
   (`--warning-text`). Criar `tf-alert--warning` daria a estes avisos o peso que o `info` não dá **sem**
   fazê-los parecer recusa — mas é uma variante nova no DS, e a decisão é sua.
2. **Preço zero merece tratamento diferente de custo absurdo?** Preço zero significa "isto não pode ser
   anunciado" e custo absurdo significa "isto provavelmente está errado". Hoje os dois têm exatamente o
   mesmo peso e podem cair no mesmo parágrafo.
3. **O aviso de atacado deve continuar entre o detalhamento e os cartões de preço, ou juntar-se aos demais
   num único lugar acima do detalhamento?** Hoje estão separados e nada explica por quê.
4. **O aviso deve poder apontar para o campo suspeito** (um "ver campo" que rola até ele)? O módulo já
   sabe qual campo causou cada aviso de faixa, mas o aviso de resultado, por definição, não tem campo
   culpado — e um link que leva a lugar nenhum é pior que nenhum link.
