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

- **Onde vive:** Dois modos de honestidade dentro do MESMO cartão "Plano" da Conta. (a) NÃO CONFIRMADO: a linha do selo contém um `Badge` neutro cujo TEXTO é a frase inteira "Não foi possível confirmar seu plano." — sem legenda ao lado, sem nota abaixo, e sem nenhuma ação de plano à direita (sobra só o "Recarregar"). (b) DEFASADO: qualquer um dos outros estados, com o sufixo " · última informação do servidor" concatenado ao FIM da legenda existente, dentro do mesmo `<span>` de tamanho legenda.
- **Como o vendedor chega:** Sem gesto próprio: o vendedor abre a Conta como sempre. O caso (a) acontece quando a leitura do ledger falha; o (b), quando o app está offline ou o servidor não respondeu e o valor exibido vem do cache do aparelho (guardado por conta).
- **Vizinhança imediata:** Acima: cartão de identidade. Abaixo: no desktop, a oferta inline NÃO aparece no caso (a) — o estado desconhecido não oferece assinar —, então a coluna 1 termina no próprio cartão do plano; no mobile, vem o cartão "Tema". No caso (b) o sufixo pode empurrar a legenda para duas linhas e, na carência, produz legenda + nota + sufixo: três frases seguidas em tamanho de legenda.
- **Dados que chegam (e o que ela devolve):** (a) `GET /entitlement` falhou (ou não há resposta nenhuma) — o painel se recusa a chutar e mostra o desconhecido. (b) o valor vem do cache uid-keyed no aparelho, que é a ÚLTIMA palavra do servidor, não uma flag do cliente; a marca de procedência é hoje apenas texto, não um elemento próprio.
- **O que acontece depois:** "Recarregar" tenta de novo (com spinner no próprio botão); voltando a rede, o cartão se reescreve para o estado real e o sufixo some. Nada muda no acesso: o servidor continua sendo quem decide a cada escrita, então um `active` defasado que já caducou é recusado na hora de salvar, e o registro fica visível como bloqueado — nunca aceito em silêncio.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Linha do plano na Conta: "não consegui confirmar" e "esse dado é de antes"

## O que desenhar

A linha do **Plano** dentro da tela **Conta** (`/conta`), nos dois estados em que ela fala sobre a
própria leitura em vez de falar sobre o plano: (a) quando o servidor de direitos **não respondeu** e o
app não sabe qual é o plano; (b) quando o valor mostrado é a **última resposta guardada no aparelho**
(vendedor offline, ou a chamada falhou e existe um valor lembrado). É o cartão logo abaixo do de
identidade (avatar de 44px + e-mail) e, no desktop, o primeiro item da coluna mais larga de uma grade
de três colunas (identidade+plano · tema · privacidade+sair); abaixo dele, quando cabe assinar, abre o
cartão da oferta. Quem vê: o vendedor que abriu a Conta para conferir se ainda é Premium — em geral
porque desconfia de algo, e quase sempre com internet ruim na bancada da impressora.

## Por que este prompt existe

Estes dois estados nunca foram desenhados — foram compostos em código. O protótipo de 2026-07-02 só tem
os ramos `isFree` e `isPremium` da Conta: não há ramo de erro nem de cache, e a busca por "não foi
possível / defasado / offline / última informação" na prancheta da Conta dá **zero**. O protótipo tem
vocabulário de offline — a **faixa global do shell** em ciano, "Offline — o cálculo continua
funcionando" (11,96:1 medido no escuro) — mas isso é uma faixa sobre a REDE, não uma marca de
procedência colada num dado específico, que é o que falta aqui. E o "não sei" não tem precedente: o
erro de carga só foi desenhado para as **listas** de Catálogo e Histórico ("Não foi possível carregar.
Tente de novo." + botão), nunca para um **selo de estado**.

## O que já existe hoje (não invente do zero — corrija)

Anatomia atual do cartão (`conta-page.tsx` · `plan-panel.tsx`): rótulo "Plano" numa linha; abaixo, um
selo (pílula) e, ao lado dele, uma legenda em texto pequeno; abaixo, opcionalmente, uma segunda linha
de nota; à direita, as ações do plano e **sempre** um botão fantasma "Recarregar".

| Estado (código) | Selo | Legenda ao lado | Nota abaixo | Ações à direita |
|---|---|---|---|---|
| `unknown` (ledger falhou) | "Não foi possível confirmar seu plano." — tom neutro | — nenhuma | — nenhuma | só "Recarregar" |
| `free` | "Gratuito" — neutro | — nenhuma | — | "Assinar Premium" + "Recarregar" |
| `lapsed` | "Premium pausado" — neutro | "Seus itens salvos continuam disponíveis para leitura." | — | "Assinar novamente" + "Recarregar" |
| `subscription-active` | "Premium" — sucesso (verde) | "Plano mensal · renova em 31/12/2026" | — | "Gerenciar assinatura" · "Cancelar assinatura" · "Recarregar" |
| `grace` | "Premium" — **verde de propósito** | "pagamento pendente — regularize" (tom `info`) | "até 30/12/2026, senão o Premium pausa." | "Atualizar forma de pagamento" (primário) + "Recarregar" |
| leitura do cache (`stale`) | o selo do estado acima, inalterado | a legenda ganha o sufixo " · última informação do servidor" | inalterada | inalteradas |

→ **A frase inteira mora dentro da pílula.** "Não foi possível confirmar seu plano." tem 37 caracteres
num componente cuja regra é `white-space: nowrap`, altura mínima 24px, peso semibold, tamanho de
legenda: ela não quebra — ela empurra a linha. É o oposto do que uma pílula de status faz.

→ **"Não sei" está pintado como se fosse um plano.** O tom neutro é exatamente o mesmo de "Gratuito" e
de "Premium pausado". Para o vendedor offline, "não consegui confirmar" e "você não tem" têm os mesmos
pixels — e essa é a confusão cara.

→ **Carregando e falhou são o mesmo desenho.** A tela nunca consulta o estado "primeira leitura em
curso": enquanto a resposta não chega e o aparelho não tem nada lembrado, a Conta já mostra
"Não foi possível confirmar seu plano.". A frase mais alarmante da tela aparece antes de qualquer falha.

→ **O sufixo de procedência é texto, não elemento.** No `free` a legenda não existe, então sobra
"última informação do servidor" sozinha — fragmento sem sujeito colado num selo "Gratuito". Na
carência viram três frases seguidas no mesmo tamanho de legenda. E **"Recarregar" não se explica**: é
fantasma, existe em todos os estados, e no `unknown` é a única coisa acionável da linha.

## Conteúdo e dados reais

- Rótulo da linha: **"Plano"**. Título da tela: **"Conta"**.
- Textos literais já homologados, a reutilizar sem reescrever: "Gratuito" · "Premium" · "Premium
  pausado" · "Seus itens salvos continuam disponíveis para leitura." · "Não foi possível confirmar seu
  plano." · "última informação do servidor" · "Recarregar" · "Assinar Premium" · "Assinar novamente" ·
  "Gerenciar assinatura" · "Atualizar forma de pagamento" · "pagamento pendente — regularize" · "até
  {data}, senão o Premium pausa." · "Plano mensal"/"Plano anual" · "renova em" · "ativo até" · "não
  renova" · "cortesia"/"via programa beta" · "expira em".
- Datas são **fato do servidor** e aparecem em pt-BR curto: `31/12/2026`. Quando o servidor não manda
  data, a frase existe **sem** data — nunca com data inventada.
- Nesta peça **não há dinheiro**: preço só existe no cartão da oferta, abaixo. Não coloque valor aqui.
- Os dois estados desta peça são **mutuamente exclusivos** por construção: "não confirmado" só ocorre
  quando não há resposta nenhuma (nem fresca, nem lembrada); "defasado" só ocorre quando há uma
  resposta lembrada. Não desenhe os dois juntos.
- E-mail vizinho: `jonatan.fbossan@gmail.com` (trunca com reticências; nunca estoura a linha).

## Estados obrigatórios

1. **Não confirmado** (`unknown`): diz "Não foi possível confirmar seu plano." sem afirmar plano
   nenhum, sem ação de assinar (o app não sabe se ele já é Premium) e com o caminho de tentar de novo.
2. **Primeira leitura em curso**: o vendedor abriu a Conta e a resposta ainda não chegou. Precisa ser
   visivelmente diferente do item 1 — hoje não é.
3. **Recarregando com dado na tela**: o botão "Recarregar" em carregamento; o selo e a legenda que já
   estavam continuam legíveis (nada pisca para vazio).
4. **Defasado sobre "Gratuito"**: selo "Gratuito" + a marca de procedência. Este é o estado em que o
   risco de mentira é maior.
5. **Defasado sobre "Premium"**: "Plano mensal · renova em 31/12/2026" + a marca de procedência.
6. **Defasado sobre carência**: selo "Premium" **verde**, legenda "pagamento pendente — regularize" em
   tom informativo, nota "até 30/12/2026, senão o Premium pausa." e ainda a marca de procedência —
   quatro informações numa linha estreita. É o pior caso de densidade; desenhe-o de verdade.
7. **Defasado sobre "Premium pausado"**: selo + "Seus itens salvos continuam disponíveis para leitura."
   + procedência.
8. **Foco de teclado**, **hover** e **pressionado** do "Recarregar" (e de qualquer afordância nova).
9. **Offline global**: como a linha se comporta enquanto a faixa do shell "Offline — o cálculo continua
   funcionando" está na tela — a marca de procedência não pode virar eco redundante da faixa.
10. **Desabilitado**: hoje não existe (o botão só entra em carregamento). Se precisar de um, diga por quê.

## Viewports

- **Mobile 390px** (obrigatório): é onde a linha já estourou uma vez; confira o pior caso a **360px**,
  o piso que a homologação usa.
- **Desktop 1280px** (obrigatório): a Conta vira grade de três colunas e o cartão do plano ocupa a mais
  larga — ainda assim ~1,15/3 da página. **A pílula com a frase inteira é pior aqui do que no mobile.**
- **1920px**: opcional, mesma composição mais folgada — só desenhe se a sua solução mudar.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como plano.** "Não consegui confirmar" jamais pode ler como
  "Gratuito", e nunca pode oferecer "Assinar Premium" — vender a alguém o que ele talvez já pague é a
  mentira mais cara desta tela.
- **Nem o contrário**: um dado lembrado do aparelho não pode ser exibido como se fosse fresco. A
  procedência é dita, não escondida.
- **Freemium binário**: só existem Gratuito e Premium. Não invente "plano indefinido" como se fosse um
  terceiro plano.
- **O selo da carência continua verde.** O Premium ESTÁ ativo durante toda a carência; degradar o selo
  seria a mentira na direção oposta. Quem carrega a cautela é o texto.
- **Frase honesta nunca em placeholder nem cortada**: a procedência e o "não confirmado" moram em
  elementos que comportam a frase inteira, com quebra de linha permitida.
- **Zero transbordo horizontal** em qualquer viewport: quebra de linha, nunca barra de rolagem.
- **Alvo de toque ≥ 44px** para "Recarregar" e para qualquer afordância nova.
- **Contraste medido contra o fundo real do cartão** (não contra o fundo da página), nos dois temas.

## Armadilhas já pagas neste projeto

- **Transbordo medido nesta mesma linha**: a 390px ela mediu 453,5px contra 316px de conteúdo do
  cartão, a página foi a 491px (100,5px de transbordo) e o botão nasceu **inteiramente fora da
  viewport**, em x=396,3 — com o modal aberto sobrava uma faixa clara à direita, com o botão à mostra.
- **Pílula não quebra**: `white-space: nowrap` é regra do componente de selo; qualquer frase longa
  dentro dele vira largura mínima intransponível.
- **Texto ocluso passa em teste**: asserção de texto não enxerga colisão nem corte, e barra de rolagem
  clássica é invisível no headless — a quebra de cada frase longa se resolve no desenho.
- **Duas primeiras palavras iguais lado a lado**: "Atualizar" já teve de virar "Recarregar" porque
  ficava a 8px de "Atualizar forma de pagamento". Não reintroduza colisão de rótulos.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. **390px — a matriz dos estados**: não confirmado · primeira leitura · defasado sobre Gratuito ·
   defasado sobre Premium · defasado sobre carência · defasado sobre Premium pausado.
2. **1280px — a coluna do plano** com os mesmos estados na largura real da grade de três colunas.
3. **Detalhe ampliado (2x)** da marca de procedência e do selo "não confirmado", com as medidas de
   altura, espaçamento e quebra de linha.
4. **Convivência** da linha com a faixa global de offline do shell.

Reaproveite os primitivos existentes, sem criar novos: **`tf-badge`** (tons neutro/info/sucesso) no
selo, **`tf-card`** no cartão da linha, **`tf-btn`** fantasma `sm` em "Recarregar" e `tf-btn` primário
nas ações de cobrança, **`tf-alert`** (`danger`/`info`) se o "não confirmado" pedir o mesmo tratamento
do erro do cartão de identidade — que já empilha alerta + "Tentar novamente". Ícones apenas do conjunto
do DS; se o pictograma que você quer não existir lá, **diga isso em vez de inventar um**.

## Perguntas em aberto para o dono

1. **O rótulo do "não sei"**: o selo passa a mostrar um rótulo curto (ex.: "Não confirmado") com a
   frase completa fora dele, ou a frase inteira continua sendo o selo? Rótulo novo é copy nova, e copy
   de cobrança é decisão do dono.
2. **Carregando é visível ou mudo?** Enquanto a primeira leitura corre, a Conta deve dizer algo
   ("Verificando seu plano...") ou ficar em esqueleto silencioso até haver resposta?
3. **A marca de dado defasado é elemento ou sufixo?** Vira chip/ícone na linha do plano, ou continua
   sufixo textual da legenda? E ela aparece junto com a faixa global de offline, ou uma suprime a outra?
4. **"Gratuito · última informação do servidor"**: no plano gratuito a legenda vira só o fragmento
   "última informação do servidor", sem sujeito. Aceita assim, ou quer uma frase completa (copy nova)?
