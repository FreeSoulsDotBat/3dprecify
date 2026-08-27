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

- **Onde vive:** O PRIMEIRO cartão da Conta — topo da coluna 1 no desktop, primeiro bloco da pilha no mobile, logo abaixo do cabeçalho "Conta". Em repouso é uma linha: avatar circular de 44px com a inicial + o e-mail (truncado com reticências). Carregando: o mesmo cartão contendo APENAS um spinner centrado (sem esqueleto de avatar nem de e-mail). Em erro: o cartão vira coluna e recebe uma tarja vermelha com o título "Não foi possível carregar sua conta" e, no caso genérico, um botão "Tentar novamente" abaixo dela.
- **Como o vendedor chega:** É o primeiro elemento que o vendedor vê ao tocar na aba Conta — o estado de carregamento aparece no primeiro instante de toda visita; o de erro, quando o token expirou ou a leitura de identidade falhou.
- **Vizinhança imediata:** Acima: o cabeçalho "Conta". Imediatamente abaixo: o cartão "Plano" — que no mesmo momento tende a estar no seu estado "Não foi possível confirmar seu plano." ou defasado, de modo que os dois cartões do topo falham juntos. Quando a sessão expira, o shell também exibe uma faixa fixa "Sua sessão expirou / Entre de novo para continuar de onde parou." com o botão "Entrar de novo" — mas ela é do shell, não deste cartão.
- **Dados que chegam (e o que ela devolve):** `GET /api/v1/me`. Duas leituras diferentes do mesmo erro: se for 401/token expirado, a tarja mostra a frase de sessão expirada e NÃO renderiza botão nenhum; em qualquer outra falha, mostra a mensagem genérica com "Tentar novamente". O cartão nunca inventa uma identidade de reserva — o e-mail não vira `title` de DOM (evita vazar PII em telemetria).
- **O que acontece depois:** "Tentar novamente" refaz a leitura com spinner no próprio botão; sucesso devolve o cartão à forma avatar + e-mail. No caso de sessão expirada, o único caminho de volta ao login está fora deste cartão (a faixa do shell); a partir de `/sign-in` o vendedor volta e a Conta recarrega identidade, plano e cache por conta.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Cartão de identidade da Conta — carregando, sessão expirada e falha

## O que desenhar

O primeiro cartão da aba **Conta**: o bloco que diz quem está logado (círculo com a inicial + o e-mail).
Ele fica no topo da primeira coluna, imediatamente acima do cartão **Plano** — é a primeira coisa que o
vendedor lê quando abre a Conta, e é o cartão que responde à pergunta "esta é a minha conta mesmo?".
O que precisa de desenho não é o cartão resolvido (esse já existe): são os **três estados em que ele não
tem o e-mail para mostrar** — enquanto o servidor não respondeu, quando a sessão expirou, e quando a
chamada falhou por outro motivo. É a mesma pessoa, no mesmo lugar, em três momentos diferentes.

## Por que este prompt existe

Os três estados foram decididos direto no código, sem nenhum desenho: o carregando virou um cartão com um
*spinner* solto no meio e nada mais; a sessão expirada virou uma tarja vermelha **sem nenhum botão**; e o
erro genérico virou a mesma tarja com um "Tentar novamente" abaixo. O canvas de layout do 018 desenha
**apenas o cartão resolvido** (avatar "M" + `maker@truthsforge.com` + o rótulo "Conectado como" — rótulo
que, aliás, o app **não** renderiza), e a lista de estados de referência traz só "Email Google".
A rodada 1 de homologação pediu esqueletos e um erro-com-retry, e isso foi desenhado e entregue — mas para
as **listas** de Catálogo e Histórico, não para este cartão. Esse padrão de lista é o precedente mais
próximo e é o ponto de partida, não a resposta: ele não sabe o que fazer com a variante **sem botão** (na
sessão expirada, tentar de novo não resolve nada — o caminho certo é voltar ao login) nem como o cartão
empilha no estreito. → O empilhamento atual do erro nasceu de uma **medição de defeito**, não de desenho.

## O que já existe hoje (não invente do zero — corrija)

| Estado (no código) | O que aparece hoje | Problema |
| --- | --- | --- |
| Carregando (`isLoading`) | Cartão vazio com um *spinner* centralizado. Rótulo só para leitor de tela: "Carregando…" | → O cartão muda de altura e de forma quando resolve: sai um spinner centralizado, entra uma linha avatar+e-mail alinhada à esquerda. Salta. |
| Sessão expirada (401 / `UNAUTHENTICATED` / `TOKEN_EXPIRED`) | Tarja vermelha com título **"Não foi possível carregar sua conta"** e o texto **"Sua sessão expirou. Entre novamente."** — e **nenhum botão** | → Não há porta de volta ao login desenhada. O texto manda "entre novamente" e não oferece onde. |
| Falha genérica (rede, 500, 404, 403) | Mesma tarja vermelha, texto vindo do código do erro, e abaixo o botão secundário **"Tentar novamente"** (que vira estado carregando enquanto refaz a chamada) | → O título afirma "sua conta" mesmo quando o problema é a rede. |
| Resolvido | Círculo de 44px com a **inicial maiúscula** do e-mail sobre a cor de acento + o e-mail em uma linha, com reticências se não couber | → O rótulo "Conectado como" existe na copy e no canvas, mas não é renderizado. |
| Sem dado (`data` vazio) | **O cartão inteiro desaparece** da página | → Buraco silencioso: a coluna começa direto no Plano, sem explicação. |

Correção à ficha da auditoria: o *design system* **não tem** hoje um primitivo `Skeleton` — só `Spinner`.
Se o desenho pedir esqueleto (e ele deveria), isso é um primitivo novo a especificar aqui.

## Conteúdo e dados reais

- **Avatar**: círculo de 44×44px, fundo de acento, uma letra — a primeira do e-mail, em maiúscula. É
  decorativo (o leitor de tela o ignora); a informação está no e-mail.
- **E-mail**: uma linha só, sem quebra, com reticências no fim quando estoura. Exemplos verdadeiros para
  desenhar: `maker@truthsforge.com` (curto) e `jonatan.fernandes.bossan@meuateliedeimpressao.com.br`
  (o caso que estoura a coluna a 390px). **Não** existe nome de exibição — o servidor devolve só `uid` e
  `email`.
- **Quando o e-mail é nulo**, o app cai para o `uid` opaco: `8f3c1d2a9b7e4f60a1c3d5e7`. Ilegível para
  humano, e é a única "identidade" que sobra. Desenhe esse caso.
- **Sem PII em dica de ferramenta**: o e-mail nunca vai para um `title`/tooltip (vazaria para a telemetria).
  Se não couber, o desenho tem que resolver por layout, não por tooltip.
- **Frases literais disponíveis** (não reescreva sem dizer que está reescrevendo):
  "Não foi possível carregar sua conta" · "Sua sessão expirou. Entre novamente." ·
  "Algo deu errado. Tente novamente." · "Você não tem acesso a este recurso." ·
  "Não encontramos o que você procura." · "Tentar novamente" · "Conectado como" · "Sair".
  Já existe no app, no Histórico, a ação **"Entrar de novo"** que leva ao login preservando a página de
  origem como retorno — é o precedente exato do caminho que falta aqui.

## Estados obrigatórios

1. **Carregando** — o cartão ocupando a MESMA caixa do resolvido (mesma altura, mesmo alinhamento), com a
   forma do avatar e a forma da linha de e-mail insinuadas. Nada de texto inventado.
2. **Resolvido** — avatar + e-mail; decidir se "Conectado como" entra e onde (ver perguntas).
3. **Sessão expirada** — tom de perigo, título "Não foi possível carregar sua conta", corpo "Sua sessão
   expirou. Entre novamente." e uma ação de volta ao login. **Sem** "Tentar novamente": repetir a chamada
   com um token morto só produz o mesmo erro.
4. **Falha genérica** — mesma tarja + "Tentar novamente" (secundário).
5. **Tentando de novo** — o botão "Tentar novamente" em estado carregando, desabilitado, sem que o cartão
   mude de tamanho.
6. **Sem identidade legível** — e-mail nulo, só o `uid`.
7. **Foco de teclado** em cada ação (o vendedor navega por Tab), **hover** e **pressionado** nos botões.

## Viewports

- **390px (mobile)** — obrigatório: a Conta é uma coluna só, o cartão ocupa a largura toda.
- **360px** — obrigatório e adversarial: é a largura em que o defeito real aconteceu.
- **1280px** — o corte do desktop: a Conta vira três colunas e este cartão vive na primeira
  (a mais larga, ~1,15 de 3). O cartão fica visivelmente mais largo e a tarja de erro fica curta demais
  se for desenhada só como faixa.
- **1920px** — o desenho de referência do 018 foi feito nesta largura; mostre que o cartão não vira uma
  faixa vazia com uma letra perdida à esquerda.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é falta de Premium.** Este cartão não fala de plano, preço nem assinatura — nem
  quando falha. O cartão Plano, logo abaixo, é quem fala disso.
- **Sessão expirada não é problema de conexão.** A palavra "conexão"/"offline" não pode aparecer aqui:
  o app já pagou esse defeito uma vez, prometendo "sincroniza quando houver conexão" com a conexão intacta.
- **Nunca fabricar identidade.** Se o servidor não confirmou quem é, o cartão não mostra um e-mail
  lembrado, um nome de placeholder nem uma inicial genérica.
- **Toda ação tem alvo de toque de pelo menos 44px** e contraste medido contra o fundo real do cartão nos
  dois temas — inclusive o vermelho da tarja sobre o cartão escuro.
- **A frase honesta mora em elemento de largura inteira**, nunca dentro de campo, badge ou legenda curta que
  a corte no meio.
- **Nada de rolagem horizontal**, em nenhuma das quatro larguras.

## Armadilhas já pagas neste projeto

- O botão do erro **nasceu fora do cartão e fora da tela** a 360px (borda direita medida em 378,5 contra
  360 de tela) porque o cartão era uma linha feita para avatar+texto e o erro tem outra forma. O remendo
  foi empilhar. → O desenho precisa dizer que **erro e carregando têm arranjo próprio**, não o do resolvido.
- Na linha do Plano, ao lado, dois botões produziram **100,5px de transbordo** a 390px, com um botão
  inteiramente fora da viewport. Mesma família de defeito, mesma tela.
- Um e-mail longo é o valor grande que estoura a coluna: verifique com o e-mail comprido acima.
- Texto ocluído ou transbordado **passa** em teste automático — a prova é geométrica e visual.

## Entregável

Pranchetas do cartão isolado, **em tema escuro (padrão) e claro (igual em cuidado)**, uma por estado:
carregando · resolvido · sessão expirada · falha genérica · tentando de novo · identidade só com `uid`;
mais **uma prancheta de contexto** por viewport (390 e 1280) mostrando o cartão em erro **acima do cartão
Plano**, para provar que duas tarjas/ações vizinhas não competem. Reaproveite os primitivos existentes,
sem criar variantes novas: cartão para o contêiner, alerta em tom de perigo para as duas falhas, botão
secundário para "Tentar novamente" e para "Sair", indicador de atividade para o carregando do botão. Se
propuser um esqueleto de carregamento, especifique-o como **primitivo novo do DS** (ele ainda não existe),
com as duas formas que este cartão usa: um círculo de 44px e uma barra de linha única.

## Perguntas em aberto para o dono

1. Na sessão expirada, o cartão deve oferecer **"Entrar de novo"** (o mesmo caminho que o Histórico já usa,
   voltando para a Conta depois do login) ou **"Sair"**, que limpa a sessão morta e devolve à tela de
   entrada? São produtos diferentes: um preserva o destino, o outro descarta a sessão.
2. Sessão expirada é problema **deste cartão** ou **da página inteira**? Se o token morreu, o cartão Plano
   ao lado também vai falhar — o desenho pode mostrar duas tarjas vermelhas empilhadas dizendo a mesma
   coisa. Um aviso único no topo da Conta resolveria; é decisão de produto.
3. O rótulo **"Conectado como"** entra no cartão resolvido (o canvas o desenha, o app não o renderiza)?
   E se entrar, antes do e-mail ou depois?
4. Quando o e-mail é nulo e sobra o `uid` opaco: mostrar o `uid` cru, mostrar um texto de "conta sem
   e-mail", ou tratar como falha?
