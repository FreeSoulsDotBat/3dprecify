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

- **Onde vive:** O mesmo cartão "Plano" da Conta, na variante SEM ação de plano: rótulo "Plano" → linha [selo verde "Premium"] + [legenda "cortesia · expira em {data}" ou "via programa beta · expira em {data}"]. À direita da linha sobra um único botão: o "Recarregar" fantasma.
- **Como o vendedor chega:** Um testador beta, um convidado ou alguém que recebeu acesso do operador abre a aba Conta para conferir o que tem e até quando.
- **Vizinhança imediata:** Acima: o cartão de identidade. Abaixo: no desktop, nada mais na coluna 1 — a oferta inline NÃO é montada para quem está com Premium ativo; no mobile, o cartão "Tema". Dentro da linha, o espaço à direita, que nos outros estados carrega uma ou duas ações, fica ocupado só pelo "Recarregar", que é o botão mais fraco do repertório.
- **Dados que chegam (e o que ela devolve):** Ledger `active` com `source` = `beta`/`comp` e um `expiresAt`, e NENHUMA assinatura no espelho do PSP (ou uma que não fala pelo plano). A data de EXPIRAÇÃO ocupa a mesma posição e o mesmo tom da data de RENOVAÇÃO de um assinante — significando o oposto. O nome de quem concedeu o acesso nunca é exibido.
- **O que acontece depois:** Nada é acionável nesta linha: não existe caminho de conversão oferecido aqui. Enquanto o grant vale, o app se comporta como Premium completo (salvar, exportar, simular). Quando a data passa, o mesmo cartão vira "Premium pausado" — e só então aparece um "Assinar novamente".

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada)` · `Retorno do checkout — "Premium ativo!" (confirmação de compra)` · `Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada)` · `Botão "Assinar Premium" — estados pendente, conflito e indisponível` · `Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo)` · `Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova")` · `Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada)` · `Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline)` · `Diálogo de cancelamento da assinatura` · `Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.")` · `Oferta de planos em GAVETA (mobile / < 1280px)` · `Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app")` · `Oferta aberta por quem JÁ é Premium ("Você já é Premium.")` · `Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha)` · `Aba Conta no MOBILE (coluna única, < 1280px)` · `Teaser Premium dentro da folha de Simulações` · `Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível)` · `Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar"`

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

# A linha do plano quando o Premium é CORTESIA (grant de operador / programa beta)

## O que desenhar
O estado **cortesia** da linha "Plano", no cartão do topo da tela **Conta** — a mesma linha que para um
assinante diz "Premium · Plano mensal · renova em 01/09/2026". Aqui não há assinatura nenhuma: o Premium
veio de um **grant concedido por um operador** (beta tester, cortesia comercial, parceiro), tem uma **data
de vencimento** e, quando ela chegar, a conta cai para "Premium pausado" — leitura apenas. Quem vê isso é
o vendedor beta, no momento em que abre a Conta para entender "o que eu tenho e até quando". A linha vive
entre o cartão de identidade (avatar + e-mail) e o cartão de Tema; no desktop ela é a primeira peça da
coluna mais larga da grade de três colunas.

## Por que este prompt existe
Este estado nunca foi desenhado. O protótipo de 2026-07-02 trata Premium como um booleano de demonstração
guardado no `localStorage` e escreve a legenda como `isPremium ? "renova em 01/09/2026" : …` — só o caso
assinatura; as palavras "cortesia", "beta" e "expira" **não aparecem em lugar nenhum do artboard**. A
própria revisão do protótipo manda anotar que "o status Premium vem do servidor — o localStorage do
protótipo é apenas simulação", ou seja: a autoridade de desenho declara que a **procedência** do Premium
está fora do que ela desenhou. A distinção de fonte do grant existe como requisito (FR-304 da 007) e como
redação (`ux-billing.md`), e requisito não é desenho. Resultado: a interface de hoje foi montada por
inferência.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/billing/plan-panel.tsx`, `plan-view.ts`, `pages/conta/conta-page.tsx`.

| Elemento | Conteúdo real hoje | Observação |
|---|---|---|
| Rótulo da linha | "Plano" | caption, cinza, acima de tudo |
| Selo | "Premium", tom `success` (verde) | → **idêntico, pixel a pixel, ao selo de quem paga** |
| Legenda (mesma linha do selo) | "cortesia · expira em 30/09/2026" ou "via programa beta · expira em 30/09/2026" | `--fs-caption`, `--text-muted` |
| Segunda linha (nota) | *nenhuma* | os outros estados têm; este não |
| Ações | *nenhuma* — só o botão fantasma "Recarregar" que a página desenha ao lado | → **zero caminho para assinar** |
| Offline | a legenda vira "cortesia · expira em 30/09/2026 · última informação do servidor" | três segmentos numa linha só |

→ **Problema 1 — a data mente pela posição.** No estado assinante a mesma posição, o mesmo tamanho e o
mesmo cinza carregam "renova em 01/09/2026": uma promessa de continuidade. Aqui a mesma vaga visual diz
"expira em 30/09/2026": o oposto exato. Nada na forma distingue as duas.

→ **Problema 2 — o selo é o mesmo do assinante.** Verde "Premium", sem qualquer marca de que este acesso
é temporário e emprestado.

→ **Problema 3 — não há conversão.** Um beta tester vai perder o Premium numa data conhecida e a tela não
lhe oferece nenhum caminho para assinar antes disso. Os estados "Gratuito", "Premium pausado" e
"assinatura cancelada" todos ganham botão ("Assinar Premium" / "Assinar novamente"); o desktop chega a
abrir a oferta inline abaixo da linha. Cortesia é o único Premium não-assinante e é o único sem oferta.

→ **Problema 4 — legenda acumulativa.** Offline, a legenda encosta três frases numa linha ao lado de um
selo, à direita do qual ainda ficam os botões.

## Conteúdo e dados reais
- **Selo**: "Premium" (literal, do dicionário). Alternativa a decidir com o dono — ver perguntas.
- **Fonte do grant**: dois rótulos existem, e só dois — `beta` → "via programa beta", `comp` → "cortesia".
  Qualquer outro valor do servidor cai silenciosamente em "cortesia". **O nome de quem concedeu nunca é
  mostrado** (FR-304).
- **Prefixo da data**: "expira em" (literal). Formato pt-BR curto: `30/09/2026`. A data é **opcional** —
  quando o grant não traz vencimento, a legenda é só "cortesia", sem data.
- **Selo de offline**: "última informação do servidor".
- **Preços, caso a peça ganhe uma oferta**: "R$ 15,99/mês", "R$ 155,88/ano", "equivalente a R$ 12,99/mês",
  "~19% de economia frente ao mensal", botão "Assinar Premium". O espaço entre `R$` e o número é
  inquebrável — nunca desenhe uma linha de preço que possa quebrar entre símbolo e valor.
- **O que vem depois do vencimento** (já existe como outro estado, e é a verdade a ser sugerida aqui):
  "Premium pausado" + "Seus itens salvos continuam disponíveis para leitura."

## Estados obrigatórios
1. **Repouso — cortesia com data**: selo + "cortesia · expira em 30/09/2026".
2. **Repouso — programa beta**: idem, com "via programa beta".
3. **Sem data de vencimento**: legenda só com a fonte ("cortesia"), sem prefixo órfão.
4. **Vencimento próximo** (não existe no código; desenhe a proposta): a mesma linha quando faltam poucos
   dias. Hoje o dia 29 e o dia 1 são visualmente idênticos.
5. **Offline / dado guardado**: legenda + "última informação do servidor" — a procedência dita, nunca
   escondida.
6. **Carregando**: o botão "Recarregar" em estado de espera; o selo NÃO pode piscar para "Gratuito".
7. **Foco de teclado** em cada controle interativo da linha (anel visível sobre o fundo real do cartão).
8. **Hover e pressionado** dos botões.
9. **Vizinhos, para comparação lado a lado na mesma prancheta** — é o ponto do desenho: assinante ativo
   ("Premium · Plano mensal · renova em 01/09/2026", ações "Gerenciar assinatura" + "Cancelar assinatura")
   e "Premium pausado" ("Seus itens salvos continuam disponíveis para leitura.", ação "Assinar novamente").

## Viewports
- **Mobile 390px** — é onde a linha quebra: selo + legenda longa + botões no mesmo cartão.
- **Mobile 360px** — o pior caso já medido nesta tela; use a legenda mais longa possível
  ("via programa beta · expira em 30/09/2026 · última informação do servidor").
- **Desktop 1280px** — o corte da grade de três colunas; a linha do plano abre a coluna mais larga, e é
  ali que uma oferta inline apareceria, se o dono decidir que ela existe.

## Regras que o desenho não pode quebrar
- **A data é fato do servidor, não decoração.** Ela pode e deve aparecer; o que não pode é aparecer com a
  mesma roupa de uma data de renovação, porque significa o contrário.
- **Nunca degradar o selo enquanto o Premium está ATIVO.** Durante a cortesia o vendedor tem tudo — pintar
  o selo de alerta seria a mentira na direção oposta (foi essa a decisão tomada para a carência: o selo
  segue verde, quem carrega a cautela é o texto).
- **Freemium binário**: não existe meio-premium. A cortesia é Premium inteiro até a data.
- **Falha de rede nunca vendida como "não é premium"**: se o servidor não respondeu, o texto é "Não foi
  possível confirmar seu plano.", jamais "Gratuito".
- **Procedência dita**: quando o dado é o último conhecido, a tela diz que é o último conhecido.
- **Frase honesta em elemento de largura inteira**, nunca espremida ao lado de um selo se isso a corta.
- **Alvo ≥44px** em todo botão da linha; **contraste medido contra o fundo real do cartão**, nos dois temas.
- **Sem padrão escuro na conversão**: se houver oferta, ela não pode usar medo, contagem regressiva
  agressiva nem culpa. O prazo é dito, não brandido.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido nesta linha exata**: a 390px o conteúdo mediu 453,5px contra 316px de
  cartão, a página foi a 491px de `scrollWidth` (100,5px de transbordo) e um botão **nasceu inteiramente
  fora da viewport** (x = 396,3). As ações são UM item flex — um item mais largo que o container não
  quebra sozinho. Desenhe explicitamente como o bloco de ações quebra.
- **Texto ocluso passa em teste**: uma asserção de texto não vê um elemento coberto ou fora da caixa.
  Layout aqui se prova com caixas, não com strings.
- **Frase honesta cortada dentro de um campo**: honestidade mora em elemento de largura inteira.
- **Quebra de linha entre `R$` e o número**: só a imagem denuncia; nenhuma medição vê.
- **Rótulo com causa falsa**: "expirado" foi banido desta tela porque afirmava uma causa que o servidor
  não manda; "pausado" ficou. Não reintroduza vocabulário que afirme causa.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. **Cortesia · 390px** — os estados 1 a 5 empilhados, cada um rotulado.
2. **Comparação · 390px** — cortesia ao lado de assinante ativo e de Premium pausado, para que a diferença
   entre "renova" e "expira" seja visível na forma e não só na palavra.
3. **Cortesia · 1280px** — a linha na coluna do plano, com e sem oferta inline abaixo (as duas hipóteses).
4. **Detalhes** — foco, hover, pressionado e carregando dos controles da linha.

Reutilize os primitivos existentes, sem criar novos: `tf-card` para a linha, `tf-badge` (tom `success`)
para o selo, o estilo de legenda em `--fs-caption` / `--text-muted` para fonte + data, `tf-button` nos
tamanhos `sm` para "Recarregar" (fantasma) e para qualquer ação nova, `tf-alert` **apenas** se o dono
decidir que o vencimento próximo merece um aviso — e, se a oferta inline entrar, o mesmo bloco de planos
já usado em "Assinar o Premium". Se você precisar de um elemento novo para separar "expira" de "renova",
proponha-o como **variação de um primitivo existente**, e diga qual.

## Perguntas em aberto para o dono
1. **O selo da cortesia deve ser o mesmo "Premium" verde do assinante?** Ou uma variação que diga, no
   próprio selo, que este acesso é temporário — sem sugerir que ele vale menos?
2. **A linha de cortesia deve oferecer assinar?** Se sim: sempre, ou só a partir de N dias do vencimento —
   e qual N? E no desktop ela abre a oferta inline, como fazem "Gratuito" e "pausado"?
3. **Existe um estado "vencimento próximo"?** A partir de quantos dias, e ele muda tom, ganha nota ou só
   ganha o botão?
4. **Deve haver uma segunda linha dizendo o que acontece no dia seguinte** ("Depois disso, seus itens
   continuam disponíveis para leitura")? Hoje essa frase só aparece DEPOIS de o Premium pausar.
5. **Quando a fonte do grant não é `beta` nem `comp`**, o texto cai em "cortesia". Serve, ou deve existir
   um rótulo neutro para fontes que ainda não têm nome?
