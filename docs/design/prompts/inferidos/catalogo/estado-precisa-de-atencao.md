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

- **Onde vive:** Três superfícies da área, com a mesma causa: (1) o resumo do item na lista de Produtos vira "manual · manual"; (2) uma linha extra sob o resumo, no cartão do desktop e na linha do celular, e um alerta informativo no topo da ficha de 560px; (3) um alerta informativo no editor de produto, entre o título da página e o cartão de nome+Salvar.
- **Como o vendedor chega:** Duas histórias chegam ao mesmo lugar e o produto não sabe distinguir: o vendedor excluiu um filamento/impressora que este produto usava, ou salvou um kit e o app materializou este produto sem vínculo nenhum. Ele encontra o estado ao voltar à lista de Produtos ou ao reabrir a peça.
- **Vizinhança imediata:** Na lista, a frase "Vincule um filamento e uma impressora salvos" entra como caption cinza sob o resumo, com o mesmo peso do "pode estar desatualizada" e do "somente leitura" — e pode coexistir com os dois. No editor, o alerta traz essa mesma frase como TÍTULO e acrescenta o corpo "Os valores atuais foram mantidos e continuam editáveis.", logo acima do cartão de nome. Há ainda um quarto texto no resumo: enquanto as listas irmãs de filamento/impressora ainda estão carregando, a referência aparece como "carregando…" em vez de "manual".
- **Dados que chegam (e o que ela devolve):** Nada é guardado: o estado é derivado da ausência de vínculo (filamento OU impressora sem id) e, no editor, do estado ao vivo dos dois seletores. Os últimos valores conhecidos continuam nos campos, como números comuns e editáveis.
- **O que acontece depois:** Escolher um filamento E uma impressora nos seletores apaga o alerta no mesmo instante, antes de salvar; salvar limpa também a linha na lista. Enquanto o estado dura, o produto continua calculando normalmente — só não acompanha mais o catálogo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# O estado "precisa de atenção" de um produto (cartão, ficha e editor)

## O que desenhar
A forma visual de um único fato do Catálogo: **este produto salvo não tem um filamento e/ou uma impressora salvos por trás dele** — ou nasceu assim (foi materializado pela gravação de um kit), ou o item de catálogo que ele referenciava foi excluído. O vendedor encontra esse estado em três momentos da mesma jornada: (1) varrendo a lista da aba **Produtos** do Catálogo, quando decide em qual peça tocar; (2) na **ficha da direita** do mestre-detalhe desktop, depois de selecionar a peça; (3) dentro do **editor de página cheia do produto**, onde ele vai de fato religar as referências. Desenhe as três, mais o estado transitório em que as referências ainda estão sendo resolvidas. É o aviso que decide se o vendedor confia ou não num preço calculado sobre valores órfãos.

## Por que este prompt existe
A auditoria classificou esta peça como `PROTOTIPO_PARCIAL`: o canvas de 018 (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) **já resolveu bem duas superfícies** — no cartão da lista, um `tf-badge` com `tone: "danger"` e o texto `"precisa de atenção"`; na ficha, um `tf-alert--info` com a frase "Vincule um filamento e uma impressora salvos"; e o resumo da linha reduzido a `meta: "manual"`. Duas superfícies, dois papéis, uma copy. O que nunca foi desenhado, e por isso está aqui: (a) o placeholder **"carregando…"** que o código inventa enquanto os caches de filamento/impressora respondem — é indistinguível de um defeito; (b) a versão do alerta dentro do **editor de página cheia**, que ganhou um corpo próprio sem autoridade nenhuma; (c) a degradação real no produto hoje.
**E o código CONTRARIA o desenho, com todas as letras:** o badge `danger` do canvas nunca foi construído. Na lista (mobile e desktop) o estado sai como **mais uma legenda cinza empilhada** abaixo das outras, no mesmo tamanho e na mesma cor de todo o resto.

## O que já existe hoje (não invente do zero — corrija)

**Cartão / linha da lista de Produtos** (`features/catalog/catalog-panel.tsx`, `features/catalog/products-panel.tsx`) — o que se empilha hoje, tudo em coluna, dentro de um `tf-card`:

| ordem | conteúdo | como é hoje |
|---|---|---|
| 1 | nome do produto — "Base hexagonal" | forte, `--text-strong` |
| 2 | resumo das referências — "PLA Branco · Ender 3" | legenda `--text-muted` |
| 3 | o aviso — "Vincule um filamento e uma impressora salvos" | → **legenda cinza igual à de cima**, quando o desenho manda badge `danger` |
| 4 | "pode estar desatualizada" (cache antigo) | legenda cinza |
| 5 | "somente leitura" (Premium pausado) | legenda cinza |

→ Nos piores casos são **quatro linhas cinzas idênticas** competindo pelo mesmo peso visual; o único aviso acionável some no meio.
→ O resumo da linha, quando degrada, vira literalmente **"manual · manual"** (ou "PLA Branco · manual"). Não há rótulo dizendo qual é filamento e qual é impressora — a ordem é fixa (filamento · impressora) mas invisível para quem lê.
→ Enquanto os caches irmãos carregam, o mesmo resumo vira **"carregando… · carregando…"**. É honesto na intenção (não afirmar "manual" sem saber) e ruim na forma: parece a interface travada. Precisa de uma forma própria de *ainda não sei*, não de uma palavra.

**Ficha da direita, desktop** (`catalog-panel.tsx`, ficha de produto/kit): kicker "Produto salvo", título com o nome, ações Duplicar/Excluir, e — logo abaixo do cabeçalho — o alerta `tf-alert` com tom **info** e a frase "Vincule um filamento e uma impressora salvos" (sem corpo). Depois, o resumo repetido ("manual · manual") e o botão secundário "Abrir para editar". Para produto e kit a ficha **só resume**, não edita (decisão do dono, clarify 2026-08-10).

**Editor de página cheia do produto** (`pages/catalogo/produto-page.tsx`, ~linhas 278-284): o mesmo alerta, tom **info**, título "Vincule um filamento e uma impressora salvos" e corpo **"Os valores atuais foram mantidos e continuam editáveis."**, colocado logo abaixo do `PageHeader` e acima do cartão de nome/salvar. Mais abaixo, os dois seletores de referência, cujo item vazio aparece como **"— Manual —"** quando o produto já estava manual.
→ O corpo existe só aqui. Ou ele é bom em todo lugar, ou não é bom em nenhum: a mesma verdade contada em duas extensões diferentes conforme a tela.

## Conteúdo e dados reais
- Frase única do estado (homologada, **não reescreva**): **"Vincule um filamento e uma impressora salvos"**.
- Corpo hoje exclusivo do editor: **"Os valores atuais foram mantidos e continuam editáveis."**
- Texto do badge, definido no canvas: **"precisa de atenção"**, minúsculas, tom `danger`.
- Resumo degradado: **"manual"** por referência ausente, unidas por " · ".
- Placeholder de resolução: **"carregando…"**.
- Vizinhos: "pode estar desatualizada" · "somente leitura" · "Premium pausado" (título de alerta info, no editor).
- Ações próximas: "Abrir para editar" (ficha), "Salvar produto", "Duplicar", "Excluir".
- Regra que dispara o estado: **falta o filamento OU falta a impressora** — não precisa faltar os dois. Some no instante em que os dois estiverem ligados.
- Números verdadeiros para as pranchetas (do canvas e do seed): produto "Base hexagonal" — Gramas usadas **26 g**, Tempo de impressão **1,75 h**, Taxa de falha **10 %**, custo **R$ 12,10**; e um produto saudável ao lado, "Vaso G", preço sugerido **R$ 24,24**. Use pelo menos um nome longo de verdade ("Suporte de celular articulado com base pesada") para provar que nome + badge convivem sem estourar.
- O que o estado **não** mostra: preço na linha da lista. Uma linha de lista nunca exibe preço (implicaria um valor congelado que não existe).

## Estados obrigatórios
1. **Repouso, produto saudável** — sem badge, resumo com os dois nomes reais ("PLA Branco · Ender 3").
2. **Precisa de atenção, os dois faltando** — badge `danger` "precisa de atenção" + resumo "manual · manual".
3. **Precisa de atenção, só um faltando** — badge igual, resumo "PLA Branco · manual". Mostre como o desenho deixa claro **qual** dos dois falta.
4. **Resolvendo referências (carregando)** — o estado que hoje escreve "carregando…". Desenhe a forma neutra: nem "manual", nem badge de atenção, nem cara de erro. O badge só pode aparecer depois que a resposta chegou.
5. **Hover / foco por teclado / pressionado** no cartão inteiro (o cartão é um botão): foco visível com anel, sem depender de cor sozinha.
6. **Atenção + cache antigo** — badge + "pode estar desatualizada" convivendo, com hierarquia decidida.
7. **Atenção + Premium pausado** — badge + "somente leitura" no cartão; no editor, o alerta de atenção acima do alerta info "Premium pausado". Diga qual vem primeiro e por quê.
8. **Ficha da direita (desktop) com atenção** — `tf-alert--info` sob o cabeçalho, com a frase; e o mesmo produto sem atenção, para comparação.
9. **Editor de página cheia com atenção** — alerta no topo, e o par de seletores mostrando "— Manual —".
10. **Estado resolvido ao vivo** — o momento imediatamente após ligar as duas referências: o aviso sai. Desenhe o "depois" para provar que o estado é derivado, não um carimbo.

## Viewports
- **Mobile 390px** — obrigatório: a lista de Produtos e o editor de página cheia são a jornada principal do vendedor. É onde as legendas empilhadas mais machucam e onde o badge tem menos largura para conviver com um nome longo.
- **Desktop 1280px** — obrigatório: é o corte do mestre-detalhe (lista em duas colunas de cartões + ficha de 560px). O cartão fica estreito de novo: badge e nome disputam a mesma linha.
- **Desktop 1920px** — desejável, uma prancheta: mostrar que o badge não fica órfão numa linha larga demais.

## Regras que o desenho não pode quebrar
- **Não vender falha de rede como estado do dado.** "carregando…" e "precisa de atenção" são coisas diferentes; e "pode estar desatualizada" (cache) não é atenção.
- **Procedência antes de afirmação.** Só se pode escrever "manual" depois de saber que a referência não existe. A forma de carregamento não pode ser confundível com o resultado.
- **A degradação é dita, nunca escondida.** O produto continua calculando com os valores que tem; o aviso explica, não bloqueia.
- **Uma verdade, uma copy.** A mesma situação não pode ter frase curta numa tela e frase longa em outra sem motivo declarado.
- **Frase honesta nunca dentro de placeholder** — "— Manual —" é rótulo de opção, e o aviso precisa existir fora dele.
- **Alvo tocável ≥ 44px** no cartão e nos botões; o badge não é alvo.
- **Contraste medido contra o fundo real** do cartão nos dois temas — o tom `danger` sobre `surface-card` no tema claro é o caso a verificar.
- **Premium pausado não é punição**: leitura completa, tom calmo, escrita interceptada no toque e não no "Salvar".

## Armadilhas já pagas neste projeto
- **Legendas empilhadas do mesmo peso**: já aconteceu neste mesmo cartão — o aviso vira ruído. O badge existe justamente para quebrar isso.
- **Overflow horizontal medido**: nome longo + badge na mesma linha estourou coluna em 016; meça a caixa, não confie em "o texto aparece".
- **Texto ocluso passa em teste**: um elemento visualmente coberto ainda satisfaz asserção de conteúdo. O desenho tem que provar a hierarquia com geometria, não com presença.
- **Placeholder que corta a frase**: em 016 a frase honesta ficou dentro de um campo estreito e foi clipada. Frases honestas moram em elementos de largura cheia; placeholders carregam só números/nomes.
- **Máscara/valor grande estoura a coluna**: use "R$ 1.234,56" em pelo menos um cartão de comparação.

## Entregável
Pranchetas: (1) lista de Produtos em **390px** com quatro cartões — saudável, atenção total, atenção parcial, resolvendo; (2) a mesma lista em **1280px** no mestre-detalhe, com a ficha da direita aberta no produto em atenção; (3) o **editor de página cheia** em 390px e 1280px com o alerta e os dois seletores; (4) a variação "atenção + cache antigo + Premium pausado" no cartão; (5) o "depois" do estado resolvido. Cada prancheta em **tema escuro (padrão) e tema claro (first-class)**.
Reutilize os primitivos existentes, sem criar novos: `tf-card` / `tf-card--interactive` para o cartão-botão da lista; `tf-badge` com a variante **`tf-badge--danger`** (ela já existe no DS, ao lado de `neutral`, `info`, `success`) para "precisa de atenção"; `tf-alert` / `tf-alert--info` com `tf-alert__icon` + `tf-alert__title` para a ficha e o editor; `tf-field` + `tf-inputwrap` + `tf-select` para os dois seletores de referência; `tf-btn--secondary` para "Abrir para editar" e `tf-btn--primary` para "Salvar produto"; `tf-tnum` em qualquer número. Se o estado de carregamento pedir uma forma nova (skeleton de linha, por exemplo), proponha-a como variação de `tf-card`, não como componente novo.

## Perguntas em aberto para o dono
1. Quando falta **só um** dos dois (só a impressora, por exemplo), a frase continua sendo "Vincule um filamento e uma impressora salvos"? Ela pede duas coisas quando só uma está faltando. Manter uma frase única (mesmo remédio declarado) ou desenhar uma segunda variação nomeando o que falta?
2. O corpo "Os valores atuais foram mantidos e continuam editáveis." deve aparecer também na **ficha do desktop**, ou o alerta curto da ficha é intencional porque a ficha só resume e a edição acontece no editor?
3. O badge `danger` "precisa de atenção" fica lado a lado com "somente leitura" (Premium pausado) — dois selos no mesmo cartão, ou um deles vence e some?
4. O estado de resolução deve mostrar **skeleton** (forma sem texto) ou uma palavra neutra? Trocar "carregando…" por forma resolve o "parece defeito", mas muda o que um leitor de tela anuncia.
