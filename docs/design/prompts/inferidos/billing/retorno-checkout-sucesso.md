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

- **Onde vive:** Mesma rota `/conta?checkout=retorno`, mesmo `Card.tf-billing-return` no lugar da página inteira — estado 2 de 3, que SUBSTITUI o cartão de espera no mesmo ponto do DOM. Ordem interna: ícone de coroa (28px) → h2 "Premium ativo!" → um parágrafo → UM botão "Ir para a calculadora".
- **Como o vendedor chega:** Chega por transição automática: o vendedor estava olhando o spinner e o cartão vira este sozinho, no instante em que o servidor confirma o grant. Estado emocional: alívio — é o único momento de confirmação de compra do produto inteiro.
- **Vizinhança imediata:** Acima: cabeçalho "Conta" e o shell com a aba Conta acesa. Abaixo: nada — nenhum resumo de plano, nenhuma linha do plano, nenhum bloco de privacidade. Dentro do cartão o botão é único e fica centrado no rodapé do cartão (aqui não há a linha de dois botões dos outros dois estados).
- **Dados que chegam (e o que ela devolve):** Só um booleano derivado do ledger (entitlement ativo com origem `payment`). NÃO chegam: valor pago, plano contratado (mensal/anual), data da próxima cobrança, meio de pagamento nem link para o comprovante do MP — nada disso é lido nesta tela, embora o espelho da assinatura exista no servidor.
- **O que acontece depois:** O botão navega para `/calcular` — sempre a calculadora, mesmo que o vendedor tenha vindo de um teaser de Kits ou Orçamentos; a intenção de origem é descartada aqui. A partir deste ponto, todo o app muda: os cinco teasers somem, os pickers do catálogo aparecem, o bloco de Marketplace destranca e salvar/exportar passa a funcionar. Voltando à Conta depois, a linha do plano mostra selo verde "Premium".

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Retorno do checkout — a única confirmação de compra do produto

## O que desenhar

A tela que o vendedor vê ao voltar do Mercado Pago depois de pagar. O Mercado Pago devolve o navegador
para `/conta?checkout=retorno`, e essa rota **toma a página Conta inteira**: some o painel de plano, some
o tema, some a privacidade, some o "Sair" — fica apenas o cabeçalho "Conta" e um único cartão centralizado.
Esse cartão assume um de **três estados**, decididos por consulta ao servidor (o app **não sabe**, na volta,
se o pagamento passou — quem escreve o direito é o webhook verificado). É o único momento de confirmação de
compra do produto inteiro: quem chega aqui é um vendedor autônomo que acabou de tirar R$ 155,88 (anual) ou
R$ 15,99 (mensal) do bolso, provavelmente no celular, provavelmente com pressa.

## Por que este prompt existe

Nunca houve desenho desta tela. O protótipo de 2026-07-02 termina na "Tela de planos Free × Premium" com
preços "R$ —" e **sem checkout** — o `onSubscribe` do `PremiumScreen` literalmente cai no `onClose`: o
protótipo FECHA a tela no clique de assinar e não desenha nada depois. O canvas 018 também não tem artboard
de confirmação (a prop `plano` já nasce `premium` ou `free`, sem transição). Autoridade de desenho: NENHUMA.
O que existe hoje foi composto por inferência: coroa de 28px + título + uma frase + um botão. Sem valor pago,
sem plano contratado, sem data da próxima cobrança, sem link para o comprovante do Mercado Pago. E o botão
manda para a calculadora — descartando a intenção que o app carregou até aqui (o teaser que originou a
compra sempre aponta para `/conta?assinar=1`, e a superfície onde o vendedor bateu no teaser é esquecida
exatamente no momento em que ele finalmente pode usá-la).

## O que já existe hoje (não invente do zero — corrija)

Um cartão só (`Card`), coluna, `gap` 0.75rem, **texto centralizado**, dentro de uma página de largura ampla.

**Estado SUCESSO** (o servidor confirmou: direito `active` com origem `payment`):

| elemento | conteúdo literal hoje |
|---|---|
| ícone | coroa (`crown`), 28px, decorativa |
| título (h2) | "Premium ativo!" |
| corpo | "Seu catálogo, kits, orçamentos e simulações agora salvam e exportam. Bom trabalho." |
| ação única | "Ir para a calculadora" (botão primário) → `/calcular` |

→ **Problema 1:** não há recibo. Nenhum valor, nenhum plano ("Plano anual"/"Plano mensal"), nenhuma data de
próxima cobrança, nenhum caminho para o comprovante. O vendedor não tem onde conferir o que comprou.
→ **Problema 2:** a coroa de 28px carrega sozinha toda a celebração de uma compra — é menor que o título.
→ **Problema 3:** o único destino é a calculadora, que já era grátis e não é o que ele acabou de comprar.
→ **Problema 4:** no desktop esse cartão fica sozinho num container largo — desenhe a largura máxima dele.

**Estado CONFIRMANDO** (padrão ao chegar; consulta o servidor a cada 3s, no máximo 15 vezes ≈ 45s):
`Spinner` + h2 "Confirmando seu pagamento…" + "Estamos verificando com o Mercado Pago. Assim que confirmar,
o Premium liga sozinho — você não precisa fazer mais nada." + dois botões empilhados: "Atualizar"
(secundário) e "Voltar para a Conta" (fantasma).

**Estado NÃO CONFIRMADO** (a paciência de ~45s acabou): ícone `circle-alert` 28px + h2 "Ainda não recebemos
a confirmação" + "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se
você não concluiu, nada foi cobrado." + "Verificar de novo" (secundário) e "Voltar para a Conta" (fantasma).

→ **Problema 5:** os três estados são visualmente quase o mesmo cartão — só troca o glifo de 28px. A compra
bem-sucedida não tem peso visual nenhum a mais que a espera.

Copy que **não** deve ser reinventada: as três frases de estado acima são deliberadas e já ratificadas —
elas existem para nunca vender um "processando" como sucesso e para tornar o abandono indistinguível de
"nunca comecei" ("Se você não concluiu, nada foi cobrado"). Mantenha-as verbatim.

## Conteúdo e dados reais

Preços literais do catálogo de planos (fonte única; o espaço entre `R$` e o número é NBSP):
"R$ 155,88/ano" · "equivalente a R$ 12,99/mês" · "~19% de economia frente ao mensal" · "R$ 15,99/mês" ·
"cobrança todo mês, cancele quando quiser". Rótulos de plano existentes: "Plano mensal" / "Plano anual".

O que o servidor **já tem** e a tela hoje ignora — desenhe espaço para isso:
- direito: `status` (`none` | `active` | `lapsed`), `source` (aqui: `payment`), `expiresAt` (data ISO);
- espelho do Mercado Pago: `plan` (`monthly` | `annual`), `currentPeriodEnd`, `cancelAtPeriodEnd`, `graceUntil`.

Exemplo concreto para as pranchetas: **Plano anual · R$ 155,88 · próxima cobrança em 20/08/2027**. Faça
também uma variante mensal: **Plano mensal · R$ 15,99 · próxima cobrança em 20/09/2026** — a data é o campo
que mais estica a linha. Frases já existentes que servem de vocabulário: "renova em", "ativo até".

## Estados obrigatórios

1. **Sucesso** — a peça principal. Coroa/celebração + "Premium ativo!" + o corpo verbatim + o bloco de
   recibo (plano, valor, próxima cobrança) + as ações.
2. **Confirmando (carregando)** — spinner + a frase de espera verbatim. Nunca insinua que a cobrança passou.
   Mostre também que a espera é **limitada** (é ~45s de consulta, não um giro infinito).
3. **Não confirmado** — alerta + a frase verbatim + "Verificar de novo".
4. **Offline / sem resposta do servidor** — **hoje esse estado não existe no código**: uma falha de leitura
   é indistinguível da espera e desemboca, 45s depois, em "Ainda não recebemos a confirmação". Desenhe-o
   separado: a rede falhou, a cobrança **não** está em questão, e nada é vendido como "não é premium".
5. **Foco (teclado)** — anel visível em cada botão, dentro da caixa do próprio botão.
6. **Repouso · hover · pressionado · desabilitado** dos botões; "Atualizar"/"Verificar de novo"
   desabilitados/ocupados enquanto a consulta está em voo.

## Viewports

- **Mobile 390px** — obrigatório, é o caso real: o retorno do Mercado Pago acontece no celular. Cartão de
  largura total, ações empilhadas, cada uma com altura de alvo ≥44px.
- **Desktop 1280px** — obrigatório: a Conta tem layout desktop e essa rota toma a página inteira. Defina a
  largura máxima do cartão e o alinhamento horizontal; hoje ele herda um container amplo e fica órfão.
- 1920px opcional, só se a decisão de largura máxima mudar nessa faixa.

## Regras que o desenho não pode quebrar

- **Nada de premium antecipado.** Só o estado 1 pode ter coroa, verde ou qualquer sinal de "ativo". Os
  estados 2, 3 e 4 são neutros.
- **Falha de rede nunca é "você não é premium"** — o estado 4 diz "não consegui perguntar", não "não tem".
- **Procedência do número:** todo valor mostrado no recibo é o que o servidor/PSP respondeu, não um valor
  que a tela lembra do momento da oferta. Se um dado não vier, o desenho mostra a linha **ausente**, não um
  número plausível.
- **Frase honesta nunca em placeholder** nem em elemento que possa ser cortado — "Se você não concluiu, nada
  foi cobrado" precisa de largura inteira e quebra em quantas linhas precisar.
- **Alvo ≥44px** em todos os botões; contraste medido contra o fundo real do cartão nos dois temas.
- **Freemium binário:** não invente "premium parcial", "ativando", "pendente premium". São três estados e
  o quarto é rede.

## Armadilhas já pagas neste projeto

- **Quebra de linha entre `R$` e o valor a 390px** — já aconteceu num teaser: a linha terminou em
  "equivalente a R$" e a próxima começou em "12,99/mês". Nenhuma asserção de texto ou geometria vê isso
  (não há corte nem transbordo), só a imagem. Linha de preço não separa símbolo de número.
- **Transbordo horizontal medido nos dois eixos** — um botão já nasceu 100px fora da viewport nesta mesma
  área de billing; o headless não vê barra de rolagem clássica.
- **Texto ocluso passa em teste** — um elemento pode estar "visível" para a asserção e coberto na tela;
  o desenho precisa de folga real entre o cartão e o cabeçalho da página.
- **Data longa estica a linha** — "próxima cobrança em 20/08/2027" ao lado de "Plano anual" é o par que
  estoura primeiro no 390px; desenhe a versão empilhada.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. Sucesso · 390px — com o bloco de recibo (variante anual).
2. Sucesso · 390px — variante mensal (a data curta vs. longa muda o empilhamento).
3. Sucesso · 1280px — com a largura máxima do cartão resolvida.
4. Confirmando · 390px.
5. Não confirmado · 390px.
6. Offline · 390px (estado novo).
7. Um detalhe em close das ações mostrando repouso/hover/foco/ocupado.

Reaproveite os primitivos existentes, sem criar novos: `Card` para o contêiner; `Icon` (`crown`,
`circle-alert`) para o glifo — se a celebração precisar de mais peso, diga o **tamanho** da coroa em vez de
inventar uma ilustração; `Spinner` no estado 2; `Button` nas variantes primária/secundária/fantasma;
`Badge` para o rótulo de plano ("Plano anual"); `Alert` para o estado offline; e as linhas do recibo com
o mesmo par rótulo/valor que a Conta já usa. O valor pago, se aparecer com destaque, usa a escala de preço
já existente — não uma tipografia nova.

## Perguntas em aberto para o dono

1. **A confirmação vira recibo?** Mostrar plano + valor pago + data da próxima cobrança nesta tela é uma
   decisão de produto (exige consultar o espelho do PSP no retorno, além do direito). Se sim: os três dados
   ou só plano + próxima cobrança?
2. **Link para o comprovante do Mercado Pago** — abrir o comprovante do PSP em nova aba é desejado, ou o
   comprovante fica exclusivamente por e-mail do MP?
3. **Para onde vai o botão principal?** Hoje é sempre "Ir para a calculadora". O app carrega, até o momento
   do pagamento, a intenção de onde o vendedor bateu no teaser (catálogo, kits, orçamentos, simulações).
   Deve voltar para lá? E se não houver intenção guardada, o destino padrão é a calculadora ou a Conta?
4. **Quantas ações no sucesso?** Uma só, ou uma primária de destino + uma secundária "Ver minha assinatura"
   levando ao painel de plano na Conta?
5. **A espera de ~45s deve ser visível?** Mostrar que a verificação é limitada no tempo (contagem, barra,
   ou "verificando há alguns segundos") é honestidade a mais ou ansiedade a mais?
