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

- **Onde vive:** A rota `/conta` inteira abaixo de 1280px: `PageHeader title="Conta"` e, logo abaixo, a grade em UMA coluna, na ordem de DOM — (1) cartão de identidade (avatar + e-mail); (2) cartão "Plano" (rótulo, selo, legenda, eventual nota; ações à direita, com quebra para segunda linha quando faltar largura); (3) cartão "Tema" (rótulo à esquerda, INTERRUPTOR à direita — não o controle segmentado do desktop); (4) cartão "Como tratamos seus dados" com dois parágrafos longos; (5) o botão "Sair" (secundário, com ícone), alinhado à esquerda, fora de cartão.
- **Como o vendedor chega:** Pela quinta aba da barra inferior (celular ≤425px) ou pela barra lateral/trilho (426–1279px). Vem para conferir quem está logado, trocar tema, sair — ou, vindo de um teaser, para assinar.
- **Vizinhança imediata:** Acima de tudo: o cabeçalho da página. Ao redor: no celular, a barra de abas fixa na base com a Conta acesa; entre 426 e 1279px, a barra lateral à esquerda (recolhida à força em 76px abaixo de 600px). Não há seções nomeadas agrupando os cinco blocos, e a oferta de assinatura NÃO ocupa espaço na página: ela mora na gaveta lateral, aberta pelo botão do cartão do plano ou por `/conta?assinar=1`.
- **Dados que chegam (e o que ela devolve):** Identidade de `GET /me`; plano da composição entitlement + assinatura (com cache uid-keyed do aparelho quando offline); tema do estado local do dispositivo (o mesmo que o controle segmentado do desktop escreve). O bloco de privacidade é texto fixo, sem link para a página completa da política.
- **O que acontece depois:** Cada bloco tem seu destino: o cartão do plano abre a gaveta de oferta ou manda para o MP em nova aba; o interruptor de tema muda o app inteiro na hora; "Sair" dispara a saída guardada, que limpa os caches por conta e devolve o vendedor à entrada — com a calculadora continuando grátis e utilizável deslogado.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Aba Conta no celular — a coluna única (identidade · plano · tema · privacidade · Sair)

## O que desenhar
A tela **Conta** do Precifica3D em largura de celular (tudo abaixo de 1280px). É a última das cinco abas
e a única onde o vendedor vê quem ele é, qual o plano dele, se o pagamento está em dia, o que fazemos com
os dados dele, e onde ele sai do app. Ele chega aqui em três momentos muito diferentes: por curiosidade
("sou premium mesmo?"), por urgência (o cartão foi recusado e ele tem um prazo correndo), ou vindo de um
teaser de outra aba com `?assinar=1` — nesse caso a oferta de assinatura já abre montada por cima da tela.
Desenhe a coluna inteira, do cabeçalho ao botão Sair, mais a gaveta da oferta que sobe do rodapé.

## Por que este prompt existe
O único desenho mobile desta tela é de 2026-07-02, **antes de existir cobrança**. Ele tinha: linha de
avatar 52px + nome + e-mail + selo binário, um cartão de marketing "TRUTH'S FORGE PREMIUM" com coroa,
um grupo rotulado "PREFERÊNCIAS" com três linhas (Tema escuro / Recalcular ao digitar / Moeda), um cartão
com "Ajuda e glossário" + "Sair" em vermelho, e o rodapé "Precifica3D · Truth's Forge · v0.1". Desses,
**quatro blocos não existem no código de hoje** (marketing, "Recalcular ao digitar", "Ajuda e glossário",
rodapé de versão) e **dois blocos do código nunca foram desenhados** (o aviso de privacidade e a linha de
plano com seus 7 estados e suas ações). O empilhamento atual não foi desenhado: ele é o que sobra quando a
grade de 3 colunas do desktop (`Abas-Desktop.dc.html`, que só descreve 1920px) colapsa na ordem do código.

## O que já existe hoje (não invente do zero — corrija)
Ordem de cima para baixo, exatamente como o app renderiza:

| # | Bloco | O que mostra hoje |
|---|-------|-------------------|
| 0 | Cabeçalho | Título "Conta" |
| 1 | Cartão de identidade | Círculo de 44px com a **inicial maiúscula** sobre a cor de destaque + o e-mail em uma linha, truncado com reticências. Sem nome, sem "Conectado como", sem foto |
| 2 | Cartão do plano | Rótulo "Plano" · selo de estado · legenda · nota · fila de botões alinhada à direita |
| 3 | Cartão do tema | Rótulo "Tema" + interruptor (ligado = escuro). No desktop isto vira um controle segmentado "Claro/Escuro"; **no celular o dono decidiu manter o interruptor** |
| 4 | Cartão de privacidade | Título "Como tratamos seus dados" + dois parágrafos longos |
| 5 | Sair | Botão secundário com ícone de saída, alinhado à esquerda, texto "Sair" |

→ **Problema 1**: os dois parágrafos de privacidade caem **entre o tema e o Sair** — o bloco mais denso e
menos acionável da tela fica no meio do caminho, empurrando a saída para fora da primeira dobra.
→ **Problema 2**: não há nenhum agrupamento nomeado. São cinco cartões soltos de mesmo peso; identidade,
cobrança, preferência, aviso legal e ação destrutiva têm a mesma temperatura visual.
→ **Problema 3**: para quem é **Gratuito**, a única coisa que fala de Premium é uma linha de selo cinza e
um botão. Não há nenhuma superfície que diga o que ele ganharia — a promessa só aparece depois de tocar.
→ **Problema 4**: o botão fantasma "Recarregar" está sempre visível ao lado da ação principal, inclusive
em "Premium ativo", onde não há nada a recarregar.
→ **Problema 5**: não há versão/build em lugar nenhum — o suporte não tem o que pedir ao vendedor.

## Conteúdo e dados reais
Textos literais em pt-BR (não reescreva os que já foram homologados; onde eu apontar que a frase é ruim,
está dito por quê):

- **Identidade**: e-mail real, ex. `jonatan.fbossan@gmail.com` — desenhe também um caso longo tipo
  `contato.comercial.impressoes3d@meudominiomuitolongo.com.br` para ver a reticência funcionar.
- **Plano**: rótulo `"Plano"`. Selos possíveis: `"Gratuito"` (neutro), `"Premium"` (verde),
  `"Premium pausado"` (neutro), `"Não foi possível confirmar seu plano."` (neutro).
- **Legendas** (segunda linha, cinza discreto): `"Plano anual · renova em 31/12/2026"` · `"ativo até
  31/12/2026 · não renova"` · `"pagamento pendente — regularize"` · `"cortesia · expira em 30/09/2026"` ·
  `"via programa beta"` · `"Seus itens salvos continuam disponíveis para leitura."` · sufixo offline
  `" · última informação do servidor"`.
- **Notas** (terceira linha): `"até 12/09/2026, senão o Premium pausa."` · `"Seus itens salvos continuam
  disponíveis; nada é apagado."` · `"Seu acesso de cortesia continua depois disso."`
- **Botões do plano**: `"Assinar Premium"` · `"Assinar novamente"` · `"Gerenciar assinatura"` ·
  `"Atualizar forma de pagamento"` · `"Cancelar assinatura"` · e o fantasma `"Recarregar"`.
- **Oferta (gaveta)**: título `"Assinar o Premium"`; `"A calculadora é grátis e continua grátis."`;
  `"O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar."`; dois cartões de
  plano com rádio — **Plano anual** `R$ 155,88/ano`, selo `"recomendado"`, `"equivalente a R$ 12,99/mês"`,
  `"~19% de economia frente ao mensal"` (pré-selecionado) e **Plano mensal** `R$ 15,99/mês`,
  `"cobrança todo mês, cancele quando quiser"`; e os dois avisos de rodapé
  `"Você paga no Mercado Pago (Pix ou cartão)."` e `"O cartão nunca passa pelo nosso app."`
- **Privacidade**: `"Como tratamos seus dados"` + `"Para entrar, usamos o Login com Google, que nos
  informa seu e-mail — usado apenas para identificar sua conta."` + `"Não vendemos seus dados nem fazemos
  rastreamento para publicidade."` (as outras três frases do aviso existem no app e **não** são mostradas
  aqui; não há link para a página completa da política).
- Nenhum número desta tela é calculado no cliente: plano, datas e origem vêm do servidor.

## Estados obrigatórios
Do cartão de identidade:
1. **Carregando** — o cartão só com o indicador de carga centralizado (mesma altura, sem pulo de layout).
2. **Erro de sessão** — alerta de perigo, título `"Não foi possível carregar sua conta"`, corpo
   `"Sua sessão expirou. Entre novamente."`, **sem** botão de repetir (repetir não resolve).
3. **Erro genérico** — o mesmo alerta com a mensagem do erro + botão `"Tentar novamente"`, empilhado
   ABAIXO do alerta (nunca ao lado: essa foi a origem de um botão nascido fora da tela).
4. **Pronto** — avatar + e-mail.

Do cartão do plano (sete estados reais, todos precisam de prancheta ou de uma tira comparativa):
5. **Gratuito** — selo neutro, sem legenda, botão `"Assinar Premium"`.
6. **Premium por assinatura ativa** — selo verde + `"Plano anual · renova em 31/12/2026"`, botões
   `"Gerenciar assinatura"` e `"Cancelar assinatura"`.
7. **Cancelada, período correndo** — selo **verde** (o premium ainda está ativo) + `"ativo até 31/12/2026
   · não renova"` + a nota de que nada é apagado; botão `"Assinar novamente"`.
8. **Carência (pagamento recusado)** — selo **continua verde**, e quem carrega a cautela é o TEXTO, em
   tom informativo: `"pagamento pendente — regularize"` + `"até 12/09/2026, senão o Premium pausa."`;
   `"Atualizar forma de pagamento"` é **primário e preenchido** — é a única ação que recupera o plano.
9. **Cortesia/beta** — selo verde + `"cortesia · expira em 30/09/2026"`, **sem** botão de ação.
10. **Premium pausado** — selo neutro + `"Seus itens salvos continuam disponíveis para leitura."`,
    botão `"Assinar novamente"`.
11. **Desconhecido (o servidor não respondeu)** — selo neutro com a frase inteira
    `"Não foi possível confirmar seu plano."`, sem nenhuma ação de compra.
12. **Offline** — qualquer estado acima com o sufixo `" · última informação do servidor"` colado na
    legenda; o selo continua dizendo o que o servidor disse por último, e diz que é velho.

Da oferta e do resto:
13. **Gaveta da oferta aberta** sobre a coluna (é o caminho do celular; no desktop ela é inline).
14. **Já premium dentro da oferta** — só a frase `"Você já é Premium."`, sem cartões e sem botão.
15. **Oferta indisponível** — `"O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi
    cobrado."`
16. **Botões** em repouso, pressionado, com carga (o "Recarregar" e o "Tentar novamente" giram) e
    desabilitado; **interruptor do tema** nos dois lados, com foco visível.

## Viewports
- **390px — a prancheta principal.** É a largura em que a maioria dos vendedores vê esta tela.
- **360px — a prancheta adversarial.** Este projeto já mediu 100,5px de transbordo horizontal exatamente
  neste cartão de plano; refaça o estado 8 (carência: dois botões largos + selo + duas linhas de texto)
  aqui e prove que nada sai da tela.
- **768px — nunca foi desenhado e existe.** Até 1279px a tela ainda é UMA coluna; num tablet os cartões
  esticam para ~700px de largura, o e-mail para de truncar e a linha do plano fica quase vazia no meio.
  Mostre o que a coluna faz com a largura sobrando (largura máxima? centraliza?).
- Desktop está fora deste prompt (já existe desenho a 1920px).

## Regras que o desenho não pode quebrar
- **Premium é binário.** Nada de "quase premium", nada de barra de progresso de plano.
- **Falha de rede nunca vira "você não é premium".** Servidor mudo = `"Não foi possível confirmar seu
  plano."`, jamais o selo "Gratuito" com botão de compra.
- **A carência mantém o selo verde.** Degradar o selo diria ao vendedor que ele já perdeu algo que ainda
  está pago — a mentira na direção oposta, e mais cara.
- **Dado velho é dito, não escondido**: o sufixo de offline é visível, não um ícone.
- **A frase honesta nunca mora num placeholder nem num rótulo cortado** — ela é texto de largura cheia.
- **Sem padrão escuro**: nenhuma escassez falsa, nenhum "de/por" riscado sobre o preço anual, e a saída
  segura de qualquer confirmação tem afordância **igual ou maior** que a ação destrutiva.
- **Alvo de toque ≥ 44px** em tudo (inclusive nos rádios da gaveta) e **contraste medido contra o fundo
  real do cartão**, não contra o fundo da página, nos dois temas.

## Armadilhas já pagas neste projeto
- **O transbordo de 100,5px**: os botões do plano são UM item flex; um item mais largo que o cartão não
  quebra sozinho — o botão nasceu inteiro **fora da viewport**, em x=396,3 numa tela de 390. Desenhe a
  quebra dos botões para a linha de baixo explicitamente, e mostre-a.
- **O botão espremido no erro**: a linha do identidade foi feita para avatar+texto; no ramo de erro ela
  espremia o alerta a uma palavra por coluna. Erro empilha, sempre.
- **Quebra entre `R$` e o número**: a 390px a linha do preço quebrava depois de "equivalente a R$". O
  símbolo e o valor andam juntos — nenhuma assertiva automática vê isso, só a imagem.
- **Duas palavras "Atualizar" a 8px de distância** já confundiram: por isso o nosso botão virou
  `"Recarregar"` e só o do Mercado Pago diz "Atualizar forma de pagamento". Não desfaça isso.

## Entregável
Pranchetas, tema **escuro como padrão e claro como cidadão de primeira classe**:
1. A coluna completa a 390px, estado Gratuito (a maioria dos vendedores).
2. A coluna completa a 390px, estado Premium ativo.
3. Uma tira com os **7 estados do cartão do plano** lado a lado, na mesma largura de 390px.
4. O cartão do plano em **carência a 360px**, com a régua mostrando que nada passa de 360.
5. A gaveta da oferta aberta a 390px (planos anual/mensal), mais o estado "já é Premium".
6. Os três estados do cartão de identidade (carregando / erro de sessão / erro com repetição).
7. A coluna a 768px.

Reutilize os primitivos existentes, sem criar novos: `tf-card` para os cinco blocos, `tf-badge` (tom
sucesso/neutro) para o selo, `tf-btn` nas variantes primária / secundária / fantasma, `tf-alert` (tom
perigo) no erro de identidade, `tf-switch` no tema, `tf-sheet` na gaveta da oferta, `tf-spinner` na carga
e `tf-icon` no ícone de saída. Se um bloco pedir algo que os primitivos não têm, diga qual e por quê em
vez de inventar um componente.

## Perguntas em aberto para o dono
1. O vendedor **gratuito** ganha de volta um cartão de valor do Premium no celular (o "TRUTH'S FORGE
   PREMIUM" do protótipo de 2026-07-02), ou a linha de plano + o botão bastam? Isso muda a altura da tela
   inteira e é decisão de produto, não de layout.
2. A ordem muda? Especificamente: o aviso de privacidade continua **entre o tema e o Sair**, vai para
   o fim (abaixo do Sair) ou vira um bloco recolhido?
3. Os cartões passam a viver sob **títulos de seção** (algo como "Preferências" / "Sobre seus dados"),
   como o protótipo antigo fazia, ou seguem soltos?
4. Volta um **rodapé de versão/build** ("Precifica3D · v…")? O suporte hoje não tem número para pedir.
5. O aviso de privacidade ganha **link para a política completa**? Hoje o código deliberadamente não tem
   um, e a página existe e é alcançável por outro caminho.
6. O `"Recarregar"` fica sempre visível, ou só nos estados em que recarregar resolve alguma coisa
   (desconhecido, offline, recém-assinado)?
