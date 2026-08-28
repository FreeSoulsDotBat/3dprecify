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

- **Onde vive:** Substituição total do miolo do painel de oferta: no lugar do lead, do corpo, dos dois cartões de plano, do botão e das duas notas, sobra UM parágrafo solto — "Você já é Premium." — dentro do mesmo contêiner `.tf-billing-offer`. Na prática o caso é o da GAVETA lateral: ela abre em tela cheia, com o título "Assinar o Premium" no topo, e o corpo tem uma única frase, sem ícone, sem ação, sem botão de fechar além do "X" do canto.
- **Como o vendedor chega:** Por caminhos guardados: um `/conta?assinar=1` que sobrou no histórico, um link de teaser cacheado pelo PWA, ou uma tela aberta antes de o Premium ligar. No desktop o painel inline nem é montado nesse estado, então quem chega aqui está quase sempre na gaveta.
- **Vizinhança imediata:** Por baixo do scrim, a Conta com a linha do plano já mostrando selo verde "Premium". Dentro da gaveta: o `SheetTitle` "Assinar o Premium" logo acima da frase — um título que promete uma compra sobre um corpo que diz que ela não é necessária. Abaixo da frase: espaço vazio até o fim da gaveta.
- **Dados que chegam (e o que ela devolve):** Um único campo do ledger: `entitlement.status === "active"`. É um guarda de entrada — nenhum preço é lido, nenhum cartão de plano é montado, nenhum checkout pode ser disparado a partir daqui.
- **O que acontece depois:** Não há para onde seguir: nenhuma ação é oferecida — nem "Gerenciar assinatura", nem "Fechar", nem um caminho de volta à Conta. A única saída é o "X" do canto, o Esc ou o toque no scrim, que devolvem a Conta.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Oferta de assinatura aberta por quem JÁ é Premium

## O que desenhar

A gaveta "Assinar o Premium" quando quem a abre **já paga**. Ela vive na aba **Conta** (`/conta`), é
uma folha ancorada à direita sobre a página, e é o mesmo painel de oferta que vende o Premium — só
que aqui ele encontra um assinante. Isso acontece de verdade por três caminhos: um link de teaser
guardado ou compartilhado que carrega a intenção `?assinar=1` na URL e abre a gaveta já montada; o
botão "voltar" do navegador depois de pagar; e um atalho salvo pelo próprio vendedor. Quem chega
aqui não tem nada para comprar — precisa entender numa olhada que já está tudo certo e sair para
onde queria ir. Origem no código: `features/billing/offer-panel.tsx`, `features/billing/billing.css`,
`pages/conta/conta-page.tsx`.

## Por que este prompt existe

Este estado **nunca foi desenhado** — autoridade NENHUMA. O canvas de billing alterna "gratuito"
(oferta) e "premium" (botões de gestão) como ramos **exclusivos** na mesma linha do plano, e o ramo
premium simplesmente não contém o bloco da oferta; a §E8 assume sempre um usuário gratuito ("upsell
disparado ao tocar Salvar/Exportar/Adicionar", que só um free encontra); a matriz §G não tem linha
para isso. O protótipo `PremiumScreen.jsx` recebe só `open` e, aberto por um assinante, mostraria a
compra inteira — o que é um defeito, não um desenho deste estado. O que existe hoje no produto foi
inferido por IA: uma guarda que troca a oferta inteira por **um único parágrafo solto**.

## O que já existe hoje (não invente do zero — corrija)

A gaveta tem duas partes: a **moldura**, que é do chamador, e o **conteúdo**, que é do painel.

| Parte | O que mostra hoje | Origem |
| --- | --- | --- |
| Título da folha | "Assinar o Premium" — caixa alta, fonte de título | `SheetTitle`, na Conta |
| Fechar | X de ≥44×44px no canto superior direito, rótulo acessível "Fechar"; Esc e clique no scrim também fecham | primitivo `tf-dialog` |
| Corpo (assinante) | **um** parágrafo: "Você já é Premium." | `offer-panel.tsx` |
| Corpo (não assinante) | lead "A calculadora é grátis e continua grátis." · "O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar." · dois cartões de plano com rádio · botão "Assinar Premium" · "Você paga no Mercado Pago (Pix ou cartão)." · "O cartão nunca passa pelo nosso app." | idem |

→ **O título contradiz o corpo**: a folha continua intitulada "Assinar o Premium" para alguém que
não pode assinar. O título é do chamador, então a correção precisa ser dita com todas as letras.
→ **Não há saída oferecida dentro do conteúdo** — só o X da moldura. Nem "Gerenciar assinatura",
nem "Fechar", nem "Voltar para a Conta".
→ **Uma frase sozinha numa folha de altura total**: a 390px sobram ~700px de vazio abaixo dela; a
1280px, uma coluna de 416px do topo ao rodapé com uma linha de texto. Lê como tela quebrada.
→ **A frase não diz de quando é a informação.** O app sabe se a resposta é fresca ou lembrada, e a
linha do plano na Conta já anexa "última informação do servidor" quando é lembrada. Aqui, não.
→ **Sem ícone, sem selo, sem número** — nada confirma visualmente o que a frase afirma.

## Conteúdo e dados reais

- Frase homologada, **use literal**: **"Você já é Premium."** (é boa: curta, verdadeira, sem festa).
- O plano vem do servidor com três valores possíveis: `none` (gratuito), `active` (premium) e
  `lapsed` (pausado). Só `active` cai neste estado.
- A resposta traz também a **data de fim do acesso** (ex.: `2026-09-23` → "23/09/2026") e a origem
  da concessão — **a origem nunca é exibida ao usuário**, decisão antiga. Hoje o painel **ignora a
  data**; ela existe e poderia ancorar a frase.
- Textos que já existem no app e podem ser reaproveitados aqui em vez de inventados: "Plano" ·
  "Premium" · "Gerenciar assinatura" · "Cancelar assinatura" · "última informação do servidor" ·
  "Seus itens salvos continuam disponíveis para leitura." · "Recarregar" · "Fechar" ·
  "Voltar para a Conta".
- **Preços não entram nesta prancheta.** R$ 155,88/ano, R$ 12,99/mês e R$ 15,99/mês pertencem ao
  ramo de venda; mostrá-los a quem já paga é vender duas vezes. (Em qualquer prancheta onde houver
  dinheiro, o espaço entre `R$` e o valor é inquebrável: já quebrou linha em homologação,
  terminando uma linha em "R$" e começando a outra em "12,99/mês".)

## Estados obrigatórios

1. **Premium confirmado (resposta fresca)** — "Você já é Premium." com confirmação visual (selo
   "Premium" em tom de sucesso, ícone de traço 2px) e **pelo menos uma saída nomeada** no corpo.
2. **Premium lembrado (offline / servidor não respondeu)** — a mesma afirmação **mais** a
   procedência: "última informação do servidor". Nunca apresentar a memória como se fosse fresca, e
   nunca transformar a falha de rede em outra coisa.
3. **Resposta em trânsito, sem nada lembrado** — hoje o painel renderiza a **venda inteira** nesse
   instante e só depois descobre que a pessoa é assinante: um pagante vê "Assinar Premium" piscar.
   Desenhe o que ocupa a folha durante a espera (esqueleto neutro ou linha de carregamento), para
   que a venda não apareça antes da resposta.
4. **Premium em carência** (assinatura ativa, cobrança falhou, prazo correndo) — o servidor ainda
   diz `active`, então esta mesma frase aparece hoje, sem nenhum sinal do problema. Ver "Perguntas
   em aberto".
5. **Repouso / foco / hover / pressionado / carregando** para cada ação que você acrescentar (um
   "Gerenciar" sai para o Mercado Pago: precisa de carregamento honesto, não de sucesso antecipado).
6. **Fora de escopo, mas marque a fronteira**: `lapsed` ("Premium pausado") e `none` veem a oferta
   normal; erro sem resposta nenhuma também. Nenhum deles é esta prancheta.

## Viewports

- **390px** — a folha ocupa ~359px de largura e a altura toda da tela. É o caminho principal: no
  desktop a oferta inline nem sequer é montada para um assinante, então este estado é sobretudo o
  da gaveta no celular.
- **1280px** — mesma folha ancorada à direita, 416px de largura, altura total, com a página Conta
  visível ao fundo. Desenhe também esta, porque o vazio é maior e mais gritante aqui.
- 1920px não acrescenta nada: a folha não cresce.

## Regras que o desenho não pode quebrar

- **Não vender duas vezes.** Nenhum preço, nenhum cartão de plano, nenhum botão "Assinar Premium"
  neste estado — nem desbotado, nem "para conhecer os planos".
- **Nada de padrão escuro ao contrário**: a saída é visível, nomeada e alcançável sem caçar o X.
- **Procedência do plano**: se a informação é a última conhecida, a folha diz isso, em elemento de
  largura total (nunca em placeholder, que corta a frase).
- **Falha de rede nunca vira "não é Premium"** e nunca vira silêncio.
- **Título e corpo não podem se contradizer** — o rótulo da folha faz parte deste desenho, mesmo
  vindo do chamador.
- Alvo de toque ≥44px em tudo que for clicável; contraste medido contra o fundo real do cartão da
  folha, nos dois temas.

## Armadilhas já pagas neste projeto

- **Transbordo medido nesta mesma tela**: na linha do plano da Conta, a 390px, as ações somavam
  453,5px contra 316px de conteúdo e o botão "Recarregar" nascia **inteiramente fora da viewport**
  (100,5px de transbordo). Duas ações lado a lado numa folha de 359px têm de quebrar de verdade.
- **Um controle solto dentro de uma coluna flex estica**: o rádio dos planos virou uma barra de
  292–350px de largura com 13px de altura, medido. Qualquer elemento novo desenhado aqui precisa de
  largura própria declarada.
- **Toast que nunca apareceu**: uma confirmação disparada por um diálogo que fecha não chega a
  renderizar. Não desenhe acknowledgement que dependa da folha continuar aberta.
- **Texto ocluso ou transbordado passa em teste automatizado.** O que valida esta prancheta é a
  imagem e a medida da caixa, não a presença da frase.

## Entregável

De 5 a 6 pranchetas, **tema escuro primeiro, tema claro como igual**:

1. 390px — premium confirmado (resposta fresca).
2. 390px — premium lembrado, com a legenda de procedência.
3. 390px — resposta em trânsito.
4. 1280px — premium confirmado, folha sobre a Conta.
5. 1280px — as duas saídas possíveis lado a lado ("só fechar" × "fechar + gerenciar"), para o dono
   escolher.

Componha com os primitivos existentes, sem criar novos: `tf-dialog--sheet-right` para a folha,
`tf-badge--success` para o selo "Premium", `tf-btn--primary` para a saída principal e `tf-btn--ghost`
para a secundária, `tf-alert--info` (ou legenda em `--text-muted`) para a procedência, `tf-icon` para
o ícone de confirmação, `tf-spinner` para o trânsito. Use **um** único grafismo curvo para quebrar o
vazio da folha alta — um só, nunca dois.

## Perguntas em aberto para o dono

1. **Esta folha deve oferecer gestão** ("Gerenciar assinatura" no Mercado Pago, "Cancelar
   assinatura") — duplicando o que já existe no cartão de plano da Conta — ou só uma saída neutra
   ("Fechar" / "Voltar para a Conta")?
2. **O título da folha muda?** Hoje é "Assinar o Premium" mesmo para quem já assina. Se muda, para
   qual frase?
3. **Carência**: quando a assinatura está ativa mas a cobrança falhou, esta tela deve continuar
   dizendo apenas "Você já é Premium." ou deve trazer o problema de pagamento à frente?
4. **A data entra?** O app conhece o fim do acesso (ex.: 23/09/2026). Mostrar "renova em 23/09/2026"
   aqui, ou manter a data só no cartão de plano da Conta?
