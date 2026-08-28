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

- **Onde vive:** `shared/ui/button.tsx` — três estados que se sobrepõem ao visual normal: `loading` (insere um `<Spinner size="sm">` ANTES do rótulo, mantém o texto, bloqueia o clique, marca `aria-busy` e troca o cursor para `progress`), `disabled` (opacidade 0,55 e nada mais) e `glow` (halo roxo, `--glow-purple`, com a regra "um CTA focal por zona" registrada só em prosa). O `loading` aparece em **12+ arquivos**: salvar filamento/impressora, excluir orçamento, sair com fila, salvar/renomear simulação, recalcular hoje, exportar, assinar (`billing-cta`), sincronizar.
- **Como o vendedor chega:** Pelo toque na ação que realmente espera a rede. O vendedor aperta "Salvar", o spinner entra no fluxo e o botão **muda de largura enquanto ele olha**. O `disabled` chega por outro caminho: ele encontra o botão já apagado — formulário incompleto, plano sem direito, fila vazia — e não há nada dizendo por quê.
- **Vizinhança imediata:** Nos três lugares em que ação e espera se encontram: o rodapé de ações da folha lateral ("Cancelar" à esquerda, ação primária à direita), a fileira `flex justify-end gap-2` do diálogo central, e a barra de ferramentas do mestre-detalhe do Catálogo (botão "Novo …" à direita da contagem de itens). No compositor de kits, o botão de salvar fica abaixo da lista de peças e do resumo de preço.
- **Dados que chegam (e o que ela devolve):** Um booleano `isPending` da mutação do TanStack Query e, no caso do `disabled`, a validade do formulário ou o entitlement resolvido pelo servidor. O botão não sabe distinguir "aguardando servidor" de "aguardando a fila offline" — quem sabe é o chamador, e é ele que decide a frase do toast que virá depois.
- **O que acontece depois:** Ou a mutação volta e o botão devolve o rótulo limpo, a folha/diálogo fecha e um toast confirma; ou a rede falha e um `Alert tone="danger"` aparece dentro da mesma caixa; ou o app está offline e a escrita entra na fila do outbox — caso em que o toast confirma o ENFILEIRAMENTO, não o salvamento. Não existe slot de ícone no primitivo: um ícone passado como filho cai DENTRO do `.tf-btn__label`.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Botão: carregando, desabilitado e com brilho

## O que desenhar

O primitivo de ação do produto (`tf-btn`) nos três estados que nunca foram desenhados: **ocupado** (esperando a rede), **bloqueado** (o vendedor não pode agir agora) e **focal** (o halo roxo do CTA principal). Não é uma tela: é a matriz de estados de uma peça que aparece em toda a jornada — o "Entrar com Google" da primeira abertura, o "Salvar" do catálogo, o "Gerar PDF" da exportação, o "Assinar Premium" dos teasers, o "Sincronizar agora" da fila offline. Hoje há **25 botões em carregamento** no app e **mais de 20 botões desabilitados**, e o desenho de nenhum deles existe. Quem usa é o vendedor de peças 3D, quase sempre no celular, em geral com a conexão ruim que é exatamente a condição que faz esses estados aparecerem.

## Por que este prompt existe

A auditoria classifica esta peça como `PROTOTIPO_PARCIAL`: o protótipo de 2026-07-02 desenhou **um** botão em carregamento — o de login. Ali o giro **substituía** o ícone do Google no mesmo lugar (`{loading ? <Spinner/> : GoogleG}`), o rótulo trocava para "Entrando…", e o botão ficava desabilitado. Largura estável, causa dita. **O app implementado diverge desse único desenho**: o giro é **inserido antes** de um rótulo que não muda, então o botão **cresce enquanto o vendedor olha**. E continuam sem qualquer desenho: o **desabilitado** (o canvas põe `disabled` em dois botões mas nenhuma folha de estilo pinta o resultado), o **brilho** fora do CTA hero, e o **slot de ícone** (`iconLeft`/`full` aparecem em 4 telas do kit e não existem no componente real — um ícone passado como filho cai dentro do rótulo). A §D.2 do protótipo não descreve carregando nem desabilitado; o item 8 da auditoria já registrava "loading skeletons" como lacuna do próprio protótipo.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/shared/ui/button.tsx`, `button.css`, `spinner.tsx`, `spinner.css`.

| Eixo | Valores reais hoje | Observação |
|---|---|---|
| Variantes | `primary`, `secondary`, `ghost`, `danger`, `danger-ghost` | `danger-ghost` nasceu de decisão do dono (2026-08-03): num diálogo de perda, quem tem preenchimento é a saída **segura**; a ação irreversível fica vermelha e legível, sem o convite de um botão cheio |
| Tamanhos | `sm` 36px · `md` 48px (padrão) · `lg` 56px | → **conflito real**: a base impõe `min-height: 44px` (alvo de toque), então o `sm` **nunca renderiza 36px**. Existe um tamanho declarado que é impossível |
| Alvo mínimo | 44×44px em altura **e** largura | invariante do projeto (WCAG 2.2 AA) |
| Foco | anel de foco do token `--ring`, sem `outline` | |
| Pressionado | escala 0,97, só quando não está desabilitado | |
| Carregando | giro `sm` (15px) **antes** do rótulo, com `gap`; rótulo intacto; clique bloqueado; cursor `progress` | → **o defeito**: a largura muda ao entrar o giro |
| Desabilitado | **opacidade 0,55 e cursor `not-allowed`. Nada mais.** | → não diz por quê; não muda cor, borda nem peso |
| Brilho (`glow`) | halo roxo `0 10px 30px -8px rgba(120,0,255,.5)` | → **prop morta: zero usos no app inteiro.** A regra "um CTA focal por zona" existe só em prosa no comentário do código |
| Ícone | **não existe slot.** Um ícone vira filho e entra dentro do rótulo | |

O giro é sempre um anel de 2px girando em 0,7s, na cor herdada do botão, com o rótulo `"Carregando…"` **visualmente escondido** só para leitor de tela. Movimento reduzido já neutraliza a animação globalmente.

## Conteúdo e dados reais

Rótulos literais que este botão carrega hoje (não reescreva — são copy homologada):

- `"Entrar com Google"` (lg, primary, no login) · `"Assinar Premium"` (CTA de cobrança) · `"Salvar"` / `"Salvar alterações"` · `"Voltar"` (ghost — o produto **não usa** a palavra "cancelar" em lugar nenhum: uma guarda de copy a proíbe para não colidir com o cancelamento de assinatura) · `"Excluir"` (danger) · `"Exportar"` · `"Gerar PDF"` / `"Baixar CSV"` · `"Tentar novamente"` · `"Sincronizar agora"` · `"Entrar de novo"`.
- Motivos de bloqueio, quando existem, são **parágrafo legível abaixo do botão**, nunca tooltip: `"Exportar precisa de conexão."` · `"Exportar precisa do Premium ativo."` · `"Esta ação precisa de conexão."` · `"Premium pausado — reative para renomear, duplicar, editar ou excluir."`
- O rótulo mais longo em uso real é `"Premium pausado — reative para renomear, duplicar, editar ou excluir."` (motivo, não botão) e `"Salvar alterações"` no botão. Desenhe com esses comprimentos, não com "Salvar".
- Barra real a desenhar como caso de estresse: **4 botões `sm` lado a lado** (`Abrir origem` ghost · `Renomear` ghost · `Duplicar` secondary · `Salvar alterações` primary) numa linha que quebra, com o motivo ocupando a largura toda embaixo.

## Estados obrigatórios

1. **Repouso** — por variante e por tamanho.
2. **Hover** (só ponteiro, só quando habilitado) — `primary` escurece o fundo; `secondary` escurece a borda; `ghost` ganha fundo suave; `danger-ghost` ganha fundo vermelho suave.
3. **Foco por teclado** — anel visível, inclusive **sobre** o botão com brilho (os dois não podem se confundir).
4. **Pressionado** — escala 0,97.
5. **Carregando** — giro + rótulo. **Decida aqui o que o protótipo já decidia: o giro ocupa um lugar reservado, a largura não muda.** O clique está bloqueado e o leitor de tela anuncia ocupado.
6. **Desabilitado com motivo** — o botão apagado **mais** a frase que diz por quê, legível, abaixo (é assim no `Exportar` e na barra de simulações). Mostre as duas frases: a de conexão e a de Premium pausado.
7. **Desabilitado sem motivo** — o que o app faz na maioria dos casos hoje. Desenhe-o para **mostrar que é insuficiente**, e proponha o mínimo (peso, borda, ou obrigatoriedade do motivo).
8. **Offline** — é o caso 6 com `"Esta ação precisa de conexão."`; nunca some o botão sem explicação.
9. **Premium pausado** — é o caso 6 com `"Premium pausado — reative…"`; o bloqueio é de plano, **não** de rede.
10. **Focal com brilho** — o halo roxo, em repouso, hover e foco, e a demonstração de "um por zona": duas ações lado a lado onde **só uma** brilha.
11. **Com ícone** — o slot que hoje não existe: ícone à esquerda do rótulo, e como ele se comporta quando o botão entra em carregando (o giro toma o lugar do ícone, como no login).

## Viewports

- **390px (mobile)** — obrigatório: é onde o produto vive e onde a barra de 4 botões `sm` quebra em duas linhas. Desenhe essa barra a 390px e também a 360px, o pior caso já medido no projeto.
- **1280px (desktop)** — o corte de desktop do produto. O mesmo botão em formulário largo e em barra de ação de painel, onde o crescimento pela entrada do giro é mais visível porque há botões alinhados à direita.
- Não é preciso 1920px: a peça não muda de forma acima de 1280px.

## Regras que o desenho não pode quebrar

- **A largura do botão não muda ao entrar ou sair o carregamento.** Esta é a razão de existir do prompt.
- **O alvo de toque nunca desce de 44×44px**, inclusive no tamanho `sm` — resolva o conflito declarado acima em vez de herdá-lo.
- **Motivo de bloqueio é texto legível, nunca tooltip**: em toque não há hover, e a explicação de um controle desabilitado precisa ser lida.
- **Falha de rede nunca é vendida como falta de Premium** — as duas frases são distintas e o desenho não pode dar a elas o mesmo tratamento visual sem distinção.
- **Frase honesta nunca dentro de campo/placeholder** e nunca cortada: a legenda de motivo mora em elemento de largura total.
- **Nunca oferecer um botão que não pode funcionar** — a regra do produto é ou habilitar, ou desabilitar **com motivo**; não existe terceiro caminho de "some sem avisar".
- **Contraste medido no fundo real**: o rótulo a 55% de opacidade sobre o fundo do cartão, nos dois temas. Se não passar, o desabilitado precisa de outra solução que não seja opacidade.

## Armadilhas já pagas neste projeto

- **Botão nascido fora da viewport**: a homologação visual de cobrança mediu 100,5px de estouro horizontal a 360px, com um botão que nascia fora da tela. Grupos de botões a 360px precisam ser desenhados, não presumidos.
- **Texto que passa no teste e não aparece na tela**: asserções de texto são cegas a oclusão e a estouro. O que decide aqui é a caixa, não a string — desenhe as caixas.
- **Frase cortada por caber em elemento estreito** (016/PR-F): a legenda honesta foi parar num sufixo de placeholder e foi clipada. Motivo vai em bloco de largura total.
- **Rótulo longo estourando a coluna**: `"Salvar alterações"` com giro à esquerda num botão `sm` dentro de uma barra de 4 é o caso que quebra.

## Entregável

Pranchetas, tema **escuro como padrão** e **claro como primeira classe** (as duas versões de cada prancheta):

1. **Matriz de estados** — 5 variantes (`primary`, `secondary`, `ghost`, `danger`, `danger-ghost`) × 6 estados (repouso, hover, foco, pressionado, carregando, desabilitado).
2. **Tamanhos** — `sm` / `md` / `lg` com a régua do alvo de 44px visível sobre cada um.
3. **Carregando, antes e depois** — o botão parado e o mesmo botão ocupado, sobrepostos com a medida de largura, provando que não mexeu.
4. **Bloqueado com motivo** — `Exportar` com as duas frases, e a barra de 4 botões `sm` a 390px e 360px com a legenda ocupando a linha inteira.
5. **Focal com brilho** — duas ações vizinhas, só uma com halo, incluindo o foco por teclado sobre a que brilha.
6. **Com ícone** — repouso e carregando, com o giro ocupando o lugar do ícone.

Reutilize os primitivos existentes: `tf-btn` e seus modificadores `tf-btn--{variante}` / `tf-btn--sm|lg` / `tf-btn--glow` / `tf-btn--loading`, as partes internas `tf-btn__spin` e `tf-btn__label`, o giro `tf-spinner--sm`, e o rótulo só-para-leitor-de-tela `tf-vh`. **Não crie primitivo novo**: se a peça precisar de algo que não existe (um slot de ícone, um estilo de desabilitado que não seja opacidade), proponha-o como **modificador do `tf-btn`** e nomeie-o, para virar decisão do dono.

## Perguntas em aberto para o dono

1. **O rótulo troca durante o carregamento?** O protótipo trocava ("Entrar com Google" → "Entrando…"); o app não troca em nenhum dos 25 casos. Trocar exige uma segunda frase por botão (24 novas frases de copy) e ainda muda a largura — manter o rótulo e reservar o lugar do giro resolve a largura sem copy nova. É decisão de produto, não de desenho.
2. **O brilho (`glow`) fica ou sai?** Hoje tem **zero** usos no app inteiro. Se fica, quais são as "zonas" e qual é o CTA focal de cada uma (login? "Assinar Premium"? o "Calcular" da calculadora?).
3. **Todo botão desabilitado passa a exigir motivo visível?** Hoje só dois lugares mostram (`Exportar` e as simulações); os demais ficam mudos. Se a resposta for sim, alguém precisa escrever ~20 frases de motivo.
4. **O tamanho `sm` de 36px é intenção ou engano?** Ele é impossível hoje (o alvo de 44px vence). Ou o `sm` vira oficialmente 44px, ou existe uma exceção declarada de alvo para densidade em desktop.
