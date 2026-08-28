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

- **Onde vive:** Toast na região fixa de avisos: no celular, centrado horizontalmente e ancorado ACIMA da barra de abas (a poucos pixels dela); no desktop (≥768px), no canto inferior direito. Largura `min(92vw, 30rem)`, empilhável, tom de sucesso, some sozinho.
- **Como o vendedor chega:** Disparado pela confirmação do cancelamento — no instante em que o servidor responde, e não por um clique próprio. O vendedor está olhando o diálogo, que desaparece no mesmo momento; o toast é a única coisa nova que entra na tela.
- **Vizinhança imediata:** Por cima da Conta já sem scrim: o olhar do vendedor está no centro da tela (onde o diálogo acabou de sumir) enquanto a mensagem aparece embaixo — no celular colada à barra de abas, no desktop longe, no canto. Ao mesmo tempo, a linha do plano no alto da coluna se reescreve para o estado de cancelamento agendado.
- **Dados que chegam (e o que ela devolve):** O texto "Assinatura cancelada. Premium ativo até {data}." é montado com a data que veio NA RESPOSTA do servidor, não com a que estava na tela (se o painel estivesse defasado, repetir o valor antigo confirmaria uma promessa que o servidor não fez). Sem data, o texto cai para "…até o fim do período já pago."
- **O que acontece depois:** O toast expira sozinho e não deixa rastro: o único eco persistente do cancelamento é a legenda da linha do plano. As duas leituras do servidor (entitlement e assinatura) são revalidadas em seguida, então a Conta pode se reescrever mais uma vez logo depois.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# O reconhecimento do cancelamento da assinatura

## O que desenhar

A confirmação de que o cancelamento da assinatura Premium REALMENTE aconteceu. Ela vive na aba **Conta**,
logo depois do diálogo "Cancelar a assinatura?": o vendedor confirma, o diálogo fecha, e a única coisa que
lhe diz "pronto, aconteceu" é um toast efêmero de tom `success` com a frase "Assinatura cancelada. Premium
ativo até 12/09/2026." — que some sozinho em 5 segundos. Em paralelo, a linha "Plano" do painel se
reescreve para o estado cancelado. Quem usa: um MEI solo que acabou de tomar uma decisão de dinheiro
irreversível-na-prática e precisa saber (a) que ela foi registrada, (b) até quando ainda tem o que pagou,
(c) que nada dele foi apagado. Desenhe o **par**: o toast e o eco persistente na linha do plano.

## Por que este prompt existe

Nada disso foi desenhado. O toast é disparado do `onSuccess` do hook (`use-subscription.ts`), e mora ali
porque o diálogo DESMONTA no flip de estado — medido na homologação T028/B2: um `MutationObserver` sobre o
toaster, armado antes do clique e observado por 8s, registrou **zero inserções**. A copy existia no bundle
afirmando um reconhecimento que em runtime nunca acontecia. O primitivo `tf-toast` existe no DS
(`claude-design-prototype.md` §D.2), mas **nenhuma tela de cobrança do protótipo dispara toast** (§E8 termina
na tela de planos) e o canvas 018 não tem toast em artboard nenhum. O que falta não é o componente: é a
decisão de desenho sobre se um aviso que some sozinho BASTA como recibo de uma ação de cobrança.

## O que já existe hoje (não invente do zero — corrija)

**O toast** (`tf-toast--success`, dentro da região `tf-toaster`):

| Parte | Hoje |
| --- | --- |
| Ícone | Lucide `circle-check`, 18px, cor `--success-text` |
| Mensagem | "Assinatura cancelada. Premium ativo até {data}." — `--fs-body-sm`, `--lh-snug` |
| Sem data | "Assinatura cancelada. Premium ativo até o fim do período já pago." |
| Fechar | botão só-ícone `x` de 16px, alvo `--touch-min`, `aria-label` "Fechar", cor `--text-muted` |
| Caixa | `--surface-raised`, borda 1px `--border-subtle`, raio `md`, sombra `md` |
| Região | largura `min(92vw, 30rem)`; mobile centrado embaixo, acima da tab bar; ≥768px canto inferior direito |
| Duração | 5000ms com auto-dispensa; fila em coluna com 8px de intervalo; `role="status"`, `aria-live="polite"` |

→ **Problema 1:** o toast não tem título, hierarquia nem ação. É uma linha de texto corrida para um evento
de cobrança — visualmente idêntico a um "Filamento salvo".
→ **Problema 2:** a frase do toast ("Assinatura cancelada. Premium ativo até 12/09/2026.") é quase a mesma
do diálogo que acabou de fechar ("Seu Premium continua ativo até 12/09/2026."). Nada no desenho separa
*vai acontecer* de *aconteceu*.
→ **Problema 3:** some em 5s e não deixa rastro próprio. O único eco é a legenda da linha do plano — que
pode estar fora da tela se a Conta estiver rolada.
→ **Problema 4 (desktop):** a região do toaster foi desenhada para o mobile com tab bar. No layout 018
(rail lateral + ficha de 560px à direita) ninguém decidiu onde essa caixa cai — ela pode nascer por cima
da ficha.

**O eco na linha "Plano"** (Conta, linha em `tf-card`), depois do cancelamento:

- rótulo "Plano"; badge **verde** `tf-badge--success` com "Premium" — continua verde de propósito: o
  Premium SEGUE ativo até a data;
- legenda: "ativo até 12/09/2026 · não renova" (`--fs-caption`, `--text-muted`);
- nota: "Seus itens salvos continuam disponíveis; nada é apagado." — e, quando uma cortesia sobrevive ao
  fim do período pago, ganha ainda "Seu acesso de cortesia continua depois disso.";
- ação: botão `sm` "Assinar novamente";
- se a leitura veio do cache, a legenda ganha " · última informação do servidor".

## Conteúdo e dados reais

- **Data**: `dd/mm/aaaa` em pt-BR, vinda da resposta do servidor (`currentPeriodEnd`), nunca da que estava
  na tela. Exemplo real: **12/09/2026**. Pode ser nula — daí a variante sem data.
- **Preços que o vendedor deixa de pagar** (aparecem na oferta de reassinar, não no toast):
  **R$ 15,99/mês** e **R$ 155,88/ano** ("equivalente a R$ 12,99/mês").
- Texto mais longo possível do toast hoje: "Assinatura cancelada. Premium ativo até o fim do período já
  pago." — 63 caracteres, quebra em 2–3 linhas a 390px. Desenhe COM essa string, não com a curta.
- Nada aqui é opcional exceto a data; a nota de cortesia é derivada (só quando a cortesia ultrapassa a data).

## Estados obrigatórios

1. **Sucesso com data** — toast `success`: "Assinatura cancelada. Premium ativo até 12/09/2026."
2. **Sucesso sem data** — "Assinatura cancelada. Premium ativo até o fim do período já pago." (2–3 linhas).
3. **Entrada e saída** — como aparece e como some (130/190ms, ease-out) e o que acontece com
   `prefers-reduced-motion`. Desenhe também a **fila**: dois toasts empilhados.
4. **Foco / hover / pressionado do "Fechar"** — anel roxo de 3px em `:focus-visible`, `--text-muted` →
   `--text-strong` no hover. O alvo é ≥44px mesmo com o ícone de 16px.
5. **Carregando (antes)** — o botão "Cancelar assinatura" dentro do diálogo em estado de carregamento; o
   diálogo ainda está montado. É o único "processando" honesto deste fluxo.
6. **Erro** — NÃO é toast: o diálogo continua montado e mostra um `tf-alert--danger` com "Não foi possível
   cancelar agora. Nada mudou — tente de novo em instantes." Desenhe esse quadro junto, porque é o par do
   sucesso e é onde a falha de rede aparece.
7. **Eco persistente pós-flip** — a linha "Plano" no estado cancelado (badge verde "Premium" + "ativo até
   12/09/2026 · não renova" + a nota + "Assinar novamente").
8. **Degradado / leitura offline** — a mesma linha com " · última informação do servidor" na legenda.
9. **Cortesia sobrevive** — a linha com as DUAS frases da nota, que é o caso em que o texto fica mais alto.

## Viewports

- **390px** — obrigatório: é onde o vendedor cancela, onde o toast concorre com a tab bar (ele nasce acima
  dela) e onde a frase longa quebra.
- **1280px** — obrigatório: o layout 018 tem rail lateral e ficha de 560px à direita, exatamente onde o
  toaster ancora acima de 768px. Mostre onde a caixa cai sem cobrir a ficha nem o botão que a disparou.
- **1920px** — opcional, só se a ancoragem mudar; se não mudar, diga que 1280 vale.

## Regras que o desenho não pode quebrar

- **O badge não pode degradar.** Enquanto a data não chegou, o Premium está ativo; pintá-lo de cinza mentiria
  na direção mais cara — faria o vendedor parar de usar o que já pagou.
- **A data é fato do servidor.** Ela nunca aparece sem o que significa ("ativo até", "não renova"). Não
  invente "expira em" nem contagem regressiva.
- **Falha nunca vira upsell.** O caminho de erro diz "Nada mudou" e não oferece nada.
- **Sem padrão escuro na volta.** "Assinar novamente" é um botão comum; nada de escassez, urgência ou
  destaque punitivo por ter cancelado.
- **A frase honesta ("nada é apagado") mora em elemento de largura total**, nunca cortada por reticências.
- Alvo ≥44px no "Fechar"; contraste medido do `--text-muted` sobre `--surface-raised` (é o pior par da peça).

## Armadilhas já pagas neste projeto

- **T028/B2**: um toast que existia na copy e nunca renderizava — 0 inserções em 8s. Portanto: se o desenho
  depender de o toast aparecer, ele precisa dizer por quanto tempo e o que fica quando ele some.
- **T028/A3**: dois estados de cobrança com temperatura visual idêntica (carência lia como saudável). Aqui
  o risco gêmeo é "cancelado" ler igual a "ativo".
- **Homologação 016**: quebra de linha entre `R$` e o valor numa linha de preço — o separador é NBSP.
- **Overflow medido**: 100,5px de transbordo horizontal e um botão nascido fora da viewport nesta mesma
  tela de cobrança. Um toast de 30rem numa viewport de 390px precisa ser medido, não estimado.
- **Texto ocluso passa em teste**: uma asserção de visibilidade não vê uma caixa coberta pela ficha do desktop.

## Entregável

Pranchetas, em **escuro** (padrão) e **claro** (first-class), reutilizando os primitivos:

1. **Toast — sucesso com data**, 390px, escuro e claro (`tf-toast--success`, `tf-icon` com `circle-check` e `x`).
2. **Toast — sucesso sem data + fila de dois**, 390px, mostrando a quebra da frase longa.
3. **Movimento**: entrada, repouso e saída, mais a variante de movimento reduzido.
4. **O eco na Conta**: a linha "Plano" cancelada, mobile e 1280px (`tf-card`, `tf-badge--success`, `tf-btn--sm`).
5. **O par de erro**: diálogo montado com `tf-alert--danger` e o botão de confirmação carregando.
6. **Desktop 1280px**: ancoragem do toaster junto do rail e da ficha, com as medidas de folga.

Se você concluir que o toast sozinho não basta para uma ação de cobrança, **proponha a alternativa como
prancheta extra** (ex.: toast + destaque temporário na linha do plano), rotulada como proposta — não
substitua a existente sem dizer.

## Perguntas em aberto para o dono

1. Um aviso que some em 5s basta como recibo de cancelamento, ou uma ação de cobrança exige um toast que só
   sai por dispensa manual e/ou um destaque temporário na linha do plano?
2. O toast deve carregar uma ação ("Ver plano" / "Assinar novamente") ou permanece só texto + fechar?
3. Existe recibo fora do app (e-mail do Mercado Pago) que o toast possa citar? Se existe, a frase muda.
4. No desktop 018, o toast ancora no canto inferior direito (por cima da área da ficha) ou passa a nascer
   dentro da coluna de conteúdo, ao lado do painel que o originou?
