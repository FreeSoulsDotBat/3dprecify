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

- **Onde vive:** No slot da DICA de um campo, entre o rótulo/controle e a mensagem de erro. Aparece em oito campos: gramas usadas, consumo médio, tarifa de energia, peso do rolo, reserva de manutenção, valor da hora de mão de obra (todos na coluna esquerda), tempo de impressão e vida útil da máquina (no bloco da máquina) — além da comissão, dentro do cartão de canal.
- **Como o vendedor chega:** Surge enquanto o vendedor digita, no instante em que o valor sai da faixa plausível. Ele não pediu e não pode fechar.
- **Vizinhança imediata:** Ocupa a linha imediatamente abaixo do controle; quando o campo também tem dica, a dica é empurrada para uma linha própria logo abaixo. Some por completo quando existe um erro de verdade, porque o erro toma esse mesmo slot.
- **Dados que chegam (e o que ela devolve):** Uma faixa por campo, avaliada sobre o texto cru digitado; devolve uma frase ou nada.
- **O que acontece depois:** Nada é bloqueado — o cálculo continua com o valor digitado. É uma terceira categoria de mensagem (nem dica, nem erro) distinguida hoje apenas pela cor do texto, sem ícone e sem título. Os mesmos avisos aparecem no editor de linha de kit, que monta os mesmos campos.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Aviso de plausibilidade — a mensagem que avisa sem recusar

## O que desenhar
A terceira categoria de mensagem de campo do Precifica3D: nem dica, nem erro. Ela aparece embaixo de um campo da tela **Calcular** quando o vendedor digita um número **perfeitamente válido que provavelmente significa outra coisa** — 120 no campo que pede kW (a etiqueta da impressora fala em watts), 3 no campo de vida útil que pede horas (ele pensou em anos), 0,12 no campo de comissão que pede 12. Nada é recusado: o formulário continua calculando e continua salvando. Quem a vê é o vendedor leigo, no meio da digitação, e é exatamente ele quem não vai reparar numa linha de texto pequena que só muda de cor. Desenhe **a categoria inteira**: o aviso num campo, o aviso convivendo com a dica do mesmo campo, o aviso morrendo quando entra um erro de verdade, três avisos ao mesmo tempo no formulário, o aviso de resultado (que hoje é outro componente) e o aviso na linha de peça de um kit.

## Por que este prompt existe
A peça nasceu em 2026-08-13 corrigindo nove achados de severidade ALTA de uma homologação automatizada, e nasceu **sem nenhum desenho**: a matriz de estados do design system só tem `error`, e os três documentos de correção pedem sempre *validação inline* — recusa, nunca aviso. Grep por "aviso"/"plausib" nas quatro autoridades de desenho: zero. O canvas 018 usa a palavra duas vezes, mas ali "peças com aviso" são peças **inválidas** de um kit, renderizadas em `tf-alert--danger` — é erro com outro nome. Ou seja: a defesa principal do usuário leigo contra erro de casa decimal foi inferida por uma IA e hoje existe como **uma cor de texto no lugar da dica, sem ícone, sem título, sem afordância**. Autoridade de desenho: NENHUMA.

## O que já existe hoje (não invente do zero — corrija)
O aviso ocupa o **slot da dica** do campo. Regras reais do código (`shared/ui/field.tsx`, `field.css`, `features/calculator/calculator-form.tsx`):

| Situação | O que a tela faz hoje |
| --- | --- |
| Campo com aviso, sem dica | uma linha de texto na cor `--info-text`, tamanho legenda, no lugar da dica |
| Campo com aviso **e** dica | a dica ganha linha própria e o aviso entra abaixo, com `space-1` de respiro |
| Campo com aviso **e** erro | → **o aviso some**: o `Field` troca a dica pelo erro. Só a recusa aparece |
| Aviso no resultado (preço zerado / custo absurdo) | um `tf-alert--info` de largura cheia, **com ícone**, texto de duas frases coladas |
| Aviso de quantidade na peça de kit | um parágrafo solto, fora do `Field`, em `text-sm` (maior que o do formulário) |

→ **Três problemas que o desenho tem de resolver.** (1) O aviso e a dica são o mesmo objeto visual, distintos só pela cor: quem lê rápido lê "mais uma explicaçãozinha cinza-azulada". (2) A mesma categoria fala em **duas línguas visuais** — no campo é texto puro sem ícone; no resultado é um `tf-alert--info` com ícone; na linha de kit é um terceiro tamanho. (3) As frases têm 150–230 caracteres em tamanho de legenda; com três campos avisando ao mesmo tempo, a seção "Energia" vira um muro de texto azul que ninguém lê.

→ Detalhe de acessibilidade lido no código: o aviso entra no `aria-describedby` do campo (é descrição, não status), então **ele não é anunciado quando aparece** — e ele aparece a cada tecla digitada, sem espera pelo `blur`. Quem digita `1200` passa por `120` e vê o aviso piscar no meio do caminho.

## Conteúdo e dados reais
As frases são homologadas e obedecem a três regras já decididas: **descritiva, nunca corretiva**; **toda frase termina em "Nada foi recusado."**; **toda frase ensina a converter**. Use-as literais no desenho (`{v}` = o valor digitado):

- Consumo médio (kW, obrigatório) → *"Confira o consumo: 120 kW. Acima de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer watts: 120 W são 0,12 kW. Nada foi recusado."* Este campo **também tem dica**: *"Consumo médio real da impressora, não a potência de placa (~0,12 kW)."* — é o caso "dica + aviso juntos".
- Tarifa de energia (R$ /kWh, obrigatório) → *"Confira a tarifa: R$ 12 por kWh está bem acima do que se paga no Brasil (perto de R$ 0,85). Na conta de luz, divida o valor total pelos kWh do mês. Nada foi recusado."*
- Vida útil da máquina (h, obrigatório, **só existe no modo manual** — no modo "ritmo" o campo nem é montado) → *"Confira a vida útil: 3 horas é menos de uma semana ligada. Se você pensou em anos, multiplique pelas horas que imprime por ano — 1.200 h/ano × 3 anos = 3.600 h. Nada foi recusado."*
- Peso do rolo (kg, obrigatório) → *"Confira o peso do rolo: 1.000 kg. O rolo comum tem 1 kg — se você informou gramas, 1.000 g são 1 kg. Nada foi recusado."*
- Gramas usadas (g, obrigatório) → *"Confira as gramas: 60.000 g são mais de 50 kg de filamento numa peça só. Se você informou o peso do ROLO, o campo pede o que a PEÇA consome. Nada foi recusado."*
- Tempo de impressão (h + min, obrigatório) → *"Confira o tempo: 150 horas equivalem a 6,3 dias imprimindo sem parar. Se você quis dizer minutos, use o campo de minutos ao lado. Nada foi recusado."* (a frase mais longa da lista, e a de maior valor: 150 h por engano multiplica o custo por 15).
- Valor da hora (R$ /h, opcional) → *"Confira o valor da hora: R$ 3.000. Se você informou quanto quer ganhar por mês, divida pelas horas do mês — R$ 3.000 ÷ 160 h = R$ 18,75. Nada foi recusado."*
- Reserva de manutenção (R$ /h, opcional) → *"Confira a reserva de manutenção: R$ 1.200 por HORA. Se você informou o gasto do ano inteiro, divida pelas horas que imprime no ano. Nada foi recusado."*
- Comissão (%, opcional, dentro do cartão de canal) → *"Confira a comissão: 0,12%. Marketplaces costumam cobrar entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi recusado."*
- Quantidade (peça de kit) → *"Confira a quantidade: 3.000.000.000. O máximo por peça é 2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."*
- No **resultado**, sem campo culpado: *"O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado."* e *"Confira os custos: R$ 6.000.061,6 para uma peça é muito acima do que costuma acontecer. Normalmente é uma casa decimal a mais em algum campo. Nada foi recusado."* → hoje as duas frases são **concatenadas num único parágrafo** quando disparam juntas.

→ Repare no dinheiro: a formatação do valor digitado descarta os centavos — sai **"R$ 6.000.061,6"** e **"R$ 3.000"**, e não `R$ 6.000.061,60`. Está fora do padrão de dinheiro do produto; trate no desenho como texto a corrigir, não como fatalidade.

Textos de recusa que **substituem** o aviso, para o quadro de contraste: *"Informe um número válido."*, *"Não pode ser negativo."*, *"Campo obrigatório."*, *"A vida útil deve ser maior que zero."*, *"A comissão deve ser menor que 100%."*, *"O peso do rolo deve ser maior que zero."*

## Estados obrigatórios
1. **Repouso sem aviso** — campo normal, dica cinza (quando existe). É a linha de base contra a qual o aviso precisa se destacar.
2. **Aviso simples** — campo válido, valor implausível, sem dica. Ex.: Peso do rolo com 1.000.
3. **Aviso + dica** — Consumo médio: a dica em cinza numa linha, o aviso abaixo. As duas precisam ser distinguíveis sem ler.
4. **Aviso com o campo em foco** — o aviso aparece enquanto se digita; mostre como ele convive com o anel de foco e com o teclado virtual no mobile.
5. **Erro de verdade** — o aviso desaparece e entra a recusa em vermelho. Desenhe lado a lado com o estado 2 para provar que **aviso ≠ erro** no relance.
6. **Três avisos simultâneos** — a seção de Energia + a de Máquina avisando juntas. É o estado que ninguém desenhou e o que mais assusta.
7. **Aviso de resultado** — o bloco de largura cheia junto ao preço, com preço R$ 0,00; e a variante com as duas frases (preço zero + custo absurdo).
8. **Aviso na linha de peça de um kit** — o mesmo objeto visual dentro de um card menor, ao lado da legenda de custo da linha.
9. **Campo sem aviso possível** — modo "ritmo": a vida útil não é editável, então nem aviso existe. Mostrar para o desenho não presumir que todo campo tem o slot.
10. **Aviso com valor absurdamente longo** — "3.000.000.000" e "R$ 6.000.061,6" dentro da frase, no campo mais estreito.

## Viewports
- **Mobile 390px — obrigatório.** É onde o vendedor de verdade preenche, e onde a frase de 230 caracteres ocupa cinco linhas empurrando o campo seguinte para fora da dobra.
- **360px como teste de estresse** de uma prancheta só (o campo mais estreito, com o número mais longo): é a largura em que este projeto já mediu overflow horizontal duas vezes.
- **Desktop 1280px** — o formulário existe em duas colunas no desktop; o aviso não pode desalinhar a linha em que dois campos dividem a largura (a etiqueta já reserva duas linhas justamente para manter os inputs alinhados; o aviso, abaixo, é o novo risco).
Não precisa de 1920px: nada nesta peça muda entre 1280 e 1920 além da largura da coluna.

## Regras que o desenho não pode quebrar
- **Aviso nunca vira validação.** Nada de tom de recusa, nada de vermelho, nada que sugira que o campo foi rejeitado, nada que iniba o botão de salvar. É decisão registrada do dono, e a frase "Nada foi recusado." é essa promessa dita ao usuário — ela é obrigatória e **não pode viver dentro de um placeholder nem ser truncada com reticências**.
- **Aviso não é erro, e o desenho precisa provar isso sem cor**: se a única diferença entre os dois for a matiz, quem enxerga mal lê recusa onde não houve.
- **A frase ensina a converter** — o exemplo numérico ("120 W são 0,12 kW", "R$ 3.000 ÷ 160 h = R$ 18,75") é a parte útil da mensagem; não desenhe uma versão "resumida" que corte o exemplo.
- **Procedência do número**: o limiar tem origem real (5 kW = faixa de chuveiro; R$ 0,85/kWh = a mesma constante datada que o tooltip do campo usa). Se o desenho quiser mostrar o limiar, ele mostra o limiar — não inventa outro número.
- Qualquer afordância nova (fechar, "entendi", expandir) é **alvo de toque ≥ 44px** e não pode ficar por cima do campo.
- Contraste medido contra o fundo real do cartão nos **dois temas** — o azul de informação em texto de legenda é o candidato natural a reprovar.

## Armadilhas já pagas neste projeto
- **Frase honesta cortada**: já aconteceu de a frase de honestidade viver num elemento estreito e o sufixo sumir. "Nada foi recusado." é o fim de toda frase — é justamente o pedaço que um truncamento come.
- **Texto que passa no teste e não aparece na tela**: asserção de texto é cega a oclusão e a overflow. Desenhe caixas, não parágrafos soltos — e diga a altura máxima que o aviso pode ocupar antes de empurrar o resto.
- **Overflow horizontal medido a 360px** com número longo dentro da frase (hoje o texto quebra em qualquer ponto da palavra para evitar isso — no desenho, prefira que o número caiba).
- **Aviso que existe e nunca renderiza**: o aviso de vida útil ficou meses com limiar, frase e teste verdes e **nenhuma tela chamando** — porque o campo mora num controle próprio. Se o desenho tratar o aviso como propriedade do campo, deixe explícito que ele vale também para os campos "especiais" (tempo h+min, vida útil, comissão, quantidade de kit).
- **Um resumo que grita vira ruído**: um produto que avisa demais treina o vendedor a ignorar avisos. Se propuser um resumo no topo do formulário, ele tem de ser mais discreto que os avisos, não mais.

## Entregável
Pranchetas, tema **escuro por padrão e claro como first-class** (as duas versões de cada uma):
1. **Anatomia do aviso** — o objeto isolado, com e sem dica, medidas e hierarquia interna; ao lado, a mesma anatomia do erro, para o contraste ficar explícito.
2. **Campo em 390px** nos estados 2, 3, 4 e 5.
3. **Seção com três avisos simultâneos** em 390px (o muro de texto e a sua solução).
4. **Resultado com aviso** (preço R$ 0,00 e a variante de duas frases).
5. **Linha de peça de kit com aviso de quantidade.**
6. **Desktop 1280px** — a linha de dois campos em que só um avisa.
7. **Estresse 360px** com o número mais longo.

Reutilize os primitivos existentes, sem criar família nova: o campo é o `Field` (etiqueta + `labelAddon` do `?` + slot de mensagem); o texto do aviso é o slot de mensagem do próprio `Field`, não um bloco novo; o aviso de resultado é `tf-alert` no tom `info`; o ícone, se entrar, é o mesmo `Icon` do `tf-alert--info`; a cor é o token semântico de informação, nunca uma matiz crua. Se o desenho concluir que o aviso de campo precisa de ícone, **ele precisa ser o mesmo ícone do alerta de resultado** — a categoria é uma só.

## Perguntas em aberto para o dono
1. **Quando o campo tem erro E aviso, o aviso deve mesmo sumir?** Hoje some (a recusa come a dica inteira). É defensável, mas nunca foi decidido — e há o caso "vida útil = 0": a recusa diz "deve ser maior que zero" e a lição sobre anos×horas evapora.
2. **O aviso aparece a cada tecla ou só quando o vendedor sai do campo?** Hoje é a cada tecla, então ele pisca no meio da digitação de um número maior. Espera pelo `blur` é mais calma e chega mais tarde.
3. **O aviso pode ser dispensado ("entendi")?** E, se for, ele volta quando o valor é redigitado igual? Hoje não há nenhuma afordância — o aviso fica para sempre enquanto o número estiver lá.
4. **Com três ou mais avisos, existe algum resumo?** Um contador junto ao botão de calcular/salvar, uma marca na seção, ou nada — e, se existir, ele continua sendo aviso (não bloqueia o salvar).
5. **O aviso de campo ganha ícone, igualando-se ao de resultado, ou o de resultado perde o ícone, igualando-se ao de campo?** Hoje são duas línguas para a mesma categoria, e unificar é decisão de produto, não de layout.
