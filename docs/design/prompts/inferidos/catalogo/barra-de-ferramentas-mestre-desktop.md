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

## O mapa funcional de Catálogo (filamentos, impressoras, produtos)

### O que é esta área

O **Catálogo** é a segunda das cinco abas. É onde o vendedor guarda o que ele reusa em todo cálculo: **filamentos**, **impressoras**, **produtos** (uma peça inteira já configurada) e **kits** (listas de peças, cuja composição mora na aba Kits). Ele chega aqui pela barra de abas do celular ou pelo menu lateral do desktop, quase sempre com uma destas três intenções: cadastrar um item pela primeira vez, corrigir um valor que mudou (o rolo de PLA subiu de preço), ou conferir/reabrir um produto salvo para ver o preço de hoje.

### Rotas

- **`/catalogo`** — a tela da área. Uma faixa de cabeçalho (`.tf-catalogo-head`) com o título **Catálogo** à esquerda e um grupo segmentado de **quatro pílulas** à direita — Filamentos · Impressoras · Produtos · Kits. A pílula ativa vem da URL (`?tab=filaments|printers|products|kits`, padrão Filamentos), então recarregar ou favoritar preserva a seção. Abaixo, um `role="tabpanel"` com o painel da seção.
- **`/catalogo?produto=<id>`** e **`?produto=novo`** — o **editor de produto em página cheia**. Não é outra rota nem outra moldura: substitui todo o conteúdo de `/catalogo` dentro do mesmo shell. (A rota antiga de dois segmentos `/catalogo/produtos/$id` só sobrevive como redirecionamento.)
- Kits é a única seção que **sai da área**: tocar um kit leva a `/kits` (o compositor); "Montar kit" e "Duplicar" também.

### Como a área é construída

As quatro seções renderizam o **mesmo componente** (`CatalogPanel`), parametrizado. Ele decide, nesta ordem: carregando → plano negado pelo servidor → erro de carga → lista vazia → **mestre-detalhe (≥1280px)** → **lista simples (<1280px)**. Filamento e impressora abrem um **formulário**; produto e kit **navegam** para seus editores. O corte de 1280px é estrutural: abaixo dele o ramo desktop nem existe na árvore.

Largura útil da coluna de conteúdo: ~460px no celular, até 1120px a partir de 1024px, até 1720px a partir de 1280px.

### Dados

Tudo vem do servidor e é espelhado num **cache local por conta (uid)**: sem semente, vazio até a primeira leitura online. Se a leitura online falha e há cache, a lista continua servida com um sinal honesto de "pode estar desatualizada". **Escrita de catálogo é só online** — não há fila/outbox aqui (a outbox pertence a Orçamentos); um salvamento offline falha com uma frase específica, nunca com um sucesso fingido. O plano (`entitlement`) vem do servidor e tem três leituras que importam: **ativo**, **nenhum**, **pausado**. O editor de produto ainda depende do **catálogo de tarifas** (servido + cacheado) e do motor **`pricing-core`**, que recalcula o preço ao vivo, offline inclusive — nenhum preço é guardado em produto nenhum.

### O que a área alimenta

Um filamento/impressora salvo vira opção no bloco "Usar do catálogo" da **Calcular**. Um produto salvo vira base de **orçamento congelado** (botão "registrar orçamento", com origem PRODUTO) e de **simulação salva**. Um kit salvo, ao ser salvo no compositor, **materializa produtos** aqui — produtos que nascem sem vínculo e por isso pedem atenção. Excluir um filamento/impressora não apaga os produtos que o usam: eles guardam os últimos valores, editáveis.

### Como muda por estado

- **Grátis / deslogado** — a área inteira vira título + o teaser Premium único (título, subtítulo, "Assinar", legenda). Nenhum CRUD quebrado, nenhuma lista fantasma.
- **Premium ativo** — tudo funciona.
- **Premium pausado** — leitura completa, escrita congelada e anunciada de antemão: faixa calma "Premium pausado" acima da lista, "somente leitura" em cada item, formulários inertes, "Salvar" substituído pela linha de reativação; tocar a lixeira leva à ficha somente-leitura em vez de abrir a confirmação de exclusão.
- **Offline** — faixa "Modo leitura offline", "pode estar desatualizada" por item, e o botão "Adicionar" segue ativo (uma tentativa de salvar falha com frase honesta).
- **Sessão expirada** — o shell mostra a faixa "Entrar de novo"; a leitura da área cai para o cache local e a escrita falha.

## O ponto exato de inserção desta peça

- **Onde vive:** Rota /catalogo a partir de 1280px, primeira linha da COLUNA ESQUERDA do mestre-detalhe (`.tf-catalog-md__toolbar`), imediatamente acima da lista de cartões e à esquerda da ficha de 560px.
- **Como o vendedor chega:** O vendedor abre o Catálogo no computador; a barra já está lá, é o topo da lista. Ele recorre a ela quando a lista cresceu e rolar deixou de ser o caminho mais curto até o item.
- **Vizinhança imediata:** Acima dela: as faixas de aviso do painel (offline / Premium pausado), e acima destas a faixa de cabeçalho com título + pílulas de seção. Na própria linha, da esquerda para a direita: o campo de busca com ícone de lupa (cresce até 420px), depois — empurrada para a direita — a contagem em caption ("8 filamento(s)"), e por último o botão "Adicionar filamento". A linha NÃO quebra: três elementos que não caibam se espremem. Logo abaixo começa a grade de cartões (uma coluna; duas colunas a partir de 1600px).
- **Dados que chegam (e o que ela devolve):** O campo filtra em memória a lista JÁ carregada, comparando o termo contra nome + resumo do item; não há requisição nova nem espera. A contagem exibida passa a ser a dos itens VISÍVEIS, ou seja, o mesmo texto muda de significado quando há filtro ativo, sem nada dizer isso.
- **O que acontece depois:** Digitar reduz a lista ao vivo e, quando nada casa, a lista inteira é substituída pelo vazio da busca. A seleção da ficha à direita acompanha: se o item selecionado sai do filtro, a ficha cai para o primeiro visível. "Adicionar" abre a folha de criação (filamento/impressora) ou navega para o editor de produto / compositor de kits.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Barra de ferramentas da lista do Catálogo (desktop)

## O que desenhar
A faixa que fica no topo da COLUNA ESQUERDA do Catálogo no desktop (≥1280px), acima da lista de
cartões e ao lado da ficha do item selecionado. Ela existe nas quatro seções do Catálogo —
Filamentos, Impressoras, Produtos e Kits — e é o único caminho até um item quando o vendedor já
tem catálogo grande: é onde ele busca, onde ele lê quantos itens tem, e de onde ele cria um item
novo. Quem usa: o vendedor Premium, no meio do trabalho, procurando "aquele PLA azul" entre
dezenas. Origem no app: `apps/web/src/features/catalog/catalog-panel.tsx` (branch `isWide`) +
`catalog-master-detail.css` (`.tf-catalog-md__toolbar`).

## Por que este prompt existe
`autoridade: PROTOTIPO_PARCIAL`. O desenho de 2026-07-02 (canvas `Abas-Desktop.dc.html`) cobre
UM terço desta peça: a linha 102 desenha o campo de busca sozinho, `tf-inputwrap` com
`max-width:420px`, placeholder "Buscar no catálogo…" e `aria-label` "Buscar no catálogo" — e a
copy implementada bate exatamente. Os outros dois elementos o canvas colocou em OUTRO lugar: a
contagem é `tf-page-header__desc`, ao lado do título "Catálogo" (linha 73), e o botão primário
`{{ addLabel }}` fica grudado no `role="tablist"` das seções (linha 82). O código juntou os três
numa única `display:flex` sem `flex-wrap` — um arranjo que não existe em desenho nenhum. Além
disso o código CONTRARIA o canvas num ponto explícito: no canvas o botão de adicionar tem
`disabled="{{ writeBlocked }}"`; no app ele nunca desabilita — com Premium pausado ele abre uma
gaveta de criação em modo somente-leitura, sem botão Salvar, de onde só se sai fechando.

## O que já existe hoje (não invente do zero — corrija)
A barra tem três filhos, nesta ordem, numa linha só (`gap: 12px`, `align-items:center`):

| # | Elemento | Comportamento hoje |
|---|---|---|
| 1 | Campo de busca `tf-inputwrap` com ícone de lupa 18px | `flex:1; max-width:420px`; rótulo visualmente oculto "Buscar no catálogo"; placeholder "Buscar no catálogo…" |
| 2 | Contagem, em texto de legenda (`--fs-caption`, `--text-muted`) | empurrada para a direita por `margin-left:auto` |
| 3 | Botão primário pequeno com ícone `+` 16px | "Adicionar filamento" / "Adicionar impressora" / "Adicionar produto" / "Montar kit" |

→ **Sem `flex-wrap`.** A coluna esquerda mede ≈390px a 1280px com o menu aberto (1280 − 240 de
menu − recuos − 560 da ficha − 28 do vão). Três elementos, um deles com "Adicionar impressora"
escrito por extenso, se espremem nesses 390px em vez de quebrar: a busca — que tem 420px de largura
desenhada — encolhe para uns 120px. Com o menu recolhido (76px) sobram ≈550px; a 1920px sobram
≈1030px e aí a linha respira. O desenho precisa resolver os três casos, não só o folgado.
→ **A contagem muda de significado sem avisar.** Ela exibe `visible.length`, o resultado do FILTRO,
com o mesmo texto de sempre. Com 40 filamentos salvos e a busca "azul" ativa, lê-se
"3 filamento(s)" — e nada na tela diz que 37 estão escondidos por um filtro.
→ **A busca filtra a lista já carregada** (nome + resumo, sem acento-insensível, sem debounce,
nenhuma requisição nova). Não há botão de limpar DENTRO do campo: "Limpar busca" só aparece no
vazio de busca, dentro do estado vazio.
→ **A barra some quando o catálogo está vazio** (o estado vazio ocupa a coluna inteira, com o botão
de adicionar em bloco), e também durante o carregamento e no erro. Ela só existe com ≥1 item.

## Conteúdo e dados reais
- Contagem, textos literais: "{n} filamento(s)" · "{n} impressora(s)" · "{n} produto(s)" ·
  "{n} kit(s)". Exemplos reais para desenhar: "12 filamento(s)", "1 impressora(s)" (sim, o plural
  entre parênteses é a copy vigente), "128 produto(s)".
- Botões: "Adicionar filamento" (o mais largo junto de "Adicionar impressora"), "Adicionar produto",
  "Montar kit" (curto — a linha não pode depender do rótulo curto para caber).
- Busca: `type="search"`, sem limite de caracteres, sem contador próprio de resultados.
- Nada aqui é dinheiro. Os valores (ex.: "PLA Azul · R$ 129,90/kg") vivem nos cartões da lista,
  logo abaixo, e na ficha de 560px à direita — a barra não os mostra.

## Estados obrigatórios
- **Repouso**, com item selecionado na lista (o cartão selecionado tem borda de destaque).
- **Busca vazia (repouso)** vs **busca preenchida**: a segunda precisa de um jeito visível de
  limpar sem apagar caractere a caractere.
- **Foco no campo** (anel de foco medido contra o fundo real do cartão, não contra o fundo da
  página) · **hover** e **pressionado** no botão de adicionar.
- **Sem resultado**: a barra CONTINUA, a lista vira o vazio "Nada encontrado para essa busca" /
  "Tente outro termo, ou limpe a busca para ver tudo de novo." + botão secundário "Limpar busca".
  Desenhe a barra e esse vazio juntos — é aqui que a contagem "0 filamento(s)" mente sobre o
  catálogo do vendedor.
- **Offline (leitura degradada)**: acima da barra a página já mostra um alerta de tom informativo
  "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar
  precisam de conexão." e cada cartão ganha a legenda "pode estar desatualizada". A barra em si
  não muda hoje — decida no desenho o que acontece com o botão de adicionar nesse estado.
- **Premium pausado (`lapsed`)**: alerta informativo "Premium pausado" / "Seus itens continuam aqui
  e podem ser usados no cálculo. Para criar ou editar, reative o Premium.", cartões com a legenda
  "somente leitura", e a linha de reativação "Reative o Premium para voltar a criar e editar. Seus
  itens estão salvos." Hoje o botão de adicionar segue aceso e leva a uma gaveta sem Salvar.
- **Estados em que a barra NÃO aparece** (desenhe pelo menos um para contraste): carregando
  (spinner na coluna), erro "Não foi possível carregar seu catálogo." + "Tentar novamente",
  catálogo vazio, e sem direito de acesso (o teaser de Premium ocupa a área).

## Viewports
- **Desktop 1280px** — o caso apertado, e o mais importante: menu aberto (240px) e menu recolhido
  (76px), porque a diferença de 160px é justamente o que decide se os três elementos cabem.
- **Desktop 1920px** — o caso folgado, onde a lista vira duas colunas de cartões (a partir de
  1600px) e a barra tem ≈1030px.
- **Mobile 390px — não desenhar.** Esta peça não existe no mobile: abaixo de 1280px o painel
  renderiza outra árvore, com contagem + botão numa linha e **nenhuma busca**. Se o desenho sugerir
  levar a busca para o mobile, isso é decisão de produto — mande para as perguntas abaixo.

## Regras que o desenho não pode quebrar
- A contagem é um número sobre os DADOS do vendedor. Se ela passar a contar o resultado do filtro,
  o texto tem que dizer isso na própria frase — número sem procedência declarada é mentira barata.
- Falha de rede nunca vira falta de Premium, e Premium pausado nunca vira erro: os dois alertas são
  de tom informativo, calmos, e a barra não pode contradizê-los ficando "normal" demais.
- Frase honesta nunca mora em placeholder. O placeholder carrega "Buscar no catálogo…" e nada mais;
  qualquer explicação (filtro ativo, itens ocultos) é texto de verdade, em elemento de largura cheia.
- Alvo de toque/clique ≥44px em qualquer controle da barra, inclusive um eventual "limpar" dentro
  do campo.
- Contraste medido contra o fundo real (a coluna fica sobre `--bg-base`, os cartões sobre o fundo
  de card) — o texto de legenda em `--text-muted` é o mais frágil.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal se mede, não se estima.** Um nome de filamento colado sem espaço já gerou
  4.948px de rolagem horizontal a 1440px nesta mesma coluna; a correção foi `min-width:0` +
  `overflow-wrap`. Uma barra sem quebra é a mesma classe de defeito uma linha acima.
- **Texto ocluso passa em teste.** Um elemento espremido continua "visível" para asserção de texto
  e ilegível para o vendedor — por isso o arranjo tem que ser resolvido no desenho, com caixas.
- **Rótulo comprido estoura a coluna.** "Adicionar impressora" com ícone é o pior caso; não desenhe
  a barra com "Montar kit" e presuma que serve para todas as seções.
- **O contador que mentia.** Numa homologação anterior um contador anunciou "8 encontrados" com 31
  correspondências — invisível para toda asserção e óbvio na imagem.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro (first-class), reusando os primitivos existentes —
nada de componente novo:
1. 1280px, menu aberto, repouso com busca vazia — a prancheta que prova (ou nega) que os três
   elementos cabem em ≈390px.
2. 1280px, menu recolhido, busca preenchida com termo e resultado parcial.
3. 1920px, repouso, lista em duas colunas ao lado da ficha de 560px.
4. 1280px, sem resultado de busca (barra + estado vazio de busca juntos).
5. 1280px, offline e Premium pausado (pode ser uma prancheta com os dois alertas empilhados acima
   da barra).
Use `tf-inputwrap` + `tf-input` com o ícone de lupa para a busca, o botão primário `tf-btn
tf-btn--primary` (com o `+`) para adicionar, `tf-badge` se a contagem virar pastilha, `tf-card` /
`tf-card--interactive` para os cartões da lista ao redor, e o vazio de busca no mesmo padrão de
`tf-empty` já usado. Se a solução for quebrar a barra em duas linhas, mostre as duas linhas
desenhadas — não deixe implícito.

## Perguntas em aberto para o dono
1. Com filtro ativo, o que a contagem deve dizer? "3 de 40 filamento(s)", "3 filamento(s)
   encontrados" ou manter "{n} filamento(s)" e explicar noutro lugar? Muda o texto e a largura.
2. O botão "Adicionar…" fica na barra da lista (como está) ou volta para o cabeçalho da página, ao
   lado das abas de seção, como o canvas de 2026-07-02 desenhou? Não dá para ter os dois.
3. Com Premium pausado ou offline, o botão de adicionar desabilita (como o canvas mandava) ou
   continua aceso levando a uma gaveta somente-leitura (como o código faz)? Se desabilitar, qual a
   frase que explica o porquê, e onde ela mora?
4. A busca deve ignorar acentos ("acucar" achar "Açúcar")? Hoje não ignora.
5. A busca deve existir também no mobile, ou o mobile continua sem nenhum caminho de filtro?
