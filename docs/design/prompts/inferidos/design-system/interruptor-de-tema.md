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

- **Onde vive:** `shared/ui/switch.tsx` (Radix + pele `tf-*`) — a raiz é o ALVO de 44×44 e a trilha VISÍVEL (44×24, `radius pill`, polegar branco de 20px com sombra, `translateX(20px)` quando ligado) fica centralizada dentro dele: o vendedor toca numa área maior do que enxerga. Aparece em **4 pontos**: (1) o TEMA, na linha de aparência de `/conta` (`conta-page.tsx`) — e **só abaixo de 1280px**, porque acima do corte a mesma linha vira um controle segmentado "Claro/Escuro"; (2) cada SOBRETAXA de canal no formulário de `/calcular` (`calculator-form.tsx:810`, um por sobretaxa); (3) o "incluir marketplace" do bloco de canais (`calculator-form.tsx:1298`); (4) "incluir custos" na folha de exportação em PDF (`export-sheet.tsx:200`).
- **Como o vendedor chega:** Sempre como um ajuste dentro de uma linha de opção que o vendedor já está lendo — ele rola até ali e toca. No caso do tema, é o controle mais visitado da Conta; no caso dos canais, é o interruptor que decide se o cálculo mostra preço de marketplace.
- **Vizinhança imediata:** Encostado à DIREITA da linha, com o rótulo à esquerda e o interruptor no fim: no cartão de aparência da Conta (entre as linhas de plano e de privacidade); no bloco de canais de `/calcular`, numa linha `justify-between` cujo rótulo é "Incluir marketplace"; na folha de exportação, entre a escolha de formato (PDF/CSV) e o rodapé de ações, e só quando o formato é PDF.
- **Dados que chegam (e o que ela devolve):** Um booleano e um `onCheckedChange` — o primitivo não renderiza texto nenhum, sempre é rotulado pelo chamador (`aria-label`/`aria-labelledby`). O tema vem do `useThemeStore` (localStorage); as sobretaxas vêm do catálogo de tarifas servido/cacheado via React Hook Form; o "incluir marketplace" recebe o **entitlement** e, para conta sem direito, fica `disabled` e `false` INCONDICIONALMENTE — nunca o valor do formulário, para que um `true` obsoleto não leia como "ligado" enquanto o plano resolve.
- **O que acontece depois:** O tema repinta o app inteiro na hora e persiste no aparelho. Uma sobretaxa ligada entra no cálculo do `pricing-core` e muda os cartões de preço por canal e as linhas negativas do detalhamento. O "incluir custos" muda o PDF que o servidor renderiza. O desabilitado é apenas opacidade 0,55 — sem dizer por quê, o que na prática significa "isto é Premium" sem escrever isso.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho`

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

# Interruptor (Switch) — a trilha, o polegar e o alvo que ninguém enxerga

## O que desenhar
O interruptor liga/desliga do Precifica3D: uma trilha em pílula com um polegar que desliza, sempre
rotulado por um texto que vive FORA dele (o componente não escreve nada por conta própria). Ele
aparece em quatro momentos reais da jornada do vendedor: na **Conta**, na linha "Tema" (só abaixo de
1280px — acima disso o tema vira um controle segmentado "Claro / Escuro"); em **Calcular**, no
interruptor-mestre "Incluir marketplaces no preço" (desabilitado para quem não é Premium); em
**Calcular**, em cada sobretaxa opcional de canal; e na folha de **exportação do Histórico**, em
"Incluir detalhamento de custos" (só quando o formato é PDF). É a mesma peça de 44×24 nos quatro —
o que muda é o que está escrito ao lado dela e o que acontece quando ela está desligada.

## Por que este prompt existe
As duas metades do tema já estão desenhadas (o interruptor no protótipo antigo, as pílulas
Claro/Escuro no canvas 018 do dono), e elas são mutuamente exclusivas por largura — isso não é
defeito. O que nunca foi desenhado é a **MEDIDA**: a auditoria de acessibilidade item 11 mediu
"switch 28", a V3 mediu "46×44", e o app terminou com raiz de 44×44 e trilha visível de 44×24. Ou
seja, o alvo de toque é maior que a peça que o vendedor enxerga — e essa relação, que é a decisão
visual mais importante do componente, saiu de uma planilha de auditoria, não de um desenho. O §E7
do documento de referência só diz "toggle de tema (Dark↔Light)".

## O que já existe hoje (não invente do zero — corrija)
Lido de `apps/web/src/shared/ui/switch.{tsx,css}` e dos quatro pontos de uso.

| Parte | Medida/valor real hoje |
| --- | --- |
| Raiz (alvo) | `min-width` e `min-height` = 44px, fundo transparente, sem borda, `cursor: pointer` |
| Trilha visível | 44 × 24px, raio pílula (999px), centrada dentro da raiz |
| Trilha desligada | cor de borda padrão (cinza neutro 300 no claro) |
| Trilha ligada | roxo de destaque (`--accent`) |
| Polegar | 20 × 20px, círculo BRANCO em ambos os temas, sombra pequena, a 2px do topo e da esquerda |
| Deslocamento ao ligar | 20px para a direita, 130ms, ease-out (anulado em "reduzir movimento") |
| Foco | o anel de foco vai na TRILHA, não na raiz; a raiz não tem contorno |
| Desabilitado | opacidade 0,55 sobre o estado atual + `cursor: not-allowed` |

→ **O alvo extra só existe no eixo vertical.** A raiz tem 44px de largura e a trilha também tem
44px: horizontalmente o alvo é exatamente a peça; a folga de 10px acima e 10px abaixo é a única
área "escondida". O desenho precisa decidir e mostrar isso — inclusive o espaçamento mínimo entre
dois interruptores empilhados (a lista de sobretaxas empilha vários), para que as folgas invisíveis
não encostem umas nas outras.
→ **Não existe hover.** Nenhuma regra de `:hover` no CSS. No desktop (onde três dos quatro
interruptores continuam existindo) o ponteiro passa por cima e nada acontece.
→ **Não existe pressionado.** Entre o clique e a transição de 130ms não há resposta imediata.
→ **No tema claro, desligado, o polegar branco fica sobre uma trilha cinza-clara** e só a sombra
pequena os separa. É o pior contraste da peça e precisa ser resolvido no desenho, medido contra o
fundo real (o cartão branco da Conta), não contra um cinza imaginado.
→ **O rótulo clicável é inconsistente**: na lista de sobretaxas o texto está dentro de um `label`,
então clicar na frase alterna; na Conta e na exportação o rótulo só aponta por `aria-labelledby`, e
clicar no texto não faz nada.

## Conteúdo e dados reais
Textos literais pt-BR que ficam ao lado do interruptor (não reescreva — são copy homologada):

- Conta: rótulo **"Tema"**; no desktop, as duas pílulas **"Claro"** e **"Escuro"** com ícones de sol
  e lua. Ligado = escuro (o padrão da v1).
- Calcular, mestre: **"Incluir marketplaces no preço"**; quando a conta não é Premium o interruptor
  é desabilitado e FALSO, e abaixo aparece **"Vender em marketplaces faz parte do Premium."** com o
  botão de assinar centrado.
- Calcular, sobretaxa: rótulo do próprio custo ao lado, e abaixo, em legenda, o texto real
  **"R$ 2,00 por pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque
  a comissão incide sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do
  pedido)."** seguido de **"Fonte: Amazon, vigente desde 06/08/2026."**
- Exportação (só PDF): rótulo **"Incluir detalhamento de custos"** e, imediatamente abaixo, o aviso
  **"Seu cliente veria as linhas gravadas — material, energia, máquina, falhas, acabamento, mão de
  obra e os seus outros custos — e poderia calcular a sua margem."** (na versão de kit:
  **"Seu cliente veria o custo total gravado do kit — e poderia calcular a sua margem."**).

O interruptor em si não tem dado, unidade nem faixa: é binário. Tudo o que ele carrega de número
está nas legendas acima — que podem ser longas (a da sobretaxa passa de 200 caracteres) e precisam
de linha inteira, nunca de uma coluna espremida ao lado da peça.

## Estados obrigatórios
1. **Desligado em repouso** — trilha cinza, polegar à esquerda.
2. **Ligado em repouso** — trilha roxa, polegar à direita.
3. **Foco por teclado** — anel na trilha, nos dois estados; mostre que ele não corta contra o
   cartão nem contra a lateral da tela a 390px.
4. **Hover** (a desenhar: hoje não existe) — nos dois estados, desktop.
5. **Pressionado** (a desenhar: hoje não existe) — a resposta antes dos 130ms.
6. **Desabilitado desligado** — opacidade 0,55; é o estado REAL do "Incluir marketplaces no preço"
   para conta gratuita, e é o único desabilitado que o produto usa hoje.
7. **Movimento reduzido** — o polegar salta sem transição; nada mais muda.
8. **Alvo de toque** — uma prancheta com o retângulo de 44×44 revelado em pontilhado sobre a peça,
   em duas linhas empilhadas, para ver as folgas se tocarem.

Não existem, e não devem ser inventados: carregando, erro, vazio, offline. Nenhuma das quatro
instâncias faz chamada de rede ao alternar — a mudança é local e imediata.

## Viewports
- **390px (mobile)** — obrigatório: é o único lugar onde o interruptor de tema existe, e onde os
  outros três convivem com rótulos longos.
- **1280px (desktop)** — obrigatório: acima desse corte o tema deixa de ser interruptor e vira o
  segmentado "Claro / Escuro", mas os outros três interruptores continuam lá. Desenhe a linha "Tema"
  no desktop também, com o segmentado, para deixar registrado que ali NÃO há interruptor.
- 1920px não é necessário: a peça tem tamanho fixo e não reflui.

## Regras que o desenho não pode quebrar
- **Freemium binário**: o interruptor de marketplaces desabilitado significa "isto é do Premium",
  dito em texto ao lado. Nunca um interruptor meio-ligado, nunca um número de canal parcial atrás
  dele.
- **Falha de rede nunca vira "não é premium"** — e como o interruptor não faz rede, ele também
  nunca deve parecer estar tentando algo.
- **A frase honesta vive em elemento de largura inteira**, embaixo do interruptor, nunca cortada e
  nunca dentro de um espaço estreito ao lado dele.
- **Alvo ≥ 44×44px** em todos os estados, incluindo o desabilitado.
- **Contraste medido contra o fundo real** de cada tela (cartão da Conta, folha da exportação,
  formulário de Calcular), nos dois temas — inclusive o polegar branco sobre trilha clara e o
  conjunto inteiro a 0,55 de opacidade.
- O componente **não escreve texto**: qualquer palavra que apareça no desenho é do rótulo vizinho.

## Armadilhas já pagas neste projeto
- **O rótulo espremido a 390px**: o mestre de marketplaces já foi corrigido uma vez porque o texto
  quebrava em duas linhas ao lado do interruptor; hoje ele ocupa uma linha inteira, rótulo à
  esquerda e interruptor à direita. Mantenha essa forma.
- **Teste passa em elemento ocluso**: alvo e sobreposição se provam com CAIXAS, não com "o texto
  está lá". Entregue as medidas do retângulo de toque.
- **Legenda cortada**: a frase da sobretaxa e o aviso da exportação são longos de propósito; se
  couberem só truncados, o desenho está errado, não a copy.
- **Rolagem horizontal medida**: a 390px, a linha rótulo+interruptor não pode estourar 1px sequer.

## Entregável
Pranchetas, tema escuro e tema claro lado a lado (o escuro é o padrão, o claro é first-class):
1. **Matriz de estados** — os 7 estados acima × ligado/desligado, em tamanho real e ampliado.
2. **Anatomia com o alvo revelado** — cotas de 44×44 (raiz), 44×24 (trilha), 20px (polegar), 2px de
   folga e o deslocamento de 20px; duas linhas empilhadas mostrando o espaçamento mínimo seguro.
3. **Os quatro contextos reais a 390px** — Tema, marketplaces (gratuito, desabilitado, com a frase
   do Premium), uma sobretaxa com a legenda completa, e a exportação com o aviso.
4. **A 1280px** — a linha "Tema" com o segmentado Claro/Escuro (sem interruptor) e os outros três
   interruptores no seu lugar.

Reutilize os primitivos existentes: `tf-switch` para a peça (é ela que está sendo redesenhada, não
substituída), `tf-segmented` para o controle de tema do desktop, o cartão do DS para as linhas da
Conta, e os ícones de sol e lua já existentes a 16px. Não crie um primitivo novo de toggle.

## Perguntas em aberto para o dono
1. O desabilitado por **falta de Premium** deve ser visualmente igual a qualquer outro desabilitado
   (opacidade 0,55), ou merece um tratamento próprio — cadeado, cor distinta — já que a frase
   "Vender em marketplaces faz parte do Premium." aparece logo abaixo?
2. Clicar no **rótulo** deve alternar o interruptor em todos os quatro casos? Hoje alterna só na
   lista de sobretaxas; na Conta e na exportação o texto é inerte. Uniformizar muda o tamanho real
   do alvo e, no caso da exportação, coloca o aviso de exposição de custos a um clique de distância
   do próprio texto que o explica.
