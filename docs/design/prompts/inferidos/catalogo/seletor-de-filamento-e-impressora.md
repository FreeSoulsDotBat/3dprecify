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

- **Onde vive:** Editor de produto em página cheia (/catalogo?produto=…): é o SEGUNDO cartão da tela, imediatamente abaixo do cartão de nome+Salvar e imediatamente acima da grade de duas colunas com os custos.
- **Como o vendedor chega:** O vendedor está criando ou editando um produto. Em criação, este cartão é obrigatório de fato: sem um filamento E uma impressora escolhidos o salvamento é recusado.
- **Vizinhança imediata:** Dentro do cartão, de cima para baixo: um rótulo de seção ("Usar do catálogo"), uma linha de legenda explicando o que acontece ao escolher, e então uma grade com DOIS seletores lado a lado — "Filamento" à esquerda, "Impressora" à direita. A primeira opção de cada um é vazia: mostra o texto neutro de "escolher", ou vira o rótulo "— Manual —" quando aquele produto perdeu a referência. Não há link "inserir manualmente" separado, nem qualquer marca nos campos abaixo indicando que os valores vieram do catálogo.
- **Dados que chegam (e o que ela devolve):** As listas de filamentos e impressoras salvos (nome e id). Escolher um filamento reescreve os campos de custo do rolo e peso do rolo na coluna esquerda; escolher uma impressora reescreve valor da máquina, vida útil, consumo médio e reserva de manutenção — tudo em silêncio, sem aviso de que valores digitados à mão foram sobrescritos.
- **O que acontece depois:** O preço no rodapé se recalcula imediatamente com os novos valores. Vincular AMBOS faz o alerta de atenção do topo desaparecer na hora, antes mesmo de salvar. Salvar grava o vínculo, e a partir daí o produto acompanha o catálogo: mudar o preço do rolo lá muda o preço deste produto ao reabri-lo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Seletor "Usar do catálogo" dentro do editor de produto

## O que desenhar
O cartão que liga o catálogo salvo ao cálculo de um produto: dois seletores — **"Filamento salvo"** e
**"Impressora salva"** — no topo do editor de página cheia de Produto (`apps/web/src/pages/catalogo/
produto-page.tsx`, o formulário que abre em `/catalogo/produtos/novo` e `/catalogo/produtos/{id}`),
logo abaixo do cartão de nome + "Salvar produto" e acima das duas colunas de custos/markup. Quem usa:
o vendedor premium que já cadastrou filamentos e impressoras e agora quer que um produto herde esses
números. O momento é decisivo: **escolher um item aqui reescreve seis campos de custo do formulário
abaixo**, e é também o único lugar onde o produto pode ficar **sem vínculo** ("— Manual —"). Desenhe o
cartão inteiro com todos os seus estados, e a saída "manual" como afordância explícita.

## Por que este prompt existe
O protótipo de 2026-07-02 (§E4, linhas 245-246) especificou "dropdowns Filamento ▾ e Impressora ▾ (puxam
do catálogo) **+ link 'inserir manualmente' como fallback SEMPRE DISPONÍVEL**", e §F item 4 repetiu a
interação. A dupla de selects, portanto, tem desenho. **O código contraria a regra explícita**: o link
sempre disponível virou uma *opção dentro do select* — e uma opção que só aparece com o rótulo
"— Manual —" quando o vínculo **já foi perdido**. Nunca foram desenhados: o cartão-invólucro com título
e dica, a marca (inexistente) de que um campo veio do catálogo, e **a sobrescrita silenciosa** dos
valores digitados. O canvas do 018 desenha os dois selects, mas dentro de um bloco "Referências" da
ficha de 560px — outra superfície, menor, que não é esta.

## O que já existe hoje (não invente do zero — corrija)

| Parte | Conteúdo literal hoje |
|---|---|
| Título do cartão | "Usar do catálogo" |
| Legenda | "Preenche os campos com o item salvo — você ainda pode editar tudo." |
| Select 1 | rótulo "Filamento salvo" (rótulo justo), caret `▾`, primeira opção "Escolher…" |
| Select 2 | rótulo "Impressora salva" (rótulo justo), caret `▾`, primeira opção "Escolher…" |
| Opções | os nomes salvos pelo vendedor: "PLA Preto 1kg", "PETG Branco", "Ender 3 V2", "Bambu A1" |
| Primeira opção, quando o vínculo se perdeu | "— Manual —" no lugar de "Escolher…" |
| Aviso acima do cartão (produto sem vínculo) | `Alert tone="info"`, título "Vincule um filamento e uma impressora salvos", corpo "Os valores atuais foram mantidos e continuam editáveis." |
| Premium pausado | o cartão inteiro fica inerte dentro de um `fieldset` desabilitado; acima, "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." |

→ **A saída manual só existe depois do estrago.** Num produto novo ou vinculado, não há nenhuma forma
visível de dizer "quero digitar à mão"; a opção "— Manual —" nasce apenas quando o vínculo já sumiu.
O desenho precisa da afordância de saída **sempre presente**, como o protótipo pediu.

→ **Escolher sobrescreve em silêncio.** Não há aviso antes, confirmação, desfazer, nem qualquer marca
de que os campos abaixo foram reescritos. O vendedor que ajustou "Custo do rolo" para R$ 129,90 e depois
trocou de filamento perde o valor sem ver nada acontecer — a mudança ocorre longe dos olhos, em outro
cartão, possivelmente fora da tela no mobile.

→ **Nada diz que um campo veio do catálogo.** Depois do preenchimento, "Custo do rolo" é um input
comum, idêntico a um digitado à mão. Editá-lo **não** desfaz o vínculo: o produto continua salvo
apontando para o filamento, com um número que discorda dele — e ninguém é avisado.

→ **Falta o estado de falha de leitura que a tela irmã tem.** Em Calcular existe
`Alert tone="danger"` com "Não foi possível carregar seus itens salvos agora." + botão "Tentar
novamente". Aqui não existe. Pior: no produto **novo**, uma lista vazia por *falha de rede* cai na
mesma tela de pré-requisito que diz **"Para criar um produto, salve antes um filamento e uma impressora
no catálogo."** — uma frase falsa para quem tem dez filamentos salvos e está sem conexão.

→ **Não há estado de carregando.** Enquanto as listas chegam, os selects já aparecem só com "Escolher…",
indistinguível de "catálogo vazio". O produto já tem a palavra certa para isso em outro lugar:
"carregando…".

## Conteúdo e dados reais
Escolher um **filamento** escreve dois campos: "Custo do rolo" (dinheiro, obrigatório, ex.:
`R$ 129,90`; padrão do app `R$ 100,00`) e "Peso do rolo" (kg, obrigatório, maior que zero, ex.: `1`).
Escolher uma **impressora** escreve quatro: "Valor da máquina" (`R$ 4.000,00`), "Vida útil da máquina"
(horas, ex.: `3600`), "Consumo médio" (kW, ex.: `0,12`) e "Reserva de manutenção" (R$/hora, ex.:
`R$ 0,00` — opcional, pode vir zerada). Os dois selects são independentes e opcionais entre si: dá para
vincular só a impressora. Num produto **novo**, salvar exige os dois vínculos; num produto **já salvo**,
qualquer um pode ficar sem vínculo, e aí os valores permanecem editáveis. Escolher a opção vazia
desvincula e **mantém** os números que estão na tela — não limpa nada. Listas típicas: 3 a 12 itens;
nomes de até ~40 caracteres, sem truncamento previsto hoje.

## Estados obrigatórios
1. **Repouso, vinculado** — os dois selects mostrando os nomes escolhidos; nenhum aviso.
2. **Repouso, produto novo** — ambos em "Escolher…"; a saída manual visível mesmo assim.
3. **Foco** — anel de foco visível no select nativo, sem deslocar o caret `▾`.
4. **Hover / pressionado** — no select e na afordância de saída manual.
5. **Carregando** — listas ainda chegando: o campo diz "carregando…", **nunca** "— Manual —" nem
   "Escolher…" (dizer "manual" é uma afirmação sobre a procedência do dado, não um spinner).
6. **Vazio de verdade** (o vendedor não salvou nada) — hoje o cartão some em silêncio; decida o que
   aparece, sem sugerir que houve erro.
7. **Falha de leitura sem cache** — "Não foi possível carregar seus itens salvos agora." + "Tentar
   novamente"; jamais a frase de pré-requisito.
8. **Sem vínculo / degradado** — a opção "— Manual —" selecionada + o alerta info "Vincule um filamento
   e uma impressora salvos" / "Os valores atuais foram mantidos e continuam editáveis.". O alerta some
   **no instante** em que os dois vínculos existem, antes de salvar.
9. **Premium pausado (somente leitura)** — os dois selects desabilitados e legíveis, com "Premium
   pausado" acima; a leitura e o recálculo continuam completos.
10. **Momento da sobrescrita** — o estado que hoje não existe: o que o vendedor vê no segundo em que
    seis campos mudam de valor.
11. **Offline** — leitura do catálogo salvo funciona; escrever exige conexão ("Modo leitura offline" /
    "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão.").

## Viewports
**390px (mobile)** e **1280px (desktop)** — o editor de página cheia existe nos dois, e o 018 manteve
deliberadamente a página cheia em vez de recompor o formulário dentro da ficha de 560px. No mobile os
dois selects empilham e os campos que eles reescrevem ficam **abaixo da dobra** — é onde a sobrescrita
silenciosa dói mais, então desenhe esse recorte. No desktop o cartão ocupa a largura toda, acima da
grade de duas colunas (custos à esquerda, markup/marketplace à direita); mostre a relação espacial
entre o seletor e os campos que ele altera. 1920px opcional, só se a faixa mudar de proporção.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca vira outra história**: nem "você não tem itens", nem "não é premium".
- **Procedência do número**: se um valor veio do catálogo, o desenho pode dizer isso; se foi editado
  depois, não pode continuar afirmando que veio.
- **Degradação dita, não escondida**: "sem vínculo" é um estado calmo e nomeado, com os valores
  preservados — nunca um campo em branco nem um erro.
- **A frase honesta vive em elemento de largura cheia**, nunca dentro do `placeholder` de um campo
  (isso já foi pago em 016: o sufixo é cortado).
- **Freemium binário**: grátis/deslogado não vê meio-seletor; premium pausado **lê tudo**.
- Alvo tocável ≥44px em ambos os selects e na saída manual; contraste medido contra o fundo real do
  cartão, nos dois temas.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido**: nome longo de filamento dentro de um select em 390px — mede-se a
  caixa, não o texto; `toBeVisible` passa em elemento estourado.
- **Placeholder que corta a frase** (016): qualquer explicação dentro do campo é perdida.
- **"manual" como fallback de carregamento** (013/FB-04): já foi corrigido na lista, não reintroduza no
  seletor.
- **Cartão que simplesmente some** (016/T072-A8): o desaparecimento silencioso foi o defeito, não a
  solução.
- **Valor grande estourando coluna**: `R$ 4.000,00` e `3600` convivem na mesma faixa de campos
  reescritos.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class)**: (a) o cartão em repouso
vinculado, mobile e desktop; (b) o cartão com a saída manual sempre visível — sua proposta de forma para
o "inserir manualmente" do protótipo; (c) o momento da sobrescrita (a peça nova a inventar); (d) os
estados carregando / falha com "Tentar novamente" / sem vínculo com o alerta info / premium pausado;
(e) o recorte mobile mostrando seletor + campos reescritos na mesma coluna. Reutilize os primitivos:
`tf-card` (padding md) para o invólucro, `tf-field` + `tf-field__label--tight` para os rótulos,
`tf-inputwrap`/`tf-selectwrap` + `tf-select` com o caret `▾` para os seletores, `tf-alert--info` para
"Vincule um filamento e uma impressora salvos", `tf-alert--danger` para a falha de leitura,
`tf-button--secondary` `sm` para "Tentar novamente". Não crie primitivo novo — se a marca de
procedência precisar de um, proponha-a como variação de um existente e diga qual.

## Perguntas em aberto para o dono
1. **A saída manual é link, botão ou opção do select?** O protótipo pediu "inserir manualmente" sempre
   disponível; o código entregou uma opção que só aparece depois de perder o vínculo. Qual das duas
   vale — e, se for a do protótipo, ela desvincula mantendo os valores (comportamento atual) ou limpa?
2. **O que acontece quando escolher um item sobrescreveria um valor editado à mão?** Avisar antes
   (confirmação), avisar depois (com desfazer), ou sobrescrever e apenas marcar os campos como vindos
   do catálogo? Cada opção dá um desenho diferente.
3. **Um produto vinculado cujos números foram editados continua vinculado?** Hoje sim, em silêncio — o
   produto aponta para o filamento e guarda valores que discordam dele. Isso é intencional?
4. **No produto novo sem nenhum item salvo, o editor deve continuar bloqueado** pela tela de
   pré-requisito, ou abrir com o caminho manual liberado e o catálogo como atalho opcional?
