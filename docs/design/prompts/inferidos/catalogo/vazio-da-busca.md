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

- **Onde vive:** Rota /catalogo a partir de 1280px, dentro da coluna esquerda do mestre-detalhe: ocupa exatamente o lugar da lista de cartões, logo abaixo da barra de busca/contagem/adicionar. A ficha de 560px continua à direita, mostrando o item que estava selecionado.
- **Como o vendedor chega:** O vendedor digita um termo na busca do Catálogo e nenhum item salvo casa — erro de digitação, nome diferente do que ele lembrava, ou a seção errada aberta.
- **Vizinhança imediata:** Acima: a barra de ferramentas, com o termo ainda visível no campo e a contagem exibindo "0 filamento(s)". Abaixo: nada — a coluna termina aí. Ao lado: a ficha do detalhe, que continua preenchida. O bloco é o mesmo componente de estado vazio usado quando o catálogo não tem nada salvo, com o MESMO ícone de caixa; a única diferença entre os dois é a frase.
- **Dados que chegam (e o que ela devolve):** Nenhum dado próprio: é uma consequência do filtro em memória (zero itens visíveis com termo ativo, e ao menos um item salvo na seção). Traz título "Nada encontrado para essa busca", corpo "Tente outro termo, ou limpe a busca para ver tudo de novo." e um botão secundário "Limpar busca".
- **O que acontece depois:** "Limpar busca" esvazia o campo e a lista inteira volta na mesma posição, com a contagem real. Apagar o termo à mão faz o mesmo. Nada é escrito, nada é perdido.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Nada encontrado para essa busca — o vazio do FILTRO no Catálogo (desktop)

## O que desenhar
O bloco que ocupa a coluna da lista do Catálogo quando o vendedor digita algo no campo "Buscar no catálogo…" e nenhum item salvo casa com o termo. Ele vive na aba **Catálogo**, no layout mestre-detalhe de desktop (≥1280px): lista à esquerda, ficha do item selecionado à direita. É o mesmo bloco nas quatro seções da aba — Filamentos, Impressoras, Produtos e Kits. Quem o vê é um vendedor que TEM catálogo salvo e errou o termo, abreviou, ou está procurando algo que ainda não cadastrou. O momento é sempre de fricção: ele digitou e a tela esvaziou.

## Por que este prompt existe
Este estado nunca foi desenhado. Não existe busca no protótipo de 2026-07-02 (`CatalogScreen.jsx` só tem o `EmptyState` de catálogo vazio, e a matriz de estados §G traz uma única coluna `empty` para "Catálogo lista"), a auditoria discute os empties de Catálogo e Histórico sem uma palavra sobre busca, e o canvas do 018 desenha o CAMPO de busca mas nenhuma prancheta do resultado zero — nem poderia, porque o `<script>` do canvas não implementa filtro nenhum. Autoridade de desenho: **NENHUMA**.
O que a IA decidiu sozinha: substituir a lista inteira por um bloco centralizado, reaproveitar o **mesmo ícone `package`** do vazio de catálogo, e a copy. O próprio código admite o buraco num comentário ("O vazio da BUSCA não é o vazio do catálogo… Dizer 'nenhum filamento salvo' seria mentira sobre os dados do vendedor") e resolve isso **só por texto**: graficamente os dois blocos são idênticos. É o pior mal-entendido possível — o vendedor que digitou errado vê exatamente a mesma imagem de "não tenho nada salvo".

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/catalog/catalog-panel.tsx` (ramo `isWide`) + `catalog-master-detail.css` + `shared/i18n/messages.pt-br.ts`.

A coluna da esquerda tem uma **barra de ferramentas** que permanece visível durante o vazio, e abaixo dela o bloco vazio:

| Elemento | Conteúdo literal hoje | Observação |
|---|---|---|
| Campo de busca | placeholder `"Buscar no catálogo…"`, rótulo acessível `"Buscar no catálogo"`, ícone `search` à esquerda | `flex:1`, largura máxima 420px |
| Contagem | `"0 filamento(s)"` / `"0 impressora(s)"` / `"0 produto(s)"` / `"0 kit(s)"` | → **problema**: com filtro ativo o número é o dos VISÍVEIS. "0 filamento(s)" ao lado de uma frase que diz "você tem itens" é a contradição do bloco inteiro na mesma linha |
| Botão de ação | `"Adicionar filamento"` / `"Adicionar impressora"` / `"Adicionar produto"` / `"Montar kit"` com ícone `plus` | continua ativo e é a saída errada para quem só errou o termo |
| Ícone do vazio | `package`, 56×56, fundo `accent-soft`, raio `lg` | → **problema**: é literalmente o mesmo do vazio de catálogo |
| Título | `"Nada encontrado para essa busca"` | homologado, mantenha |
| Corpo | `"Tente outro termo, ou limpe a busca para ver tudo de novo."` | homologado, mantenha |
| Ação | botão secundário `"Limpar busca"` | → **problema**: não repete o termo buscado; o vendedor não vê o que a máquina entendeu |

→ **Problema de layout, o mais grave**: a ficha da direita some junto (não há item selecionado), mas a grade continua `minmax(0,1fr) 560px`. A 1280px sobra uma coluna de lista de ~420px com um bloco centralizado de até 448px, e **560px de vazio absoluto ao lado**. Metade da tela fica em branco no exato momento em que o produto precisa parecer inteiro.

Para comparação, o vazio LEGÍTIMO de catálogo (que este NÃO pode parecer) usa: mesmo ícone `package`, título `"Nenhum filamento salvo ainda"` e corpo `"Salve seus filamentos uma vez e reutilize em cada cálculo."` com o botão primário de adicionar.

## Conteúdo e dados reais
- A busca **filtra a lista já carregada** — nenhuma requisição nova. Nunca há spinner nem erro de rede causado por digitar. O casamento é substring simples, sem acento-insensibilidade, sobre nome + resumo da linha (ex.: filamento `"PLA Preto 1,75mm"` + resumo `"R$ 129,90 · 1000 g"`).
- Termos reais que produzem zero: `"pl a"`, `"nylon"`, `"petg"` sem PETG salvo, um SKU colado inteiro.
- A contagem tem plural preguiçoso de propósito: `"3 filamento(s)"`. Não é erro de digitação e não é para ser "corrigido" no desenho — é o padrão da casa.
- O termo digitado é o único dado dinâmico disponível para o bloco. Ele pode ser longo (o vendedor cola um código de 60+ caracteres sem espaço).
- Não há sugestão, correção ortográfica, histórico de busca nem "você quis dizer" — nada disso existe no produto.

## Estados obrigatórios
1. **Repouso** — o bloco com termo sem resultado, sobre uma lista que tem itens salvos.
2. **Termo longo** — o mesmo bloco com um código de ~60 caracteres sem espaço; ele precisa quebrar (`overflow-wrap: anywhere`) e não pode empurrar a coluna.
3. **"Limpar busca": repouso, hover, foco visível por teclado, pressionado** — é um `tf-button` secundário `sm`; o mínimo de alvo do DS é 44px de altura (a base impõe `min-height: 44px` mesmo no tamanho `sm`) e o desenho não pode descer disso.
4. **Campo de busca em foco enquanto o vazio está na tela** — o cursor normalmente continua no campo; o anel de foco tem de conviver com o bloco vazio logo abaixo.
5. **Offline (leitura degradada)** — acima do bloco já renderiza um alerta de tom `info` com `"Modo leitura offline"` / `"Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."`. Desenhe os dois juntos: alerta + vazio de busca.
6. **Premium pausado** — acima do bloco renderiza o alerta `info` `"Premium pausado"`; as linhas trazem a legenda `"somente leitura"`. Desenhe alerta + vazio de busca coexistindo.
7. **Vazio de catálogo (referência de contraste, na mesma prancheta)** — `"Nenhum filamento salvo ainda"`. Precisa estar lado a lado com o vazio de busca para o desenho PROVAR que os dois não se confundem.

Não desenhe: carregando, erro de carga, sem permissão. Nenhum deles alcança este bloco — a busca só existe depois que a lista carregou com itens.

## Viewports
- **Desktop 1280px** — o corte onde o mestre-detalhe nasce e onde o buraco de 560px ao lado é mais brutal. Prancheta obrigatória.
- **Desktop 1920px** — acima de 1600px a lista vira duas colunas; o vazio de busca precisa dizer o que faz com a largura dobrada (ocupar as duas? centralizar em uma?). Prancheta obrigatória.
- **Mobile 390px — NÃO desenhar.** O campo de busca só existe dentro do ramo desktop do componente; abaixo de 1280px a lista é a lista simples de sempre, sem filtro, e este estado é inalcançável. Se o desenho sugerir busca no mobile, ele está propondo produto novo, e isso é decisão do dono.

## Regras que o desenho não pode quebrar
- **A frase honesta não pode virar a única diferença.** Título e corpo já dizem a verdade; o desenho tem de dizer a mesma verdade em forma — outro ícone (o DS tem `search`, além de `package`, `x`, `info`), outra densidade, outra moldura, ou o bloco ancorado ao campo em vez de centralizado no palco. Escolha e justifique.
- **Nunca afirmar que o catálogo está vazio.** Nem por texto, nem por número, nem por imagem. A contagem "0 filamento(s)" na barra é hoje uma afirmação falsa sobre os dados do vendedor — resolva (ex.: `"0 de 12 filamento(s)"`, ou a contagem some enquanto há filtro).
- **Zero resultado não é erro.** Tom neutro/informativo: nada de vermelho, nada de ícone de alerta, nada de linguagem de falha.
- **Falha de rede nunca se disfarça de vazio** — e vice-versa: o alerta offline é `info` e vive ACIMA, separado, nunca fundido ao bloco.
- **A saída barata primeiro.** "Limpar busca" é a ação certa para quem errou o termo; "Adicionar filamento" é a ação certa para quem realmente não tem o item. As duas coexistem na tela — a hierarquia visual tem de deixar claro qual é qual.
- Contraste medido contra o fundo real do card/palco, nos dois temas; alvo ≥44px.

## Armadilhas já pagas neste projeto
- **Nome do vendedor sem espaço já gerou 4.948px de rolagem horizontal a 1440px** (homologação CF-015-UI-02). O termo buscado é do mesmo tipo de dado: se ele aparecer no bloco, quebra ou trunca — nunca empurra.
- **Contagem mentirosa é invisível em teste**: no 014, um contador dizia "8 encontrados" com 31 casando, e nenhuma asserção pegou — só o screenshot. A contagem desta barra é exatamente a mesma classe.
- **Texto ocluso passa em `toBeVisible`**: o desenho tem de ser assertável por CAIXA (posição e tamanho), não por presença de string.
- **Frase honesta fora de placeholder** (lição do 016/PR-F): a explicação do vazio nunca pode viver só dentro do campo de busca, que corta o texto.
- **A ficha à direita é `sticky` e rola por dentro**; se o vazio for desenhado como um bloco que atravessa as duas colunas, ele quebra essa mecânica. Diga explicitamente se o bloco ocupa só a coluna da lista ou o palco inteiro.

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro (first-class)**:
1. `1280 · Filamentos · vazio de busca` — barra de ferramentas + bloco + o tratamento proposto para os 560px órfãos da direita.
2. `1280 · comparação lado a lado` — vazio de busca vs. vazio de catálogo, para provar a distinção visual.
3. `1920 · vazio de busca` — com a lista de duas colunas ao fundo indicada.
4. `1280 · vazio de busca + alerta offline` e `1280 · vazio de busca + Premium pausado`.
5. `Estados do botão "Limpar busca"` — repouso/hover/foco/pressionado, e o campo de busca em foco.

Reutilize os primitivos existentes, sem criar novos: o campo é o `tf-input` dentro do `tf-inputwrap` com o ícone `search`; a contagem é a legenda em `--fs-caption` / `--text-muted`; o botão de adicionar é o `tf-button` primário `sm` com ícone `plus`; "Limpar busca" é o `tf-button` secundário `sm`; os alertas offline e Premium pausado são o `tf-alert` de tom `info`; o bloco vazio é o `tf-empty` (ícone 56×56 em `accent-soft`, título `--fs-lg`, corpo `--fs-body-sm` em `--text-muted`, ação abaixo). Se a distinção visual exigir alterar o `tf-empty`, proponha a variação COMO variação do primitivo (ex.: uma modificação de alinhamento/ícone), não como um componente novo.

## Perguntas em aberto para o dono
1. A contagem com filtro ativo deve mostrar **"0 de 12 filamento(s)"** (o total continua visível, e a mentira morre), **sumir** enquanto há busca, ou continuar como está? Muda a barra inteira.
2. Quando a busca não acha nada, o botão **"Adicionar filamento"** deveria virar um atalho contextual (**"Adicionar 'petg'"**, já com o termo no nome do novo item) ou permanecer genérico? É uma funcionalidade nova, não um ajuste de desenho.
3. A busca deve ignorar acentos e maiúsculas (`"pla"` acha `"PLA Prêto"`)? Hoje ignora só maiúsculas — metade dos zeros que este bloco vai mostrar podem ser desta causa, e isso muda quanto o desenho precisa se esforçar.
