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

- **Onde vive:** O ÚLTIMO bloco de dentro do cartão de canal, abaixo da linha dos selos de vigência — e só quando o marketplace do cartão é Shopee.
- **Como o vendedor chega:** O vendedor escolhe Shopee no select do topo do cartão. O aviso compacto aparece imediatamente e nunca some; o outro só acende na combinação CPF + mais de 450 pedidos + preço abaixo da faixa publicada.
- **Vizinhança imediata:** Acima: a linha `flex-wrap` com o selo de vigência (e possíveis selos de estimativa/taxa fixa). Os dois avisos têm FORMAS diferentes e ficam empilhados com gap: primeiro o alerta completo (título + corpo, tom informativo) da tarifa não publicada, depois o alerta COMPACTO de uma linha (ícone + título curto + um ⓘ que guarda o corpo inteiro) do frete aferido. Abaixo: o fim do Card — o próximo cartão de canal ou o botão 'Adicionar canal'.
- **Dados que chegam (e o que ela devolve):** O primeiro depende do resultado do canal (o motor recusou precificar aquela faixa); o segundo é estático, uma nota de risco permanente de qualquer canal Shopee.
- **O que acontece depois:** Nenhum dos dois bloqueia nada — o cálculo segue. O caso que acende o primeiro é o mesmo que faz o bloco daquele canal, no rodapé, aparecer sem preço.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)

## O que desenhar
Dois avisos informativos que fecham o cartão de um canal Shopee dentro da calculadora de preço. O
vendedor está preenchendo o slot do marketplace (comissão, taxa fixa, frete, tipo de vendedor,
volume de pedidos) e, logo abaixo da grade de taxas, das legendas de faixa e do selo de procedência,
o produto admite duas coisas que não sabe: (1) que a Shopee **não publica** a fórmula de uma taxa
regressiva que atinge exatamente este vendedor neste preço, e (2) que o **frete aferido** pela
transportadora pode gerar uma recobrança retroativa que o cálculo não modela. O primeiro é
condicional (só aparece na combinação CPF + alto volume + preço que o motor recusou precificar); o
segundo é estático — está sempre lá em qualquer slot Shopee, mesmo depois de o vendedor editar tudo.
São as duas frases em que a marca cumpre a promessa de "verdade forjada": preferir dizer "não sei" a
entregar um número inventado.

## Por que este prompt existe
Nunca houve desenho: `autoridade: NENHUMA`. Nenhum protótipo cobre "taxa não publicada" ou "frete
aferido" — as duas únicas menções à Shopee no `claude-design-prototype.md` a listam como opção de
canal com taxa fixa + comissão. Foi **inferido sem desenho**: (a) que o aviso do frete vira uma linha
compacta com o corpo escondido atrás de um ⓘ, (b) que o tom dos dois é `info` e não perigo, (c) que
ambos vivem colados no fim do slot, e (d) que dois avisos com o mesmo peso de verdade podem ter
**formas diferentes** na mesma tela. A forma compacta em si é legítima — o dono a usou no canvas
`Abas-Desktop.dc.html` (aba Orçamentos, "1 registro(s) pendente(s) neste dispositivo") —, mas ela
nasceu de uma **medição de altura** em 016/PR-F, não de uma decisão de hierarquia: a seção Shopee
media 1248px a 360px e os dois avisos ocupavam 48% dela. Ou seja: uma admissão de ignorância foi
espremida por falta de espaço, e ninguém desenhou quanto ela deve pesar.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual dentro do cartão do canal, de cima para baixo: grade de taxas → legenda de faixa
("Tabela por faixa de preço — valores da faixa do seu anúncio.") → legenda do subsídio de frete →
checkboxes de sobretaxa → selo de procedência → **os dois avisos**, com 8px entre eles.

| Peça | Forma hoje | Condição para aparecer |
|---|---|---|
| Aviso da taxa regressiva | Alerta completo, tom `info`: ícone ⓘ + título em semibold + corpo longo (~370 caracteres) sempre visível | Canal = Shopee **e** "Pessoa física (CPF)" **e** "Mais de 450 pedidos nos últimos 90 dias? = Sim" **e** o motor recusou precificar algum nível (preço fora de toda faixa publicada) |
| Aviso do frete aferido | Linha compacta de uma só altura: ícone ⓘ + título curto + botão ⓘ (InfoTip) que guarda o corpo num popover | Sempre, em qualquer slot Shopee — nunca some |

Textos literais em pt-BR, homologados, que o desenho deve usar **sem reescrever**:

- Título 1: **"A Shopee não publica a fórmula completa desta taxa"**
- Corpo 1: **"Para vendedores CPF com mais de 450 pedidos nos últimos 90 dias, a Shopee cobra uma
  taxa adicional regressiva abaixo de R$ 12,00 — mas só divulga dois pontos: “um produto de R$10 tem
  uma taxa de R$6,50, enquanto um de R$8 terá taxa de R$6”. Sem a fórmula completa, não aplicamos
  nenhuma estimativa — informe a taxa manualmente se precisar calcular este preço."**
- Título 2: **"Frete aferido pode gerar cobrança retroativa"**
- Corpo 2 (hoje dentro do popover): **"Se o peso ou as dimensões cadastrados forem menores que os
  aferidos pela transportadora, a Shopee pode recobrar a diferença depois da entrega. Isso não entra
  no cálculo — é um risco a considerar ao cadastrar o anúncio."**
- Rótulo acessível do gatilho ⓘ: **"Sobre o frete aferido"**

→ Problema 1: **duas verdades da mesma natureza, com dois pesos visuais diferentes**, e o motivo é
espaço, não importância. O desenho precisa decidir a hierarquia entre elas de propósito.
→ Problema 2: o corpo 1 é um bloco corrido de ~370 caracteres com uma citação entre aspas curvas
dentro. A 390px isso vira 8–10 linhas de parede. A citação dos dois pontos oficiais (R$ 10 → R$ 6,50;
R$ 8 → R$ 6,00) é o dado mais concreto da frase e está enterrada no meio do parágrafo.
→ Problema 3: o corpo 2 está **atrás de um clique**. Uma admissão de risco financeiro só é lida por
quem tocar no ⓘ; quem não tocar leva só o título.
→ Problema 4: os dois avisos aparecem depois do selo de procedência, no fim de um cartão longo — bem
longe do campo "Comissão", que é onde a ação pedida pelo aviso 1 ("informe a taxa manualmente")
acontece.

## Conteúdo e dados reais
- Os dois pontos oficiais são **verbatim da fonte** (art. 26839) e não podem ser reformulados,
  arredondados nem completados: R$ 10,00 → taxa R$ 6,50 · R$ 8,00 → taxa R$ 6,00. O limite da faixa
  é **R$ 12,00**; o gatilho de volume é **450 pedidos em 90 dias**.
- A fórmula linear que "encaixa" nesses dois pontos é **deliberadamente inexistente** no produto. O
  desenho não pode sugerir um gráfico, uma curva, uma interpolação nem um "valor estimado".
- Campos do formulário que compõem a condição, com os rótulos reais: **"Você vende como"**
  (Pessoa física (CPF) / Pessoa jurídica (CNPJ)) e **"Mais de 450 pedidos nos últimos 90 dias?"**
  (Sim / Não).
- O que o vendedor vê no lugar do preço quando o motor recusa: **"Sem tarifa publicada para a faixa
  de preço deste anúncio — informe a comissão do canal para precificar."** e o selo **"sem
  referência — informe as taxas"**. O aviso 1 é o *porquê* dessas duas frases; hoje nada os liga
  visualmente.
- Nenhum dos dois avisos bloqueia o cálculo, nenhum tem botão de ação, nenhum é dispensável (não há
  "×" para fechar), nenhum tem número calculado pelo produto.

## Estados obrigatórios
- **Aviso 1 ausente** (o caso mais comum): CNPJ, ou volume "Não", ou preço dentro de faixa publicada
  — só o aviso 2 existe no fim do cartão. Desenhe esta prancheta: é o repouso real.
- **Aviso 1 presente**: as três condições verdadeiras ao mesmo tempo, junto com o slot já mostrando
  "Sem tarifa publicada…" e o selo "sem referência". Os três precisam ler como uma explicação só.
- **Aviso 1 aparecendo por edição**: o vendedor troca "Você vende como" para CPF e o aviso surge
  entre o selo e o aviso 2. Mostre como a chegada é percebida sem empurrar a tela inteira de susto.
- **Aviso 2 em repouso**: título visível, corpo (onde quer que ele fique) no seu estado padrão.
- **Aviso 2 com o detalhe aberto** — se o desenho mantiver o ⓘ: popover com o corpo completo,
  ancorado ao gatilho, sem cobrir o campo que o vendedor acabou de editar.
- **Foco de teclado** no gatilho ⓘ: anel visível sobre o fundo tingido do alerta (o alerta info tem
  fundo próprio; o anel precisa contrastar contra ELE, não contra o fundo da página).
- **Hover / pressionado** do gatilho ⓘ (em ponteiro fino ele abre no hover; em toque só no toque).
- **Vendedor sem premium / free**: os avisos são conteúdo do cálculo aberto, não recurso premium —
  mostre que eles **não** ganham cadeado nem selo de assinatura.
- **Offline**: os dois textos são estáticos e continuam idênticos sem rede. Nada de spinner, nada de
  "não foi possível carregar" — não há nenhum estado de carregamento aqui, e não deve haver.

## Viewports
- **Mobile 390px — obrigatório.** É o viewport que criou a compressão (a medição original foi a
  360px). Desenhe os dois avisos no fim do cartão do canal, com o selo de procedência visível acima
  para dar a escala real de quanto do cartão eles ocupam.
- **Desktop 1280px — obrigatório.** O cartão do canal é largo; o título 2 cabe folgado numa linha e
  ainda sobra medida. A pergunta que o desenho responde aqui é se o corpo 2 ainda precisa ficar
  escondido quando existe espaço para ele — a compressão foi resposta a uma medição de mobile.
- 1920px não é necessário: o cartão do canal tem largura máxima e o resultado repete o de 1280px.

## Regras que o desenho não pode quebrar
- **Nunca fabricar número.** Nenhuma estimativa, faixa "de R$ X a R$ Y", barra de progresso ou
  gráfico dos dois pontos. Os dois pontos são citação, não série de dados.
- **A frase honesta vive em elemento de largura total**, nunca como sufixo de placeholder nem dentro
  de um campo — esta regra foi paga em 016/PR-F, quando um sufixo cortou para "2,50 (= 50".
- **Tom informativo, não alarme.** Nada aqui está errado nem quebrado: são riscos e lacunas de fonte.
  Vermelho de perigo mentiria tanto quanto esconder.
- **Ausência não é silêncio.** Se o desenho tirar o corpo 2 de trás do ⓘ, ele não pode encurtar a
  frase até virar um aviso sem conteúdo; se mantiver o ⓘ, o gatilho precisa parecer clicável e ter
  alvo ≥44px.
- **Falha de rede jamais aparece como restrição de plano** e nada aqui muda com entitlement.
- Contraste ≥4.5:1 do título e do corpo **medido contra o fundo tingido do alerta**, nos dois temas.

## Armadilhas já pagas neste projeto
- **Altura medida, não estimada**: a seção Shopee media 1248px a 360px e estes dois avisos eram 48%
  dela. Se o desenho devolver corpo visível ao aviso 2, precisa devolver altura em outro lugar —
  diga onde.
- **Placeholder que corta a frase honesta** (016/PR-F): frase de honestidade só em bloco próprio.
- **Overflow horizontal medido**: "R$ 12,00" e as aspas curvas “ ” no meio do corpo 1 não podem
  quebrar de forma a deixar um símbolo órfão na linha; a citação inteira deve ler como uma unidade.
- **Texto ocluso passa em teste**: um alerta empurrado para fora do cartão ou coberto por um popover
  ainda "existe" para o código. Desenhe as caixas onde elas realmente caem.
- **InfoTip vs. Escape** (016/PR-C): o popover fecha no Escape e não pode reabrir sozinho — o estado
  fechado depois do Escape é um estado de desenho, com o gatilho ainda focado.

## Entregável
Pranchetas, tema escuro como padrão e tema claro como first-class (as duas versões de cada):
1. **390px — repouso**: fim do cartão do canal Shopee com selo + só o aviso 2.
2. **390px — condição completa**: "Sem tarifa publicada…" + selo "sem referência" + aviso 1 + aviso 2,
   mostrando a hierarquia proposta entre os dois.
3. **390px — detalhe do frete aberto** (ou a alternativa que o desenho propuser no lugar do ⓘ).
4. **1280px — os dois avisos no cartão largo**, evidenciando o que muda com medida sobrando.
5. **Um quadro de anatomia** do aviso 1: como a citação dos dois pontos oficiais se destaca dentro do
   corpo sem virar tabela nem sugerir interpolação.

Reutilize os primitivos existentes, sem criar novos: `tf-alert` com `tf-alert--info` para o aviso 1
(ícone `info`, `tf-alert__title` + `tf-alert__text`); `tf-alert--info tf-alert--compact` para a linha
de uma altura, se ela sobreviver ao desenho (é a mesma variante do canvas de Orçamentos do dono);
`InfoTip` (Radix Popover skin da casa) para qualquer detalhe revelado; `FeeSeal`/`tf-badge` para o
selo acima, que entra só como contexto. Se o desenho concluir que o aviso 2 precisa voltar a ser um
alerta completo, diga isso explicitamente e mostre a altura resultante — não deixe implícito.

## Perguntas em aberto para o dono
1. **Peso relativo**: os dois avisos devem ter a mesma forma (ambos completos, ou ambos compactos com
   detalhe sob demanda), ou é correto que o condicional pese mais que o permanente? A regra atual
   ("o que é raro grita, o que é constante sussurra") nunca foi escrita nem ratificada.
2. **O aviso 2 pode ser dispensável?** Ele é estático e se repete em todo slot Shopee — um vendedor
   que abre cinco slots lê a mesma frase cinco vezes. Pode aparecer uma vez por página, ou por
   sessão, ou virar item permanente de um lugar de "riscos do canal"?
3. **Proximidade da ação**: o aviso 1 pede "informe a taxa manualmente", mas nasce no fim do cartão,
   longe do campo "Comissão". Ele deve migrar para junto da grade de taxas (ou ancorar-se ao campo)
   mesmo isso quebrando a ordem "avisos por último"?
