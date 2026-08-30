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

- **Onde vive:** Rota `/conta?checkout=retorno`, estado 1 de 3 do mesmo cartão. É uma TOMADA DE PÁGINA: a Conta devolve, antes da grade de três colunas, apenas o cabeçalho `PageHeader title="Conta"` e, logo abaixo dele, um único `Card` centrado (classe `tf-billing-return`, conteúdo em coluna, `text-align:center`), largura da coluna de página (`tf-page-wide`, centrada). Ordem interna do cartão: Spinner → h2 "Confirmando seu pagamento…" → parágrafo → linha de dois botões.
- **Como o vendedor chega:** O vendedor NÃO navega até aqui: o Mercado Pago devolve o navegador para esta URL depois do checkout (Pix ou cartão). Ele chega vindo de fora do app, ansioso, sem saber se foi cobrado — e o app também não sabe. Chega logado; se tinha vindo por um teaser, a intenção original já se perdeu.
- **Vizinhança imediata:** Acima: o cabeçalho "Conta" e, ao redor, o shell inteiro continua desenhado — barra de abas embaixo no celular, barra lateral/trilho à esquerda no desktop, com a aba Conta acesa. Abaixo do cartão: nada; a identidade, o plano, o tema, a privacidade e o "Sair" não são montados neste estado. Dentro do cartão, o Spinner fica sozinho no topo, e a linha final tem "Atualizar" (secundário) e "Voltar para a Conta" (fantasma), empilhados em coluna.
- **Dados que chegam (e o que ela devolve):** Nada do MP: o app relê `GET /api/v1/entitlement` (o ledger do servidor) a cada 3 segundos, no máximo 15 vezes (~45 s), e só aceita como sucesso `status=active` com origem `payment`. O tempo restante não é exibido em lugar nenhum — não há contador, barra nem indicação de duração. "Atualizar" força uma releitura imediata sem zerar a contagem.
- **O que acontece depois:** Assim que o webhook verificado do MP grava o acesso, o cartão TROCA sozinho para o estado de sucesso, sem aviso sonoro, sem `aria-live` e sem mover o foco. Esgotadas as 15 tentativas, troca para o estado "Ainda não recebemos a confirmação". "Voltar para a Conta" leva a `/conta` limpa (a grade normal volta, com o plano ainda podendo dizer "Gratuito").

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Retorno do checkout — a espera "Confirmando seu pagamento…"

## O que desenhar
A tela inteira que o vendedor encontra quando volta do checkout hospedado do Mercado Pago para o app,
na rota `/conta?checkout=retorno`. É uma tela só, com **três desfechos mutuamente exclusivos**:
(1) **aguardando** — o app pergunta ao servidor, a cada 3 segundos, até 15 vezes (≈45 s), se o Premium
já foi liberado; (2) **confirmado** — o servidor confirmou o pagamento; (3) **não confirmado** — a
paciência acabou sem resposta positiva. Ela toma a página da Conta por completo: acima dela sobra
apenas o cabeçalho "Conta", e a grade de três colunas da Conta (identidade+plano · tema · privacidade)
não é renderizada. É o instante de maior ansiedade da jornada inteira: o cartão pode ter sido cobrado
e o app honestamente ainda não sabe.

## Por que este prompt existe
Nenhuma das quatro autoridades de desenho cobre isto. O protótipo de 2026-07-02 **exclui o assunto por
escrito duas vezes** (a seção se chama "Upsell (sem checkout — E6 fora de escopo)" e o §J repete que o
fluxo de upsell termina na tela de planos); o `Abas-Desktop.dc.html` do 018 trata `plano` como enum
binário `"premium" | "free"` e não tem nenhuma ocorrência de checkout/retorno; o kit de UI diz no
cabeçalho do arquivo "Pagamento (Mercado Pago) integra depois — só a tela". Ou seja: a peça que decide
a confiança do vendedor no momento em que ele acabou de pagar foi inteiramente inferida por IA a partir
de requisito textual. O que existe hoje é um cartão centralizado com spinner, título, parágrafo e dois
botões — e **nenhuma representação da passagem do tempo**, o que é justamente o que falta em 45 segundos
de silêncio.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/billing/checkout-return.tsx`, `billing.css` (`.tf-billing-return`),
`pages/conta/conta-page.tsx`, textos em `shared/i18n/messages.pt-br.ts` (`messages.billing`).

| Desfecho | Ícone / indicador | Título (h2) | Corpo (p) | Ações (nesta ordem) |
|---|---|---|---|---|
| Aguardando | `Spinner` (indeterminado, rótulo de leitor de tela "Carregando…") | "Confirmando seu pagamento…" | "Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada." | "Atualizar" (secundário) · "Voltar para a Conta" (fantasma) |
| Confirmado | ícone `crown`, 28 px | "Premium ativo!" | "Seu catálogo, kits, orçamentos e simulações agora salvam e exportam. Bom trabalho." | "Ir para a calculadora" (primário, sozinho) |
| Não confirmado | ícone `circle-alert`, 28 px | "Ainda não recebemos a confirmação" | "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se você não concluiu, nada foi cobrado." | "Verificar de novo" (secundário) · "Voltar para a Conta" (fantasma) |

Estrutura visual atual: um `Card` em coluna, `gap` de 0,75 rem, **tudo centralizado** (`text-align:
center`), e os botões empilhados em coluna com 0,5 rem entre eles. O cartão **não tem largura máxima
própria** — herda a da página, que no 018 vai a 1720 px a partir de 1280 px.

→ **Problema 1 — o tempo é invisível.** 15 tentativas × 3 s ≈ 45 s sem contador, barra, tique ou
qualquer sinal de progresso. O spinner de hoje gira igual no segundo 2 e no segundo 44.
→ **Problema 2 — falha de rede é vendida como "pagamento não confirmado".** O componente lê apenas
"o Premium ficou ativo?"; ele ignora os estados que a fonte de dados oferece (erro sem resposta
alguma, resposta lembrada/vencida do cache do aparelho). Sem internet, o vendedor vê 45 s de spinner e
depois "Ainda não recebemos a confirmação" — uma frase que culpa o pagamento por um problema de
conexão. Isto contraria a regra da casa de nunca vender falha de rede como outra coisa.
→ **Problema 3 — a troca de estado é muda.** O cartão inteiro é substituído sozinho, sem região de
anúncio para leitor de tela e sem levar o foco para o novo conteúdo.
→ **Problema 4 — "Verificar de novo" reinicia silenciosamente outros ≈45 s.** Nada no desenho diz isso.
→ **Problema 5 — "Atualizar" contradiz o corpo**, que acabou de prometer "você não precisa fazer mais
nada". E o nome colide com o botão do próprio Mercado Pago no fluxo vizinho (no painel de plano, o
mesmo gesto foi renomeado "Recarregar" por ratificação do dono, exatamente para não colidir).
→ **Problema 6 — a composição foi pensada só para telefone.** Um cartão centralizado de largura livre e
botões empilhados em coluna a 1720 px é uma faixa de texto centralizado no vazio.

## Conteúdo e dados reais
- Preços que o vendedor acabou de ver na tela anterior (para coerência de tom, não para repetir aqui
  sem decisão do dono): "R$ 15,99/mês" ("cobrança todo mês, cancele quando quiser") e "R$ 155,88/ano".
- Antes desta tela: o botão "Assinar Premium" leva ao aviso honesto "Abrindo o Mercado Pago…" e o app
  entrega o vendedor ao checkout do MP (o cartão nunca passa pelo app — a Conta afirma isso com "O
  cartão nunca passa pelo nosso app.").
- Janela de sondagem: **3 s entre tentativas, 15 tentativas, ≈45 s no total** — números reais do código,
  não estimativa.
- O Premium só é ligado por confirmação verificada no servidor (webhook/reconciliação). O app **não
  tem** um estado "pagamento pendente" para exibir como selo: o caso "desisti no meio" tem que ficar
  indistinguível de "nunca comecei", e em nenhum lugar da Conta pode aparecer um "pendente premium".
- Nada nesta tela é editável. Não há campo, valor monetário calculado, nem número derivado.
- Depois desta tela: "Ir para a calculadora" (sucesso) ou de volta à Conta (demais casos).

## Estados obrigatórios
1. **Aguardando (repouso)** — spinner + "Confirmando seu pagamento…" + o corpo acima. Precisa mostrar
   que o tempo passa e que a espera é limitada (a forma é decisão do desenho: tique de tentativas,
   barra determinada de ~45 s, ou uma legenda de duração).
2. **Aguardando, com verificação manual em curso** — o vendedor tocou em "Atualizar": o botão precisa
   de um estado ocupado próprio (o dado de "consulta em voo" existe e hoje não é usado) e continuar
   com alvo ≥44 px.
3. **Confirmado** — coroa + "Premium ativo!" + corpo + ação única. Este é o único momento em que o app
   pode afirmar Premium; nada antes dele.
4. **Não confirmado (paciência esgotada)** — alerta + "Ainda não recebemos a confirmação" + corpo, com
   as duas ações. Deve deixar claro que "Verificar de novo" abre uma nova rodada de espera.
5. **Sem conexão / servidor sem resposta** — estado que hoje NÃO existe e precisa existir: texto próprio
   dizendo que não foi possível verificar agora, sem afirmar nem negar o pagamento (copy a ratificar
   pelo dono, ver perguntas).
6. **Sessão expirada durante o retorno** — o app já tem o caminho de volta "Entrar de novo" (padrão da
   correção A3); desenhe como ele aparece aqui sem parecer que o pagamento falhou.
7. **Já era Premium ao voltar** — a Conta tem a frase "Você já é Premium."; decida como esta tela se
   comporta se o vendedor cair aqui já com plano ativo por outra origem.
8. **Foco, hover, pressionado e desabilitado** dos dois botões, nos dois temas.
9. **Anúncio da mudança automática** — mostre no desenho onde vive a região que anuncia a troca de
   estado e para onde o foco vai quando o cartão é substituído sozinho.

## Viewports
- **Mobile 390 px** — obrigatório e prioritário: o retorno do checkout do MP acontece majoritariamente
  no telefone, e é onde o vendedor está enquanto espera.
- **Desktop 1280 px** — o corte do 018; aqui a página passa a usar largura larga e o cartão de hoje
  fica solto. Defina largura máxima da peça e o alinhamento dos botões (lado a lado ou empilhados).
- **Desktop 1920 px** — só para provar que a peça não vira uma linha de texto perdida em 1720 px de
  página. Um artboard basta.

## Regras que o desenho não pode quebrar
- **Nunca antecipar o Premium.** Enquanto o servidor não confirmar, nada de coroa, nada de badge verde,
  nada de "processando seu Premium" — o app realmente não sabe se houve cobrança.
- **Falha de rede jamais é vendida como pagamento não confirmado** (nem o contrário).
- **Abandonar o checkout é indistinguível de nunca ter começado**: a frase "Se você não concluiu, nada
  foi cobrado" é a promessa; nenhum resíduo de "pendente" pode sobrar na Conta.
- **Frase honesta nunca dentro de placeholder** nem em elemento que corta: as três frases acima são
  longas e precisam de bloco de largura inteira.
- **Freemium binário**: ou é Premium, ou não é. Não invente um terceiro selo de plano.
- Alvo de toque **≥44 px** nos dois botões, inclusive no fantasma.
- Contraste medido contra o fundo real do cartão, nos dois temas — o texto secundário do corpo é o de
  maior risco.

## Armadilhas já pagas neste projeto
- **O aviso que nunca apareceu**: no billing PR-B uma confirmação existia no código e nunca renderizou
  porque o diálogo desmontava antes do retorno da chamada — aqui há troca automática de estado, então
  desenhe a confirmação como **conteúdo permanente da tela**, nunca como aviso efêmero pós-ação.
- **100,5 px de estouro horizontal com um botão nascido fora da viewport** (mesma tela de billing).
  Meça a largura da peça a 390 px com os botões nos rótulos reais.
- **Estouro vertical que o headless não vê**: barra de rolagem clássica não aparece em teste; meça os
  dois eixos com o cartão no seu estado mais alto (não confirmado + aviso de rede).
- **Texto ocluso passa em teste**: título e corpo precisam de caixa medida, não só de presença.
- **Sufixo cortado em placeholder** (016): qualquer contagem ou legenda de tempo vive em elemento
  próprio de largura inteira, não pendurada no fim de outra frase.

## Entregável
Pranchetas, tema **escuro como padrão e claro como primeira classe** (ambos desenhados, não derivados):
390 px × {aguardando, aguardando com verificação manual em curso, confirmado, não confirmado, sem
conexão}; 1280 px × {aguardando, não confirmado}; 1920 px × {aguardando}. Mais uma prancheta de detalhe
com os estados de foco/hover/pressionado/desabilitado dos dois botões e a marcação de para onde vai o
foco na troca automática.

Reutilize os primitivos existentes, sem criar novos: o contêiner é o **card** da casa; o indicador de
espera é o **spinner** (tamanhos sm/md/lg já existentes); os ícones são **`crown`** (confirmado) e
**`circle-alert`** (não confirmado), 28 px; as ações são o **botão secundário** ("Atualizar" /
"Verificar de novo"), o **botão fantasma** ("Voltar para a Conta") e o **botão primário** ("Ir para a
calculadora"); o aviso de rede usa o mesmo bloco de alerta que a oferta de planos já usa; o título
"Conta" acima da peça é o **cabeçalho de página** padrão. Indique no desenho o que muda e o que
permanece entre os três desfechos — é uma tela, três desfechos, e a continuidade visual entre eles é
parte do que precisa ser desenhado.

## Perguntas em aberto para o dono
1. **Mostrar a passagem do tempo como quê?** Contador de tentativas, barra determinada de ~45 s, ou
   apenas uma legenda ("costuma levar menos de um minuto")? E qual a frase exata — copy nova precisa da
   sua ratificação.
2. **"Atualizar" continua existindo?** O corpo promete que nada é preciso, e o mesmo gesto já foi
   renomeado "Recarregar" no painel de plano para não colidir com o botão do Mercado Pago.
3. **O trilho de navegação e as abas continuam visíveis e clicáveis durante a espera**, ou a tela é
   focada, sem navegação lateral, até haver um desfecho?
4. **Sem conexão: qual é a frase?** Precisa ser distinta de "Ainda não recebemos a confirmação" e não
   pode afirmar nada sobre a cobrança.
5. **Depois do "não confirmado", existe um caminho de suporte** (falar com a gente, consultar o
   comprovante no Mercado Pago), ou o único destino continua sendo voltar para a Conta?
6. **"Verificar de novo" deve abrir outra rodada de ≈45 s** com a mesma tela de espera, ou uma
   verificação única com resposta imediata?
