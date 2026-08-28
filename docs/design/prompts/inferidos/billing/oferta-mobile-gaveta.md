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

- **Onde vive:** Gaveta lateral ancorada à DIREITA, ocupando toda a altura da tela e `min(92vw, 26rem)` de largura, com scrim por cima da Conta e um "X" de 44×44px no topo direito. Dentro, em coluna e com rolagem própria: título "Assinar o Premium" → "A calculadora é grátis e continua grátis." → "O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar." → o grupo de rádios com os DOIS cartões de plano empilhados (anual primeiro, pré-selecionado, com selo "recomendado", preço, equivalente mensal e economia; mensal abaixo, com a nota de cobrança) → botão "Assinar Premium" → duas frases cinzas de hand-off.
- **Como o vendedor chega:** Duas portas: (1) o botão da linha do plano na Conta — "Assinar Premium" (grátis) ou "Assinar novamente" (pausado/cancelado); (2) chegando de fora por `/conta?assinar=1`, vindo do "Assinar" de qualquer um dos cinco teasers Premium do app — nesse caso a gaveta já abre montada, sem clique nenhum.
- **Vizinhança imediata:** Por baixo do scrim, à esquerda, fica a Conta empilhada: identidade no topo, a linha do plano logo abaixo (é dela que o vendedor acabou de sair) e, mais abaixo, tema, privacidade e Sair. A barra de abas continua na base da tela. Abaixo de 1280px este é o ÚNICO caminho para a oferta; a partir de 1280px o mesmo painel também vive inline na coluna do plano.
- **Dados que chegam (e o que ela devolve):** Preços vêm de uma única constante de produto (R$ 155,88/ano · equivalente a R$ 12,99/mês · ~19% de economia; R$ 15,99/mês) — nunca há preço riscado nem "de/por". A escolha do rádio define o período mandado ao `POST /billing/checkout`. O painel também lê o entitlement: se a conta já for Premium, todo o miolo é substituído.
- **O que acontece depois:** O "Assinar Premium" leva o navegador para fora, ao checkout do MP; o retorno cai em `/conta?checkout=retorno`. Fechar (X, Esc ou toque no scrim) devolve a Conta intacta, sem nenhuma mudança de plano — e o foco volta ao botão que abriu a gaveta.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Gaveta "Assinar o Premium" (mobile, abaixo de 1280px)

## O que desenhar
A superfície de COMPRA do Precifica3D no mobile: uma gaveta que sobe sobre a tela de Conta com o título "Assinar o Premium", os dois planos (anual e mensal), o botão "Assinar Premium" e os avisos de que o pagamento acontece no Mercado Pago. Ela abre por dois caminhos: o vendedor toca no botão de assinar na linha do plano (aba **Conta**), ou chega de um dos quatro teasers premium (Catálogo, Kits, Orçamentos, Simulações) por `/conta?assinar=1` — nesse segundo caso a gaveta já aparece ABERTA assim que a página de Conta pinta, sem nenhum toque. É o único lugar do app onde alguém paga, e abaixo de 1280px é onde está a maioria dos vendedores.

## Por que este prompt existe
Nunca houve desenho desta gaveta. O que existe hoje é o mesmo bloco de oferta composto para o desktop de 1920px, jogado dentro de um painel lateral, com altura e rolagem que ninguém compôs. Existe SIM um desenho mobile de oferta — `PremiumScreen.jsx` (2026-07-02) — mas ele é outra peça: tela cheia com overlay, coroa + h1, bloco "NO PLANO GRÁTIS VOCÊ TEM" com quatro benefícios marcados, controle segmentado mensal/anual, UM preço grande, CTA `primary size=lg full glow` e um `ghost full` "Agora não". **Nada disso sobreviveu no código**: virou fieldset de rádios com dois cartões, sem benefícios listados, sem segmentado, sem "Agora não". As perguntas que decidem a peça — o que fica acima da dobra, se o CTA gruda no rodapé, como se sai sem comprar — continuam sem resposta em qualquer autoridade.

## O que já existe hoje (não invente do zero — corrija)
A gaveta é o primitivo `Sheet`/`SheetContent` do DS, **ancorado à DIREITA por padrão** (o código não passa `side`), altura total da tela, largura `min(92vw, 26rem)` — a 390px isso dá **358,8px**, com uma faixa do fundo visível à esquerda. O conteúdo rola dentro dela (`overflow: auto`), sem cabeçalho fixo nem rodapé fixo.

→ Primeiro problema a resolver: **uma tela de compra no celular entrando pela lateral, ocupando 92% da largura e 100% da altura, não é nem gaveta de fundo nem tela cheia** — é um meio-termo que ninguém escolheu. Decida a ancoragem no desenho (o DS já oferece `bottom`, com `max-height: 85vh` e cantos superiores arredondados).

Ordem atual do conteúdo, de cima para baixo:

| # | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Título da gaveta (`SheetTitle`, caixa alta, `--fs-lg`, com espaço reservado à direita para o X) | "Assinar o Premium" |
| 2 | Botão fechar, ≥44×44px, canto superior direito | rótulo acessível "Fechar" |
| 3 | Lead, cor `--text-muted`, 15px | "A calculadora é grátis e continua grátis." |
| 4 | Corpo | "O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar." |
| 5 | `fieldset` com legenda invisível | legenda = "Assinar o Premium" → **repete o título palavra por palavra** |
| 6 | Cartão de plano 1 | **Plano mensal** (veja a ordem abaixo) |
| 7 | Cartão de plano 2 | **Plano anual** |
| 8 | Botão primário, largura automática (não é `full`, não tem `glow`) | "Assinar Premium" |
| 9 | Aviso 1, 13px, muted | "Você paga no Mercado Pago (Pix ou cartão)." |
| 10 | Aviso 2, 13px, muted | "O cartão nunca passa pelo nosso app." |

→ **O cartão pré-selecionado é o SEGUNDO da lista.** O anual nasce marcado e carrega o selo "recomendado", mas é renderizado depois do mensal. O vendedor lê primeiro o plano que o produto não recomenda, e encontra a marcação já feita embaixo.
→ Não existe nenhuma dispensa explícita: o "Agora não" do protótipo sumiu, e a única saída é o X, o Esc ou tocar fora.
→ Os dois cartões ficam SEMPRE empilhados (coluna, em qualquer largura). Isso está certo no mobile; registre no desenho que é intencional, não um colapso acidental do lado a lado do desktop.
→ Se o vendedor já é Premium, a gaveta abre com o título "Assinar o Premium" e uma única frase, "Você já é Premium.", num painel de altura inteira. Um painel quase vazio anunciando uma venda que não vai acontecer.

## Conteúdo e dados reais
Os preços vêm de uma constante única de produto — dois preços diferentes na mesma tela é bloqueador de release. São estes, exatos:

**Plano anual** (marcado por padrão, selo verde "recomendado"): preço "R$ 155,88/ano"; abaixo, "equivalente a R$ 12,99/mês"; abaixo, "~19% de economia frente ao mensal".
**Plano mensal**: preço "R$ 15,99/mês"; abaixo, em muted 14px, "cobrança todo mês, cancele quando quiser".

O preço do cartão usa a fonte de título, `--fs-md`, cor `--text-strong`. O card inteiro é o alvo de toque (≥44px), não só a bolinha do rádio — o rádio tem 18×18px e mora NA MESMA LINHA do nome do plano, à esquerda dele; o selo "recomendado" fica na ponta oposta da mesma linha. R$ 191,88 (12 × 15,99) **nunca** aparece riscado: não existe "de/por" nesta peça, porque um desconto que nunca existiu seria mentira. Não há contagem regressiva, "última chance" nem qualquer urgência.

## Estados obrigatórios
- **Repouso** — anual marcado, mensal não marcado. Mostre a diferença visual entre marcado e não marcado além do rádio: hoje é só a borda que muda para a cor de destaque.
- **Foco de teclado** — o anel de foco pertence à caixa do rádio, nunca ao cartão inteiro; desenhe-o visível sobre o fundo escuro E sobre o claro.
- **Pressionado / toque no cartão** — o toque em qualquer ponto do cartão troca a seleção.
- **Enviando** — ao tocar "Assinar Premium" o botão fica ocupado com um spinner inline **e o rótulo continua sendo "Assinar Premium"**, até o navegador sair do app para o Mercado Pago. A frase "Abrindo o Mercado Pago…" existe na copy do produto mas **não aparece nesta peça** → decida no desenho se ela deve aparecer (é a frase honesta: está criando a assinatura, não "processando pagamento").
- **Erro: já existe pagamento em andamento** — alerta de perigo logo abaixo do botão: "Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e tente de novo."
- **Erro: Mercado Pago indisponível / sem rede** — mesmo lugar, mesmo tom: "O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado."
- **Deslogado** — o toque no CTA não compra nada: leva para a tela de entrar e a gaveta desaparece. Desenhe o que o vendedor vê no instante da saída (nada de tela branca sem explicação).
- **Já é Premium** — hoje só "Você já é Premium." Componha esse estado de propósito ou decida que a gaveta simplesmente não abre.
- **Premium pausado** (assinatura lapsa ou cancelada) — a gaveta ABRE para esses vendedores, com o mesmo conteúdo de venda. O contexto de que ele já foi Premium não aparece em lugar nenhum.
- **Rolagem** — desenhe a peça com o conteúdo rolado até o fim e com ele no topo: precisamos ver se o CTA fica alcançável sem rolar e o que acontece com os dois avisos no rodapé.

## Viewports
- **390 × 844** — obrigatória, é a razão de existir do prompt. Desenhe também com a altura curta (**390 × 667**), porque é aí que o CTA cai abaixo da dobra.
- **768** (tablet retrato) — a gaveta ainda é o caminho até 1279px; a 768 a largura vira 26rem = 416px e sobra muito fundo visível. Vale uma prancheta.
- **Não desenhe 1280px+**: acima do corte a mesma oferta abre INLINE, dentro de um cartão na coluna do plano, e o botão só rola até ela. Essa é outra peça.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto**: "A calculadora é grátis e continua grátis." é promessa de produto, não isca — não a coloque em cinza fraquinho no rodapé nem em placeholder.
- **Nenhum toque liga o Premium antes do servidor confirmar.** O botão nunca fica verde de "ativo" ao ser tocado.
- **Falha de rede nunca é vendida como falta de assinatura**: erro do Mercado Pago mostra a frase de erro, jamais um "você não é Premium".
- **"Nada foi cobrado" precisa caber inteiro** na largura real — frase honesta mora em elemento de largura cheia, nunca em placeholder nem truncada.
- **Zero transbordo horizontal a 390px.** Esta tela já custou 100,5px de transbordo com um botão nascendo fora da viewport, na aba Conta, a 8px daqui.
- **Alvo ≥44×44px** para o cartão de plano, o CTA e o fechar.
- **Contraste medido contra o fundo real da gaveta**, não contra o fundo da página — os avisos de 13px em `--text-muted` são o ponto mais frágil.

## Armadilhas já pagas neste projeto
- **Quebra de linha dentro do preço**: já aconteceu de a linha terminar em "equivalente a R$" e a seguinte começar em "12,99/mês". Nenhuma asserção de texto ou de geometria enxerga isso (não há corte, não há transbordo) — só a imagem. Numa linha de preço, separar o símbolo do valor é a única quebra proibida. Desenhe as três linhas do cartão anual na largura real de 358,8px menos os paddings.
- **O rádio esticado**: como item de uma coluna flex, o rádio nativo já virou uma barra de 292–350px de largura com 13px de altura. Deixe explícito no desenho que ele é um quadrado de 18px alinhado ao topo do texto do nome.
- **Elemento ocluído passa em teste**: `toBeVisible` passa em coisa coberta ou fora da tela. Se o CTA ficar sob a dobra, isso só aparece na prancheta — desenhe a dobra.
- **PNG/asset que some do cache**: se a peça ganhar qualquer ícone novo (coroa, cheques), ele precisa ser um primitivo do DS, não um arquivo novo.

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro (first-class)** para: (1) repouso a 390×844; (2) repouso a 390×667 mostrando a dobra; (3) mensal selecionado; (4) enviando (spinner no CTA); (5) erro "pagamento em andamento"; (6) erro "Mercado Pago não respondeu"; (7) já é Premium; (8) 768 retrato. Reutilize os primitivos existentes: `Sheet`/`SheetContent` para a gaveta e seu fechar de 44×44, `Card`/rótulo clicável para cada plano, `Badge` tom `success` para "recomendado", `Button` primário para "Assinar Premium", `Alert` tom `danger` para os dois erros, `Spinner` inline no botão. **Não crie primitivo novo** — se o desenho pedir algo que não existe (um rodapé fixo dentro da gaveta, por exemplo), marque como pedido explícito em vez de inventar o componente.

## Perguntas em aberto para o dono
1. **A gaveta deve subir do RODAPÉ (85% da altura, cantos arredondados no topo) em vez de entrar pela direita?** O código herdou "direita" por ser o padrão do primitivo, não por decisão.
2. **Volta o "Agora não"?** O protótipo de 2026-07-02 tinha uma dispensa explícita; hoje só existe o X.
3. **O anual deve vir PRIMEIRO na lista**, já que é o recomendado e o pré-marcado — ou a ordem mensal→anual é intencional?
4. **Os quatro benefícios do protótipo ("NO PLANO GRÁTIS VOCÊ TEM" + linhas com cheque) voltam** para dentro da gaveta, ou o corpo de uma linha ("O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar.") é a versão final?
5. **Quem já é Premium ou está com o Premium pausado deve ver esta gaveta?** Hoje o pausado vê a oferta idêntica à de quem nunca assinou, e o ativo vê um painel de altura inteira com uma frase.
6. **"Abrindo o Mercado Pago…" deve aparecer no CTA enquanto envia?** A frase existe na copy e nenhuma superfície a mostra.
