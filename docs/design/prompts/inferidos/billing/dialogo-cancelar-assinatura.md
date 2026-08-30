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

- **Onde vive:** Diálogo MODAL centrado (`variant="center"`, largura `min(92vw, 32rem)`, cantos arredondados, scrim escuro por cima da página inteira), aberto sobre a Conta. Conteúdo em coluna: título "Cancelar a assinatura?" → descrição com a data ("Seu Premium continua ativo até {data}.") → um terceiro parágrafo menor, em cinza, sobre o congelamento em leitura → (se houver falha) uma tarja vermelha → linha final de botões alinhada à DIREITA: "Voltar" (secundário, com preenchimento) e "Cancelar assinatura" (perigo-fantasma). Um "X" de fechar de 44×44px fica no canto superior direito da caixa.
- **Como o vendedor chega:** Só existe uma porta: o botão fantasma "Cancelar assinatura", terceiro elemento da direita da linha do plano, visível apenas para quem tem assinatura ATIVA (ao lado de "Gerenciar assinatura").
- **Vizinhança imediata:** Por baixo do scrim fica a Conta inteira: o cartão de identidade e, imediatamente atrás do diálogo, a linha do plano com selo verde "Premium · Plano anual · renova em {data}". No desktop, também as colunas de tema e de privacidade/Sair, escurecidas. É o único fluxo destrutivo pago do produto.
- **Dados que chegam (e o que ela devolve):** A data que aparece na descrição é a mesma `renewsAt` do espelho do PSP já exibida na linha do plano (se não houver data, o texto cai para "…até o fim do período já pago."). O botão de confirmação chama `POST /billing/subscription/cancel`; em falha, a tarja "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes." nasce DENTRO da caixa, entre o parágrafo do congelamento e a linha de botões, e o diálogo continua aberto.
- **O que acontece depois:** No sucesso o diálogo DESMONTA sozinho (o estado do plano muda e o ramo que o renderiza deixa de existir): a linha do plano atrás se reescreve para "ativo até {data} · não renova" com "Assinar novamente", e um toast de sucesso aparece no rodapé. "Voltar" e o "X" fecham sem mudar nada. Nada é apagado: os itens salvos seguem disponíveis até a data e, depois dela, em leitura.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Diálogo "Cancelar a assinatura?" — a única ação destrutiva paga do produto

## O que desenhar
A caixa de confirmação que aparece quando o assinante Premium clica em "Cancelar assinatura" na linha do
plano, dentro da aba **Conta**. É um diálogo centrado, modal, com foco preso: ele diz o que a pessoa
MANTÉM e até quando, o que acontece depois (congelamento em leitura, nada é apagado), e oferece duas
saídas — voltar atrás ou confirmar o cancelamento. Quem a usa é o vendedor que já paga (R$ 15,99/mês ou
R$ 155,88/ano) e está decidindo parar. É o único lugar do produto onde um clique tira algo que foi pago,
e é o único botão do módulo de cobrança que carrega a palavra "Cancelar" como AÇÃO — em todo o resto ela
está proibida como rótulo de dispensa.

## Por que este prompt existe
A caixa inteira foi inferida a partir de um texto de spec (`specs/012-e6-billing/ux-billing.md` §5, que
traz só um esboço em ASCII), sem nenhum artboard. O protótipo de 2026-07-02 desenha apenas o **gatilho** —
um botão fantasma "Cancelar assinatura" na tela da conta — e nenhum artboard tem diálogo, overlay ou
confirmação; a rodada 1 da homologação inclusive PROIBIU o assunto no protótipo ("Cancele quando quiser"
foi removido por ser decisão em aberto). Existe um padrão de caixa reutilizável (foco, Escape, alvos
≥44px, tudo verificado), mas ninguém compôs **título + corpo + aviso + erro + duas saídas de peso
desigual** para uma ação destrutiva de cobrança. E o desenho inferido contradizia a própria cópia: a
mensagem dizia "dá para voltar" enquanto o botão destrutivo era 2,2× mais largo (187,6×48px contra
85,6×48px) e o ÚNICO com preenchimento. Isso foi remendado às pressas trocando o preenchimento de lado —
o próprio comentário no código registra que "a largura continua desigual".

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/billing/plan-panel.tsx` (`CancelDialog`) e
`apps/web/src/shared/i18n/messages.pt-br.ts` (namespace `billing`). Ordem vertical atual, de cima para
baixo, tudo empilhado com espaçamento igual (gap de 12px), dentro de uma caixa com um "✕" de fechar no
canto superior direito:

| # | Elemento | Texto literal hoje | Tratamento atual |
|---|---|---|---|
| 1 | Título | "Cancelar a assinatura?" | título do diálogo |
| 2 | Corpo | "Seu Premium continua ativo até 31/12/2026." (sem data no servidor: "Seu Premium continua ativo até o fim do período já pago.") | descrição do diálogo, corpo normal |
| 3 | Aviso de congelamento | "Depois disso, seus itens salvos ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser." | → **problema**: é o parágrafo que mais tranquiliza e está no MENOR tamanho (legenda) e no MENOR contraste (cinza apagado) da caixa |
| 4 | Erro (só após falha) | "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes." | alerta vermelho, aparece DENTRO da caixa, entre o aviso e os botões — → **problema**: empurra os botões para baixo e nunca foi desenhado nessa posição |
| 5 | Saídas | "Voltar" · "Cancelar assinatura" | linha alinhada à direita, gap de 8px; "Voltar" preenchido (secundário), "Cancelar assinatura" contornado em vermelho — → **problema**: larguras desiguais herdadas do comprimento do rótulo, nunca desenhadas |

Fora da caixa, e que o desenho precisa considerar como contexto:

- **Gatilho** — na linha "Plano" da Conta: selo verde "Premium", legenda "Plano mensal · renova em
  31/12/2026" e, à direita, dois botões pequenos e do mesmo peso: "Gerenciar assinatura" (leva ao
  Mercado Pago, fora do app) e "Cancelar assinatura".
- **Sucesso** — a caixa DESMONTA no instante do sucesso; o reconhecimento vive num toast verde:
  "Assinatura cancelada. Premium ativo até 31/12/2026." A linha do plano então passa a mostrar selo verde
  "Premium", legenda "ativo até 31/12/2026 · não renova", a nota "Seus itens salvos continuam disponíveis;
  nada é apagado." e o botão "Assinar novamente".

## Conteúdo e dados reais
- **A data** é sempre a do servidor (fim do período já pago), formatada pt-BR: `31/12/2026`. Nunca é
  calculada no aparelho, e pode faltar — nesse caso entra a frase sem data, que já existe. Desenhe as duas.
- **Não há campos de entrada.** Nada é digitado; não há caixa de "motivo do cancelamento" hoje.
- **Valores do plano** (aparecem na oferta, não nesta caixa, mas dão a escala do que está em jogo):
  R$ 15,99/mês, R$ 155,88/ano ("equivalente a 12,99/mês").
- **A caixa só existe para a assinatura ATIVA.** Em carência, pausado, gratuito ou já cancelado, o botão
  que a abre nem é renderizado — não desenhe variantes para esses casos, desenhe o gatilho ausente.

## Estados obrigatórios
1. **Repouso** — os cinco blocos acima, sem erro. Diga com o desenho qual das duas saídas é a segura.
2. **Sem data do servidor** — mesma caixa com "Seu Premium continua ativo até o fim do período já pago."
   (frase mais longa: mostre que ela quebra em duas linhas sem empurrar nada para fora).
3. **Foco** — o foco entra na caixa ao abrir e não escapa dela; Escape fecha e devolve o foco ao botão
   "Cancelar assinatura" da linha do plano. Desenhe o anel de foco visível nos dois botões e no "✕".
4. **Hover e pressionado** nas duas saídas e no "✕" — inclusive o hover do destrutivo, que hoje ganha
   fundo vermelho suave e borda mais escura.
5. **Confirmando (carregando)** — o botão destrutivo entra em carga; ele não pode ser clicado duas vezes,
   e "Voltar" precisa de uma posição definida nesse instante (continua clicável? fica desabilitado?).
   Nada na caixa pode sugerir que o cancelamento já aconteceu enquanto o servidor não respondeu.
6. **Erro** — alerta vermelho com "Não foi possível cancelar agora. Nada mudou — tente de novo em
   instantes.", a caixa segue aberta e as duas saídas continuam disponíveis. Ao fechar, o erro some.
7. **Falha por falta de rede** — hoje cai no MESMO alerta acima. Ele diz a verdade literal (nada foi
   espelhado no servidor), mas não diz "você está sem conexão". Desenhe como esse alerta se lê para quem
   está offline sem que a caixa acuse o produto de ter falhado ou insinue que o Premium acabou.
8. **Depois do sucesso** — a caixa não existe mais: desenhe o toast e a linha do plano no estado
   "ativo até 31/12/2026 · não renova", porque é a única prova que o vendedor recebe.

## Viewports
- **390px (mobile)** — obrigatório: é onde o transbordo já foi medido, e onde as duas saídas lado a lado
  com larguras desiguais ficam mais apertadas. Mostre também a linha do plano ATRÁS do overlay.
- **1280px (desktop)** — obrigatório: a Conta tem layout próprio de desktop, e a caixa não pode simplesmente
  esticar. Defina a largura máxima da caixa e o que acontece com o espaço restante.
- **1920px** — não precisa de prancheta nova, mas declare no desenho que a caixa mantém a mesma largura
  máxima de 1280px e permanece centrada.

## Regras que o desenho não pode quebrar
- **"Cancelar" só na ação, nunca na dispensa.** A saída segura chama-se "Voltar" e essa é uma regra dura
  do produto (FR-014). Não renomeie nenhum dos dois rótulos.
- **A saída segura precisa ser visivelmente a mais fácil.** A cópia promete reversibilidade; o desenho
  precisa concordar com ela — hierarquia, peso e largura são parte da promessa.
- **Sem culpa, sem escassez, sem padrão escuro**: nada de "tem certeza que quer perder tudo?", contagem
  regressiva, benefício riscado ou botão destrutivo escondido.
- **Frase honesta nunca em elemento estreito ou cortado.** O aviso de congelamento é a frase mais cara da
  caixa e precisa caber inteira, nos dois viewports, sem reticências.
- **A data é fato do servidor**, não estimativa: nunca escreva "aproximadamente" ou "em cerca de 30 dias".
- **Alvos ≥44×44px** para as duas saídas e para o "✕", medidos, não estimados.
- **Contraste do texto vermelho** medido contra o fundo REAL da caixa (não contra o fundo da página), nos
  dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo medido de 100,5px** na linha do plano a 390px: o botão de ação nascia inteiramente fora da
  viewport (x=396,3) e, com o modal aberto, o overlay cobria só 390px — sobrava uma faixa clara à direita
  com o botão solto à mostra por baixo. O desenho precisa mostrar o overlay cobrindo a página inteira.
- **Um toast que nunca apareceu**: a cópia de sucesso existia, mas a caixa desmontava antes de ela ser
  disparada — um observador armado por 8 segundos registrou zero inserções. Por isso o reconhecimento é
  desenhado FORA da caixa, e a prancheta do sucesso é obrigatória.
- **Hierarquia invertida medida em pixels** (187,6 contra 85,6, e só o destrutivo com fundo). Qualquer
  proposta aqui precisa vir com as duas larguras declaradas.
- Texto ocluso ou transbordado passa em teste de conteúdo: layout se prova com caixas medidas.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**, reaproveitando os primitivos existentes —
não crie componentes novos:

1. Repouso, 390px — caixa centrada (`tf-dialog` variante centrada, com o overlay), título `tf-dialog__title`,
   corpo `tf-dialog__desc`, aviso de congelamento (proponha o tratamento; hoje é legenda apagada), e as
   duas saídas em `tf-btn` — declare qual variante cada uma usa e as larguras resultantes.
2. Repouso, 1280px, com a linha do plano visível atrás do overlay.
3. Confirmando — botão destrutivo em carga.
4. Erro — `tf-alert` de tom perigo dentro da caixa, 390px, mostrando o empurrão vertical que ele causa.
5. Sem data do servidor — a frase longa quebrando.
6. Sucesso — `tf-toast` de tom sucesso + a linha do plano no estado "não renova" com `tf-badge` verde e
   o botão "Assinar novamente".
7. Uma folha de estados dos dois botões e do "✕": repouso, hover, foco, pressionado, desabilitado,
   carregando — com os alvos medidos anotados.

## Perguntas em aberto para o dono
1. **As duas saídas devem ter a mesma largura?** Igualá-las foi explicitamente considerada e não escolhida
   quando a hierarquia foi remendada; a decisão nunca foi desenhada. Se sim, largura igual em 50/50 ou
   ambas em largura total, empilhadas?
2. **Ordem e posição**: "Voltar" fica à esquerda do destrutivo, como hoje, ou o destrutivo desce/afasta-se
   para não ser o alvo mais próximo do polegar no mobile?
3. **O "✕" no canto continua?** Ele é o padrão da caixa e duplica a função de "Voltar" — a spec original o
   desenhava, mas com duas saídas explícitas ele pode virar ruído.
4. **Perguntar o motivo do cancelamento?** Não existe hoje e não está escrito em lugar nenhum; incluir
   muda a caixa inteira (e arrisca virar atrito, que a §5 proíbe).
5. **Quando a pessoa tem cortesia que sobrevive ao fim do período pago**, o painel avisa isso DEPOIS
   ("Seu acesso de cortesia continua depois disso."). A caixa deve avisar ANTES de confirmar, para não
   assustar com um corte que não vai acontecer?
