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

- **Onde vive:** Mesma rota `/conta?checkout=retorno`, mesmo `Card.tf-billing-return` — estado 3 de 3, exibido quando a sondagem esgota. Ordem interna: ícone de alerta em círculo (28px) → h2 "Ainda não recebemos a confirmação" → um parágrafo que emenda as DUAS leituras ("Se você concluiu… Se você não concluiu, nada foi cobrado.") → linha de dois botões: "Verificar de novo" (secundário) e "Voltar para a Conta" (fantasma).
- **Como o vendedor chega:** Chega por esgotamento: ~45 segundos depois do retorno do MP, sem ação nenhuma do vendedor. Duas pessoas muito diferentes caem exatamente aqui e são indistinguíveis por contrato: quem pagou e o webhook ainda não chegou, e quem abandonou o checkout sem pagar nada.
- **Vizinhança imediata:** Acima: cabeçalho "Conta" e o shell completo (abas/rail visíveis). Abaixo: nada — o restante da Conta continua não montado. Não existe, em nenhum ponto do cartão, link de suporte, e-mail, código de correlação ou caminho de contato.
- **Dados que chegam (e o que ela devolve):** O mesmo `GET /entitlement`: o app sabe apenas que, até agora, nenhum grant de pagamento apareceu. Não recebe do MP status do pagamento, id da transação nem se um checkout chegou a ser aberto.
- **O que acontece depois:** "Verificar de novo" zera o contador e reinicia a mesma sondagem de ~45s (volta ao estado de espera; se o grant chegou nesse meio-tempo, cai direto no sucesso). "Voltar para a Conta" leva a `/conta`, onde o plano vai dizer "Gratuito" com o botão "Assinar Premium" — ou seja, quem pagou e caiu aqui reencontra uma oferta de compra.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Retorno do checkout — "Ainda não recebemos a confirmação"

## O que desenhar

A tela que o vendedor vê quando volta do Mercado Pago para o app e o app, depois de ~45 segundos
consultando o servidor, **ainda não sabe se houve cobrança**. Ela toma a página inteira da aba
**Conta** (o app volta do MP em `/conta?checkout=retorno`: cabeçalho "Conta" e, abaixo, só este
cartão — nenhuma outra seção da Conta aparece). É o terceiro e último desfecho de uma sequência de
três: *confirmando* → *Premium ativo* **ou** *não confirmado*. Quem chega aqui é sempre uma de duas
pessoas, e o produto **não consegue distingui-las por contrato**: quem pagou e cuja confirmação
ainda não chegou, e quem abriu o checkout e desistiu (nesse caso nada foi cobrado, e por decisão de
produto o abandono precisa ser indistinguível de "nunca comecei"). Desenhe o estado final, e também
os dois estados irmãos que levam até ele, porque a temperatura visual de um só faz sentido ao lado
da dos outros.

## Por que este prompt existe

Nenhuma das autoridades de desenho cobre o retorno do checkout — o canvas exclui o fluxo inteiro, e
uma busca por "confirmação / não recebemos / verificar" nele dá zero. O que existe hoje foi inferido
por IA direto do requisito: um **ícone de alerta** (`circle-alert`, 28px) para um estado que pode
significar "você não comprou nada", as duas leituras (paguei / desisti) **emendadas num parágrafo
só**, e **nenhum caminho de suporte** em lugar nenhum do componente. Existe no produto uma tela
on-brand de erro genérico ("Algo deu errado" + "Recarregar" + "Código de suporte: {correlationId}"),
mas ela é o *error boundary* de falha técnica — **não serve aqui**: aqui nada quebrou, o sistema
funcionou e a resposta honesta é "ainda não sei". Usar a linguagem de erro seria exatamente a
leitura falsa que este prompt vem corrigir.

## O que já existe hoje (não invente do zero — corrija)

Um único cartão (`Card`), conteúdo **centralizado**, coluna, respiro de 0,75rem entre blocos; os dois
botões empilhados em coluna com 0,5rem entre eles. Textos literais, todos já em produção:

| Estado | Ícone/indicador | Título | Corpo | Ações |
|---|---|---|---|---|
| Confirmando (0–45s) | `Spinner` | "Confirmando seu pagamento…" | "Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada." | "Atualizar" (secundário) · "Voltar para a Conta" (fantasma) |
| Confirmado | `crown` 28px | "Premium ativo!" | "Seu catálogo, kits, orçamentos e simulações agora salvam e exportam. Bom trabalho." | "Ir para a calculadora" (primário) |
| **Não confirmado** | `circle-alert` 28px | "Ainda não recebemos a confirmação" | "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se você não concluiu, nada foi cobrado." | "Verificar de novo" (secundário) · "Voltar para a Conta" (fantasma) |

→ **O ícone de alerta é o problema central.** Para metade das pessoas que chegam aqui a resposta
certa é "nada aconteceu, está tudo bem" — e um triângulo/círculo de alerta grita erro sobre um
não-evento. Proponha a temperatura visual: neutra/paciente (espera), nunca vermelha de falha.

→ **As duas leituras dentro de um parágrafo único.** "Se você concluiu…" e "Se você não concluiu…"
são dois destinatários diferentes com duas ações diferentes, colados na mesma frase corrida. Separe-
as visualmente (dois blocos legíveis) sem reescrever a copy, que já foi homologada.

→ **Não há saída para quem pagou e não vê o Premium.** As duas ações são "tentar de novo" e "voltar".
Quem pagou de verdade e continua sem Premium sai daqui sem nenhum caminho. Desenhe o *lugar* dessa
saída (o conteúdo dela é pergunta ao dono, abaixo).

→ **"Verificar de novo" volta ao estado 1**: zera o contador e reabre os ~45 segundos de espera. Hoje
essa transição não é anunciada de forma nenhuma — a tela simplesmente vira o spinner.

## Conteúdo e dados reais

- A espera é **medida e limitada**: 15 tentativas de 3 em 3 segundos ≈ **45 segundos**, e então para.
  Nunca há consulta infinita e silenciosa. Se o desenho quiser mostrar progresso da espera, é aqui.
- Valores que a pessoa pode ter acabado de pagar (formatação exata, com **espaço fixo entre `R$` e o
  número**): **R$ 15,99/mês** ou **R$ 155,88/ano** ("equivalente a R$ 12,99/mês").
- O provedor de pagamento é nomeado sempre: **Mercado Pago** (Pix ou cartão). Frases já em uso na
  jornada anterior: "Você paga no Mercado Pago (Pix ou cartão)." e "O cartão nunca passa pelo nosso
  app.".
- O único identificador técnico que o app sabe exibir hoje, em outra tela, é o **"Código de suporte:"**
  seguido do id de correlação. Não existe e-mail, telefone ou canal de suporte em texto em lugar
  nenhum do produto.
- Nada nesta tela é derivado de cálculo; não há campo de entrada, não há número editável.

## Estados obrigatórios

1. **Não confirmado (o foco)** — ícone/indicador de espera esgotada, título "Ainda não recebemos a
   confirmação", as duas leituras separadas, "Verificar de novo" + "Voltar para a Conta".
2. **Confirmando** — spinner + "Confirmando seu pagamento…"; a conta **continua exatamente como
   estava** (nada de selo "Premium pendente" em canto nenhum).
3. **Confirmado** — coroa + "Premium ativo!" + "Ir para a calculadora"; é o único momento em que o
   Premium aparece ligado.
4. **Repouso / hover / foco / pressionado** dos dois botões, com o anel de foco visível sobre o fundo
   real do cartão nos dois temas.
5. **Reentrada** — o instante depois de tocar "Verificar de novo": a tela volta ao estado 2. Mostre
   como a pessoa entende que a espera recomeçou, e não que o botão não fez nada.
6. **Offline** — a consulta ao servidor não sai. É falha de rede, e **jamais** pode ser desenhada
   como "você não é premium" nem como "não pagou". Precisa de um recado próprio dizendo que é a
   conexão.
7. **Sessão expirada** — se a volta do MP cai numa sessão morta, a frase da casa é "Sua sessão
   expirou. Entre novamente." e precisa de um caminho de volta ao login, não de um beco.

## Viewports

- **390px (mobile)** — obrigatório: é a largura real da maioria e a que já custou defeitos medidos.
- **1280px (desktop)** — obrigatório: a Conta ganhou grade de três colunas no desktop, mas este
  estado é um *takeover* e continua sendo um cartão só. Mostre a largura máxima do cartão e onde ele
  se ancora; um cartão de 1200px com quatro palavras centralizadas é uma resposta errada.
- 1920px é opcional e só se a decisão de largura máxima mudar de comportamento lá.

## Regras que o desenho não pode quebrar

- **O app não sabe se houve cobrança.** Nada aqui pode sugerir sucesso: nem cor de sucesso, nem
  coroa, nem "processando seu Premium", nem selo de pendência.
- **Abandono = nunca comecei.** Quem desistiu não pode sair daqui achando que deve dinheiro, que tem
  algo "em aberto" ou que precisa cancelar alguma coisa.
- **A frase honesta "nada foi cobrado" nunca mora em texto de apoio apagado, em placeholder ou em
  linha cortada.** Ela é a informação mais importante da tela para metade do público.
- **Freemium é binário**: ou o Premium está ativo, ou não está. Não invente um terceiro nível
  ("parcial", "provisório", "liberado por 24h").
- Falha de rede nunca é vendida como falta de assinatura.
- Alvos de toque ≥ 44px; contraste medido contra o fundo real do cartão, nos dois temas.

## Armadilhas já pagas neste projeto

- **Quebra de linha entre `R$` e o valor** a 390px — já aconteceu ("…equivalente a R$" / "12,99/mês").
  Nenhuma asserção de teste vê isso; só a imagem. Se um valor aparecer nesta tela, ele não parte.
- **Transbordo horizontal medido**: a 390px já nasceu botão fora da viewport (100,5px de estouro) numa
  tela de billing. Botões empilhados, texto que quebra, zero rolagem lateral.
- **Aviso que existe no código e nunca aparece na tela**: já houve um recado escrito que nenhum
  usuário jamais viu. Todo recado desenhado aqui precisa de um lugar fixo e visível no cartão.
- **Frase honesta cortada por caber num elemento estreito** — a frase inteira precisa de largura
  cheia.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como par de primeira classe**:

1. Não confirmado — 390px e 1280px (a peça principal, com as duas leituras separadas).
2. A sequência dos três desfechos lado a lado a 390px (confirmando → confirmado / não confirmado),
   para julgar a temperatura visual relativa.
3. Os estados 5, 6 e 7 (reentrada, offline, sessão expirada) a 390px.
4. Detalhe dos botões em repouso, hover, foco e pressionado, nos dois temas.

Reutilize os primitivos existentes, sem criar novos: `Card` como recipiente; `Icon` para o
indicador do topo (o conjunto disponível hoje é `circle-alert`, `triangle-alert`, `circle-check`,
`circle-user`, `crown`, `arrow-left`, `chevron-*`, `log-out`, `panel-left` — se o desenho pedir um
símbolo de espera/paciência que não existe, diga qual é e por quê, em vez de improvisar um
desenho); `Spinner` no estado de espera; `Button` nas variantes `primary` / `secondary` / `ghost`;
`Alert` (tons disponíveis) para o recado de offline ou de sessão expirada; `Badge` só se houver de
fato um rótulo de estado a exibir. Marque, prancheta a prancheta, qual primitivo é cada parte.

## Perguntas em aberto para o dono

1. **Existe canal de suporte?** O produto não tem e-mail, WhatsApp nem formulário em lugar nenhum.
   Se quem pagou e não vê o Premium precisa de uma saída, qual é: um e-mail de contato, o próprio
   comprovante no app do Mercado Pago, ou nada por enquanto? Sem essa resposta o desenho só pode
   reservar o espaço, não preenchê-lo.
2. **Mostrar o "Código de suporte" aqui?** Ele já existe na tela de erro técnico. Ajuda quem vai
   pedir ajuda, mas é ruído (e cheiro de erro) para quem só desistiu do checkout.
3. **A tela deve lembrar qual plano a pessoa tentou assinar** (R$ 15,99/mês ou R$ 155,88/ano)? Ajuda
   quem pagou a se reconhecer, mas fala de dinheiro com quem talvez não tenha pago nada.
4. **Qual das duas leituras vem primeiro** — "se você concluiu" ou "se você não concluiu"? A ordem
   define quem o desenho trata como público principal.
5. **A espera pode ser esticada por escolha da pessoa** ("continuar aguardando" além dos 45s), ou o
   único caminho é sair e voltar depois?
