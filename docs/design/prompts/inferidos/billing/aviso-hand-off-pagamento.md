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

## O mapa funcional de Billing, planos e Conta

### Billing, planos e Conta — o mapa da área

**Quem chega aqui e para quê.** A Conta é a 5ª e última aba do app (barra inferior no celular ≤425px; barra lateral de 240px — ou um trilho de 76px — em qualquer largura acima disso). O vendedor chega por três portas: (1) tocando na aba **Conta** para ver quem está logado, trocar o tema, sair ou conferir o plano; (2) vindo de um **teaser Premium** de outra tela (Simulações, "Usar do catálogo", Catálogo, Kits, Orçamentos) — todo botão "Assinar Premium" desses teasers é um link para `/conta?assinar=1`, que abre a oferta já montada; (3) **voltando do Mercado Pago** depois de pagar, na URL `/conta?checkout=retorno` (o `back_url` real do MP).

**Rotas.**
- `/conta` — a página: cabeçalho "Conta" e uma grade. No celular é **uma coluna** na ordem: identidade → plano (+ oferta, que vai para a gaveta) → tema → privacidade → Sair. A partir de **1280px** vira **três colunas** (1.15fr · 1fr · 0.85fr): coluna 1 = identidade + plano + **oferta inline**; coluna 2 = tema; coluna 3 = privacidade + Sair.
- `/conta?assinar=1` — mesma página, com a oferta aberta (gaveta lateral no estreito; cartão inline no desktop).
- `/conta?checkout=retorno` — a página **inteira** é substituída: sobra o cabeçalho "Conta" e um único cartão centrado de retorno do checkout. A grade de três colunas nem monta.
- Portas vizinhas usadas daqui: `/sign-in?redirect=…` (deslogado), `/calcular` (destino do sucesso) e a superfície do **Mercado Pago**, aberta fora do app (nova aba) para gerenciar/atualizar cartão.

**O que a área guarda e de onde lê.** Nada de dinheiro vive no cliente. A Conta **compõe duas verdades do servidor**: o *ledger de entitlement* (`GET /entitlement` → `none | active | lapsed`, mais origem e validade — é ele que decide se há Premium) e o *espelho do PSP* (`GET /billing/subscription` → plano mensal/anual, status, fim do período, carência). O entitlement é **cacheado no aparelho por uid** (sobrevive a boot offline) e, quando servido do cache, a legenda ganha o sufixo "· última informação do servidor". A assinatura **não** é cacheada: sem resposta, o painel cai para o que o entitlement diz. Preços (R$ 15,99/mês · R$ 155,88/ano) vêm de **uma única constante de produto** — dois preços diferentes na mesma tela é bloqueador de release. O cartão nunca passa pelo app: o "Assinar" cria um checkout no servidor e **manda o navegador embora** para o MP.

**Do que depende e o que alimenta.** O Premium não é uma chave local: quem grava o acesso é o **webhook verificado do MP** (ou a reconciliação), nunca o clique. Por isso o retorno do checkout **sonda** o servidor por ~45s (15 tentativas de 3s) e não promete nada antes. Ligado o Premium, ele destranca tudo que o resto do app chama de "salvar": catálogo (filamentos, impressoras, produtos), kits, orçamentos congelados, exportação PDF/CSV e as simulações de marketplace da calculadora. Calcular continua grátis e ilimitado, sempre — inclusive offline, pelo motor `pricing-core` que roda no aparelho.

**Como a área muda por estado.**
- **Grátis** (nunca pagou): selo neutro "Gratuito", botão "Assinar Premium" na linha do plano; no desktop a oferta já aparece aberta na coluna do plano.
- **Premium ativo**: selo verde "Premium" + "Plano anual · renova em 01/09/2026", ações "Gerenciar assinatura" (leva ao MP) e "Cancelar assinatura" (nosso diálogo). A oferta não é oferecida.
- **Carência** (renovação recusada, prazo correndo): selo **continua verde** — o Premium *está* ativo —, mas legenda e nota falam em tom de cautela e "Atualizar forma de pagamento" vira a ação principal.
- **Cancelamento agendado**: selo verde, "ativo até {data} · não renova", nota de que nada é apagado, e "Assinar novamente".
- **Cortesia/beta** (acesso concedido por operador): selo verde igual ao do assinante, legenda "cortesia · expira em {data}" e **nenhuma ação**.
- **Premium pausado** (todo grant caducou): selo neutro, "Seus itens salvos continuam disponíveis para leitura." + "Assinar novamente". Em todo o app, escrever fica bloqueado e ler continua.
- **Offline**: as legendas do plano ganham o sufixo de dado defasado; a oferta e o checkout falham com frase honesta ("nada foi cobrado"); o cálculo segue funcionando; escritas feitas offline entram na fila (outbox) e drenam depois.
- **Sessão expirada**: o cartão de identidade troca por uma tarja de erro, e o shell exibe uma faixa fixa "Sua sessão expirou · Entrar de novo".

## O ponto exato de inserção desta peça

- **Onde vive:** As DUAS últimas linhas do painel de oferta, dois parágrafos consecutivos e idênticos em estilo (`tf-billing-offer__notice`, ~13px, cinza `--text-muted`), imediatamente ABAIXO do botão "Assinar Premium": primeiro "Você paga no Mercado Pago (Pix ou cartão).", depois "O cartão nunca passa pelo nosso app.". Aparecem nos dois lugares em que a oferta existe: dentro da gaveta lateral (mobile) e dentro do cartão "Assinar o Premium" na coluna do plano (desktop ≥1280px).
- **Como o vendedor chega:** Sem gesto próprio: o vendedor rola até o fim da oferta, ou lê de relance enquanto decide tocar no botão de compra. É a última coisa da superfície.
- **Vizinhança imediata:** Acima delas: o botão "Assinar Premium" (e, quando há erro de checkout, a tarja vermelha que se insere ENTRE o botão e estas frases, empurrando-as para baixo). Acima do botão, os dois cartões de plano. Abaixo: nada — são o fim do painel; na gaveta, o fim do conteúdo rolável; no desktop, o fim do cartão e da coluna 1. Não há ícone, logo do Mercado Pago, cadeado nem qualquer selo de segurança em nenhuma das duas.
- **Dados que chegam (e o que ela devolve):** Texto fixo, sem dado dinâmico; nenhum ativo de marca do provedor é carregado. Elas são a única declaração, na tela de decisão de compra, de quem processa o pagamento e de que o app não vê o cartão — e a promessa é literal: o checkout é hospedado pelo MP e o app só recebe de volta a confirmação do servidor.
- **O que acontece depois:** Nada é acionável: são texto. O que elas prometem se cumpre no clique do botão logo acima — o navegador sai do app para o MP e volta em `/conta?checkout=retorno`.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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
