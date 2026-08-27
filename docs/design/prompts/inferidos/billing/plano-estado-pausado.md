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

- **Onde vive:** O mesmo cartão "Plano" da Conta, na sua forma curta: rótulo "Plano" → linha [selo NEUTRO com o texto "Premium pausado"] + [legenda "Seus itens salvos continuam disponíveis para leitura."]; sem segunda linha de nota. À direita, "Assinar novamente" (pequeno) + "Recarregar" (fantasma).
- **Como o vendedor chega:** O ex-assinante abre a Conta depois de bater numa parede em outra aba — tentou salvar um produto, um kit ou um orçamento e o app recusou a escrita. Ele vem aqui entender por quê.
- **Vizinhança imediata:** Acima: o cartão de identidade. Abaixo, no desktop: o cartão "Assinar o Premium" com a oferta inline (o estado pausado é um dos três que a exibem). No mobile: o cartão "Tema". Visualmente, o selo é EXATAMENTE o mesmo do "Gratuito" — mesmo tom neutro, mesma forma —, só o texto muda.
- **Dados que chegam (e o que ela devolve):** Ledger com `status = lapsed` (nenhum grant válido, seja por fim de assinatura, seja por estorno). A causa NÃO trafega no contrato, e por isso o rótulo é deliberadamente neutro — "pausado", nunca "expirado", que afirmaria uma causa que pode ser falsa.
- **O que acontece depois:** "Assinar novamente" abre a mesma oferta (gaveta no mobile; rolagem até o cartão inline no desktop). Enquanto o estado durar, o app inteiro fica em modo leitura: catálogo, kits, orçamentos e simulações continuam visíveis e consultáveis, exportação e qualquer salvamento ficam bloqueados, e a fila offline não drena.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — CORTESIA / programa beta (grant de operador)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# Linha do plano na Conta — o estado "Premium pausado"

## O que desenhar
A linha "Plano" do cartão da Conta quando o vendedor **já pagou e perdeu a escrita**: o grant caducou, a conta
virou somente-leitura (o catálogo, os kits, os orçamentos e as simulações continuam lá, abrem e recalculam, mas
não salvam). É a primeira tela em que ele descobre isso de forma explícita — nas outras abas ele encontra uma
faixa "Premium pausado", e é para a Conta que essas faixas o mandam. Quem chega aqui é um ex-pagante ansioso:
ou o cartão falhou depois da carência, ou houve estorno/chargeback, ou a cortesia acabou. Ele quer duas
respostas em segundos: **"perdi meus dados?"** e **"como volto?"**.

## Por que este prompt existe
Este estado nunca foi desenhado. Ele foi inferido a partir de requisito textual: o código reusa o **mesmo selo
neutro do "Gratuito"**, trocando apenas a palavra, e coloca a tranquilização sobre os dados numa legenda de
`--fs-caption` ao lado. Resultado medido pela auditoria: **quem perdeu um acesso pago fica visualmente idêntico
a quem nunca pagou**. Não há protótipo parcial a resgatar — o canvas de autoridade (`Abas-Desktop.dc.html`)
trata plano como enum binário `premium|free` e não tem terceiro ramo; o `AccountScreen` do protótipo faz
`isPremium ? 'Premium' : 'Grátis'`; o `PremiumScreen` só conhece a primeira compra, não a reassinatura. O
único "congelamento" desenhado em algum lugar é o empty-state de upsell do Histórico, que é o *nunca teve* — e
não o *perdeu*. Falta desenhar como o produto comunica perda de acesso pago **sem parecer punição e sem parecer
igual a nunca ter assinado**.

## O que já existe hoje (não invente do zero — corrija)
O cartão é uma linha flex (rótulo + conteúdo à esquerda, ações à direita), com quebra para a segunda linha.
Origem: `apps/web/src/features/billing/plan-panel.tsx`, `pages/conta/conta-page.tsx`.

| Elemento | Conteúdo hoje | Observação |
|---|---|---|
| Rótulo da linha | "Plano" | `--text-body`, acima do selo |
| Selo | "Premium pausado" | pílula **neutra**: fundo `--bg-muted`, texto `--text-body`, `--fs-caption`, semibold, altura mín. 24px, `white-space: nowrap` → **é o mesmo selo, pixel a pixel, do "Gratuito"** |
| Legenda | "Seus itens salvos continuam disponíveis para leitura." | `--fs-caption` em `--text-muted`, **na mesma linha do selo** → a única frase que responde "perdi meus dados?" tem o menor tamanho e o menor contraste do cartão |
| Segunda linha | *não existe neste estado* | o código só emite a segunda linha ("nota") em carência e cancelamento |
| Ação primária | "Assinar novamente" | botão `size="sm"`, variante padrão |
| Ação secundária | "Recarregar" | botão `size="sm"` fantasma, ao lado; entra em carregando ao refazer a consulta |

→ Selo indistinguível do Gratuito é o defeito central.
→ A frase que acalma vive em tamanho de legenda, disputando a mesma linha com o selo.
→ Nada diz **o que trava** — só o que continua. As outras abas já dizem as duas metades ("Para criar ou editar,
reative o Premium"); esta, que é a tela do assunto, diz menos que elas.
→ **Offline/dado velho**: quando a resposta vem do cache, o app concatena o sufixo à mesma legenda e produz
literalmente `Seus itens salvos continuam disponíveis para leitura. · última informação do servidor` — ponto
final seguido de " · ". É feio e é obrigatório manter a informação; precisa de forma própria no desenho.

## Conteúdo e dados reais
- Textos literais de hoje (homologados, **não reescreva sem marcar que está propondo**): "Plano",
  "Premium pausado", "Seus itens salvos continuam disponíveis para leitura.", "Assinar novamente",
  "Recarregar", "última informação do servidor".
- O rótulo "Premium pausado" é **decisão fechada e cara**: era "Premium expirado" e foi trocado em homologação
  porque *expirar afirma uma causa* — num estorno o período foi cortado, não terminou. "Pausado" não afirma
  causa nenhuma e é a mesma palavra que Catálogo, Kits, Orçamentos e Simulações já usam.
- **Não há data e não há causa disponíveis neste estado.** O servidor manda apenas `none | active | lapsed`;
  a causa não trafega. Qualquer desenho que peça "pausado desde 12/08/2026" ou "por falta de pagamento" está
  pedindo contrato novo — se você achar que a peça precisa disso, escreva como pergunta ao dono, não desenhe
  como se existisse.
- Vizinhança do mesmo cartão (para o contraste que a prancheta precisa mostrar): "Gratuito" (selo neutro, sem
  legenda) · "Premium" (selo verde) + "Plano mensal · renova em 01/09/2026" · carência: selo **verde** +
  "pagamento pendente — regularize" e segunda linha "até 22/08/2026, senão o Premium pausa." em tom `info` ·
  cancelada: "ativo até 31/12/2026 · não renova" + "Seus itens salvos continuam disponíveis; nada é apagado." ·
  cortesia: "cortesia · expira em 30/09/2026" · falha: "Não foi possível confirmar seu plano." (selo neutro).
- A oferta que o botão leva: plano anual **R$ 155,88/ano**, "equivalente a R$ 12,99/mês", "~19% de economia
  frente ao mensal"; plano mensal **R$ 15,99/mês**, "cobrança todo mês, cancele quando quiser"; rodapé
  "Você paga no Mercado Pago (Pix ou cartão)." e "O cartão nunca passa pelo nosso app.".
- No desktop a oferta abre **inline, logo abaixo do cartão do plano**, sob o título "Assinar o Premium", e
  "Assinar novamente" apenas rola até ela. No mobile a mesma oferta abre numa gaveta.

## Estados obrigatórios
1. **Repouso (pausado)** — selo + frase de tranquilização + as duas ações.
2. **Pausado com dado velho (offline)** — a mesma linha, mais a marca de que aquilo é a última resposta
   guardada do servidor: "última informação do servidor". Resolva a colisão com o ponto final.
3. **"Recarregar" carregando** — o botão em estado ocupado enquanto reconsulta; o selo **não pode piscar para
   outro estado** nem virar esqueleto: o que está na tela continua sendo verdade até chegar outra.
4. **Foco de teclado** nos dois botões (anel visível sobre o fundo real do cartão) e **hover** e **pressionado**.
5. **Vizinhos para comparação na mesma prancheta**: "Gratuito" e "Premium" ativo — a prova visual de que os três
   não se confundem.
6. **Falha de leitura ("Não foi possível confirmar seu plano.")** — precisa ler como *não sabemos*, nunca como
   *você perdeu*; hoje ele também é um selo neutro.

## Viewports
- **390px (obrigatória)** — é onde o vendedor usa o app e onde esta linha já estourou a viewport uma vez.
- **1280px (obrigatória)** — é o corte em que a Conta vira três colunas (identidade+plano · tema · privacidade)
  e onde a oferta passa a abrir inline embaixo do cartão do plano; a coluna do plano é a mais larga das três.
- 1920px é bem-vinda só para mostrar que a coluna larga não estica o selo nem a frase até virar uma linha vazia.

## Regras que o desenho não pode quebrar
- **Freemium é binário no acesso, não no respeito**: pausado não é um castigo. Nada de vermelho de erro, de
  cadeado grande, de escurecer o conteúdo do vendedor. Os dados são dele; nada foi apagado.
- **Não afirmar causa.** Nenhuma palavra que diga por que pausou (expirou, venceu, falhou, inadimplente).
- **Dizer as duas metades**: o que continua funcionando e o que exige reativar. Meia verdade calma ainda é meia.
- **Falha de rede nunca vira "não é premium"**: o estado de erro de leitura tem forma própria.
- A frase honesta **nunca dentro de placeholder** e nunca em elemento que possa cortar — ela mora em bloco de
  largura total.
- Alvo de toque **≥44px** nas duas ações, mesmo em tamanho pequeno; contraste medido contra o fundo real do
  cartão, nos dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo medido nesta linha exata**: com dois botões `nowrap` ao lado do selo, a 390px a linha mediu
  453,5px contra 316px de conteúdo útil, a página foi a 491px (100,5px de transbordo) e o segundo botão nasceu
  **inteiramente fora da viewport** (x=396,3). O paliativo foi deixar as ações quebrarem para uma segunda linha.
  Desenhe a quebra de propósito — não conte com sorte de rótulo curto.
- **O selo é `nowrap`**: qualquer rótulo mais longo empurra a legenda, não quebra.
- Texto ocluso ou transbordado **passa em teste automatizado**: só a imagem no 1:1 mostra. Entregue as
  pranchetas na escala real.
- A carência já foi pega lendo **igual** à assinatura saudável (mesmos pixels, mesmo cinza). O mesmo erro de
  "temperatura visual idêntica" é o que está aqui entre pausado e gratuito.

## Entregável
Pranchetas, tema escuro (padrão) **e** tema claro, ambos tratados como primários:
1. 390px — a linha do plano pausada, em repouso.
2. 390px — as três linhas empilhadas para comparação: Gratuito · Premium · Premium pausado.
3. 390px — variantes: dado velho (offline), "Recarregar" carregando, foco/hover/pressionado, falha de leitura.
4. 1280px — a coluna do plano pausada com a oferta inline aberta abaixo ("Assinar o Premium" + os dois planos).

Reaproveite os primitivos existentes, sem criar novos: o **cartão** da Conta como recipiente, o **selo** de
status (se ele precisar de outro tom, use um dos tons semânticos que já existem — neutro, informativo, sucesso,
perigo — não um quinto), os **botões** nas variantes já disponíveis (preenchido, secundário, fantasma) com o
estado de carregando que o botão já tem, o **ícone** e o **indicador de carregamento** do DS, e a **faixa de
aviso** já existente se a proposta for promover a tranquilização a bloco próprio. Marque com clareza o que é
proposta sua e o que é o estado atual.

## Perguntas em aberto para o dono
1. O selo do pausado deve **ganhar tom próprio** ou permanecer neutro? Deixá-lo neutro é o defeito relatado;
   torná-lo de perigo pode ler como punição a quem só quer voltar; informativo pode ler como aviso passageiro.
   A escolha é de produto, não de desenho.
2. A tranquilização deve **sair da legenda** e virar um bloco próprio (faixa/aviso) com as duas metades — o que
   continua e o que trava —, no mesmo formato longo que Catálogo/Kits/Orçamentos já usam?
3. "Assinar novamente" deve ser a **ação primária preenchida** desta linha (como a carência já fez com
   "Atualizar forma de pagamento"), ou continuar do mesmo peso que "Recarregar"?
4. No desktop, a oferta inline já abre **automaticamente** para quem está pausado. Isso é desejado para um
   ex-pagante, ou a oferta deve ficar fechada até ele pedir?
5. O painel pode mostrar **quando** o Premium pausou ou por quanto tempo a leitura continua? Hoje o servidor não
   manda nem data nem causa — responder "sim" a esta pergunta é uma mudança de contrato, não de layout.
