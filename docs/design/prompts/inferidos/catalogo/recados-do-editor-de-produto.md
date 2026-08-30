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

- **Onde vive:** No lugar do editor de produto inteiro, na rota /catalogo com `?produto=…`: uma coluna estreita centralizada (bem mais estreita que a página real do editor), dentro do shell. São dois recados diferentes na mesma posição.
- **Como o vendedor chega:** (a) O vendedor Premium recém-assinado toca "Adicionar produto" sem ter salvo antes um filamento OU uma impressora — é o primeiro passo do Catálogo Premium e ele bate aqui. (b) Ele abre um link/histórico de um produto que não existe mais (excluído em outro aparelho, id inválido).
- **Vizinhança imediata:** Em ambos, de cima para baixo: o título da página ("Novo produto" ou "Editar produto"), um alerta de tom informativo e, abaixo dele, um único botão secundário "Voltar ao catálogo". No caso (a) o alerta diz "Para criar um produto, salve antes um filamento e uma impressora no catálogo." — e NÃO há atalho para criar o item que falta. No caso (b), enquanto a lista de produtos ainda carrega aparece só um giro centralizado; depois dele, o alerta "Não encontramos este produto." com o mesmo botão.
- **Dados que chegam (e o que ela devolve):** O primeiro recado depende das contagens das listas de filamentos e impressoras já carregadas; o segundo, de a lista de produtos ter respondido sem conter o id pedido. Nenhuma escrita acontece nestes estados.
- **O que acontece depois:** "Voltar ao catálogo" devolve para /catalogo na aba Filamentos (não na aba de onde o vendedor veio). Para sair do pré-requisito, ele precisa cadastrar por conta própria um filamento e uma impressora e só então tentar de novo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Os dois recados que substituem o editor de produto

## O que desenhar

Duas telas curtas que **tomam o lugar inteiro** do editor de produto do Catálogo Premium, antes de qualquer campo aparecer. (a) **Pré-requisito**: o vendedor clicou em "Adicionar produto" mas ainda não tem filamento OU impressora salvos — o produto referencia itens salvos, então o formulário não pode abrir. (b) **Produto não encontrado**: o vendedor abriu `/catalogo?produto=<id>` (linha da lista, deep link, ou o atalho "ver a base" de um cenário salvo) e aquele id não está na lista carregada. As duas vivem na mesma rota do Catálogo — quando `?produto=` está presente, a página do Catálogo **não renderiza as abas**: ela devolve o editor, e portanto estes recados ocupam toda a área de conteúdo, com o rail de navegação do 018 ao lado. A primeira é o primeiro passo do vendedor no Catálogo Premium; a segunda quase sempre chega depois de uma exclusão ou de um link antigo.

## Por que este prompt existe

Autoridade de desenho: **NENHUMA**. O verificador adversarial confirmou que nada cobre estas duas telas: o §E9 do protótipo cobre "erro global (envelope ADR-0002)" e "404 de rota inexistente" — recados de **rota/sistema**, não um recado *dentro de um editor* sobre o estado dos dados do próprio vendedor; o §E5 não prevê pré-requisito entre entidades (no protótipo qualquer segmento cria livremente); a matriz §G não tem linha para isso; o `.design-import` cria produto pelo mesmo sheet, sem verificar nada; e o canvas do 018 mantém o editor de produto explicitamente fora (research §E). Uma IA montou as duas à mão, em `max-w-md` centralizado, com `PageHeader` + `Alert tone="info"` + botão secundário. Nunca se decidiu se isso é **estado vazio de marca** ou **alerta**, e a tela do pré-requisito explica o problema e manda o vendedor embora **sem oferecer a ação que o resolve**.

## O que já existe hoje (não invente do zero — corrija)

**(a) Pré-requisito** — `produto-page.tsx`, disparo: `!productId && (filaments.length === 0 || printers.length === 0)`

| Elemento | Conteúdo literal hoje |
|---|---|
| Cabeçalho (`PageHeader`) | "Novo produto" |
| Alerta `tone="info"` | "Para criar um produto, salve antes um filamento e uma impressora no catálogo." |
| Botão secundário | "Voltar ao catálogo" |

→ **Problema 1**: não há atalho para "Adicionar filamento" / "Adicionar impressora" — exatamente as duas ações que destravam a tela. O vendedor volta para o Catálogo e tem que descobrir sozinho em qual aba entrar.
→ **Problema 2**: a frase é genérica quando o app **sabe qual dos dois falta**. Se o vendedor já tem 3 filamentos e nenhuma impressora, ele lê "salve antes um filamento e uma impressora" e desconfia de tudo que salvou.
→ **Problema 3**: a largura `max-w-md` (448px) é fixa. O resto do Catálogo usa `tf-page-wide` (460px no mobile, 1120px a partir de 1024px, até 1720px a partir do corte de 1280px do 018). No desktop redesenhado, este recado é uma coluna de 448px perdida numa área de conteúdo de mais de 1400px.

**(b) Produto não encontrado** — disparo: `productId && !editing` (o id não está em `products.items`)

| Elemento | Conteúdo literal hoje |
|---|---|
| Cabeçalho | "Editar produto" |
| Enquanto `products.isLoading` | um `Spinner` centralizado, `py-8`, sem nenhuma legenda |
| Depois | Alerta `tone="info"` "Não encontramos este produto." + botão "Voltar ao catálogo" |

→ **Problema 4 (o mais grave)**: o código só distingue `isLoading`. O hook do catálogo expõe também `isError` e `stale`, e **nenhum dos dois é consultado aqui**. Se a leitura falhou (offline sem cache, servidor fora), a lista vem vazia, `isLoading` é falso — e a tela afirma "Não encontramos este produto" para um produto que **existe**. É uma falha de rede vendida como um fato sobre os dados do vendedor. A copy honesta já existe no mesmo arquivo de textos e não está sendo usada: "Não foi possível carregar seu catálogo." + "Tentar novamente", e para offline "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."
→ **Problema 5**: o mesmo `isError` afeta a tela (a): com a leitura falhando, `filaments.length === 0` é verdade e o vendedor experiente lê "salve antes um filamento e uma impressora" — uma acusação falsa.
→ **Problema 6**: o cabeçalho diz "Editar produto" acima de "Não encontramos este produto." Título e corpo se contradizem na mesma tela.

## Conteúdo e dados reais

- Entradas para o editor: botão "Adicionar produto" (aba Produtos), clique numa linha da lista, e a barra de contexto de um cenário salvo, que navega para o produto que serve de base ao cenário.
- Ações vizinhas que já existem com estes nomes exatos: "Adicionar filamento", "Adicionar impressora", "Adicionar produto", "Voltar ao catálogo", "Tentar novamente", "Limpar busca".
- Estados do catálogo já modelados: `isLoading`, `isError`, `stale` ("pode estar desatualizada"), lapsed ("Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium.").
- Nenhuma das duas telas mostra dinheiro. O editor completo que elas substituem mostra (para calibrar a expectativa de quem chega): nome do produto (placeholder "Ex.: Vaso G"), os dois seletores de catálogo e o resultado recalculado ao vivo, por exemplo **R$ 24,24** como preço sugerido — o vendedor está a um passo disso e o recado é o que o separa dali.
- O pré-requisito só vale para **criar**. Editar um produto já salvo cujos vínculos sumiram não cai aqui: cai no editor normal, com o alerta "Vincule um filamento e uma impressora salvos" + "Os valores atuais foram mantidos e continuam editáveis." Não misture as duas linguagens.

## Estados obrigatórios

1. **Pré-requisito — falta só filamento**: diz qual falta e oferece "Adicionar filamento" como ação primária, "Voltar ao catálogo" como secundária.
2. **Pré-requisito — falta só impressora**: simétrico, com "Adicionar impressora".
3. **Pré-requisito — faltam os dois**: a frase homologada "Para criar um produto, salve antes um filamento e uma impressora no catálogo." com as duas ações, a primeira em destaque.
4. **Carregando** (`isLoading`, lista ainda não respondeu): não decidir nada ainda. Nem "não encontramos", nem "salve antes". Desenhe o que ocupa esse tempo — hoje é um `Spinner` mudo e isso precisa de uma legenda curta.
5. **Não encontrado de verdade** (lista respondeu, id ausente): "Não encontramos este produto." + volta ao catálogo. Título coerente (ver Problema 6).
6. **Falha de leitura** (`isError`): "Não foi possível carregar seu catálogo." + "Tentar novamente" — nunca a frase de não-encontrado.
7. **Offline com cache**: "Modo leitura offline" (tom `info`, jamais `danger`) + "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."
8. **Premium pausado**: "Premium pausado" + "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." — o atalho de criar filamento/impressora não pode ser oferecido como se funcionasse.
9. Para cada botão: repouso, foco visível (anel de foco no fundo real da tela), hover, pressionado, desabilitado.

## Viewports

- **Mobile 390px** — é onde o vendedor usa o produto no dia a dia; a coluna de 448px já se comporta bem aqui, o desenho só precisa confirmar o empilhamento das duas ações e o alvo de toque.
- **Desktop 1280px** — o corte do 018, onde o rail de navegação passa a existir ao lado. É aqui que a decisão de largura tem que aparecer: o recado acompanha `tf-page-wide` ou fica numa coluna centrada com teto próprio?
- **Desktop 1920px** — a área de conteúdo chega a 1720px. Um alerta de 448px encostado à esquerda ou boiando no centro de 1720px é a diferença entre "tela pensada" e "aviso esquecido". Desenhe as duas telas neste tamanho.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca vira fato sobre os dados do vendedor.** "Não encontramos este produto" e "não conseguimos carregar" são afirmações diferentes e precisam de tratamentos visuais diferentes.
- **Não inventar evento que não aconteceu.** O app não sabe se o produto foi excluído, se o link é antigo ou se é de outra conta. A copy não pode dizer "excluído".
- **Freemium binário**: nada de "parcialmente disponível". Premium pausado mantém leitura completa e congela escrita, dito de frente e não descoberto no botão Salvar.
- **A frase honesta fora de placeholder.** Já foi pago neste projeto: frase honesta dentro de campo estreito é frase cortada.
- **Alvo ≥44px** para todos os botões, inclusive no desktop, e contraste medido contra o fundo real de cada tema.
- O recado não pode ser um beco: toda tela oferece pelo menos uma saída **que resolve** e uma que **volta**.

## Armadilhas já pagas neste projeto

- **Largura desperdiçada é defeito medido, não gosto**: no 016 mediu-se ~39% da área de conteúdo usada a 1440px por causa de um `max-w-md` esquecido. Estas duas telas ainda têm exatamente esse `max-w-md`.
- **Overflow horizontal**: medir os dois eixos. O headless não enxerga barra de rolagem clássica; foi assim que o item 9 do 016 escapou.
- **Texto ocluso passa em teste**: `toBeVisible`/`toContainText` passam em elemento sobreposto ou estourado. Assertar geometria, não presença.
- **Botão nascido fora da viewport**: aconteceu na tela de plano (100,5px de estouro). Duas ações lado a lado numa tela estreita é exatamente o arranjo que reproduz isso.
- **Spinner mudo**: um giro sem legenda por vários segundos lê como travamento, e foi o que fez a homologação confundir "carregando" com "quebrado" mais de uma vez.

## Entregável

Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:

1. Pré-requisito — faltam os dois (390 · 1280 · 1920).
2. Pré-requisito — falta só um dos dois (1280 basta, com a variante de texto visível).
3. Carregando (390 · 1280).
4. Não encontrado (390 · 1280 · 1920).
5. Falha de leitura + offline (1280, lado a lado para comparar os tons).
6. Premium pausado sobre o pré-requisito (1280).

Reutilize os primitivos existentes, sem criar novos: `PageHeader` para o título da rota; **decida e justifique** entre `tf-empty` (`EmptyState`, que já tem ícone decorativo, título, descrição e slot de ação centralizados) e `tf-alert` (`Alert`, com tons `neutral | info | success | danger`, ícone de 20px e `role="status"`) — a auditoria aponta essa indefinição como o buraco central desta peça; `Button` primário/secundário para as ações; `Spinner` para o carregamento; e o `Grafismo` da marca se a resposta for estado vazio. Marque na prancheta qual primitivo é cada bloco.

## Perguntas em aberto para o dono

1. **Estado vazio de marca ou alerta?** O pré-requisito é o primeiro passo do Catálogo Premium (tom de boas-vindas, grafismo, ação em destaque) ou um aviso de bloqueio (`Alert info`, seco)? A escolha muda a tela inteira e ninguém a tomou.
2. **O atalho pode existir?** Oferecer "Adicionar filamento" aqui abre o sheet de filamento *dentro* do editor de produto, ou leva à aba Filamentos do Catálogo e o vendedor tem que voltar a pé? A segunda opção é mais barata e pior.
3. **Contar o que falta é aceitável?** Dizer "você já tem 3 filamentos; falta salvar uma impressora" é mais útil e revela contagem do catálogo numa tela que hoje não revela nada. Pode?
4. **Largura no desktop**: estes recados acompanham `tf-page-wide` (até 1720px) ou ganham um teto próprio de leitura centralizado? O 018 redesenhou as quatro abas, não estes recados.
5. **O caminho do cenário salvo**: quando o produto que serve de base a um cenário não é encontrado, o recado deve dizer algo sobre o cenário de origem, ou permanecer genérico?
