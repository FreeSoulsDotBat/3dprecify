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

- **Onde vive:** Dentro da gaveta lateral "Minhas simulações", aberta a partir da tela Calcular: logo abaixo do título da gaveta, ocupando o lugar EXATO onde a lista de simulações apareceria para quem é Premium. É o padrão fechado de teaser, com quatro elementos em ordem fixa e centrados: título → subtítulo → linha de preço + botão "Assinar Premium" → legenda de honestidade. Para quem tem acesso, no lugar disso vêm a descrição da lista e a lista em si.
- **Como o vendedor chega:** Pelo botão fantasma "Meus cenários" no alto da tela Calcular — uma entrada de NAVEGAÇÃO, visível para todo mundo, inclusive deslogado e grátis, posicionada logo abaixo do cabeçalho e alinhada à direita, acima do formulário.
- **Vizinhança imediata:** Acima, dentro da gaveta: o título da folha (a descrição da lista é suprimida no grátis, para não repetir a promessa que o subtítulo do teaser já faz) e o "X" de 44×44px. Por baixo do scrim, à esquerda: a tela Calcular inteira — e é aqui que vale a regra do CTA ÚNICO: enquanto esta folha está aberta, o teaser do "Usar do catálogo", que fica mais abaixo na mesma página, é REMOVIDO, para que nunca existam dois botões de compra na mesma tela.
- **Dados que chegam (e o que ela devolve):** Sessão + entitlement (`deslogado` ou `status = none` levam ao teaser; `lapsed` vê a lista em leitura). Título, subtítulo e legenda vêm de um registro único por funcionalidade; a linha de preço é montada da mesma constante de produto da oferta. O botão é um link comum para `/conta?assinar=1` (ou para `/sign-in` preservando esse retorno, se deslogado).
- **O que acontece depois:** Tocar em "Assinar Premium" TROCA de tela: sai da calculadora e vai para a Conta com a oferta já aberta — gaveta no mobile, cartão inline no desktop. Se a compra se confirma, voltar a abrir "Meus cenários" mostra a lista real no lugar exato onde o teaser estava.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# A oferta Premium dentro da gaveta "Minhas simulações"

## O que desenhar
A gaveta lateral que abre quando o vendedor toca em "Minhas simulações" na calculadora (`/calcular`) — só que
no caso de quem **ainda não tem Premium**. Para quem tem, essa gaveta é a lista de simulações salvas; para
quem não tem (deslogado, ou logado sem nenhuma assinatura), o mesmo painel mostra, no lugar da lista, a oferta
completa: título, promessa, preço real e o botão "Assinar Premium". É um painel sobreposto, ancorado à direita,
que ocupa a altura inteira da tela e escurece a calculadora atrás. O momento é o mais quente da jornada: o
vendedor acabou de calcular um preço, gostou, e foi procurar onde isso fica salvo. Descubra ali que a coisa é
paga. Precisa ser uma porta honesta, não uma parede.

## Por que este prompt existe
O bloco de teaser (`tf-premium-teaser`) está desenhado no canvas do 018 — três vezes. O que **nunca** foi
desenhado é ele **dentro de uma gaveta sobreposta**, nem o conteúdo específico de Simulações: o canvas cobre
Catálogo, Kits, Orçamentos e Conta, e não tem prancheta de Simulações. Motivo cronológico simples: o protótipo
de 2026-07-02 é dezoito dias anterior à E5, que criou as simulações salvas. Faltam três decisões que hoje são
código e não desenho: **a altura** (um bloco de ~220px de conteúdo dentro de um painel de altura total),
**a âncora do CTA** (ele fica colado no texto, no topo, com um vazio enorme embaixo) e **a regra do CTA único**
— hoje uma guarda em código (`showTeaserSlot && !scenariosOpen`) que apaga a outra oferta da página atrás.
Dois CTAs de compra empilhados na mesma tela já aconteceram **duas vezes** (E6/T038-D4 e 016/T010-A3), e as
duas foram consertadas por `if`, não por composição.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/scenarios/scenarios-list-sheet.tsx`, `apps/web/src/shared/billing/premium-teaser.tsx`,
`teaser-upgrade.tsx`, `apps/web/src/pages/calcular/calcular-page.tsx`.

Ordem exata dos elementos renderizados hoje, de cima para baixo, tudo centralizado:

| # | Elemento | Texto literal (pt-BR, homologado) |
|---|---|---|
| 1 | Título da gaveta | "Minhas simulações" |
| 2 | Título do teaser (h2, `--fs-lg`) | "Salve suas simulações" |
| 3 | Subtítulo (`--fs-body-sm`, texto suave) | "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje." |
| 4 | Faixa de compra (topo com linha divisória) | preço + botão, ver abaixo |
| 5 | Legenda (`--fs-caption`, texto suave) | "A calculadora continua grátis." |

A faixa de compra (4) é: a linha de preço `"Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês"`
como texto pequeno e suave, e ao lado (ou abaixo, quando não cabe) o botão primário **"Assinar Premium"**.
No painel os dois ficam **centralizados**, e a faixa tem uma **linha divisória acima**.

→ **Problema 1 — a ordem contradiz a própria regra escrita.** A faixa de compra foi especificada para entrar
*entre* a nota "continua grátis" e as ações; no que roda, a legenda honesta "A calculadora continua grátis."
cai **abaixo** do botão de compra, isolada sob a linha divisória, virando rodapé de um bloco de venda. Decida
no desenho onde a frase honesta pertence — ela é a metade da verdade que segura o vendedor que não vai comprar.

→ **Problema 2 — o vazio.** O painel tem altura total (100% da tela); o conteúdo tem ~5 elementos curtos.
Hoje tudo fica grudado no topo e sobra meia tela vazia embaixo. Ninguém desenhou o que acontece nesse espaço.

→ **Problema 3 — a descrição da lista some.** No estado de teaser, a frase "Estratégias salvas. Cada uma
recalcula com os preços de hoje quando você abre." **não** é renderizada (foi removida em 016/T010-A1 porque
duplicava a promessa do subtítulo). O painel do não-assinante fica, portanto, com título e nada entre título e
teaser. Confirme se essa é a hierarquia que você quer ver.

→ **Problema 4 — a regra do CTA único é invisível.** Enquanto esta gaveta está aberta, o card de teaser do
seletor de catálogo, que vive na página atrás, é **removido da página**. Quando a gaveta fecha, ele volta — e o
conteúdo atrás pula. Isso precisa ser uma decisão de composição desenhada, não um `if`.

## Conteúdo e dados reais
- Preço mensal: **R$ 15,99/mês**. Anual: **R$ 155,88/ano**, apresentado sempre pelo **equivalente mensal
  R$ 12,99/mês**. O R$ 191,88 (12 × mensal) **nunca** aparece riscado — um "de/por" fabricaria um desconto que
  não existe. A linha inteira é uma só string, não dois campos.
- Botão: "Assinar Premium" — leva à oferta dentro de `/conta`, **não** a um checkout direto (mensal e anual têm
  preços diferentes; disparar a compra de um período que o vendedor não escolheu é escolher por ele). Para quem
  está deslogado, o mesmo botão passa antes pelo sign-in preservando a intenção.
- Não há campos de entrada nesta peça. Nenhum número do vendedor aparece aqui.
- Geometria real do painel: ancorado à **direita**, largura `min(92vw, 26rem)` — ou seja **359px a 390px de
  viewport** e no máximo **416px no desktop** —, altura total, com rolagem própria. O bloco do teaser tem
  largura máxima `min(28rem, 100%)` centralizada, então dentro deste painel ele ocupa a largura inteira.

## Estados obrigatórios
1. **Repouso — deslogado.** Teaser completo, botão "Assinar Premium" ativo. O caminho passa pelo sign-in.
2. **Repouso — logado, nunca assinou** (`status: "none"`). Visualmente idêntico ao anterior; o botão vai direto
   à oferta. Desenhe o par para confirmar que são mesmo iguais — se não devem ser, diga por quê.
3. **Foco por teclado no botão** — anel visível contra o fundo do painel (não contra o fundo da página).
4. **Hover e pressionado** do botão primário.
5. **Verificando o plano.** Hoje, enquanto a resposta do plano não chega, a gaveta **não** mostra o teaser —
   ela mostra o corpo da lista (vazio), e o teaser aparece depois. É um piscar de conteúdo errado. Desenhe o
   estado de espera do painel (esqueleto ou frase curta), ele não existe.
6. **Falha ao verificar o plano.** Uma rede que caiu **não pode** ser desenhada como "você não é Premium".
   Precisa de um estado próprio; o vocabulário honesto já usado no produto é "Não foi possível verificar seu
   plano." + "Tentar novamente".
7. **Premium pausado** (`lapsed`) — **este estado NÃO é o teaser**: a gaveta mostra a lista com o aviso
   "Premium pausado" / "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar,
   renomear, duplicar ou excluir, reative o Premium." Desenhe-o lado a lado com o teaser só para provar que as
   duas superfícies não se confundem.
8. **Offline com teaser na tela** — o botão continua visível (a compra é uma intenção, não uma escrita local),
   mas o painel precisa dizer o que está acontecendo; a frase existente do módulo é "Modo leitura offline".
9. **Fechamento** — como o painel sai e o que acontece com a página atrás (ver Problema 4).

## Viewports
- **Mobile 390px** — obrigatório: é onde a peça mais aparece e onde o painel come 92% da largura. A linha de
  preço e o botão **não cabem lado a lado** nessa largura; desenhe o empilhamento explicitamente.
- **Desktop 1280px** — obrigatório: é o corte do 018, o painel fica em 416px sobre a calculadora de duas
  colunas, e a decisão do vazio vertical (Problema 2) só fica visível aqui.
- **Largura estreita ~430px** — desenhe ao menos o bloco isolado nessa medida. É a faixa em que o layout já
  virou desktop mas a barra lateral ainda come 240px, e é exatamente onde este teaser já transbordou 131px.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto**: ou a pessoa tem Premium, ou vê a oferta inteira, com preço. Nada de lista
  quebrada fingindo que a funcionalidade está ligada, nada de contagem de "3 grátis".
- **Uma única superfície de compra por tela.** Com esta gaveta aberta, nenhuma outra linha de preço/"Assinar"
  pode estar visível — inclusive atrás do escurecimento. Isso é composição, não guarda.
- **Falha de rede nunca é vendida como "não é Premium"** (estado 6).
- **A frase honesta nunca mora dentro de um placeholder** nem num elemento que corte texto: "A calculadora
  continua grátis." precisa de elemento de largura inteira e altura livre.
- **Alvo de toque ≥ 44px** no botão e no fechar da gaveta.
- **Contraste medido contra o fundo real do painel** (que é sobreposto a um fundo escurecido), não contra o
  fundo da página.
- O preço é **um** texto único; nunca um preço "a partir de", nunca desconto fabricado.

## Armadilhas já pagas neste projeto
- **100,5px de transbordo com um botão nascendo fora da viewport** (E6/T028) — a faixa preço+botão é a peça
  exata que causou isso. Ela quebra linha desde sempre por causa desse defeito.
- **131px fora da tela a 426px de largura** (CF-043-UI-03): a largura máxima do bloco não encolhia dentro do
  container. Qualquer largura fixa que você desenhar precisa vir com a instrução de encolher.
- **Texto ocluso passa em teste**: elemento sobreposto ou cortado continua "visível" para o teste automatizado.
  Layout aqui se verifica por caixa, não por texto.
- **Rolagem no eixo vertical que o headless não vê** (016/PR-B): o painel rola sozinho; diga onde a rolagem
  começa e o que fica fixo, se algo ficar.
- **Legenda cortada por sufixo de placeholder** (016/PR-F): frases de honestidade vivem em elementos de largura
  inteira, nunca coladas em campos.

## Entregável
Pranchetas, tema escuro como padrão e tema claro como primeira classe (as duas versões de cada uma):
1. Gaveta em 390px — teaser completo, deslogado (estado 1), com a página atrás visível e escurecida.
2. Gaveta em 1280px — o mesmo, mostrando explicitamente a decisão sobre o vazio vertical e a âncora do CTA.
3. Estados do painel em 390px: verificando o plano, falha ao verificar, offline.
4. Comparativo lado a lado: teaser (sem Premium) × painel "Premium pausado" (com dados), para provar que as
   duas leituras não se confundem.
5. O bloco isolado em ~430px de largura, com anotação de encolhimento.
6. Uma prancheta de composição mostrando a página atrás **com** e **sem** a gaveta, marcando onde a outra
   oferta desaparece e o que ocupa esse lugar.

Reutilize os primitivos existentes, sem criar novos: o painel é o `Sheet` lateral (`tf-dialog--sheet-right`);
o título é o título da gaveta; o bloco é o `tf-premium-teaser` (título / subtítulo / faixa / legenda), com a
faixa `tf-teaser-upgrade` na variante centralizada; o botão é o `tf-btn--primary`; avisos usam `Alert` nos tons
`info`/`danger`; o estado de pausado usa o mesmo `Alert` de tom informativo já usado no produto.

## Perguntas em aberto para o dono
1. **A âncora do CTA**: "Assinar Premium" fica logo abaixo do texto (topo do painel) ou fixado no rodapé do
   painel, sempre à mão? As duas leituras vendem coisas diferentes e ninguém decidiu.
2. **O vazio vertical**: sobra meia tela abaixo do teaser no desktop. Ele fica vazio, ganha uma prova de valor
   (um exemplo do que uma simulação salva mostra), ou o painel encolhe e deixa de ter altura total no estado
   de teaser?
3. **A regra do CTA único**: a oferta deve viver **só** aqui enquanto a gaveta está aberta (é o que o código
   faz hoje, apagando o card atrás), ou a página atrás deve manter o card e a gaveta é que abre sem oferta?
4. **O que a gaveta mostra enquanto o plano é verificado** — hoje ela mostra a lista vazia por um instante e
   depois troca pelo teaser. Esqueleto, painel em branco, ou abrir só depois de saber?
