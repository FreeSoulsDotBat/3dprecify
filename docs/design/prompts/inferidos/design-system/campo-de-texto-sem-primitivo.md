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

## O mapa funcional de Primitivos do Design System

### O que é esta área

Não é uma aba nem uma tela. É o **vocabulário visual** que as cinco abas do Precifica3D — Calcular · Catálogo · Kits · Orçamentos · Conta — falam. Vive em `apps/web/src/shared/ui/` e é exportado por um único barril (`index.ts`, o ÚNICO barril permitido no app, ADR-0007/A38): 20 primitivos + 2 lojas de estado (tema e menu recolhido). Nenhum deles tem rota. O vendedor nunca "vai ao design system" — ele encosta nele a cada toque.

### Como o vendedor chega

Por toda parte. Um caminho típico de primeira sessão: abre `/calcular` (grátis, sem login), digita gramas num **NumberField** dentro de um **Field**, lê a explicação de como a conta é feita num **InfoTip ⓘ**, escolhe o canal num **Select** nativo, vê o resultado num **PriceHero** e a conta aberta numa pilha de **BreakdownRow**, tudo dentro de **Cards**. Ao tentar SALVAR qualquer coisa, encontra o teaser Premium; assinando, ganha `/catalogo`, `/kits`, `/historico` — e ali o mesmo vocabulário reaparece em outra combinação: **EmptyState** na primeira visita, **Sheet** vindo da direita para cadastrar, **Dialog** central para confirmar exclusão, **Toast** confirmando, **Spinner** enquanto a rede responde, **Badge** dizendo o estado, **Alert** dando a notícia ruim.

### Rotas onde os primitivos aparecem

`/` · `/calcular` · `/catalogo` (+ `/catalogo/produtos/novo` e `/catalogo/produtos/$productId`) · `/kits` · `/historico` (+ `/historico/$snapshotId`) · `/conta` · `/sign-in` · `/privacidade`. O casco (`app/app-shell.tsx`) monta banner offline, banner de sessão expirada, TopBar, AppNav (TabBar no celular / barra lateral no desktop) e o **Toaster** (uma vez, em `app/providers.tsx`).

### O que a área guarda

Quase nada — e é de propósito. Três estados vivem aqui: a fila do **Toast** (zustand, em memória, some no refresh), o **tema** (`theme-store`, localStorage) e a **preferência de menu recolhido** (`nav-rail-store`, por aparelho, só vale ≥1280px). Nenhum primitivo fala com servidor, cache uid-keyed, outbox ou entitlement: quem sabe de plano, rede e dinheiro são as *features*, que passam texto e estado já resolvidos para dentro da peça.

### De que depende

Dos **tokens de design** (`src/styles/tokens/*` — cor, espaço, raio, sombra, anel de foco, `--touch-min: 44px`, `--tabbar-h`, `--sidebar-w`), do **Radix** para os três primitivos com acessibilidade não trivial (Dialog/Sheet, Popover do InfoTip, Switch), e do dicionário pt-BR (`shared/i18n/messages.pt-br`) só para os rótulos genéricos ("Fechar", "Notificações"). Formatação de dinheiro vem de `shared/lib/decimal-ptbr` (`formatDecimal`/`parseDecimal`) — o **pricing-core** calcula, o DS só mostra.

### O que ele alimenta

Tudo. O `NumberField` reescreve o próprio valor ao perder o foco (máscara de milhar pt-BR) e devolve isso ao formulário; o `Field` decide se a mensagem embaixo do campo é dica, **aviso de plausibilidade** (azul, não recusa) ou **erro** (vermelho, recusa); o `PriceHero` é o número que vira orçamento congelado; o `Card` clicável da lista mestre é o que seleciona a ficha à direita no desktop.

### Como muda por estado

- **Grátis** — o DS não sabe que é grátis. As features trocam o conteúdo: `EmptyState` vira teaser, `Switch` de canais fica **desabilitado e falso**, botões de salvar somem.
- **Premium** — as mesmas peças com dados reais; `Badge` verde no plano, `Sheet` de cadastro liberada.
- **Premium pausado (lapsed)** — listas ficam em leitura: `Alert` de aviso no topo, cartões ganham uma linha "somente leitura", ações destrutivas desaparecem.
- **Offline** — calcular funciona inteiro (o motor é local); escrever entra na fila e o `Badge` do item diz "na fila"; o `Toast` confirma o enfileiramento, não o salvamento.
- **Sessão expirada** — banner fixo no topo do casco com "Entrar de novo"; a fila NUNCA é purgada; `Dialog` central bloqueia a saída se houver pendências.
- **Largura** — abaixo de 1280px é celular (`useIsWide()` retorna false sem `matchMedia`); acima, o Catálogo vira mestre-detalhe e o tema vira controle segmentado. Os primitivos em si **não têm ponto de corte nenhum**: só o Toaster (768px) e o Switch (`prefers-reduced-motion`) declaram `@media` em toda a pasta.

## O ponto exato de inserção desta peça

- **Onde vive:** Em lugar nenhum de `shared/ui` — é a peça ausente. Não existe `Input` nem `Textarea` entre os 20 exports de `index.ts`; existe só a MOLDURA em CSS (`.tf-inputwrap` + `.tf-input`, em `field.css`). Cada tela remonta a mão, em **pelo menos 12 arquivos**: busca do Catálogo (`catalog-panel.tsx:265`, um `<label class="tf-inputwrap">` com lupa à esquerda e `<span class="sr-only">` como rótulo, dentro da barra de ferramentas do mestre-detalhe), nome de filamento/impressora (`catalog-controls.tsx:43`), rótulo do orçamento (`record-snapshot-sheet.tsx`), renomear rótulo (`snapshot-manage.tsx:87`), nome da simulação (`save-scenario-sheet.tsx`, `scenarios-list-sheet.tsx:391`, `scenario-context-bar.tsx:236`), datas do período personalizado (`historico-page.tsx:492`), nome do kit (`bom-page.tsx`), nome do produto (`produto-page.tsx`) e o falso seletor de categoria (`category-picker.tsx`, que usa a mesma moldura para fingir um campo que não é campo).
- **Como o vendedor chega:** Sempre que o vendedor precisa DIGITAR texto livre — o nome do filamento, o nome do orçamento, o nome do cliente, o termo de busca. É a única superfície do produto onde ele escreve palavras em vez de números.
- **Vizinhança imediata:** Dentro de um `Field`: rótulo em cima (com reserva de duas linhas), moldura de 48px de altura, borda 1.5px, `radius-field`, e embaixo a dica ou o erro em `--fs-caption`. Variações reais: a busca do Catálogo tem lupa de 18px à esquerda e vive na `tf-catalog-md__toolbar`, entre o campo e a contagem de itens à direita seguida do botão "Novo …"; os campos da ficha à direita vêm empilhados em grade de 2 colunas; o "Nome do kit" fica no topo do compositor, acima da lista de peças.
- **Dados que chegam (e o que ela devolve):** O valor controlado pelo formulário (React Hook Form + Zod na maioria; `useState` na busca), o `placeholder` e — quando o chamador lembra — a classe de erro `tf-inputwrap--error`, concatenada À MÃO num array de classes. Quem esquecer a concatenação, o campo simplesmente não pinta de vermelho: é o comportamento decidido por esquecimento, não por regra.
- **O que acontece depois:** O texto digitado vira nome no catálogo, rótulo do orçamento congelado, nome da simulação salva — dado do vendedor que ele vai reler meses depois. Na busca, cada tecla refiltra a lista mestre em tempo real e, se nada casar, a lista dá lugar ao `EmptyState` de busca vazia com o botão "limpar busca".

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Campo de texto — a moldura que 21 telas remontam à mão

## O que desenhar

O campo onde o vendedor **digita texto** no Precifica3D: o nome do filamento ("Ex.: PLA Azul"), o nome da impressora ("Ex.: Ender 3"), o rótulo do orçamento ("Cliente, pedido…"), o nome e a nota da simulação salva, e as três buscas do app (Catálogo, Orçamentos, Simulações). É a peça mais repetida do produto e a única do sistema de campos que nunca foi desenhada como peça: existe o campo numérico (`NumberField`, com R$ e unidade), existe o seletor (`Select`), existe a moldura de rótulo/dica/erro (`Field`) — não existe `Input` nem `Textarea`. Desenhe a peça inteira: campo de uma linha, campo de várias linhas, campo de busca, e todos os estados que hoje só existem por acidente.

## Por que este prompt existe

O canvas do dono (2026-07-02 e o 1920 do 018) desenhou o campo **parado e preenchido** em cinco lugares — a busca do Catálogo com lupa e "Buscar no catálogo…", os campos da ficha com prefixo/sufixo, a quantidade da peça do kit com o afixo "un", "Nome do kit" e a busca dos Orçamentos com "Cliente, pedido…". O que nunca foi desenhado: **erro, foco, desabilitado, com ação de limpar, multilinha, e a busca como peça própria**. O readme do import nomeia `Input`/`Textarea`, mas nenhum código deles chegou em `.design-import/components/` — não havia o que copiar, e cada tela remontou a moldura à mão (`<div class="tf-inputwrap"><input class="tf-input">`) em **21 lugares**. A consequência dura: o estado de erro é montado por concatenação manual de classe em **um** desses lugares (`catalog-controls.tsx:43`); nos outros 20, um campo inválido **não fica vermelho**. O erro aparece por sorte, não por decisão.

## O que já existe hoje (não invente do zero — corrija)

A moldura (`shared/ui/field.css`) é real e boa; herde-a em vez de reinventar:

| Parte | Como está hoje |
|---|---|
| Altura da moldura | 48px padrão (`--control-h`), 36px `sm`, 56px `lg` — o alvo de 44px já está garantido no padrão |
| Borda | 1.5px `--border-default`; hover → `--border-strong`; foco → borda + anel na cor `--focus-ring` lidos como **um traço só** |
| Erro | borda `--danger`; com foco, **continua vermelha** e o halo vira vermelho (regra já paga: o roxo do foco apagava o erro) |
| Desabilitado | fundo `--bg-muted`, opacidade 0.6, cursor `not-allowed` |
| Rótulo | `--fs-sm` semibold, reserva **duas linhas** para alinhar campos lado a lado; variante "tight" reserva uma |
| Obrigatório / opcional | asterisco na cor `--energy` à direita do rótulo; a tag "opcional" em texto fraco, empurrada para a direita |
| Dica e erro | dica em `--text-muted`; erro em `--danger-text`, e o erro **substitui** a dica |
| Aviso de plausibilidade | linha extra dentro da dica, tom `info` (`--info-text`) — deliberadamente **não** vermelha: o número não foi recusado |

O que está montado à mão e precisa virar decisão de desenho — marcado com →:

- → **A busca tem quatro formas diferentes.** Catálogo (desktop): moldura com lupa à esquerda, placeholder "Buscar no catálogo…" e o rótulo "Buscar no catálogo" escondido para leitor de tela. Orçamentos: rótulo **visível** "Buscar por rótulo" + placeholder "Cliente, pedido…", **sem lupa**. Simulações: **sem rótulo nenhum**, só placeholder "Buscar por nome…". E o seletor de categoria usa a mesma moldura para algo que não é campo. Uma peça, uma anatomia.
- → **Não há botão de limpar dentro do campo.** Limpar a busca só é possível pelo botão "Limpar busca" que aparece no estado vazio — ou seja, quem buscou e achou **três** resultados não tem como voltar a ver tudo sem apagar o texto letra por letra.
- → **A nota da simulação é um `<textarea rows=3>` dentro de uma moldura de altura fixa de 48px.** Três linhas pedidas, uma linha de altura entregue. O campo multilinha não existe como peça.
- → **Não há contador de caracteres**, embora os limites sejam reais: 120 no nome do orçamento e no nome da simulação, 500 na nota. O vendedor só descobre o limite quando o erro "Máximo de 120 caracteres." aparece — depois de já ter digitado demais.
- → **O rótulo da nota carrega o "(opcional)" dentro do texto** ("Nota (opcional)") enquanto a moldura já tem uma tag "opcional" própria — duas gramáticas para a mesma informação.

## Conteúdo e dados reais

Use estes textos **literais**, já homologados, nas pranchetas:

- Catálogo — filamento: rótulo "Nome" (obrigatório), placeholder "Ex.: PLA Azul"; rótulo "Material", placeholder "Ex.: PLA".
- Catálogo — impressora: rótulo "Nome" (obrigatório), placeholder "Ex.: Ender 3".
- Orçamentos — salvar: rótulo "Rótulo (opcional)", dica "Cliente, pedido…", máx. 120 caracteres. Ao lado dele vive um campo numérico "Validade da proposta" com afixo "dias" (1 a 3650) — desenhe os dois juntos uma vez, para provar o alinhamento de rótulo de duas linhas.
- Orçamentos — busca: rótulo "Buscar por rótulo", placeholder "Cliente, pedido…".
- Simulações — salvar: rótulo "Nome" (obrigatório), erro "Dê um nome à simulação." e "Máximo de 120 caracteres."; rótulo "Nota (opcional)", erro "Máximo de 500 caracteres."
- Catálogo — busca (desktop): placeholder "Buscar no catálogo…", rótulo acessível "Buscar no catálogo"; vazio de busca: título "Nada encontrado para essa busca", corpo "Tente outro termo, ou limpe a busca para ver tudo de novo.", ação "Limpar busca".
- Seletor de categoria (mesma moldura, comportamento de busca): rótulo "Categoria do anúncio (opcional)", dica "A comissão muda conforme a categoria.", placeholder "Busque pelo produto…", e a contagem **visível** "8 categorias encontradas" / "Mostrando 8 de 23 — refine a busca para ver as demais."
- Exemplo de vizinhança monetária, para provar contraste e alinhamento na mesma ficha: "Custo do rolo" com R$ 1.234,56 e o preço sugerido R$ 24,24.

## Estados obrigatórios

1. **Repouso vazio** — placeholder em `--text-faint`, e o placeholder carrega **só exemplo**, nunca uma frase honesta.
2. **Repouso preenchido** — "PLA Azul" em `--text-strong`.
3. **Hover** — borda `--border-strong`; a moldura inteira é área de clique (cursor de texto).
4. **Foco** — borda + anel na mesma cor, lidos como um traço único.
5. **Erro** — borda vermelha e a mensagem substituindo a dica: "Dê um nome à simulação."
6. **Erro com foco** — vermelho **mantido**, halo vermelho. É um estado próprio, não um acidente.
7. **Desabilitado** — fundo `--bg-muted`, 0.6 de opacidade. Acontece de verdade: a ficha do catálogo inteira vira somente-leitura via `fieldset disabled`, então desenhe **um formulário inteiro desabilitado**, não um campo solto.
8. **Perto do limite / no limite** — o que aparece aos 110/120 e aos 120/120 (hoje: nada até estourar).
9. **Multilinha em repouso e crescido** — a nota com 3 linhas e a nota com 500 caracteres.
10. **Busca vazia**, **busca com termo** (com a ação de limpar visível) e **busca sem resultado** — este último devolvendo "Nada encontrado para essa busca" + "Limpar busca", nunca "nenhum item salvo": existem itens, o filtro é que não achou.
11. **Aviso de plausibilidade** — linha extra em tom `info` sob o campo, junto com o valor **aceito**. Aviso nunca vira validação.

Não desenhe estados de carregamento, offline, premium pausado ou sem permissão **para esta peça**: quem carrega, degrada ou bloqueia no app é a lista, o cartão ou o painel ao redor — o campo de texto não tem esses estados hoje, e inventá-los criaria uma segunda gramática para eles.

## Viewports

- **390px (obrigatório)** — é onde o vendedor usa o produto. Prove: campo com rótulo de duas linhas, campo com erro, busca com ação de limpar, e a nota multilinha dentro de uma folha (sheet).
- **1280px (obrigatório)** — o corte do 018: a busca vive na barra de ferramentas da lista mestre, ao lado da contagem e do botão de adicionar, dividindo a largura com a ficha à direita.
- **1920px** — a mesma ficha em duas colunas, para provar que dois campos lado a lado ficam com as molduras alinhadas quando um rótulo quebra em duas linhas e o outro não.

## Regras que o desenho não pode quebrar

- **Frase honesta nunca mora em placeholder** — placeholder some quando o vendedor digita, e some para quem usa leitor de tela. Exemplo, sim; explicação, na dica.
- **Todo campo de busca tem rótulo** — visível ou acessível, mas existente e sempre com a mesma palavra da tela.
- **O erro é um estado da peça, não uma decoração opcional**: se o campo é inválido, ele fica vermelho — sem depender de quem montou a tela lembrar de pintá-lo.
- **Alvo de toque ≥44px** em qualquer botão dentro do campo (limpar, mostrar/ocultar), sem estourar a moldura de 48px.
- **Contraste medido contra o fundo real da moldura** (`--surface-card`), não contra o fundo da página — inclusive o placeholder e o texto desabilitado a 60% de opacidade.
- **Tema claro é de primeira classe**: o vermelho do erro é o mesmo vermelho medido nos dois temas.

## Armadilhas já pagas neste projeto

- **Um campo invisível passa em teste.** A busca das Simulações já foi entregue com 1×1px: escondeu-se o controle inteiro querendo esconder só o rótulo. Desenhe explicitamente a diferença entre "rótulo oculto" e "campo oculto".
- **Overflow horizontal medido, não presumido.** A moldura carrega um piso de 8rem e o texto interno pode encolher a zero — foi assim que uma grade de duas colunas com prefixo R$ e sufixo "/kWh" estourou o viewport de 360px. Um nome de produto de 120 caracteres **sem espaços** tem que quebrar dentro do campo, não empurrar a folha.
- **O rótulo não pode engolir o botão vizinho.** A dica em forma de ícone fica **ao lado** do rótulo, nunca dentro dele — dentro, o nome acessível vira "Vida útil da máquina Sobre a vida útil da máquina".
- **Uma contagem que mente é pior que nenhuma.** "8 categorias encontradas" com 23 existindo fez o vendedor parar de refinar. Se a lista corta, o texto diz que cortou.
- **Um campo que deixa de parecer campo quando é preenchido é um defeito** — já aconteceu com a categoria escolhida, que virou texto solto entre dois rótulos.

## Entregável

Pranchetas em **tema escuro (padrão) e tema claro**, ambas com o mesmo conteúdo:

1. **Anatomia** — rótulo, asterisco de obrigatório, tag "opcional", moldura, texto, afixo, dica e erro, com as medidas (48/36/56px, borda 1.5px, raio do campo).
2. **Grade de estados** — os 11 estados acima, um ao lado do outro, em 390px.
3. **Campo de busca como peça** — as três ocorrências reais reduzidas a **uma** anatomia: lupa, texto, ação de limpar, contagem; nos estados vazio / com termo / sem resultado.
4. **Multilinha** — a nota da simulação em repouso, crescida e no limite de 500.
5. **Em contexto** — a ficha do filamento a 390px e a barra de ferramentas da lista mestre a 1280px.

Reutilize os primitivos existentes: a moldura de rótulo/dica/erro é `Field` (com `required`, `optional`, `tightLabel`, `labelAddon`), a lupa e o "x" são `Icon`, a ação de limpar é `Button` `ghost`/`sm`, o vazio de busca é `EmptyState` com `Button` `secondary`, o afixo de unidade segue o mesmo desenho de `NumberField`, e a dica em ícone é `InfoTip`. **Não crie um novo tom, um novo raio ou um novo tamanho de controle** — o que falta é a peça, não a linguagem.

## Perguntas em aberto para o dono

1. **Contador de caracteres**: aparece sempre ("12/120"), só ao chegar perto do limite, ou nunca — e nos três campos com limite (rótulo do orçamento, nome e nota da simulação) ou só na nota?
2. **Ação de limpar dentro do campo de busca**: entra como "x" permanente enquanto há texto, ou o "Limpar busca" continua existindo só no estado sem resultado?
3. **Rótulo da busca**: qual é a forma canônica — rótulo visível (como em Orçamentos hoje) ou lupa + placeholder com rótulo só para leitor de tela (como no Catálogo)? As duas estão em produção e são visualmente diferentes.
4. **A nota da simulação cresce sozinha** conforme se digita, ou tem altura fixa de três linhas com rolagem interna?
5. **"Nota (opcional)" no texto do rótulo vs. a tag "opcional" da moldura** — qual das duas fica, para valer em todo o app?
