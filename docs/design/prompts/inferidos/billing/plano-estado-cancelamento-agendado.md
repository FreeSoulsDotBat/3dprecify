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

- **Onde vive:** O mesmo cartão "Plano" da Conta (coluna 1 no desktop, segundo bloco no mobile), na sua altura MÁXIMA: rótulo "Plano" → linha [selo verde "Premium"] + [legenda "ativo até {data} · não renova"] → nota, que pode ser UMA ou DUAS frases emendadas no mesmo parágrafo de legenda.
- **Como o vendedor chega:** O vendedor acabou de cancelar (o diálogo fechou e a linha se reescreveu debaixo dele), ou volta à Conta dias depois para conferir até quando ainda tem acesso.
- **Vizinhança imediata:** Acima: cartão de identidade. À direita, na mesma linha: o botão "Assinar novamente" (pequeno) e o "Recarregar" fantasma. Abaixo, no DESKTOP: o cartão "Assinar o Premium" com a oferta inline completa (este é um dos três estados em que ela aparece), o que coloca duas superfícies de recompra em sequência vertical. No mobile, o próximo cartão é "Tema".
- **Dados que chegam (e o que ela devolve):** Ledger `active` + espelho do PSP com status `cancelled` e `currentPeriodEnd`. A nota base é "Seus itens salvos continuam disponíveis; nada é apagado."; quando o ledger tem um grant que vai ALÉM do fim do período (uma cortesia mais longa), o texto ganha uma terceira frase colada: "Seu acesso de cortesia continua depois disso." Tudo isso em tamanho de legenda e cinza neutro.
- **O que acontece depois:** "Assinar novamente" abre a oferta — no mobile a gaveta "Assinar o Premium"; no desktop apenas ROLA suavemente até o cartão de oferta que já está logo abaixo (nunca abre a gaveta por cima). Quando a data chega sem recompra, o estado vira "Premium pausado" e o app congela em leitura.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Linha do plano na Conta — cancelamento agendado ("ativo até 31/12/2026 · não renova")

## O que desenhar
A linha do **Plano** dentro do card de plano da tela **Conta**, no estado em que o vendedor **já pediu o
cancelamento e ainda está pagando o período corrente**: o Premium continua ligado, mas há uma data de corte
marcada. É a primeira coisa que ele vê quando volta à Conta depois de cancelar — e é a única superfície do
produto que responde "o que eu perco, e quando". A peça é uma linha composta: rótulo `Plano`, selo verde
`Premium`, uma legenda com a data, uma nota de tranquilização que pode ganhar uma terceira frase, e as ações
à direita (`Assinar novamente` + `Recarregar`). Origem no código: `apps/web/src/features/billing/plan-panel.tsx`
(estado `subscription-canceled`), `plan-view.ts`, `apps/web/src/pages/conta/conta-page.tsx`.

## Por que este prompt existe
Este estado nunca foi desenhado. O protótipo de 2026-07-02 (§E7 "plano atual (Free/Premium)") renderiza **um
selo binário e UMA legenda de uma linha** — não existe no artboard nenhum elemento equivalente à segunda linha
(a nota), e a busca por "não renova / ativo até / apagado / cortesia" no canvas dá zero. Toda a redação veio de
`specs/012-e6-billing/ux-billing.md` §4.3, texto, sem prancheta. Pior: a rodada de correção do protótipo
(`claude-design-prototype-fixes.md`, item 2) mandou **remover** a frase "Cancele quando quiser" do overlay
Premium porque "a política de cancelamento ainda não foi decidida pelo produto" — ou seja, a autoridade de
desenho fecha a porta neste assunto, e o código a atravessou assim mesmo. A terceira frase (cortesia) está
marcada no próprio código como "recomendação §10-F1, ~70%, **pendente de ratificação do dono**".

## O que já existe hoje (não invente do zero — corrija)
Ordem atual dos elementos, de cima para baixo, dentro de um `tf-card`:

| Elemento | Texto literal hoje | Estilo atual |
| --- | --- | --- |
| Rótulo | `Plano` | `--text-body` |
| Selo | `Premium` | badge tom `success` (verde) |
| Legenda (mesma linha do selo) | `ativo até 31/12/2026 · não renova` | `--fs-caption`, `--text-muted` |
| Nota (linha própria) | `Seus itens salvos continuam disponíveis; nada é apagado.` | `--fs-caption`, `--text-muted` |
| 3ª frase (condicional, **emendada na mesma nota, só com um espaço**) | `Seu acesso de cortesia continua depois disso.` | idem — indistinguível da anterior |
| Ação primária | `Assinar novamente` | botão pequeno, preenchido |
| Ação secundária | `Recarregar` | botão pequeno, fantasma |

→ **Problema 1**: as três frases têm exatamente a mesma cor, o mesmo tamanho e nenhuma hierarquia. A nota que
tranquiliza ("nada é apagado") e a nota que **muda o fato** ("sua cortesia continua depois disso") leem como a
mesma letra miúda, coladas numa única linha de texto corrido.
→ **Problema 2**: a legenda afirma um corte em 31/12/2026 e a linha de baixo promete que nada é apagado. Sem
desenho, isso lê como contradição; a peça precisa mostrar visualmente que são coisas diferentes — o que
**para** (a cobrança e a edição) e o que **fica** (os dados, em leitura).
→ **Problema 3**: `Assinar novamente` sugere um checkout novo; o vendedor que só quer desfazer o cancelamento
não sabe se é isso. Ver "Perguntas em aberto".
→ **Problema 4**: no desktop (≥1280px) este mesmo estado faz aparecer, **logo abaixo do card**, um segundo card
`Assinar o Premium` com a oferta inteira — e o botão `Assinar novamente` apenas rola até ele. A relação entre os
dois cards nunca foi composta.

## Conteúdo e dados reais
- **Data de corte** (`activeUntil`): data do servidor, formato pt-BR `dd/mm/aaaa` — exemplo real `31/12/2026`.
  É o fim do período **já pago**. Nunca é inventada; quando o servidor não a manda, a legenda encolhe para
  apenas `não renova` (sem "ativo até"), e a nota continua igual.
- **Cortesia sobrevivente**: existe quando o vendedor carrega um grant de cortesia que vai **além** da data de
  corte (ex.: assinatura termina em `31/12/2026`, cortesia vale até `15/03/2027`). A borda é estrita: empate na
  mesma data **não** acende a frase.
- **Selo**: sempre `Premium`, tom verde. O premium **está ativo** durante todo o período — degradar o selo aqui
  seria a mentira na direção oposta (dizer que ele já perdeu o que ainda pagou).
- **Origem do dado**: quando a leitura é a última resposta guardada no aparelho (offline), a legenda ganha um
  terceiro segmento: `ativo até 31/12/2026 · não renova · última informação do servidor`.
- **Sem dinheiro nesta peça.** Preço só aparece no card de oferta que fica abaixo; esta linha não mostra valor.

## Estados obrigatórios
1. **Repouso, com data, sem cortesia** — selo `Premium` + `ativo até 31/12/2026 · não renova` + nota
   `Seus itens salvos continuam disponíveis; nada é apagado.` + `Assinar novamente` e `Recarregar`.
2. **Repouso, com cortesia sobrevivente** — as três frases. Desenhe como a terceira deixa de ser letra miúda:
   ela é a que corrige a data de corte que está logo acima.
3. **Sem data** — legenda apenas `não renova`; o resto igual. A linha não pode "murchar" nem parecer quebrada.
4. **Offline / dado guardado** — legenda com o sufixo `última informação do servidor`. Precisa caber sem cortar:
   a frase honesta **não pode** virar reticências (é a terceira ocorrência dessa armadilha no projeto).
5. **Recarregando** — o botão `Recarregar` em carregamento (rótulo permanece legível, o alvo não encolhe).
6. **Foco, hover e pressionado** dos dois botões, com anel de foco visível sobre o fundo do card em ambos os temas.
7. **Vizinhos que NÃO são esta peça, e que o desenho não pode misturar**: erro de leitura do plano mostra
   `Não foi possível confirmar seu plano.` sem selo verde; premium já caído mostra `Premium pausado` +
   `Seus itens salvos continuam disponíveis para leitura.`. Não invente um híbrido entre eles e este estado.

## Viewports
- **390px (mobile)** — obrigatório: é onde o estado nasceu e onde ele já transbordou de verdade.
- **1280px (desktop)** — obrigatório: é o corte medido do produto, e é a partir dele que a coluna do plano ganha
  ~1,15 de 3 frações da grade **e** o card de oferta aparece inline logo abaixo. Desenhe os dois cards juntos.
- **1920px** — opcional, só para mostrar que a coluna larga não deixa as três frases virarem uma faixa
  interminável de texto de uma linha só.

## Regras que o desenho não pode quebrar
- **A data é fato do servidor, não promessa nossa.** Onde não há data, não há frase com data.
- **A degradação é dita, não escondida**: o que acontece depois de 31/12/2026 (itens em leitura, nada apagado)
  precisa ser legível sem esforço, não uma nota de rodapé.
- **O selo continua verde.** Cautela mora no texto, nunca num selo rebaixado que afirmaria uma perda que ainda
  não ocorreu.
- **Falha de rede nunca é vendida como perda de premium** — o rótulo offline é sobre a *origem do dado*.
- **Frase honesta fora de placeholder e fora de elemento estreito**: as três frases vivem em elementos de
  largura total.
- **Alvo de toque ≥44px** nos dois botões, inclusive quando a linha quebra.
- **Contraste medido contra o fundo real do card** (não contra o fundo da página), nos dois temas — o texto
  `--text-muted` sobre o card é justamente o par que costuma reprovar.

## Armadilhas já pagas neste projeto
- **Transbordo medido, não estimado**: nesta mesma linha, a 390px, as ações somaram 453,5px contra 316px de
  conteúdo útil do card; a página foi a 491px de largura de rolagem (**100,5px de transbordo**) e um dos botões
  **nasceu inteiramente fora da viewport**, em x=396,3 — com o modal aberto, sobrava uma faixa clara à direita
  com o botão solto à mostra. O card quebra a linha das ações; **nunca** rola na horizontal.
- **Duas ações lado a lado com a mesma primeira palavra** já confundiram aqui (`Atualizar` × `Atualizar forma de
  pagamento`), e por isso o nosso botão virou `Recarregar`. Mantenha os dois rótulos visualmente distinguíveis.
- **Texto ocluso passa em teste**: a sobreposição não é propriedade do texto. Componha com caixas, não confiando
  que "o texto está lá".
- **Valor/frase longa estoura coluna**: teste a composição com a legenda mais longa possível (data + `não renova`
  + `última informação do servidor`) e com a nota de três frases juntas.

## Entregável
Pranchetas, tema **escuro** como padrão e **claro** como equivalente de primeira classe:
1. 390px — estado 1 (duas frases), repouso.
2. 390px — estado 2 (três frases, cortesia sobrevivente).
3. 390px — estado 4 (offline) com o botão `Recarregar` em carregamento; e a variação sem data.
4. 1280px — a coluna do plano com o card `Assinar o Premium` inline logo abaixo, mostrando a relação entre eles.
5. Folha de estados dos dois botões: repouso, hover, foco, pressionado, carregando.
6. Tema claro do estado 2.

Reutilize os primitivos existentes, sem criar novos: `tf-card` para o card do plano, `tf-badge` tom `success`
para o selo `Premium`, `tf-btn` pequeno preenchido para `Assinar novamente` e `tf-btn` pequeno fantasma para
`Recarregar`, tipografia de legenda para as três frases. Se a solução exigir separar visualmente a nota da
terceira frase, faça-o com espaçamento, peso ou ícone dentro do que já existe — não com um componente novo.

## Perguntas em aberto para o dono
1. **Ratificar ou derrubar a §10-F1**: a frase `Seu acesso de cortesia continua depois disso.` fica? Se fica, ela
   é uma terceira frase emendada, uma linha própria, ou substitui a data de corte por outra ("ativo até
   15/03/2027 por cortesia")? Hoje ela está no produto marcada como pendente de sua ratificação.
2. **Desfazer o cancelamento**: existe caminho para o vendedor *retomar* a assinatura antes de 31/12/2026, ou o
   único caminho é assinar de novo? O rótulo `Assinar novamente` afirma a segunda hipótese; se a primeira for
   possível, a ação e o texto mudam.
3. **Contagem regressiva**: o desenho pode dizer quanto tempo falta ("faltam 12 dias") ou só a data? Contagem
   pressiona — e a política de cancelamento sem padrão escuro é uma decisão sua, não minha.
4. **O selo deve carregar alguma marca de "agendado"** (um ponto, um sufixo), ou o verde puro + a legenda bastam?
