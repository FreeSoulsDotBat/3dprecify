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

- **Onde vive:** Rota /catalogo abaixo de 1280px, dentro do painel da seção ativa (`role="tabpanel"`). É o ramo `else` final do CatalogPanel: ocupa toda a coluna de ~460px, começando logo abaixo do cabeçalho "Catálogo" + pílulas de seção e de qualquer faixa de aviso (offline / Premium pausado).
- **Como o vendedor chega:** O vendedor toca "Catálogo" na barra de 5 abas do rodapé e cai direto aqui, na seção Filamentos, com a lista já preenchida pelo cache local enquanto a leitura online acontece. Chega quase sempre para cadastrar um item novo ou corrigir um preço que mudou.
- **Vizinhança imediata:** Primeira linha do bloco: uma faixa `flex justify-between` com a contagem em caption à esquerda ("3 filamento(s)") e o botão pequeno de texto "Adicionar filamento" (com ícone +) à direita. Abaixo, a lista `ul` com gap de 8px. Cada item é um Card de padding pequeno em linha: área clicável flexível à esquerda (nome em semibold, resumo em caption e, empilhados no mesmo estilo, "Vincule um filamento e uma impressora salvos", "pode estar desatualizada" e "somente leitura"), seguida de 2 a 3 botões-ícone ghost de 18px — lápis sempre, copiar só em Kits, lixeira sempre. Abaixo da lista não há nada: o próximo elemento é a barra de abas do shell.
- **Dados que chegam (e o que ela devolve):** Recebe a lista da seção (servidor com espelho em cache local por uid), o sinalizador de leitura desatualizada e o estado do plano. O resumo é composto por seção: filamento vira "PLA · R$ 89,90 / 1 kg", impressora cola três grandezas numa linha ("R$ 2.400,00 · 4680 h · 0,12 kW"), produto mostra só os NOMES das referências ("PLA Prata · Ender 3 V3", nunca um preço), kit mostra "2 peça(s)". Devolve cliques: seleção de item e ações de linha.
- **O que acontece depois:** Tocar a área clicável ou o lápis abre a folha lateral de edição (filamento/impressora) ou navega para o editor de página cheia (produto) / para /kits (kit). A lixeira abre o diálogo de exclusão — a menos que o Premium esteja pausado, quando ela desvia para a ficha somente-leitura. "Adicionar" abre a mesma folha em modo criar, ou navega para `?produto=novo`.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Lista do Catálogo no celular — a linha do item, a contagem e o botão de adicionar

## O que desenhar

A lista do Catálogo como ela aparece no **celular**: dentro da aba `/catalogo`, logo abaixo de um controle
segmentado de quatro seções ("Filamentos", "Impressoras", "Produtos", "Kits"), vem uma faixa fina com a
contagem à esquerda e o botão de adicionar à direita, e abaixo dela a pilha de itens salvos. Cada item é uma
linha com o nome, um resumo, eventuais avisos, e de 2 a 3 botões de ícone. É a tela que o vendedor abre todo
dia no balcão para conferir, corrigir ou apagar um filamento, uma impressora, um produto ou um kit antes de
precificar. O mesmo bloco serve às quatro seções — só mudam os textos e o resumo —, então o desenho precisa
funcionar para os quatro conteúdos, não só para o mais bonito.

## Por que este prompt existe

Esta lista nunca foi desenhada: o ramo mobile do `catalog-panel.tsx` foi composto por inferência a partir de
requisito textual. Existe protótipo (`.design-import/ui_kits/precifica3d/CatalogScreen.jsx`), mas ele é
**parcial e diverge ponto a ponto** do que o produto virou: lá era **um** cartão único envolvendo todos os
itens com divisórias, `Avatar` de 36px como elemento inicial, **duas** linhas de texto (título + subtítulo),
**um** único botão de lápis ao final, e o "+" era um `IconButton` sólido na barra de título — **não existia
faixa de contagem em lugar nenhum**. O produto de hoje tem faixa de contagem, botão de texto, cartão por item
(sem divisórias), até **quatro** textos empilhados e até **três** alvos de toque por linha. A regra do
incremento 018 é "o mobile não se mexe", e por isso o desenho de 1920px não alcança este código — ele segue
sem autoria de design.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual, de cima para baixo (`catalog-panel.tsx`, ramo abaixo de 1280px):

| Elemento | Conteúdo real hoje | Observação |
| --- | --- | --- |
| Faixa | contagem à esquerda, botão à direita | "3 filamento(s)" · botão pequeno com "+" e o texto "Adicionar filamento" |
| Item (cartão) | área clicável ocupando toda a largura restante + botões de ícone | o cartão inteiro **não** é clicável; só a área de texto é |
| Linha 1 | nome do item, semibold | ex.: "PLA Azul" |
| Linha 2 | resumo, tipografia de legenda | ver "Conteúdo e dados reais" |
| Linha 3 (condicional) | "Vincule um filamento e uma impressora salvos" | só em Produtos, quando falta referência |
| Linha 4 (condicional) | "pode estar desatualizada" | quando os dados vieram do cache offline |
| Linha 5 (condicional) | "somente leitura" | quando o Premium está pausado |
| Ações | lápis (sempre) · copiar (**só em Kits**) · lixeira (sempre) | todos ícones de 18px sem rótulo visível |

→ **Problema 1 — quatro textos, uma tipografia só.** Resumo, aviso de referência faltando, aviso de dado
velho e aviso de somente-leitura usam *exatamente* o mesmo estilo (legenda, cor esmaecida). Não há hierarquia:
o dado ("PLA · R$ 89,90 / 1 kg") e o alerta ("Vincule um filamento e uma impressora salvos") têm o mesmo peso
visual, e no pior caso os três avisos coexistem na mesma linha de lista. O desenho precisa decidir o que é
dado, o que é aviso, e o que acontece quando três avisos aparecem juntos.

→ **Problema 2 — o resumo de impressora cola três grandezas numa frase só**: "R$ 2.400,00 · 4680 h · 0,12 kW".
Sem rótulo nenhum: o vendedor precisa adivinhar que 4680 h é vida útil e 0,12 kW é potência média. (O canvas de
desktop, quando desenha a impressora, **separa em duas linhas** — `0,12 kW · 4.680 h de vida útil` e, à parte,
`R$ 2.400,00`. O oposto de colar as três.) Note ainda que o "4680" sai **sem separador de milhar** aqui,
enquanto o valor em reais sai com — a mesma linha usa duas convenções numéricas.

→ **Problema 3 — três alvos de toque de 44px disputando espaço com o texto** numa tela de 390px. A área de
texto é `flex-1` com `min-w-0`: nomes longos são o que cede. Em Kits são três botões; nas outras seções, dois.

→ **Problema 4 — a faixa de contagem.** "3 filamento(s)" com parênteses é linguagem de programador, e o botão
de texto ao lado ("Adicionar impressora") é largo e compete com a contagem em telas estreitas.

## Conteúdo e dados reais

Resumos, por seção (todos são a segunda linha do item):

- **Filamentos** — `{material} · R$ {custo do rolo} / {peso} kg`. Exemplo real: **"PLA · R$ 89,90 / 1 kg"**.
  O material é opcional: sem ele a linha começa direto no dinheiro — "R$ 89,90 / 1 kg".
- **Impressoras** — `R$ {valor} · {vida útil} h · {potência} kW`. Exemplo real:
  **"R$ 2.400,00 · 4680 h · 0,12 kW"**. Faixas plausíveis: valor de R$ 800,00 a R$ 40.000,00; vida útil de
  algumas centenas a ~20.000 h; potência de 0,05 a 1,5 kW.
- **Produtos** — os **nomes das referências**: `{filamento} · {impressora}`, ex.: **"PLA Azul · Ender 3"**.
  Nunca um preço: um preço na linha implicaria valor congelado, e produto é sempre recalculado. Referência
  ausente vira a palavra **"manual"**; enquanto o cache irmão ainda carrega, vira **"carregando…"** (jamais
  "manual" — isso seria uma afirmação falsa sobre a origem do dado).
- **Kits** — a contagem de peças: **"4 peça(s)"**.

Contagens da faixa, literais: **"{n} filamento(s)"**, **"{n} impressora(s)"**, **"{n} produto(s)"**,
**"{n} kit(s)"**. Botões de adicionar, literais: **"Adicionar filamento"**, **"Adicionar impressora"**,
**"Adicionar produto"**, **"Montar kit"**. Rótulos assistivos das ações: "Editar", "Duplicar", "Excluir",
sempre seguidos do nome do item.

Nomes de item são livres e podem ser longos ("PLA Silk Azul Petróleo 1,75mm — lote 2") — desenhe com um nome
longo, não com "PLA".

## Estados obrigatórios

- **Carregando**: hoje é só um indicador de progresso centralizado, sem esqueleto de lista. O protótipo antigo
  previa três linhas esqueleto com círculo + duas barras; decida e desenhe.
- **Vazio (catálogo sem itens)**: ilustração, título "Nenhum filamento salvo ainda" e corpo "Salve seus
  filamentos uma vez e reutilize em cada cálculo.", com o botão de adicionar em largura cheia. Sem faixa de
  contagem.
- **Erro de carga**: alerta de perigo, "Não foi possível carregar seu catálogo." + botão "Tentar novamente".
- **Sem permissão (conta não ativa)**: estado vazio com ícone de coroa e a frase de entitlement do servidor —
  sem lista falsa, sem CRUD que não funciona.
- **Offline / dado velho**: acima da lista, alerta **informativo** (nunca perigo) com título "Modo leitura
  offline" e corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de
  conexão."; **e** em cada linha o texto "pode estar desatualizada". Desenhe a repetição — hoje a mesma
  verdade aparece uma vez no topo e N vezes na lista, e isso é ruído.
- **Premium pausado**: alerta informativo "Premium pausado" / "Seus itens continuam aqui e podem ser usados no
  cálculo. Para criar ou editar, reative o Premium."; **e** "somente leitura" em cada linha. O lápis e a
  lixeira continuam presentes e levam à tela de reativação — não são desabilitados nem escondidos.
- **Produto precisando de atenção**: "Vincule um filamento e uma impressora salvos" na linha, e o resumo
  mostrando "manual" em uma ou nas duas posições.
- **Linha em repouso, foco (teclado), toque/pressionado**: a área de texto e cada botão de ícone são alvos
  independentes — mostre os três focos distintos, porque hoje o cartão inteiro não é um alvo só.
- **Pior caso combinado**: item de Kits, offline, Premium pausado, nome longo — 4 textos + 3 botões. Desenhe
  essa prancheta; é o caso que decide o layout.

## Viewports

**Somente 390px.** Esta peça é o ramo mobile: acima de 1280px o produto troca para uma composição
mestre-detalhe que já foi desenhada no canvas do 018. A faixa entre 600 e 1279px também cai neste mesmo ramo,
então acrescente **uma prancheta de checagem a 768px** apenas para mostrar como a linha respira quando sobra
largura (o botão de texto e a contagem deixam de competir).

## Regras que o desenho não pode quebrar

- **Nenhum preço na linha de Produto.** O preço é sempre recalculado; um número ali seria uma promessa falsa.
- **Degradação é dita, não escondida**: "manual", "carregando…", "pode estar desatualizada" e "somente
  leitura" precisam continuar legíveis — nada de escondê-los atrás de reticências ou de um ícone mudo.
- **Falha de rede nunca vira "não é premium"**: offline é tom informativo; erro de carga é erro de carga.
- **Frase honesta fora de placeholder** e fora de elemento truncável: nunca coloque essas frases num campo que
  corta o texto.
- **Alvo de toque ≥ 44px** para cada botão de ícone, com espaçamento suficiente para que a lixeira não seja
  vizinha imediata do lápis por acidente.
- **Contraste medido contra o fundo real do cartão**, não contra o fundo da página — os textos esmaecidos de
  legenda são o ponto frágil.

## Armadilhas já pagas neste projeto

- **Estouro horizontal medido, não olhado**: aqui o texto é o elemento que cede, então um nome longo ou
  "R$ 2.400,00 · 4680 h · 0,12 kW" empurra a linha. Desenhe com valores grandes de verdade.
- **Texto ocluso passa em teste**: presente e invisível é o defeito que nenhuma asserção pega. Se um aviso for
  truncado por decisão de desenho, diga explicitamente qual e por quê.
- **A frase honesta cortada**: já aconteceu de uma frase de honestidade viver num elemento estreito e sair
  cortada — daí a regra acima.
- **Máscara de milhar inconsistente**: "4680 h" sem separador ao lado de "R$ 2.400,00" com separador é defeito
  já corrigido em outras telas.

## Entregável

Pranchetas a 390px, **tema escuro (padrão) e tema claro (first-class, não um afterthought)**:

1. Lista de Filamentos com 4 itens, um deles com nome longo.
2. Lista de Impressoras — a prancheta que resolve o resumo de três grandezas.
3. Lista de Produtos com um item em "precisa de atenção" e um com "manual · manual".
4. Lista de Kits (o caso de três botões).
5. Carregando · Vazio · Erro de carga · Sem permissão.
6. Offline e Premium pausado (o alerta do topo + os avisos na linha).
7. O pior caso combinado descrito acima.
8. Prancheta de checagem a 768px.

Reutilize os primitivos existentes, sem criar novos: cartão para o item (ou o cartão único com divisórias, se
o desenho voltar ao padrão do protótipo), botão de ícone fantasma para lápis/copiar/lixeira, botão pequeno com
ícone à esquerda para adicionar, alerta informativo/perigo no topo, estado vazio com ícone e ação, esqueleto
ou indicador de progresso no carregamento, e a tipografia de legenda no resumo. Se propuser hierarquia nova
entre resumo e aviso, componha-a com tokens existentes e diga qual token usou.

## Perguntas em aberto para o dono

1. **Volta ao cartão único com divisórias?** O protótipo desenhava um cartão envolvendo todos os itens; o
   produto usa um cartão por item. Mudar isso é decisão de produto (densidade da tela), não de implementação.
2. **A faixa de contagem fica?** Ela não existe em nenhum desenho. Se ficar, "3 filamento(s)" precisa de uma
   forma melhor ("3 filamentos" / "1 filamento"); se sair, o botão de adicionar vai para a barra de título
   como ícone sólido (como no protótipo) — e o botão perde o texto.
3. **Avatar/inicial no começo da linha?** O protótipo tinha um de 36px; a auditoria registra que iniciais de
   uma letra já foram apontadas como problema e nunca corrigidas. Entra, sai, ou vira ícone da seção?
4. **A linha inteira vira um alvo só?** Hoje só a área de texto abre o item, e os botões ficam de fora. Um
   toque na borda direita do texto não faz nada.
5. **Três avisos ao mesmo tempo: mostrar todos, ou eleger um?** Se eleger, qual vence — a referência faltando,
   o dado velho, ou o somente-leitura?
6. **O resumo da impressora deve nomear as grandezas** ("4.680 h de vida útil · 0,12 kW"), separar em duas
   linhas como o desktop, ou mostrar menos?
