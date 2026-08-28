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

- **Onde vive:** Dentro do formulário da calculadora, na posição da seção "Marketplace". No DESKTOP, para quem não tem acesso, ele não fica confinado a uma coluna: ocupa a LARGURA TOTAL da grade de duas colunas, abaixo delas (à esquerda ficam "Custos da peça" e "Mão de obra"; à direita, "Markup" e "Outros custos", que migram para lá justamente quando o gate aparece) e acima do rodapé com o total e o "Como chegamos no preço". No mobile é a mesma sequência em coluna única. Ordem interna: título da seção "Marketplace" (com seu ícone de informação) → uma linha inteira com o rótulo do interruptor à esquerda e o INTERRUPTOR desligado e morto à direita → a frase "Vender em marketplaces faz parte do Premium." → a linha de preço + botão "Assinar Premium", tudo centrado.
- **Como o vendedor chega:** Sem gesto: o vendedor grátis está preenchendo o cálculo — o motivo de ele ter aberto o app — e ao rolar encontra a seção que mostraria quanto sobra depois da taxa do marketplace, trancada.
- **Vizinhança imediata:** Imediatamente acima: as duas colunas de campos do formulário (custos/mão de obra à esquerda; markup e outros custos à direita). Imediatamente abaixo: o rodapé com o preço total e a explicação do cálculo, que continua funcionando normalmente — o cálculo direto (varejo/atacado) nunca é bloqueado. É a única superfície de compra ENXERTADA no meio de um formulário; para quem tem Premium, este mesmo lugar traz os canais editáveis com comissão, frete e o "Preços por canal".
- **Dados que chegam (e o que ela devolve):** Entitlement: sem acesso, o interruptor é renderizado `checked=false` e `disabled` INCONDICIONALMENTE — nunca o valor do formulário —, e nenhum canal é computado (zero número parcial ou fabricado). A linha de preço vem da mesma constante única de produto usada na oferta; o botão é um link para `/conta?assinar=1` (ou `/sign-in` com esse retorno).
- **O que acontece depois:** "Assinar Premium" sai da calculadora e abre a oferta na Conta. Confirmada a compra, este bloco é substituído no mesmo ponto pela seção real de Marketplace — o interruptor passa a funcionar, os canais aparecem com as taxas do catálogo servido (e cacheado para uso offline) e o rodapé ganha o anúncio e o líquido por canal. Fora isso, nada no cálculo muda: o preço direto continua igual, antes e depois.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)`

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

# Bloco "Marketplace" trancado na calculadora (gratuito)

## O que desenhar
A seção **Marketplace** como ela aparece para quem **não é Premium**, dentro da tela Calcular — a tela principal do produto, onde o vendedor digita os custos da peça e lê o preço sugerido. Para quem assina, essa seção é onde ele escolhe canal (Shopee, Mercado Livre Clássico/Premium, Amazon), informa comissão e taxa fixa, e vê o preço de anúncio e o líquido de cada canal. Para quem não assina, a seção continua no mesmo lugar, com o mesmo título, mas **trancada**: o interruptor aparece desligado e morto, uma frase explica por quê, e logo abaixo entra uma faixa de preço com o botão "Assinar Premium". É o único ponto de compra enxertado **dentro de um formulário de cálculo** — e é isso que precisa de desenho.

## Por que este prompt existe
Ninguém desenhou este bloco. A composição atual (título normal + interruptor visível-porém-morto + frase + faixa de compra centrada) foi montada em código, e o alinhamento central só nasceu depois de **medir ~950px de distância** entre a frase que motiva a compra e o botão que a executa, na faixa full-width do desktop. Pior: o protótipo de 2026-07-02 desenha Marketplace como uma seção colável **normal e grátis** (§E4) e o §I proíbe explicitamente "paywall no cálculo (computar é sempre grátis)" — a rodada 1, item 5, chegou a corrigir os presets de taxa **para o usuário livre**. O código de hoje **contraria essa regra de desenho com todas as letras**: o marketplace virou Premium só no incremento 016 (PR-E, 2026-08-06), mais de um mês depois, por decisão de produto registrada em Clarifications datadas. O desenho nunca foi refeito para essa realidade nova. É o que este prompt pede.

## O que já existe hoje (não invente do zero — corrija)
Ordem literal do bloco, de cima para baixo (`calculator-form.tsx`, `data-testid="marketplace-premium-gate"`):

| # | Elemento | Conteúdo literal hoje |
|---|---|---|
| 1 | Título de seção + gatilho ⓘ | "Marketplace" · tooltip "Sobre o marketplace": *"Calcula o preço para anunciar em um marketplace de modo que, após a comissão e a taxa fixa, você receba o preço-base. Anúncio = (preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a taxa fixa."* |
| 2 | Linha de interruptor (rótulo à esquerda, switch à direita, largura total) | "Incluir marketplaces no preço" · switch **desligado e desabilitado**, sempre — nunca o valor do formulário |
| 3 | Legenda | "Vender em marketplaces faz parte do Premium." |
| 4 | Faixa de preço + CTA (centrada, separada por um filete no topo) | "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" + botão primário **"Assinar Premium"** |

→ **Problema 1:** o interruptor desligado e morto, com o rótulo normal ao lado, lê como *quebrado* antes de ler como *trancado*. A legenda é o único sinal de que aquilo é uma tranca. O desenho decide se o interruptor permanece (e com que afordância de cadeado/estado) ou se dá lugar a outra coisa — mas não pode fingir que ele funciona.
→ **Problema 2:** o gratuito não vê **nada** do que a seção faria. Nenhuma pista do valor: nem canais, nem a ideia de "anúncio × líquido". O tooltip ⓘ com a fórmula é a única informação, escondida atrás de um ícone.
→ **Problema 3:** a faixa de compra é visualmente idêntica à faixa dos outros teasers do app, mas aqui ela está **no meio de um formulário**, entre "Markup"/"Outros custos" e o rodapé "Como chegamos no preço". Ela interrompe a leitura do cálculo.
→ **Problema 4:** a mesma tela pode mostrar **um segundo "Assinar Premium"** — o teaser do seletor de catálogo, num Card à parte. Dois CTAs de compra na mesma rolagem já foi defeito corrigido duas vezes neste projeto.

**Onde o bloco vive.** No desktop (≥1024px) a tela é uma grade de 2 colunas; o bloco trancado é uma linha **que atravessa as duas colunas**, logo abaixo delas — porque, aninhado numa coluna, ele deixava **1.671px de buraco vazio** ao lado (medido a 1440px). No mobile é uma coluna só, e o bloco cai depois de "Markup" e "Outros custos". Depois dele vem sempre o rodapé: "Como chegamos no preço" + os cartões de preço sugerido.

## Conteúdo e dados reais
- Preços do plano (fonte única, não reescrever): mensal **R$ 15,99/mês**; anual **R$ 155,88/ano**, apresentado pelo **equivalente mensal R$ 12,99/mês**. Nunca existe "de/por" nem valor riscado — o desconto real é "~19% de economia frente ao mensal".
- O botão leva à **oferta** (mensal vs anual) dentro da tela Conta, não a um checkout direto. Deslogado, o caminho passa pelo login preservando a intenção.
- O que o assinante veria no lugar (para o desenho saber o que está sendo trancado): por canal, "Marketplace", "Modalidade", "Comissão" (%), "Taxa fixa" (R$), "Comissão mínima/item", "Frete" (R$, descontado do recebido), e o par **anúncio / recebido líquido** para varejo e atacado. Números reais do catálogo: ML Clássico **6,75 + 14%**, ML Premium **6,75 + 19%**, Amazon INDIVIDUAL **R$ 2,00**. Preço-base típico da tela: **R$ 16,16** (varejo) e **R$ 24,24** (atacado).
- O gratuito **não recebe nenhum número de canal** — nem parcial, nem de exemplo, nem borrado. A lista "Preços por canal" chega vazia por construção.

## Estados obrigatórios
1. **Repouso (não assinante, logado)** — o bloco como descrito: título, interruptor travado, "Vender em marketplaces faz parte do Premium.", faixa + "Assinar Premium".
2. **Deslogado** — visualmente igual; muda só o destino do botão (passa pelo login). Se o desenho quiser diferenciar o convite para quem nem tem conta, diga como.
3. **Foco de teclado** no botão "Assinar Premium" e no gatilho ⓘ — anel visível contra o fundo real do bloco.
4. **Hover / pressionado** do botão primário.
5. **Interruptor desabilitado** — o estado central da peça: precisa ler como "trancado", nunca como "com defeito". Rótulo "Incluir marketplaces no preço" continua legível (contraste medido, não apagado a ponto de sumir).
6. **Premium pausado (`lapsed`)** — hoje esta pessoa vê **exatamente o mesmo bloco**, com "faz parte do Premium" e "Assinar Premium", como se nunca tivesse assinado. Desenhe a variante honesta desse caso (ver Perguntas).
7. **Direito ainda sendo verificado / falha ao verificar** — o código degrada para "não tem direito" e mostra o bloco trancado. Ou seja: **uma falha de rede pode mostrar uma oferta de compra a quem já é Premium.** Desenhe o que aparece enquanto verifica (e se existe um estado de espera antes de mostrar a oferta).
8. **Assinante (comparação)** — uma prancheta com a seção destrancada e um canal preenchido, só para o contraste ficar visível lado a lado.

## Viewports
- **390px (mobile)** — obrigatório: é a jornada principal. A faixa preço + botão **quebra em duas linhas** aqui; a quebra tem que acontecer entre a legenda e o botão, **nunca entre "R$" e o valor** (defeito já pago: a linha terminava em "equivalente a R$" e a seguinte começava em "12,99/mês").
- **1280px e 1920px (desktop)** — obrigatórios: é onde o bloco atravessa as duas colunas e onde a frase e o CTA já ficaram a ~950px um do outro. Mostre a linha inteira em escala, com a grade de 2 colunas acima e o rodapé abaixo, para provar que a proximidade se sustenta em faixa larga.

## Regras que o desenho não pode quebrar
- **Freemium binário**: ou a pessoa tem o recurso inteiro, ou não tem. Nada de "prévia" com número reduzido, borrado ou de mentira. Um número inventado sob a marca do produto é pior que nenhum número.
- **A tranca é dita, não insinuada**: o motivo aparece em texto de largura total — nunca dentro de um placeholder de campo, que corta a frase.
- **Falha de rede nunca é vendida como falta de plano** e vice-versa: se o app não sabe se a pessoa é Premium, ele não pode afirmar que ela não é.
- **A procedência do número**: a linha de preço do plano mostra os valores reais do plano, sem desconto fabricado.
- **Alvo de toque ≥44px** no botão "Assinar Premium" e no gatilho ⓘ.
- **Um único CTA de compra visível por vez** na tela Calcular.
- **Zero transbordo horizontal** a 390px — a tela toda, não só o bloco.
- Contraste medido contra o fundo real do bloco (que fica dentro do fundo da página, não sobre branco).

## Armadilhas já pagas neste projeto
- **CTA órfão**: 149,6px na primeira vez, ~950px nesta faixa. Preço e botão têm que ler como **uma unidade**, e é por isso que hoje está centrado — o desenho pode resolver melhor, mas não pode reintroduzir a distância.
- **Botão nascendo fora da viewport**: 100,5px de transbordo com o botão fora da tela, achado só na imagem.
- **Quebra de linha dentro do preço** (R$ separado do valor): invisível para qualquer asserção de texto ou geometria — só a imagem vê.
- **Buraco de coluna**: 1.671px vazios quando o bloco foi aninhado numa coluna do desktop.
- **Dois "Assinar" na mesma tela** (um por trás de um overlay), já corrigido duas vezes.
- **Texto ocluso passa em teste**: oclusão não é propriedade do texto — o desenho é conferido na imagem, em 1:1.

## Entregável
Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class, não um afterthought)**:
1. Bloco trancado a **390px** — repouso.
2. Bloco trancado a **1280px** e a **1920px**, em contexto (grade de 2 colunas acima, rodapé abaixo), para provar a proximidade preço↔CTA na faixa larga.
3. Painel de estados: interruptor travado (repouso/foco/hover), botão (repouso/hover/pressionado/foco), verificando direito, **Premium pausado**.
4. Prancheta de contraste: a mesma seção **destrancada** com um canal preenchido (ML Clássico 6,75 + 14%, anúncio e líquido) ao lado da trancada.

Reutilize os primitivos existentes, sem criar novos: o **Card** para o corpo da seção, o **título de seção com gatilho ⓘ** já usado por "Custos da peça"/"Markup"/"Como chegamos no preço", o **Switch** no estado desabilitado, o **botão primário `tf-btn--primary`** para "Assinar Premium", a **legenda em texto secundário** para a frase da tranca, e o **Alert de tom `info`** caso algum estado (verificando/pausado) precise de um aviso — nunca tom de erro: não há erro nenhum em não ser assinante.

## Perguntas em aberto para o dono
1. **Premium pausado (`lapsed`)**: quem já assinou e teve o pagamento interrompido deve ver "Assinar Premium" (como hoje) ou uma variante de **reativação**, que reconheça que ele já foi cliente? Muda copy e provavelmente o desenho do bloco.
2. **Interruptor morto**: ele permanece visível como afordância travada (mostrando o que existiria), ou dá lugar a outra representação da tranca? É decisão de produto porque define se o gratuito "vê o controle que não pode usar".
3. **Prévia do valor**: o gratuito pode ver a *estrutura* do que compraria — a lista de canais suportados, ou um exemplo explicitamente rotulado como ilustrativo — ou a regra "nenhum número de canal, nem de exemplo" vale sem exceção?
4. **Enquanto o app verifica o direito**: aceitável mostrar a oferta de imediato (comportamento de hoje, que pode oferecer compra a quem já paga), ou o bloco deve exibir um estado neutro de espera antes de assumir "não assinante"?
5. **§I do protótipo** ("computar é sempre grátis") fica formalmente revogado por este desenho, ou o dono quer que alguma parte do cálculo com canal continue livre (por exemplo, um único canal)?
