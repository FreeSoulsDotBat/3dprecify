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

- **Onde vive:** O cartão "Plano" (`Card.tf-conta__row--plan`) — segundo cartão da coluna 1 da Conta no desktop (abaixo do cartão de identidade), segundo bloco da pilha no mobile. Estrutura da linha: à esquerda, em coluna, o rótulo "Plano", depois uma linha com [selo] + [legenda] e, abaixo dela, a NOTA (segunda frase); à direita, alinhadas ao fim e com quebra para uma segunda linha se faltar largura, as ações.
- **Como o vendedor chega:** Ninguém escolhe ver isto: o vendedor abre a Conta por qualquer motivo e descobre que o cartão foi recusado e que existe um prazo correndo. É a tela de quem ESTÁ pagando e pode perder o acesso em dias.
- **Vizinhança imediata:** Acima: o cartão de identidade (avatar circular de 44px com a inicial + e-mail). Abaixo: no desktop, o cartão "Assinar o Premium" NÃO aparece neste estado (a oferta inline só existe para grátis/pausado/cancelado) — o próximo bloco é o fim da coluna; no mobile, o próximo cartão é "Tema". À direita, dentro da própria linha: "Atualizar forma de pagamento" (primário, único da linha com preenchimento) e, ao lado, o "Recarregar" fantasma.
- **Dados que chegam (e o que ela devolve):** Composição de duas leituras do servidor: o ledger diz `active` (o Premium SEGUE ligado) e o espelho do PSP diz `grace` com uma `graceUntil`. Renderiza selo VERDE "Premium", legenda "pagamento pendente — regularize" e nota "até {data}, senão o Premium pausa." — legenda e nota são o único caso do painel pintado em `--info-text` em vez do cinza neutro.
- **O que acontece depois:** "Atualizar forma de pagamento" abre a superfície do Mercado Pago em NOVA ABA (o cartão nunca passa pelo app) e o vendedor volta para cá por conta própria; "Recarregar" relê o ledger na hora. Se o pagamento é regularizado, a linha vira "Premium · renova em {data}"; se o prazo vence, vira "Premium pausado" e toda escrita no app congela em leitura.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Linha do plano na Conta — o estado de CARÊNCIA (pagamento recusado, prazo correndo)

## O que desenhar
A primeira linha da tela **Conta** (`/conta`) é um card horizontal com o rótulo "Plano", um selo de estado, uma legenda e as ações do lado direito. Desenhe **um estado específico** dessa linha: **carência** — a renovação foi recusada pelo Mercado Pago, o Premium **continua ligado**, e há um prazo em dias correndo até ele pausar. É a tela em que o vendedor pagante descobre que o cartão falhou; ele chega aqui pelo menu (Conta é a última aba) ou vindo de um e-mail do PSP, ansioso, e precisa entender em segundos: (1) ainda tenho Premium? (2) até quando? (3) o que eu clico para resolver? Desenhe a linha em carência **lado a lado com a linha em Premium saudável e com a linha em Premium pausado**, porque o problema central é a distinção entre elas.

## Por que este prompt existe
Este estado inteiro nasceu em código, sem nenhum desenho: o protótipo de 2026-07-02 (`AccountScreen`, §E7) tem **dois** estados de plano — `Premium` / `Gratuito` — e **uma única legenda de uma linha** ("renova em 01/09/2026"); não há carência, nem segunda linha, nem prazo, nem hierarquia de ações. A redação e a regra vieram só de uma spec textual (`ux-billing` §9-G1), e nem ela chegou ao produto sozinha: o estado precisou ser **corrigido duas vezes por medição de homologação** — T028/A3 (carência e assinatura saudável tinham temperatura visual **idêntica**: mesmos pixels de selo, as duas frases no mesmo cinza neutro) e 015/A8 (a única ação que recupera o Premium era a **mais fraca** da linha, sem preenchimento, ao lado de um botão secundário). Ou seja: a hierarquia visual estava invertida em relação ao risco, e ninguém desenhou — mediu-se depois. É isso que este prompt vem fechar.

## O que já existe hoje (não invente do zero — corrija)
Linha "Plano" em carência, exatamente como está no produto:

| Elemento | Conteúdo literal hoje | Observação |
|---|---|---|
| Rótulo | "Plano" | texto de corpo, acima do selo |
| Selo | "Premium", tom **success (verde)** | verde **de propósito**: o Premium ESTÁ ativo |
| Legenda (linha 1) | "pagamento pendente — regularize" | pintada em `--info-text` — **única exceção** ao `--text-muted` de todos os outros estados |
| Nota (linha 2) | "até 12/09/2026, senão o Premium pausa." | mesma cor `--info-text`; só existe neste estado |
| Ação primária | "Atualizar forma de pagamento" | botão **preenchido**; abre `mercadopago.com.br/subscriptions` em **nova aba** — o cartão nunca é digitado aqui |
| Ação secundária | "Recarregar" | botão fantasma, com estado de carregando |

→ **Problemas a resolver no desenho, não a copiar:**
- → A cautela hoje é carregada **inteiramente pela cor do texto**. Um vendedor com pouca visão, ou lendo sob sol, vê duas frases cinza-azuladas ao lado de um selo verde. Falta uma marcação de **forma**, não só de cor (o desenho decide qual: faixa, ícone, contorno do card, agrupamento — não degrade o selo).
- → A frase quebra em duas linhas que só juntas fazem sentido ("pagamento pendente — regularize" + "até 12/09/2026, senão o Premium pausa."). A segunda começa em minúscula e depende da primeira; a leitura em voz alta fica truncada, e no mobile a linha 1 pode ficar longe da linha 2 se algo se intrometer.
- → **O prazo — o dado mais urgente da tela — está enterrado no fim da segunda linha**, em corpo de legenda. Não há contagem de dias restantes em lugar nenhum.
- → Dois botões lado a lado a 8px: "Atualizar forma de pagamento" (vai para fora do app) e "Recarregar" (fica). Nada indica que o primeiro **sai do produto**.
- → Existe uma frase escrita e **nunca renderizada**: `planRefreshHint` = "Mudou de plano agora?". Ela explicaria por que "Recarregar" está ali; hoje é código morto. Decida no desenho se ela aparece (e onde) ou se some.

## Conteúdo e dados reais
- **Data**: sempre `dd/mm/aaaa` em pt-BR (`12/09/2026`). É afirmação real do servidor (`graceUntil`), nunca estimativa — pode ser exibida com confiança.
- **Duração da janela**: entre **7 e 10 dias** (a regra é `max(janela de retentativa do MP = 10 dias, piso contratual = 7 dias)`, ancorada no fim do período pago). Desenhe o pior e o melhor caso de texto: "até 12/09/2026" e um dia distante como "até 31/12/2026".
- **Preços reais do plano** (aparecem na oferta logo abaixo, não nesta linha): "R$ 15,99/mês" e "R$ 155,88/ano · equivalente a R$ 12,99/mês".
- **Se `graceUntil` vier nulo**, a segunda linha **não é escrita** — o card fica só com "pagamento pendente — regularize". Desenhe essa variante: ela não pode parecer quebrada nem perder o tom de cautela.
- **Modo offline / dado guardado**: a legenda ganha um sufixo com separador " · última informação do servidor" → "pagamento pendente — regularize · última informação do servidor". Essa é a variante mais longa de todas e é onde a linha estoura.
- **Vizinhança**: acima não há nada (é a primeira linha da Conta); abaixo vem o card de **oferta** ("Assinar Premium", planos anual/mensal) — que em carência **não é oferecido** —, depois identidade da conta e o controle de Tema. No desktop (≥1280px) a Conta é uma grade de três colunas e a linha do plano ocupa a primeira.

## Estados obrigatórios
Desenhe a carência em **todas** estas condições, e mais os três estados vizinhos para comparação:

1. **Carência, repouso** — selo verde "Premium" + "pagamento pendente — regularize" + "até 12/09/2026, senão o Premium pausa." + botão preenchido "Atualizar forma de pagamento" + fantasma "Recarregar".
2. **Carência sem data** — sem a segunda linha (`graceUntil` nulo).
3. **Carência offline / dado guardado** — legenda com o sufixo " · última informação do servidor".
4. **"Recarregar" carregando** — o botão fantasma com indicador de carga; o resto da linha **não pisca nem some** (o vendedor não pode perder o prazo de vista durante a atualização).
5. **Foco de teclado** em cada um dos dois botões — anel visível contra o fundo real do card, nos dois temas.
6. **Hover e pressionado** do botão primário, e do fantasma.
7. **Estado vizinho A — Premium saudável**: selo verde "Premium" + "Plano mensal · renova em 01/09/2026" em cinza neutro; ações "Gerenciar assinatura" (fantasma) + "Cancelar assinatura" (fantasma) + "Recarregar".
8. **Estado vizinho B — Premium pausado**: selo neutro "Premium pausado" + "Seus itens salvos continuam disponíveis para leitura." + botão "Assinar novamente".
9. **Estado vizinho C — não sabemos**: selo neutro + "Não foi possível confirmar seu plano." e apenas "Recarregar" (nenhuma ação de cobrança é oferecida quando o servidor não respondeu).

## Viewports
- **Mobile 390px** — obrigatório: é o uso dominante e é a largura onde o defeito já aconteceu (ver armadilhas). Mostre a linha com o texto mais longo (variante 3) e com os dois botões.
- **Desktop 1280px** — obrigatório: a Conta vira grade de três colunas e a linha do plano fica numa coluna estreita, com a oferta inline logo abaixo nos estados que a oferecem. A carência **não** oferece assinatura, então essa coluna fica curta — mostre como ela não parece "vazia por erro".
- 1920px é o mesmo arranjo de 1280px com mais folga; desenhe só se algo mudar.

## Regras que o desenho não pode quebrar
- **O selo continua VERDE.** Degradar o selo diria ao vendedor que ele já perdeu algo — a mentira na direção oposta, e mais cara: ele pode parar de usar o que ainda pagou. A cautela mora no texto e na marcação de forma, nunca no selo.
- **Nada de alarme falso.** Sem vermelho de erro, sem ícone de perigo, sem contagem regressiva ansiosa em segundos. Isto é um aviso, não uma falha.
- **Nenhuma falha de rede pode ser vendida como perda de Premium** — o estado "não foi possível confirmar" é honesto e separado; nunca se disfarça de pausa.
- **Frase honesta nunca vive dentro de placeholder** nem de campo truncável: "até 12/09/2026, senão o Premium pausa." precisa de um elemento de largura total que a mostre inteira.
- **A ação que recupera o Premium é a mais forte da linha.** Ela é primária porque é a única que resolve; "Recarregar" jamais pode ter peso igual ou maior.
- **Sinalize a saída do app**: "Atualizar forma de pagamento" leva ao Mercado Pago em nova aba. O dado do cartão não passa por este produto e o desenho deve deixar isso legível.
- **Alvos ≥44px** de altura nos dois botões, inclusive quando a linha quebra.
- **Contraste medido contra o fundo real do card** (não contra o fundo da página) para o tom de cautela — nos dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido a 390px**: nesta mesma linha, as ações mediam 453,5px contra 316px de conteúdo útil, o `scrollWidth` da página ia a 491 (**100,5px de transbordo**) e um botão **nascia inteiramente fora da viewport** (x=396,3). Com um modal aberto, sobrava uma faixa clara à direita com o botão solto. Regra da casa: **quebra de linha, nunca rolagem horizontal** — e o bloco de ações precisa quebrar *dentro de si*, não só o card.
- **Colisão de rótulos**: o botão de recarregar já se chamou "Atualizar" e ficava a 8px de "Atualizar forma de pagamento" — mesma primeira palavra, lado a lado, no momento de maior ansiedade. Por isso hoje é "Recarregar". Não reintroduza duas ações que começam com a mesma palavra.
- **Temperatura visual idêntica**: carência e assinatura saudável já foram indistinguíveis num teste automatizado que passava — texto presente não é texto perceptível. Se as duas pranchetas lado a lado não se distinguirem **em preto e branco**, o desenho ainda não resolveu.
- **Texto que passa em teste e não aparece na tela**: ocultação e transbordo não são propriedades do texto. Toda frase de honestidade precisa caber medida em caixa, não só existir.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como primeira classe** (as duas versões de cada prancheta de repouso; os estados de interação podem ficar só no escuro):
1. Mobile 390px — carência em repouso (estados 1, 2, 3).
2. Mobile 390px — carregando + foco + hover/pressionado (estados 4–6).
3. Mobile 390px — a tira comparativa: carência acima de Premium saudável acima de Premium pausado acima de "não sabemos" (estados 7–9), para provar a distinção.
4. Desktop 1280px — a coluna do plano em carência, no contexto da grade de três colunas.

Reutilize os primitivos existentes, sem criar novos: o card da linha é o **`tf-card`**; o selo é o **`tf-badge`** em tom `success` (e `neutral` nos vizinhos); rótulo, legenda e nota usam a escala de **caption** do sistema; as duas ações são **`tf-btn`** — primária preenchida para "Atualizar forma de pagamento" e `ghost` para "Recarregar" —, com o estado de carga do próprio botão; se propuser uma faixa/realce de cautela, use o **`tf-alert`** em tom `info`, e não um bloco novo.

## Perguntas em aberto para o dono
1. A carência deve mostrar **dias restantes** ("faltam 6 dias") além da data, ou só a data? Contagem em dias é mais urgente e mais fácil de errar por fuso/arredondamento.
2. A frase escrita e nunca exibida "Mudou de plano agora?" deve aparecer ao lado de "Recarregar", ou deve ser apagada da base?
3. Em carência, a Conta deve mostrar **algum** caminho de reassinatura (hoje não mostra: a assinatura ainda existe, só o pagamento falhou) — ou o botão do Mercado Pago é a única saída, mesmo para quem quer trocar de plano no meio da carência?
4. Além da cor `info`, a carência pode ganhar uma marcação de forma (faixa, ícone, contorno do card)? E, se sim, ela vale para o card inteiro ou só para o par de frases?
