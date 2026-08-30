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

- **Onde vive:** O rodapé de largura total inteiro (`.tf-calc-footer`), na posição do resultado.
- **Como o vendedor chega:** O vendedor esvazia ou estraga um campo obrigatório em qualquer uma das duas colunas e, ao descer, encontra o rodapé trocado.
- **Vizinhança imediata:** No lugar de TODO o conteúdo do rodapé — detalhamento, 'Preços por canal', os dois cartões de preço, 'Salvar cenário' e 'Salvar no histórico' — fica um único alerta de tom perigo com a frase 'Confira os campos destacados para ver o preço.'. Acima dele continuam as duas colunas do formulário, intactas.
- **Dados que chegam (e o que ela devolve):** É a ausência de resultado: o motor não devolveu nada calculável a partir dos campos atuais.
- **O que acontece depois:** Corrigir o campo faz o rodapé inteiro voltar. A tela NÃO aponta qual campo causou o sumiço — o vendedor tem de procurar as marcações de erro nas colunas acima.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# "Não dá para calcular" — o rodapé de resultado quando o formulário está inválido

## O que desenhar

O estado da tela **Calcular preço** (aba Calculadora) no momento em que um campo obrigatório fica vazio,
com letra ou com um valor que a regra recusa (peso do rolo = 0, vida útil = 0, número negativo). Quem usa é
o vendedor no meio da digitação — ele veio à tela por causa da metade de baixo (o detalhamento "Como
chegamos no preço" e os dois cartões de preço), e é exatamente essa metade que muda de estado. A peça é o
bloco de rodapé inteiro (`.tf-calc-footer`), que atravessa as duas colunas no desktop e fecha a página no
mobile. O mesmo estado aparece em mais três lugares com o mesmo texto: a página cheia do produto, o editor
de linha de kit e o resumo de kit — o desenho vale para os quatro.

## Por que este prompt existe

Ninguém desenhou este estado: uma IA decidiu que a resposta a um input inválido é **apagar o resultado
inteiro** e pôr no lugar um único alerta vermelho. Pior, o desenho já tinha decidido o contrário e isso foi
verificado em render: o item 9 do `claude-design-prototype-fixes.md` manda "além do alerta, **zere TODAS as
linhas do breakdown**", e o `prototype-audit-2026-07-02.md` §V2 lista esse item entre os 20 corrigidos e
medidos ("peso=0 zeroes breakdown") — o protótipo `CalculatorScreen.jsx` mantinha os cartões de preço e as
linhas do detalhamento em 0,00 **com o alerta junto**. O código de hoje remove o bloco. Duas ressalvas
honestas: o protótipo só desenhou o caso peso do rolo = 0, e o código de hoje cobre qualquer invalidez do
formulário — então o desenho precisa decidir a regra geral, não só aquele caso.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual da tela, de cima para baixo: cabeçalho "Calcular preço" → o formulário em grade (uma coluna até
1024px, duas acima) com as seções "Custos da peça", "Mão de obra e custos", "Markup" e "Marketplace" → o
rodapé de resultado.

Rodapé no estado **válido** (o que existe e o que some):

| Bloco | Conteúdo real |
| --- | --- |
| Título de seção | "Como chegamos no preço" + botão ⓘ "Sobre o cálculo do preço" |
| Aviso de resultado | avisos de plausibilidade (ex.: "O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado.") |
| Card do detalhamento | linhas "Material", "Energia", "Máquina", "Falha / perdas", "Acabamento", "Mão de obra", cada item de "Outros custos" pelo nome, depois "Custo total" (ênfase total), "Preço varejo — markup 50%" (ênfase accent) e "Preço atacado — markup 30%" |
| Preços por canal | dentro do mesmo card, sob a legenda "Preços por canal": "Preço para anunciar" e "Recebido líquido" por canal |
| Dois cartões de preço | "Preço varejo" R$ 24,24 (tom accent) e "Preço atacado" R$ 21,01 (tom energy), rótulo/valor/legenda centralizados |
| Ações | "Salvar cenário" e o botão de gravar orçamento (ambos Premium; ausentes no plano gratuito) |

Rodapé no estado **inválido**, hoje: tudo isso acima é substituído por **um** alerta de tom `danger` com a
frase `"Confira os campos destacados para ver o preço."` — e só. O botão "Salvar cenário" continua ali,
desabilitado; o botão de gravar orçamento desaparece por completo.

→ **Problema 1**: o alerta promete "campos destacados", mas ele mora no fim da página e não aponta,
não lista e não leva a campo nenhum. No mobile o campo culpado costuma estar fora da tela, acima.
→ **Problema 2**: a tela inteira encolhe de repente (o rodapé passa de ~700px de conteúdo para uma tarja de
~60px) — o vendedor lê isso como "travou/quebrou", não como "falta preencher".
→ **Problema 3**: os avisos de plausibilidade moram DENTRO do bloco que some, então uma tela inválida
perde também os avisos honestos que ela mais precisaria mostrar.
→ **Problema 4**: a mesma frase aparece com tom `danger` em três telas e com tom `info` no resumo de kit —
um mesmo fato com duas temperaturas diferentes.

## Conteúdo e dados reais

Campos que podem derrubar o resultado inteiro (obrigatórios ou pré-preenchidos; em branco já é erro):
"Custo do rolo" (R$, ex.: R$ 100,00), "Peso do rolo" (kg, ex.: 1), "Gramas usadas" (g, ex.: 100), "Tempo de
impressão" (h/min, ex.: 5 h), "Consumo médio" (kW, ex.: 0,12), "Tarifa de energia" (R$/kWh, ex.: R$ 1,00),
"Valor da máquina" (R$, ex.: R$ 4.000,00), "Vida útil da máquina" (h, ex.: 3.600), "Markup varejo" (%,
ex.: 50) e "Markup atacado" (%, ex.: 30).

Campos **opcionais** — em branco valem 0 e nunca derrubam nada: "Reserva de manutenção", "Taxa de falha",
"Tempo de acabamento", "Valor do acabamento", "Mão de obra (horas)", "Valor da hora", "Outros custos".

Mensagens de erro literais, que aparecem sob o campo e **substituem a dica** dele: `"Campo obrigatório."`,
`"Informe um número válido."`, `"Não pode ser negativo."`, `"O peso do rolo deve ser maior que zero."`,
`"A vida útil deve ser maior que zero."`.

Contraste importante: um erro num **canal de marketplace** NÃO derruba o preço — aquele canal mostra
`"Corrija os campos deste canal para ver os preços."` e o resto da tela continua calculando. A mesma
degradação local existe para "Outros custos" (uma linha ruim erra sozinha). Só os campos de custo/markup
acima apagam tudo.

Números da semente (conferidos rodando o motor, não chutados): custo total **R$ 16,16**, varejo
**R$ 24,24**, atacado **R$ 21,01**. Use exatamente esses no estado válido de referência, e mostre o mesmo
cenário quebrado — por exemplo "Peso do rolo" apagado — no estado inválido.

## Estados obrigatórios

- **Válido (referência)** — o rodapé completo com R$ 24,24 / R$ 21,01, para comparação lado a lado.
- **Inválido, um campo** — o estado central deste prompt: o que fica visível no lugar do resultado, o que
  o alerta diz e como ele aponta o campo. Frase de hoje: "Confira os campos destacados para ver o preço."
- **Inválido, vários campos** — desenhe com 3 campos errados ao mesmo tempo; se a solução for listar os
  culpados, ela precisa aguentar 3 nomes sem virar parágrafo.
- **Campo em erro** — rótulo + controle + a mensagem literal ocupando o lugar da dica; e o mesmo campo em
  foco enquanto ainda está errado (anel de foco visível sobre a borda de erro).
- **Recuperação** — o instante em que o campo volta a ser válido: o resultado reaparece. Diga se ele
  reaparece inteiro de uma vez ou se há transição.
- **Premium pausado / plano gratuito** — no gratuito não existem "Salvar cenário" nem gravar orçamento;
  desenhe o rodapé inválido sem essas ações, para provar que ele não fica com um vazio pendurado.
- **"Salvar cenário" desabilitado** — é o estado real de hoje enquanto o formulário está inválido: um botão
  Premium desabilitado ao lado de um alerta vermelho, sem uma linha dizendo por quê.

## Viewports

- **Mobile 390px** — é onde o dano é maior: o rodapé é o fim de uma página longa, e o campo culpado está
  fora da tela. Desenhe com o teclado fora e o rodapé visível.
- **Desktop 1280px** — a partir de 1024px o formulário tem duas colunas e o rodapé atravessa as duas,
  centralizado e limitado a 720px de largura. É o corte do redesenho 018, então é o desktop que vale.

## Regras que o desenho não pode quebrar

- **Nenhum número inventado.** Se o desenho mantiver o detalhamento no lugar (item 9), cada linha precisa
  deixar claro que aquilo é um esqueleto sem cálculo — um "R$ 0,00" cheio de aparência de resultado é uma
  mentira pior que o sumiço. Zerar e **dizer que está zerado** é a única leitura aceitável.
- **Falha de preenchimento não é falha de rede nem de plano.** Nada aqui pode parecer "sem internet",
  "assine o Premium" ou "deu erro no servidor" — nada foi recusado por nós; falta um dado.
- **A frase honesta mora em elemento de largura cheia**, nunca dentro de um placeholder e nunca cortada.
- **O alerta tem que cumprir o que promete**: se o texto diz "campos destacados", o destaque tem que existir
  e ser alcançável a partir dali.
- **Alvo de toque ≥ 44px** em qualquer coisa clicável dentro do alerta; contraste medido contra o fundo real
  do card, nos dois temas.
- Precedente de tom já ratificado neste produto: o aviso de atacado acima do varejo é `info`, e a razão foi
  escrita em código — "quem lê um aviso escrito como erro conclui que o produto recusou". Aqui o produto de
  fato não calculou, mas a mesma leitura precisa ser considerada antes de pintar tudo de vermelho.

## Armadilhas já pagas neste projeto

- **Sumiço lido como quebra**: já aconteceu nesta mesma tela — a persona que acha que travou recarrega a
  página. O desenho precisa ocupar o espaço com algo que explique, não deixar um buraco.
- **Overflow horizontal medido, não olhado**: os cartões de preço já quebraram um número no meio do dígito
  a 360px; qualquer lista de campos culpados precisa quebrar linha, nunca empurrar a página.
- **Texto ocluso passa em teste**: um alerta correto atrás de um cabeçalho fixo, ou fora da viewport no
  momento em que aparece, é indistinguível de "certo" para qualquer asserção de texto — desenhe onde ele
  fica visível sem rolagem no mobile.
- **Frase cortada em placeholder**: nunca resolver o "qual campo" escrevendo a explicação dentro do campo.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como par de primeira classe**:

1. `390 · rodapé válido` (referência, R$ 24,24 / R$ 21,01).
2. `390 · rodapé inválido, um campo` — a proposta central.
3. `390 · rodapé inválido, três campos`.
4. `390 · campo em erro + foco` (recorte do formulário, mostrando o vínculo com o alerta).
5. `1280 · rodapé inválido` no rodapé centralizado de 720px, com o formulário de duas colunas acima.
6. `1280 · rodapé inválido, plano gratuito` (sem as ações Premium).

Reutilize os primitivos existentes, sem criar novos: `Alert` para a tarja (tom a decidir, ver perguntas),
`Card padding="md"` para o detalhamento mantido/zerado, a linha de detalhamento existente para
"Material/Energia/Máquina/Custo total", o cartão de preço existente para "Preço varejo"/"Preço atacado",
`Field` para os campos em erro (a mensagem entra no slot de erro que substitui a dica) e `Button` para
qualquer ação dentro do alerta. Marque em cada prancheta o que é novo em relação ao código de hoje.

## Perguntas em aberto para o dono

1. **Mantém o bloco zerado (item 9 do protótipo) ou mantém o sumiço de hoje?** O item 9 foi ratificado e
   verificado em render, mas só para "peso do rolo = 0". Zerar todo o detalhamento quando falta o "Custo do
   rolo" mostra "Material R$ 0,00" — um número que o motor nunca calculou. Vale para qualquer invalidez, só
   para as que zeram de verdade, ou o esqueleto aparece com traços ("—") no lugar dos valores?
2. **O tom é `danger` (vermelho) ou `info`?** Faltar preencher um campo é erro do vendedor ou etapa normal
   de digitação? O precedente do aviso de atacado escolheu `info` de propósito.
3. **O alerta deve nomear os campos culpados** ("Peso do rolo", "Tarifa de energia") e levar até eles ao
   toque? Se sim, qual a frase — a atual ("Confira os campos destacados para ver o preço.") deixa de ser
   verdade quando os campos passam a ser nomeados.
4. **"Salvar cenário" desabilitado continua visível** enquanto não há preço, ou some junto com o botão de
   gravar orçamento (que já some hoje)? Hoje os dois se comportam de formas diferentes sem motivo escrito.
