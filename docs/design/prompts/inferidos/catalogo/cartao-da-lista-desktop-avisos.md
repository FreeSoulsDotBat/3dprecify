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

- **Onde vive:** Rota /catalogo a partir de 1280px: é o item da lista da coluna esquerda do mestre-detalhe (`.tf-catalog-md__card`) — uma coluna de cartões, ou duas colunas a partir de 1600px.
- **Como o vendedor chega:** O vendedor varre a lista com os olhos ou usa a busca logo acima; clicar num cartão SELECIONA (não navega), e a ficha à direita troca no mesmo instante.
- **Vizinhança imediata:** Acima do primeiro cartão: a barra de busca + contagem + "Adicionar". À direita da coluna inteira: a ficha de 560px, onde o cartão clicado é espelhado. Dentro do cartão, empilhados em coluna com gap pequeno: o nome em semibold, o resumo em caption e — no MESMO estilo caption cinza, sem hierarquia e sem limite de coexistência — a nota "Vincule um filamento e uma impressora salvos", o "pode estar desatualizada" (offline) e o "somente leitura" (Premium pausado). Não há selo, não há linha de dinheiro, e o cartão selecionado se distingue por borda de destaque e fundo suave.
- **Dados que chegam (e o que ela devolve):** Nome e resumo da seção corrente, mais três sinalizadores externos: a nota de atenção (produto sem vínculos), o sinal de leitura desatualizada (cache servido porque a leitura online falhou) e o de plano pausado. Nenhum preço chega aqui de propósito — um preço na linha implicaria um valor guardado, e nada é guardado.
- **O que acontece depois:** Clicar seleciona: a ficha da direita passa a mostrar aquele item (formulário para filamento/impressora, resumo para produto/kit). Nada é escrito e a URL não muda — a seleção é efêmera e morre ao trocar de seção.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Cartão do item na lista do Catálogo (desktop) e seus avisos

## O que desenhar
O cartão de um item salvo dentro da lista da esquerda do mestre-detalhe do Catálogo no desktop
(≥1280px), nas quatro seções da aba: Filamentos, Impressoras, Produtos e Kits. É o objeto que o
vendedor varre com os olhos e clica para trazer o item para a ficha de 560px à direita — ele
carrega nome, resumo do item e, quando existe, um ou mais **avisos honestos** sobre o estado
daquele item ou daquela lista (item degradado, catálogo possivelmente desatualizado, conta com
Premium pausado). Desenhe o cartão em todos os seus estados e, sobretudo, **a hierarquia dos
avisos** — inclusive quando mais de um aparece ao mesmo tempo.

## Por que este prompt existe
O cartão FOI desenhado no canvas de 018 (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`,
linhas 104–114): nome em negrito, um `tf-badge` no canto superior direito e uma linha de meta
abaixo. O canvas prova os dois rótulos: `badge: "somente leitura", tone: "neutral"` no TPU Flex e
`badge: "precisa de atenção", tone: "danger"` na Base hexagonal. **O que foi construído não é
isso**: o cartão implementado empilha até quatro `<span>` com o MESMO estilo cinza de legenda —
resumo, nota do item, aviso de desatualizado e aviso de somente leitura — sem badge nenhum e sem
hierarquia. O aviso mais importante desce para a quarta linha, com o mesmo peso do resumo. Então
aqui não se desenha do zero: **executa-se o desenho que existe e resolve-se o que ele não cobre** —
a coexistência de DOIS ou TRÊS avisos no mesmo cartão (o canvas só mostra um badge por vez), e a
linha de dinheiro que o canvas inventou para Produtos, que **contraria FR-310** (ver abaixo).

## O que já existe hoje (não invente do zero — corrija)
O cartão é um `tf-card tf-card--interactive`, coluna, `gap` de 4px, largura total, `text-align:
left`, `overflow-wrap: anywhere`. Ordem atual de dentro para fora:

| # | Conteúdo | Estilo hoje | Observação |
|---|---|---|---|
| 1 | Nome do item | semibold, `--text-strong` | livre, digitado pelo vendedor |
| 2 | Resumo do item | caption, `--text-muted` | varia por seção (tabela abaixo) |
| 3 | Nota do item — `"Vincule um filamento e uma impressora salvos"` | **idêntico ao 2** | só Produtos; derivada, nunca armazenada |
| 4 | `"pode estar desatualizada"` | **idêntico ao 2** | flag da LISTA, não do item |
| 5 | `"somente leitura"` | **idêntico ao 2** | flag da CONTA, não do item |

→ **Problema central:** 3, 4 e 5 são indistinguíveis do resumo. O canvas resolve com badge no
canto superior direito; o código não tem badge nenhum.
→ **Problema 2:** 4 e 5 vêm de estado de LISTA/CONTA e são repetidos em CADA cartão — com 40
filamentos, "somente leitura" aparece 40 vezes. Ninguém desenhou se isso é por cartão ou uma
faixa única acima da lista.
→ **Problema 3:** o canvas desenha, para Produtos, `money: "custo R$ 21,84 · varejo R$ 65,52"`.
**Aqui o desenho é que está errado**: `product-summary.ts` proíbe preço na linha de um produto
("a row price would imply a stored snapshot", FR-310). Produto na lista mostra procedência
(nomes do filamento e da impressora), nunca preço.
→ **Problema 4:** hoje o cartão não tem badge, não tem canto superior direito e não tem linha de
dinheiro própria; para Filamentos e Impressoras o dinheiro já vive *dentro* do resumo cinza.

Ao redor: acima da lista há a barra com busca (`"Buscar no catálogo…"`), a contagem
(`"{n} filamento(s)"`) e o botão `Adicionar filamento`; à direita, colada no topo, a ficha de
560px do item selecionado. A lista é **1 coluna** entre 1280 e 1599px e **2 colunas** a partir de
1600px.

## Conteúdo e dados reais
Resumo (linha 2) por seção, com valores verdadeiros de como o app formata hoje:

| Seção | Resumo real | Exemplo |
|---|---|---|
| Filamentos | `{material} · R$ {custo} / {peso} kg` | `PLA · R$ 89,90 / 1 kg` |
| Impressoras | `R$ {valor} · {vida} h · {potência} kW` | `R$ 2.400,00 · 4680 h · 0,12 kW` |
| Produtos | `{filamento} · {impressora}` | `PLA Prata 1kg · Ender 3 V3` · degradado: `manual · manual` · carregando: `carregando… · carregando…` |
| Kits | `{n} peça(s)` | `3 peça(s)` |

- Dinheiro sempre com máscara de milhar (`R$ 2.400,00`). → **Grandezas não-monetárias hoje saem
  sem máscara** (`4680 h`); trate isso como problema a resolver no desenho da linha de meta.
- Nome do item é texto livre do vendedor: pode ser `PLA Prata 1kg` ou 500 caracteres sem espaço.
- Rótulos literais dos avisos, homologados, **use exatamente estes**: `"Vincule um filamento e uma
  impressora salvos"` · `"pode estar desatualizada"` · `"somente leitura"`. Os rótulos de badge do
  canvas: `"somente leitura"` (neutro) e `"precisa de atenção"` (danger).
  → `"precisa de atenção"` (badge do canvas) e `"Vincule um filamento e uma impressora salvos"`
  (frase do código) são o MESMO estado: o badge nomeia, a frase instrui. Desenhe os dois juntos e
  diga onde cada um vive.

## Estados obrigatórios
1. **Repouso** — nome + resumo. Sem badge.
2. **Selecionado** — hoje: borda `--accent` e fundo `--accent-soft`. É o item que está na ficha à
   direita; precisa ser inequívoco a três metros e não pode depender só de cor.
3. **Hover** e **pressionado** — o cartão inteiro é o alvo clicável (não há botão dentro dele no
   desktop; editar/duplicar/excluir vivem no cabeçalho da ficha).
4. **Foco de teclado** — o cartão é um `<button>`; o anel precisa aparecer inteiro, incluindo no
   cartão selecionado, onde a borda já é `--accent`.
5. **Precisa de atenção** (só Produtos) — badge danger `"precisa de atenção"` + a frase
   `"Vincule um filamento e uma impressora salvos"`. O resumo desse item lê `manual · manual`.
6. **Lista desatualizada** — `"pode estar desatualizada"`. A leitura online falhou e o cache do
   aparelho respondeu: os dados são reais, só possivelmente velhos. Tom informativo, nunca danger.
7. **Referências carregando** — resumo `carregando… · carregando…`. Nunca cair para `manual`
   enquanto carrega: `manual` é uma afirmação sobre a procedência do dado, não um spinner.
8. **Premium pausado** — badge/aviso `"somente leitura"`. O item continua clicável e a ficha abre
   completa: o que some é criar/editar/excluir. **Não desabilite o cartão.**
9. **Dois e três avisos juntos** — Produto degradado, em lista desatualizada, com Premium pausado.
   Este é o caso que ninguém desenhou e é o que este prompt precisa resolver.
10. **Nome extremo** — 500 caracteres sem espaço, e nome de 3 caracteres.
11. Fora do cartão, mas na mesma prancheta para contexto: **carregando** (spinner no lugar da
    lista), **erro** (`"Não foi possível carregar seu catálogo."` + `Tentar novamente`) e
    **busca sem resultado** (`"Nada encontrado para essa busca"` / `"Tente outro termo, ou limpe a
    busca para ver tudo de novo."` / `Limpar busca`).

## Viewports
- **1280px** — lista em 1 coluna, ficha de 560px à direita. O cartão fica largo e baixo; é aqui
  que o badge no canto superior direito tem mais espaço e mais risco de parecer solto.
- **1920px** — lista em 2 colunas (regra ativa a partir de 1600px). O cartão fica estreito; teste
  aqui a convivência de badge + nome longo + linha de meta na mesma largura.
Mobile 390px **não** entra: abaixo de 1280px o app monta outra árvore e este componente nem existe.
O cartão da lista mobile tem o mesmo empilhamento cinza, mas **o mobile não se mexe neste
incremento** — se a solução for portável, diga; não redesenhe o mobile.

## Regras que o desenho não pode quebrar
- **Produto na lista não mostra preço** (FR-310). Preço de produto só existe onde há orçamento
  salvo; uma linha de dinheiro no cartão sugere um snapshot que não existe.
- **Degradação dita, não escondida**: `manual · manual` e `"precisa de atenção"` são informação
  honesta, não erro do usuário — tom firme, sem alarme vermelho piscante.
- **Falha de rede nunca vendida como falta de Premium**: `"pode estar desatualizada"` e
  `"somente leitura"` são estados diferentes e não podem compartilhar cor, ícone ou posição.
- **Premium pausado é calmo, não punitivo**: os itens continuam ali e continuam servindo ao
  cálculo.
- Frase honesta em elemento de largura cheia — nunca dentro de um placeholder nem cortada por
  ellipsis. Se um aviso não couber, o cartão cresce.
- Contraste medido contra o fundo REAL do cartão (que muda no estado selecionado, `--accent-soft`)
  — não contra o fundo da página.

## Armadilhas já pagas neste projeto
- Um nome de filamento com 500 caracteres sem espaço gerou **4.948px de rolagem horizontal a
  1440px** no cartão da lista (a ficha à direita já quebrava, o cartão não). Qualquer coisa nova
  no cartão — badge inclusive — precisa quebrar linha, não empurrar a grade.
- Texto ocluso passa em teste: `toBeVisible` é verdadeiro para um elemento inteiramente coberto.
  Se o badge sobrepuser o nome, nenhum teste pega — só o desenho.
- Valor grande estoura a coluna: `R$ 2.400,00 · 4680 h · 0,12 kW` já é longo; some a máscara de
  milhar e um nome de impressora comprido e a linha de meta precisa de plano de quebra.
- Máscara de milhar perdida (016) — o número não-monetário sai cru hoje.
- "Desenhado e não executado" é o defeito desta própria peça: entregue o desenho com o
  comportamento de cada aviso explícito o bastante para não sobrar espaço para inferência.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como first-class**:
1. O cartão em repouso, hover, foco, pressionado e selecionado — 1280px e 1920px.
2. Os três avisos isolados: precisa de atenção · pode estar desatualizada · somente leitura.
3. **A pilha**: dois avisos juntos e os três juntos, com a hierarquia proposta e uma legenda de uma
   linha explicando qual vence e por quê.
4. O cartão de cada seção com seu resumo real (Filamento, Impressora, Produto, Kit).
5. A lista completa em 1280px e 1920px com um cartão selecionado, mostrando o cartão dentro do
   mestre-detalhe (busca + contagem + botão adicionar acima, ficha de 560px à direita).
6. Nome extremo (500 caracteres sem espaço) em 1920px, duas colunas.
Reutilize os primitivos existentes: `tf-card` / `tf-card--interactive` para o cartão, `tf-badge`
(`--neutral`, `--info`, `--danger`) para os avisos, `tf-tnum` para qualquer número tabular, o anel
de foco padrão, e o `Alert` do DS apenas se a solução for uma faixa acima da lista em vez de marca
por cartão. Não crie primitivo novo — se precisar de um, diga qual e por quê.

## Perguntas em aberto para o dono
1. **Dois avisos no mesmo cartão**: um Produto degradado dentro de uma lista desatualizada e com
   Premium pausado tem três avisos. Um badge só, com precedência (qual vence?), dois badges, ou
   badge para o estado do ITEM e faixa única acima da lista para os estados de LISTA/CONTA?
2. **Repetição**: `"pode estar desatualizada"` e `"somente leitura"` são verdadeiros para a lista
   inteira e hoje se repetem em cada cartão. Devem sair do cartão para uma faixa única?
3. **Kits**: o canvas dá ao kit uma linha `custo R$ 52,34 · varejo R$ 157,02`. FR-310 fala de
   Produtos. Kit mostra dinheiro no cartão da lista, ou segue a mesma regra do produto?
4. **`"precisa de atenção"` vs `"Vincule um filamento e uma impressora salvos"`**: mantemos os dois
   textos (badge nomeia, frase instrui) ou a frase some do cartão e fica só na ficha à direita,
   onde já aparece como `Alert` informativo?
