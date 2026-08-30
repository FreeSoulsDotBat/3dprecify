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

- **Onde vive:** Rota /catalogo a partir de 1280px, seções PRODUTOS e KITS: é a coluna direita fixa de 560px do mestre-detalhe (`aside.tf-catalog-md__detail`), grudada abaixo da goteira do topo e com rolagem própria quando o conteúdo passa da altura da janela.
- **Como o vendedor chega:** O vendedor clica num cartão da lista à esquerda. Nas seções Filamentos e Impressoras esta mesma coluna abriga o formulário de edição; em Produtos e Kits ela não edita — só resume.
- **Vizinhança imediata:** À esquerda, a 24px de distância: a coluna da lista com sua barra de busca. Dentro da ficha, de cima para baixo: cabeçalho com o rótulo em caixa alta ("Produto salvo" / "Kit salvo") sobre o nome do item à esquerda, e à direita, no mesmo alinhamento, os botões-ícone ghost (copiar, só em Kits; lixeira sempre). Abaixo: um alerta informativo quando o item pede atenção; depois um alerta vermelho se um salvamento pela ficha falhou; e então o corpo — que hoje é UMA linha em caption repetindo o MESMO resumo já lido no cartão (para produto, só os nomes das referências: "PLA Prata · Ender 3 V3", sem custo, preço, gramas ou tempo) e, abaixo dela, um botão secundário "Abrir para editar" com ícone de lápis.
- **Dados que chegam (e o que ela devolve):** Recebe o item selecionado da lista (nunca uma leitura nova) e o resumo pronto da seção; para kit, a contagem de peças. Nenhum número calculado chega aqui — preço de produto e de kit só existe recalculado ao vivo nos editores.
- **O que acontece depois:** "Abrir para editar" navega: produto vai para o editor de página cheia (`?produto=<id>`, que substitui esta tela inteira), kit vai para /kits com o kit carregado. A lixeira abre o diálogo de exclusão; em Premium pausado ela desvia para a superfície somente-leitura. Trocar de cartão à esquerda troca esta ficha na hora.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Ficha de resumo de Produto e de Kit (coluna direita do Catálogo no desktop)

## O que desenhar

A coluna direita fixa de 560px do Catálogo no desktop (≥1280px), no caso em que o item selecionado é um **Produto** ou um **Kit**. O Catálogo desktop é um mestre-detalhe: à esquerda a lista de cartões com busca e contador, à direita a ficha do item clicado. Para Filamento e Impressora essa coluna É o editor (o mesmo formulário da gaveta, montado ali, com salvar inline). Para Produto e Kit o dono decidiu o contrário: a ficha **não edita** — o formulário completo de Produto continua sendo uma página inteira, e o Kit continua no compositor. Sobra a pergunta que ninguém desenhou: **o que uma ficha de 560px deve mostrar quando ela não edita?** Quem usa: o vendedor premium, dentro da aba Catálogo → seção Produtos ou Kits, no momento em que clica num item salvo para relembrar do que ele é feito antes de abrir o editor, duplicar, excluir ou levar para o cálculo.

## Por que este prompt existe

O que existe hoje foi inferido por IA a partir de texto, não desenhado: a coluna renderiza o kicker ("Produto salvo"), o nome, dois botões de ícone fantasma no canto (copiar/lixeira), **a mesma linha de resumo que o cartão da lista já mostrava** e um botão "Abrir para editar". Para produto essa linha são só os nomes das referências ("PLA Prata · Ender 3 V3") — nenhum número: nem gramas, nem tempo, nem custo, nem preço. Meia tela mostrando menos do que o cartão que o vendedor acabou de clicar.

`PROTOTIPO_PARCIAL`: o canvas de 2026-08 (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) desenha SIM um `<aside>` único servindo as quatro seções, e dá a produto e kit os mesmos campos que dá a filamento/impressora — produto: Nome do produto, Gramas usadas, Tempo de impressão, Taxa de falha, com um bloco "Referências" (filamento, impressora) e um alerta quando falta vínculo; kit: Nome do kit, Peças, Custo total, Markup varejo; rodapé "Salvar alterações" + "Usar no cálculo"; cabeça com "Duplicar" e "Excluir" como botões **de texto**. Ou seja: o desenho existente é mais rico que o construído — mas ele desenha uma ficha que EDITA, e a decisão do dono (registrada só em texto, `research.md` §E: "Rejeitado: recompor o formulário completo de Produto dentro de 560px") tornou essa ficha somente-leitura. Texto de decisão não é desenho. **O buraco é exatamente a ficha de leitura.**

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/catalog/catalog-panel.tsx` (ramo `else` da ficha), `products-panel.tsx`, `kits-panel.tsx`, `catalog-master-detail.css`.

| Elemento | Texto/valor literal hoje | Observação |
|---|---|---|
| Kicker | "PRODUTO SALVO" / "KIT SALVO" | caption, maiúsculas, letter-spacing 0.06em, cor `--text-muted` |
| Título | nome do item, ex.: "Suporte de fone" | `--fs-lg`, quebra em qualquer ponto (`overflow-wrap: anywhere`) |
| Ações no canto | dois botões **ícone fantasma**: copiar (só em Kits) e lixeira | → o canvas pedia botões de TEXTO "Duplicar"/"Excluir"; hoje só existe `aria-label` |
| Resumo | Produto: "PLA Prata · Ender 3 V3" · Kit: "3 peça(s)" | → **é a repetição literal do cartão da lista** |
| Nota (condicional) | "Vincule um filamento e uma impressora salvos" | Alert tom `info`, só em produto degradado/manual |
| Erro inline | frase honesta do servidor | Alert tom `danger` |
| Ação | "Abrir para editar" (Button secundário + ícone lápis) | leva à página cheia (`?produto=…`) ou ao compositor (`/kits?id=…`) |

→ Problemas a resolver no desenho: (1) 560px repetindo uma linha de 40 caracteres; (2) nenhum dado próprio da peça (gramas, tempo, falha, markup, peças do kit); (3) "Duplicar" só existe em Kit e só como ícone — Produto não tem duplicar nenhum; (4) "Excluir" mora ao lado de "Duplicar" com o mesmo peso visual, sem nada que diga que uma é destrutiva; (5) o canvas prometia "Usar no cálculo" e isso **não existe** na peça construída.

## Conteúdo e dados reais

Dados que o Produto salvo realmente carrega (wire `ProductOut`) e que hoje não aparecem:

- **Gramas impressas** — obrigatório, ex.: `45 g` (faixa real 1–2000 g)
- **Tempo de impressão** — obrigatório, guardado em horas decimais (`3.5`) e exibido no app como **"3 h 30 min"** (regra do 016/PR-C: horas decimais nunca aparecem cruas)
- **Taxa de falha** — opcional, ex.: `5 %`
- **Acabamento** — opcional: tempo (`0 h 30 min`) e valor por hora (`R$ 25,00/h`)
- **Mão de obra** — opcional: horas e valor por hora
- **Markup varejo / atacado** — obrigatórios, ex.: `120 %` e `60 %`
- **Tarifa de energia** — ex.: `R$ 0,92/kWh`
- **Referências** — filamento e impressora pelo NOME ("PLA Prata", "Ender 3 V3"); quando o vínculo não existe, a palavra literal é **"manual"**; enquanto as listas irmãs carregam, é **"carregando…"** (nunca "manual", que seria uma afirmação falsa sobre a procedência do dado)
- **Marketplace** — o produto pode ter canais salvos e custos adicionais ("outros custos")
- **Datas** — `createdAt` / `updatedAt` existem no wire e não são mostrados em lugar nenhum

Kit salvo (`BomOut`): nome, **linhas** com `quantidade`, `nome da peça` e um sinal `degradado` por linha (peça cujo produto de catálogo sumiu), ex.: "2× Base · 1× Tampa · 4× Pino". Um kit **nunca guardou preço** (FR-407: o preço é sempre recalculado ao abrir), então a ficha não pode exibir um valor "salvo" de kit.

## Estados obrigatórios

1. **Repouso — produto completo**: kicker, nome, dados da peça, referências resolvidas por nome.
2. **Repouso — kit**: kicker, nome, contagem "3 peça(s)" + a composição das linhas.
3. **Produto que precisa de atenção** (`filamentId` ou `printerId` nulos): Alert tom `info` com a frase exata "Vincule um filamento e uma impressora salvos", e as referências lendo "manual". Não é erro, não é vermelho — é um estado honesto e calmo.
4. **Kit com linha degradada**: a peça cujo produto sumiu precisa se declarar na ficha; hoje o `degraded` do wire não aparece em lugar nenhum desta coluna.
5. **Referências carregando**: os nomes lendo "carregando…" (placeholder neutro), o resto da ficha já legível.
6. **Erro de escrita inline**: Alert tom `danger` acima do conteúdo, com a frase que o servidor devolveu; a ficha continua legível.
7. **Offline (modo leitura)**: "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." — tom `info`, nunca `danger`, e a ação de editar precisa dizer o porquê, não sumir sem explicação.
8. **Dado possivelmente velho** (cache): a legenda literal "pode estar desatualizada".
9. **Premium pausado (`lapsed`)**: "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." + a legenda "somente leitura" no item. Ler continua inteiro; a lixeira **não** pode abrir uma confirmação que funciona e depois falhar — o desenho precisa mostrar a interceptação honesta no toque.
10. **Foco / hover / pressionado / desabilitado** dos botões e do link de cada referência.
11. **Nada selecionado**: na prática o código sempre cai no primeiro item da lista visível, então a coluna vazia só existe quando a busca não achou nada — nesse caso a coluna direita some e a esquerda mostra "Nada encontrado para essa busca".

## Viewports

Desenhe **1280px** e **1920px** — a peça só existe acima do corte de 1280px; abaixo dele o componente nem monta esta árvore (no mobile, tocar num produto abre direto a página de edição, e não há coluna nenhuma). **Não desenhe mobile 390px para esta peça.** A diferença entre os dois viewports importa: a partir de 1600px a lista da esquerda vira duas colunas de cartões, e a ficha continua com os mesmos 560px — o desenho a 1920px precisa provar que 560px não parecem vazios ao lado de uma lista mais larga.

## Regras que o desenho não pode quebrar

- **A ficha não edita.** Nenhum campo digitável, nenhum "Salvar alterações". A edição sai daqui para a página cheia. Se o desenho quiser sugerir edição, é através da ação que navega.
- **Procedência do número.** Todo valor mostrado é o que o vendedor salvou, não um cálculo novo. Se a ficha mostrar qualquer número derivado (custo, preço), ele tem que dizer que é recalculado agora — e para kit não existe valor salvo nenhum (FR-407).
- **Nunca um preço de linha.** A lista da esquerda não mostra preço por regra (FR-310); se a ficha mostrar, o desenho precisa marcar visualmente que é outra coisa que a linha.
- **Degradação dita, não escondida**: "manual", "carregando…" e a linha de kit degradada aparecem como texto, não como campo em branco.
- **Falha de rede nunca vendida como falta de premium**: offline é `info` com a frase de offline; premium pausado é a frase de premium. As duas não se misturam.
- **Frase honesta fora de placeholder**: nenhuma dessas frases pode viver dentro de um campo de exemplo — placeholder carrega número, não honestidade.
- **Alvo ≥44px** em todo botão da cabeça da ficha (hoje são ícones `size="sm"`).
- **Contraste medido contra o fundo real do card**, incluindo o estado selecionado com `--accent-soft`.

## Armadilhas já pagas neste projeto

- **Nome comprido estoura a coluna.** Um nome de 500 caracteres sem espaço já gerou 4.948px de rolagem horizontal a 1440px nesta mesma tela. Desenhe a ficha com um nome absurdo (código colado sem espaço) e prove que ele quebra dentro dos 560px.
- **Número grande estoura a coluna.** Mostre a ficha com `R$ 1.234.567,89` e com `12.500 g` — o desenho tem que aguentar o valor grande, não o valor bonito.
- **A coluna fixa criando uma segunda barra de rolagem.** A ficha gruda no topo e só rola por dentro quando é mais alta que a janela. Rolagem horizontal ali é defeito, e headless não desenha barra clássica — meça os dois eixos.
- **Texto ocluso passa em teste.** `toBeVisible` passa em elemento totalmente coberto; o desenho precisa mostrar a hierarquia visual real, não confiar que "está no DOM".
- **Placeholder que corta a frase** (016): frases de honestidade moram em elementos de largura cheia.
- **Ação destrutiva com o mesmo peso da benigna**: excluir ao lado de duplicar, ambos ícones fantasma de 18px, é o convite ao clique errado.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não um afterthought)**:

1. **1280px — Produto salvo, completo**: coluna esquerda (busca + contador + cartões) e a ficha direita cheia.
2. **1280px — Produto que precisa de atenção**: com o Alert `info` e as referências lendo "manual".
3. **1280px — Kit salvo**: com a composição das linhas e uma linha degradada.
4. **1920px — Produto salvo**: lista em duas colunas, ficha nos mesmos 560px.
5. **Estados**: offline em leitura · Premium pausado · erro inline · referências carregando · nome absurdo + valor gigante (a prancheta de estresse).

Reutilize os primitivos existentes, nomeadamente: `tf-card` para a moldura da ficha e para os cartões da lista; o kicker como caption em maiúsculas já existente (`tf-catalog-md__kicker`); `tf-alert` nos tons `info` e `danger` para atenção/offline/pausado/erro; `tf-button` variante `secondary` para a ação principal de navegação ("Abrir para editar"), variante `ghost` para as secundárias e o tratamento destrutivo para excluir; `tf-badge` se precisar marcar "somente leitura" ou uma linha degradada; `tf-input` dentro de `tf-inputwrap` para a busca da esquerda (já existe, não redesenhe). Se um valor monetário aparecer, use o primitivo de preço já existente em vez de tipografia solta. **Não crie primitivo novo** — se algo não couber nos existentes, marque na prancheta e explique por quê.

## Perguntas em aberto para o dono

1. **A ficha pode mostrar dinheiro?** Ela é somente-leitura e o produto guarda entradas, não preço. Mostrar um custo/preço exige recalcular na hora (e dizer isso). O canvas desenhou "Custo total" e "Markup varejo" para kit — mas kit nunca guardou preço. Vale recalcular ao vivo dentro da ficha, ou a ficha fica só com as entradas salvas e o número só existe no editor/cálculo?
2. **"Usar no cálculo" existe?** O canvas desenhou essa ação no rodapé da ficha, e ela não foi construída. É uma ação de verdade (levar o produto/kit direto para a calculadora) ou foi só cenografia do protótipo?
3. **Duplicar em Produto**: hoje só Kit tem duplicar. Produto ganha "Duplicar" também, ou a assimetria é intencional?
4. **Datas**: `criado em` / `atualizado em` existem no dado e nunca foram mostrados. O vendedor quer saber "atualizado em 12/08/2026", ou é ruído?
5. **Quanto do produto cabe na ficha**: só o essencial (gramas, tempo, falha, referências) ou tudo que foi salvo, incluindo acabamento, mão de obra, tarifa, canais de marketplace e outros custos? É a diferença entre uma ficha de 6 linhas e uma de 20.
