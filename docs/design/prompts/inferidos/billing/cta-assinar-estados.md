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

- **Onde vive:** O botão "Assinar Premium" do `BillingCta`, sempre o ÚLTIMO elemento acionável do painel de oferta: dentro de `.tf-billing-offer`, logo abaixo do bloco de rádios dos dois planos e imediatamente acima das duas frases cinzas de hand-off. Aparece nos dois lugares em que a oferta vive: a gaveta lateral do mobile e o cartão inline da coluna do plano no desktop. Quando há erro, o `Alert` nasce EMPILHADO ABAIXO do botão, dentro do mesmo contêiner.
- **Como o vendedor chega:** O vendedor já escolheu (ou aceitou) o plano anual pré-selecionado e toca no botão para comprar. É o clique de maior compromisso do produto; ele espera sair do app e pagar.
- **Vizinhança imediata:** Acima do botão: o cartão do plano anual (selecionado, com selo "recomendado") e o do mensal, empilhados. Abaixo: "Você paga no Mercado Pago (Pix ou cartão)." e "O cartão nunca passa pelo nosso app." — e é ENTRE o botão e essas duas frases que a tarja de erro se insere, empurrando-as para baixo. No desktop, tudo isso mora dentro do cartão "Assinar o Premium", que fica logo abaixo do cartão do plano.
- **Dados que chegam (e o que ela devolve):** O período escolhido nos rádios; o botão chama `POST /billing/checkout` no servidor. Quatro estados tipados: repouso; **pendente** (spinner no botão, que NUNCA volta ao repouso — a frase "Abrindo o Mercado Pago…" existe no bundle mas não é renderizada em lugar nenhum); **conflito** (409: "Você já tem um pagamento em andamento…"); **indisponível** (503/offline: "O Mercado Pago não respondeu agora… nada foi cobrado."). Hoje os dois últimos usam a MESMA tarja vermelha de perigo. Deslogado, o botão nem chama a API: manda para `/sign-in` preservando o retorno.
- **O que acontece depois:** No caminho feliz o navegador SAI do app: `window.location` vai para o checkout hospedado do MP, e o botão fica com spinner até a página trocar. O vendedor só volta pela rota `/conta?checkout=retorno`. Nos dois estados de erro nada é cobrado, nada muda no plano e o vendedor continua exatamente na mesma tela, com o botão reabilitado.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Botão "Assinar Premium" — os três estados que ninguém desenhou

## O que desenhar

O botão que leva o vendedor para fora do app, para pagar. Ele é a última linha do painel de oferta
(`tf-billing-offer`) da aba **Conta**: primeiro a promessa grátis, depois os dois cartões de plano
(anual pré-selecionado com selo "recomendado", mensal a um toque), depois **este botão**, e abaixo
dele os dois avisos de procedência ("Você paga no Mercado Pago (Pix ou cartão)." / "O cartão nunca
passa pelo nosso app."). No mobile o painel abre numa gaveta com o título "Assinar o Premium"; no
desktop ele já vive aberto, inline, num cartão da coluna da Conta. Quem toca é um vendedor que
decidiu pagar — o momento de maior confiança da jornada, e exatamente onde o app hoje só sabe
desenhar o sucesso. Desenhe o botão **e a região de mensagem que nasce junto dele**: repouso, carga,
"você já tem um pagamento aberto" e "o Mercado Pago não respondeu".

## Por que este prompt existe

O componente tem quatro estados tipados em código (`idle` · `pending` · `conflict` · `unavailable`)
e **só o de repouso existe em desenho**. O canvas 018 desenha o botão numa linha só, sem irmão de
erro e sem variante de carga (`<button class="tf-btn tf-btn--primary tf-btn--lg">Assinar Premium</button>`),
e a matriz de estados do próprio canvas confirma a lacuna: a linha "Upsell sheet" traz `loading —`,
`error —`, `disabled —`. O `PremiumScreen.jsx` do protótipo antigo idem — botão e "Agora não", nenhum
estado. A única regra herdada é de COPY ("erro sempre em frase pt-BR amigável, nunca stack"), que o
código obedece; **onde a frase aparece, com que tom e com que peso visual nunca foi decidido por
ninguém.** A auditoria registra "Missing states" como resíduo não resolvido e manda absorver no app.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/billing/billing-cta.tsx` · `offer-panel.tsx` · `billing.css` ·
`shared/i18n/messages.pt-br.ts` (namespace `billing`).

| Estado | O que o vendedor vê hoje | Diagnóstico |
|---|---|---|
| `idle` | Botão primário, tamanho **md** (o canvas desenhou `lg`), largura natural, alinhado à esquerda | → divergência canvas × código: decida o tamanho e a largura no desenho |
| `pending` | O MESMO botão com spinner à esquerda, desabilitado, rótulo continua "Assinar Premium" | → a frase "Abrindo o Mercado Pago…" **existe no bundle e nunca é renderizada** — o app afirma um aviso que nunca acontece |
| `conflict` (409) | Tarja **vermelha** empilhada 8px abaixo do botão: "Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e tente de novo." | → é informativo, não é falha: vermelho para "está tudo indo bem, só já começou" |
| `unavailable` (503, offline, resposta malformada) | Tarja **vermelha** idêntica: "O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado." | → mesma cor, mesmo ícone, mesma posição que o caso acima: os dois casos são visualmente indistinguíveis |
| já Premium | O painel inteiro some e sobra a frase "Você já é Premium." — sem botão | é correto; desenhe para que não se perca |
| deslogado | O toque **não** mostra nada: navega direto para o login guardando a intenção de voltar | → transição sem aviso a partir de um botão que promete pagamento |

Comportamento que o desenho precisa respeitar: o `pending` **nunca volta ao repouso** — o navegador
está saindo do app, e um botão que reabilita antes da navegação piscaria "clique de novo" no pior
momento possível. Depois de `conflict`/`unavailable` o botão volta a ficar clicável e a tarja
**permanece na tela** até o próximo toque, quando some e o spinner entra.

## Conteúdo e dados reais

- Rótulo do botão: **"Assinar Premium"** (homologado, não parafraseie).
- Plano anual (pré-selecionado): "Plano anual" · selo "recomendado" · **R$ 155,88/ano** ·
  "equivalente a R$ 12,99/mês" · "~19% de economia frente ao mensal".
- Plano mensal: "Plano mensal" · **R$ 15,99/mês** · "cobrança todo mês, cancele quando quiser".
- O espaço entre `R$` e o número é **NBSP** — em 390px a linha já quebrou entre símbolo e valor numa
  homologação real; numa linha de preço essa é a única quebra proibida.
- Nunca existe preço riscado, "de/por", contagem regressiva ou escassez. R$ 191,88 (12 × mensal) é
  um número derivado que **nunca é renderizado**.
- Avisos que ficam ABAIXO do botão, sempre, em qualquer estado: "Você paga no Mercado Pago (Pix ou
  cartão)." e "O cartão nunca passa pelo nosso app."
- Frase de carga disponível e hoje órfã: **"Abrindo o Mercado Pago…"** (a verdade literal: está se
  criando a assinatura — não é "processando pagamento").
- O que vem DEPOIS, e é outra peça: a tela de retorno ("Confirmando seu pagamento…" / "Premium
  ativo!" / "Ainda não recebemos a confirmação"). Não desenhe aqui; apenas não conflite com ela.

## Estados obrigatórios

1. **Repouso** — botão primário, alvo real ≥44px de altura, sem tarja alguma.
2. **Foco por teclado** — anel visível no botão, medido contra o fundo do cartão E o fundo da gaveta.
3. **Hover** e **pressionado** — desktop e toque.
4. **Carregando (`pending`)** — spinner + botão bloqueado + a frase "Abrindo o Mercado Pago…"
   finalmente visível. Desenhe as duas leituras possíveis (a frase como rótulo do botão × a frase
   como legenda logo abaixo) para o dono escolher; nas duas, o vendedor precisa entender que o app
   está **saindo** e que ele não deve tocar de novo.
5. **Conflito (409)** — mensagem informativa, tom distinto do erro, com a frase literal acima.
   Precisa ainda ser anunciada por leitor de tela.
6. **Indisponível (503 / falha)** — mensagem de falha honesta, com o "nada foi cobrado." legível
   como parte da mesma frase (é a linha que acalma).
7. **Já Premium** — sem botão, só "Você já é Premium."
8. **Deslogado** — o mesmo botão em repouso; desenhe se há (ou não) uma legenda dizendo que o
   próximo passo é entrar.
9. **Desabilitado puro** — o app não usa hoje; desenhe o token para que ninguém invente depois.

## Viewports

- **390px** — obrigatório: é aqui que o painel vive numa gaveta, com o botão perto da borda inferior
  e a tarja empurrando os dois avisos de procedência para baixo. Mostre a coluna inteira, não o
  botão recortado: o que importa é o que a tarja desloca.
- **1280px** — obrigatório: o painel é inline num cartão da coluna da Conta (não é gaveta), e a
  largura maior faz a mensagem de erro virar uma faixa larga com muito ar à direita da frase.
- 1920px opcional, apenas se a decisão de largura máxima do botão/tarja mudar em relação a 1280.

## Regras que o desenho não pode quebrar

- **Nada pré-acende o Premium.** Nenhum estado do botão pode parecer sucesso antes de o servidor
  confirmar; nenhum "processando" que insinue pagamento aprovado.
- **Falha de rede nunca é vendida como "não é premium"** e — igualmente — não pode ser vendida como
  culpa do Mercado Pago se a origem foi o aparelho offline.
- **"nada foi cobrado."** é a informação mais importante do estado de falha e não pode ficar cortada,
  truncada, dentro de placeholder ou fora da primeira leitura.
- Nenhum código de status, nome de erro técnico ou jargão aparece — nem em legenda pequena.
- Alvo ≥44px, contraste medido contra o fundo REAL (cartão sobre fundo da Conta, e gaveta sobre
  overlay), nos dois temas.
- Se o tom do 409 deixar de ser vermelho, a mensagem ainda precisa ser lida em voz alta pelo leitor
  de tela — mudança de cor não pode virar mudança de urgência para quem não vê a cor.

## Armadilhas já pagas neste projeto

- **Copy no bundle que nunca renderiza** — já aconteceu com um toast de confirmação que sumia junto
  com o diálogo: o texto existia, o reconhecimento nunca. "Abrindo o Mercado Pago…" é o mesmo caso,
  ainda vivo.
- **Quebra entre `R$` e o valor a 390px** — invisível para qualquer asserção (não há corte nem
  transbordo); só a imagem denuncia.
- **Transbordo medido nos DOIS eixos** — headless não enxerga barra de rolagem clássica; a tarja de
  erro entrando na gaveta é exatamente o tipo de elemento que estoura a altura útil.
- **Texto ocluso passa em teste** — "visível" não é propriedade do texto: desenhe onde a tarja fica
  quando o teclado do celular está aberto e a gaveta encurtou.
- **Um controle que estica sozinho** — nesta mesma tela um radio virou uma barra de 292px por herdar
  o alinhamento do container. Diga a largura pretendida do botão e da tarja, não deixe implícita.

## Entregável

Pranchetas, tema **escuro** (padrão) e **claro** (first-class, mesmo conjunto):

1. 390px — painel completo em repouso (planos + botão + avisos).
2. 390px — `pending`, nas duas leituras da frase de carga.
3. 390px — `conflict`.
4. 390px — `unavailable`.
5. 390px — "Você já é Premium."
6. 1280px — o cartão inline da Conta com repouso, `conflict` e `unavailable` lado a lado.
7. Tira de estados do botão isolado: repouso · hover · foco · pressionado · carregando · desabilitado.

Reutilize os primitivos existentes, sem criar novos: **`tf-btn tf-btn--primary`** (com
`tf-btn--loading` + `tf-btn__spin` no estado de carga) para o botão; **`tf-alert`** para a mensagem —
`tf-alert--danger` para a indisponibilidade e a variante informativa que você julgar correta para o
409, sempre com ícone à esquerda e corpo em duas linhas no máximo a 390px; **`tf-badge`** tom
sucesso para o selo "recomendado"; o cartão/gaveta já existentes para o contêiner. Marque no desenho
o espaçamento entre botão e tarja e a distância até os avisos de procedência.

## Perguntas em aberto para o dono

1. Quando a falha é do **aparelho** (offline), o app pode dizer isso — "Você está sem conexão" — em
   vez de atribuir ao Mercado Pago? Hoje os dois casos usam a mesma frase, e uma delas culpa terceiro
   por algo que ele não fez.
2. O 409 ("você já tem um pagamento em andamento") deve ganhar uma **ação** — um caminho explícito
   para concluir no Mercado Pago — ou continua sendo só uma frase para reler e esperar?
3. Durante o `pending`, o rótulo do botão pode **trocar** de "Assinar Premium" para "Abrindo o
   Mercado Pago…", ou a frase entra como legenda separada abaixo, preservando o rótulo homologado?
4. Para quem não está logado, o toque deve **avisar** que o próximo passo é entrar, ou continua
   navegando direto para o login sem intermediação?
