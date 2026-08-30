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

- **Onde vive:** Um `Card` na coluna central da tela Calcular, entre o bloco de contexto de cenário e o formulário — exatamente o slot que, para quem tem Premium, é ocupado pelo cartão "Usar do catálogo" com os dois seletores (Filamento salvo / Impressora salva). Ordem interna, tudo centrado: título "Preencha o cálculo com um toque" → subtítulo → linha de preço + botão "Assinar Premium" → legenda de honestidade → e ABAIXO de tudo, em largura total, um `<Button>` secundário DESABILITADO com o rótulo "Usar do catálogo".
- **Como o vendedor chega:** Sem gesto: o vendedor grátis (ou deslogado) abre a aba Calcular — a tela inicial e mais usada do produto — e encontra este cartão ao rolar, antes de começar a preencher os campos.
- **Vizinhança imediata:** Acima: o cabeçalho "Calcular", a frase de promessa ("a calculadora é grátis…") e o botão "Meus cenários" alinhado à direita. Abaixo: o formulário de custos da peça (ou, quando há falha real de leitura do catálogo, o cartão de erro com "Tentar de novo"). Note a inversão: o botão morto fica DEPOIS do botão de compra, e não no lugar onde o controle real viveria — dois botões seguidos, um que compra e um que não faz nada.
- **Dados que chegam (e o que ela devolve):** Sessão + entitlement (`deslogado` ou `status = none`). Nenhuma lista de filamentos/impressoras é lida — para quem não tem acesso, os seletores não existem. O botão desabilitado é a única exceção nomeada do padrão fechado de teaser: ele existe para MOSTRAR que a funcionalidade existe e está trancada, em vez de escondê-la.
- **O que acontece depois:** "Assinar Premium" leva a `/conta?assinar=1` (passando por `/sign-in` se deslogado, preservando o retorno). Se a compra se confirma, este cartão inteiro é substituído pelo picker real, e escolher um filamento salvo passa a preencher os campos do formulário logo abaixo. Enquanto a folha "Minhas simulações" estiver aberta, este cartão é retirado da página para não haver dois CTAs de compra simultâneos.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Teaser do "Usar do catálogo" na calculadora — com o controle trancado à vista

## O que desenhar
O bloco que o vendedor **grátis ou deslogado** encontra na aba **Calcular**, no lugar exato onde o assinante
vê o cartão "Usar do catálogo" (dois seletores que preenchem os campos do cálculo a partir do catálogo
salvo). É a tela central do produto — a primeira que abre e a única que o usuário grátis usa todo dia. O
bloco aparece logo abaixo da frase de promessa e do botão "Meus cenários", e imediatamente **acima** do
formulário de custo. Ele precisa dizer, na mesma respiração: este atalho existe, ele é Premium, e o cálculo
que você veio fazer continua grátis logo abaixo.

## Por que este prompt existe
O desenho de 2026-07-02 (`claude-design-prototype-fixes.md`, item 1) especificou esta superfície com
precisão: **substituir** os selects por um "card compacto de teaser" com a frase "Preencha direto do seu
catálogo — recurso Premium" e um **link discreto** "Ver Premium". O que foi construído inverteu a decisão:
mostra o **controle morto** (um botão secundário desabilitado, rótulo "Usar do catálogo") **abaixo** de um
CTA primário de compra com preço real. Ninguém ratificou a inversão — o canvas do 018 não cobre Calcular
(o artboard é um ponteiro para um arquivo que **não existe** no repositório). Logo: o arranjo "botão morto
sob botão de compra" é inferência de IA, não desenho. É isso que este prompt vem resolver.

## O que já existe hoje (não invente do zero — corrija)
Um `Card` (padding médio) contendo, **nesta ordem fixa** (o componente é fechado: quatro elementos + a
exceção nomeada):

| # | Elemento | Conteúdo literal hoje |
|---|---|---|
| 1 | Título (h2, `--fs-lg`, centrado) | "Preencha o cálculo com um toque" |
| 2 | Subtítulo (`--fs-body-sm`, mudo) | "O catálogo guarda seus filamentos e impressoras salvos: no Premium, eles preenchem os campos abaixo sozinhos — e continuam editáveis." |
| 3 | Faixa de preço + CTA (topo com filete `--border-subtle`, centrada, com quebra de linha permitida) | "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" + botão primário "Assinar Premium" |
| 4 | Legenda (`--fs-caption`, muda) | "O cálculo de custo e markup continua grátis." |
| 5 | **A exceção**: bloco de largura 100%, colado abaixo da legenda | botão **secundário desabilitado** com o rótulo "Usar do catálogo" |

O bloco inteiro é centrado, com `max-width` de 448px, dentro de um cartão que a partir de 1024px pode ter
até 1120px de largura.

→ **Problema 1 — dois botões empilhados, e o de baixo é morto.** O último elemento visual da peça é um
controle que não faz nada; ele compete visualmente com "Assinar Premium" e é o que o olho pousa por último.
→ **Problema 2 — o controle trancado não está onde o controle real vive.** No Premium, "Usar do catálogo" é
um cartão com dois seletores rotulados; aqui virou um único botão genérico, deslocado para o rodapé do
teaser. Quem vê isso não aprende o que vai ganhar.
→ **Problema 3 — o botão desabilitado não explica nada.** Não tem cadeado, não tem dica, e um botão
desabilitado não recebe foco de teclado: para leitor de tela e para navegação por teclado, ele simplesmente
não existe.
→ **Problema 4 — o bloco de 448px centrado dentro de um cartão de até 1120px** deixa uma faixa vazia larga
nos dois lados no desktop, sem que nada ocupe o espaço.

## Conteúdo e dados reais
- **Preço**: mensal `R$ 15,99/mês`; anual `R$ 155,88/ano` exibido **apenas** como equivalente mensal
  `equivalente a R$ 12,99/mês`. O R$ 191,88 **nunca** aparece riscado — não existe desconto "de/por".
- **CTA**: "Assinar Premium" leva à oferta dentro de `/conta` (nunca direto ao checkout: mensal e anual são
  escolhas do vendedor). Deslogado, o mesmo botão passa pelo sign-in preservando a intenção — **o rótulo e
  a copy não mudam** entre deslogado e grátis.
- **O que o controle trancado destrancaria** (o cartão Premium real, para você desenhar a promessa com
  fidelidade): rótulo de seção "Usar do catálogo"; dica "Preenche os campos com o item salvo — você ainda
  pode editar tudo."; dois campos lado a lado — "Filamento salvo" e "Impressora salva" — cada um um seletor
  com o placeholder "Escolher…" e nomes reais de itens (ex.: "PLA Azul", "Ender 3").
- **Contexto imediato acima** (já existe, não redesenhar, mas compor com): a promessa da primeira dobra,
  centrada — "Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem
  parte do Premium." O teaser não pode repetir essa frase com outras palavras.
- **Contexto imediato abaixo**: os campos de custo do cálculo (gramas, tempo, energia…), sempre livres.

## Estados obrigatórios
1. **Repouso, grátis logado** — os cinco elementos acima; é o estado principal.
2. **Repouso, deslogado** — visualmente idêntico; só o destino do CTA muda. Desenhe-o para provar que a copy
   não muda (e diga isso na prancheta).
3. **Foco de teclado no "Assinar Premium"** — anel de foco visível contra o fundo do cartão.
4. **Hover / pressionado do "Assinar Premium"**.
5. **Controle trancado (o estado que este prompt existe para resolver)** — mostre o que ele mostra: o rótulo
   "Usar do catálogo", o sinal de que está trancado, e por quê. Se a sua solução mantiver um controle
   visível, ele **não pode** ler como um segundo botão clicável.
6. **Ausente por sobreposição** — com a folha "Meus cenários" aberta, o teaser some (dois CTAs de compra na
   mesma tela já foi defeito uma vez). Basta indicar na anotação, não precisa prancheta.
7. **Estado vizinho — falha de leitura do catálogo (assinante)**: cartão com alerta de perigo
   "Não foi possível carregar seus itens salvos agora." + botão secundário "Tentar novamente". Desenhe-o
   como referência de contraste: **falha de rede nunca pode parecer "você não é Premium"**.
8. **Premium pausado** — hoje esta peça **não** aparece para quem está pausado (esse usuário continua vendo
   o seletor real, porque os itens salvos seguem utilizáveis no cálculo). Não desenhe teaser para pausado;
   registre a regra na prancheta.

## Viewports
- **390px (obrigatório)** — é onde o produto vive. O cartão ocupa a largura da coluna (máx. 460px); o preço
  e o "Assinar Premium" **não cabem lado a lado** e quebram em duas linhas.
- **1280px** — a página da calculadora é coluna única e vai até 1120px de largura; o bloco de teaser fica
  centrado. Resolva a faixa vazia dos lados: ou o bloco ganha uma composição horizontal (promessa à
  esquerda, controle trancado à direita), ou o cartão deixa de ser largo aqui. Diga qual escolheu e por quê.
- **Faixa 426–600px** — anote o comportamento: já houve 131px de conteúdo fora da viewport quando o bloco
  reivindicava 448px numa coluna menor. O bloco tem de encolher, nunca empurrar.

## Regras que o desenho não pode quebrar
- **Freemium é binário e honesto**: ou o recurso é Premium, ou é grátis. Nada de "amostra grátis" ou
  contador de usos.
- **A frase honesta "O cálculo de custo e markup continua grátis." não pode ser cortada, virar tooltip nem
  viver dentro de placeholder** — ela mora em elemento de largura total, sempre inteira.
- **Preço sempre com procedência**: R$ 15,99/mês e o equivalente anual de R$ 12,99/mês, juntos, sem preço
  riscado.
- **Falha de rede nunca é vendida como falta de Premium** (regra 7 acima).
- **Alvo tocável ≥ 44px** para qualquer coisa clicável; contraste medido contra o fundo real do cartão, não
  contra o fundo da página.
- **O elemento desabilitado ainda precisa ser legível** — desabilitado não é invisível; mas também não pode
  convidar ao clique.
- O contrato do teaser é fechado: **título, subtítulo, preço+CTA, legenda** nesta ordem. Se o seu desenho
  precisar mudar a ordem ou reposicionar a exceção, marque isso explicitamente como proposta de mudança de
  contrato — não como detalhe visual.

## Armadilhas já pagas neste projeto
- Um botão de compra **nascendo fora da viewport**: 100,5px de transbordo horizontal medido a 390px. Qualquer
  linha com preço + botão tem de quebrar antes de estourar.
- Um bloco com `max-width` fixo que **não encolhe** dentro de coluna estreita: 131px fora da tela a 426px.
- Texto que passa em teste automatizado e está **ocluso ou cortado na imagem** — homologa-se por geometria,
  não por presença de string.
- Frase honesta que só aparecia como sufixo de placeholder e era **cortada** no campo.
- Dois CTAs de compra visíveis ao mesmo tempo na mesma tela (o teaser atrás de uma folha aberta).

## Entregável
Pranchetas, tema **escuro** (padrão) e **claro** (first-class, não um "modo alternativo"):
1. 390px — repouso, grátis logado (a peça inteira, dentro do cartão, com a frase da primeira dobra acima e o
   primeiro campo do formulário abaixo, para provar o encaixe).
2. 390px — deslogado (idêntica; anotar o único delta).
3. 390px — detalhe ampliado do **controle trancado**, com foco/hover/pressionado do "Assinar Premium".
4. 1280px — a composição desktop resolvida.
5. 390px — o vizinho de falha de leitura ("Não foi possível carregar seus itens salvos agora." +
   "Tentar novamente"), como referência de contraste.
6. 390px — o cartão Premium real ("Usar do catálogo" com os dois seletores), como referência do que é
   prometido.

Reutilize os primitivos existentes, sem criar novos: o contêiner é o cartão padrão com padding médio; o CTA
é o botão primário; o controle trancado parte do botão secundário em estado desabilitado (ou, se você propor
outra forma, use campo/seletor desabilitado + ícone de cadeado do conjunto de ícones existente); a falha usa
o alerta em tom de perigo com botão secundário pequeno; a faixa de preço usa a tipografia de legenda com o
filete sutil já definido.

## Perguntas em aberto para o dono
1. **Qual decisão vale?** O desenho de 2026-07-02 mandava *esconder* o controle e oferecer um **link
   discreto** "Ver Premium"; o código mostra o **controle morto + CTA de compra com preço**. São duas
   estratégias opostas de conversão e nenhuma foi ratificada depois da inversão. Qual fica?
2. Se o controle trancado fica: ele deve aparecer **no lugar onde o seletor real vive** (acima da promessa,
   com a forma dos dois campos "Filamento salvo" / "Impressora salva") em vez de abaixo do botão de compra?
3. O controle trancado deve mostrar a **forma do recurso** (dois seletores desabilitados, com nomes de
   exemplo) ou continuar como um único botão genérico?
4. Clicar/tocar no controle trancado deve fazer alguma coisa (levar à oferta, abrir explicação) ou continuar
   inerte? Hoje é inerte e invisível ao teclado.
5. No desktop (até 1120px), o teaser deve ganhar uma composição de duas colunas ou o cartão deve ficar
   estreito e centrado como no mobile?
