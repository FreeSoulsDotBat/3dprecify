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

- **Onde vive:** Rota /catalogo, no lugar do corpo inteiro do painel da seção — some junto a busca, a contagem, o botão adicionar, a lista e, no desktop, a ficha de 560px.
- **Como o vendedor chega:** Toda abertura da aba Catálogo (ou troca de seção) em que a primeira leitura online está em voo e ainda não há nada no cache local daquela conta — conta nova, aparelho novo, ou cache limpo.
- **Vizinhança imediata:** Acima permanecem apenas a faixa de cabeçalho (título + pílulas de seção) e, se for o caso, as faixas de aviso do painel. No lugar de todo o resto: um único giro centralizado, com folga vertical acima e abaixo. Nada preserva a forma da lista que vai aparecer — a tela salta de "nada" para "tudo".
- **Dados que chegam (e o que ela devolve):** É o estado "primeira leitura em voo e sem cache". Quando existe cache do aparelho, ele NÃO aparece: a lista antiga é servida na hora e a atualização acontece por baixo.
- **O que acontece depois:** Ao responder, o giro é trocado pela lista (ou pelo vazio da seção); se a leitura falhar sem cache, pelo alerta de erro com "Tentar novamente"; se falhar com cache, pela lista mais a faixa de leitura offline.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Catálogo carregando — o esqueleto da lista (e da ficha) no lugar do spinner

## O que desenhar
O estado de **carregamento da lista do Catálogo**, a tela premium onde o vendedor guarda filamentos,
impressoras, produtos e kits para reusar em cada cálculo. É o primeiro meio-segundo de toda visita a
`/catalogo` e de toda troca de aba (Filamentos · Impressoras · Produtos · Kits, cada aba busca sua
própria lista). Quem vê isso é o vendedor premium que já tem itens salvos e voltou para escolher um —
ele não está esperando um conteúdo novo, está esperando **o conteúdo que ele mesmo salvou** reaparecer.
Existe no mobile (lista simples) e no desktop ≥1280px (mestre-detalhe: lista à esquerda, ficha de
560px à direita), e as duas formas precisam do desenho.

## Por que este prompt existe
O código faz o painel inteiro virar um **spinner centralizado** (`Spinner` dentro de um bloco
`flex justify-center py-8`): busca, contagem de itens, botão "Adicionar filamento", lista e ficha
somem juntos e voltam juntos. Não é uma lacuna — é uma **contradição** com a única autoridade que
cobre este estado. O protótipo de 2026-07-02 (`.design-import/ui_kits/precifica3d/CatalogScreen.jsx`,
ramo `loading`) desenha um **Card sem padding com três linhas de esqueleto**: círculo 36×36 + duas
barras de texto (55% e 35%) por linha, separadas por `borderTop` de 1px — exatamente a forma da lista
que vai chegar. A matriz §G do prompt principal crava "Catálogo lista · loading = skeleton", o
`-fixes.md` item 16 e o `-fixes-r2.md` item 14 pedem de novo (o r2 ainda manda **aumentar a
visibilidade no tema escuro**), e a auditoria V3 registra o item como corrigido e MEDIDO
(contraste 1,79:1 no escuro, `prefers-reduced-motion` respeitado). Três autoridades pediram esqueleto,
uma o desenhou, e o produto entrega spinner. O que de fato nunca foi desenhado é o **esqueleto dentro
da grade de duas colunas do desktop** — e é aí que este prompt precisa decidir.

## O que já existe hoje (não invente do zero — corrija)
Ordem real da tela, de cima para baixo, com o que **permanece** e o que **some** durante o load:

| Elemento | Texto literal hoje | Durante `isLoading` |
| --- | --- | --- |
| Cabeçalho da página + abas segmentadas | "Filamentos" · "Impressoras" · "Produtos" · "Kits" | **permanece** (fica fora do painel) |
| Aviso offline (quando há cache antigo) | título "Modo leitura offline", corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." | permanece |
| Aviso premium pausado | título "Premium pausado", corpo "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." | permanece |
| Campo de busca (só desktop) | placeholder "Buscar no catálogo…", rótulo acessível "Buscar no catálogo" | → **some** |
| Contagem | "3 filamento(s)" / "12 produto(s)" / "2 kit(s)" | → **some** |
| Botão de adicionar | "Adicionar filamento" · "Adicionar impressora" · "Adicionar produto" · "Montar kit" | → **some** |
| Lista de cartões | nome + resumo (+ notas) | → **some**, vira spinner |
| Ficha de 560px (desktop) | kicker "FILAMENTO SALVO", nome, formulário ou resumo | → **some**, a grade colapsa |

→ Problema central: a tela pisca de **nada** para **tudo**. Some a barra de ferramentas inteira, o
grid de duas colunas colapsa e volta, e o conteúdo salta de posição quando os dados chegam.
→ Problema secundário: o spinner é o `tf-spinner` `md` (anel de 20px, cor `--accent`, rótulo de
leitor de tela "Carregando…") sozinho no meio de um bloco de 4rem — não sugere nem quantidade, nem
forma, nem coluna.
→ **Não existe primitivo de esqueleto no DS de hoje** (não há `tf-skeleton`). O protótipo tinha
`Skeleton variant="circle|text"`; o produto perdeu isso na travessia. Este desenho precisa
especificá-lo como peça nova do DS — é a única criação autorizada aqui.

## Conteúdo e dados reais
O esqueleto imita conteúdo verdadeiro, então desenhe sobre as medidas reais das linhas:

- **Filamento** — nome curto ("PLA Azul"), resumo em uma linha: `PLA · R$ 128,90 / 1 kg`
  (material opcional; quando falta, o resumo começa direto no dinheiro).
- **Impressora** — "Ender 3", resumo: `R$ 1.899,00 · 2.000 h · 0,12 kW`.
- **Produto/Kit** — nome + resumo com as referências, mais legendas eventuais: "manual",
  "Vincule um filamento e uma impressora salvos", "{n} peça(s)".
- Legendas que podem aparecer numa terceira linha do cartão: "pode estar desatualizada" (cache
  offline) e "somente leitura" (premium pausado). O esqueleto deve caber **2 a 3 linhas** de texto
  por cartão sem mudar de altura quando o conteúdo real chega.
- Existe um segundo carregamento, menor e já resolvido: enquanto as referências de um produto ainda
  não chegaram, o resumo mostra **"carregando…"** — nunca "manual", porque isso seria uma afirmação
  sobre a procedência do dado. Mantenha essa distinção visível no desenho.
- Contagem: o número real do vendedor, tipicamente 1 a 40 itens; a lista não é paginada.

## Estados obrigatórios
1. **Carregando — primeira carga (mobile)**: 3 cartões-esqueleto empilhados, com a mesma altura e o
   mesmo espaçamento dos cartões reais; a barra com contagem e botão "Adicionar filamento" **fica no
   lugar**, com a contagem substituída por uma barra-esqueleto curta (não por "0 filamento(s)" — isso
   seria mentir sobre os dados).
2. **Carregando — primeira carga (desktop ≥1280px)**: a grade `1fr / 560px` **não colapsa**. À
   esquerda, busca e botão presentes; 4 a 6 cartões-esqueleto. À direita, o cartão da ficha mantém a
   moldura de 560px com kicker, título e três blocos de campo esqueletizados.
3. **Recarga em segundo plano**: quando já existe lista na tela, o conteúdo **não** vira esqueleto —
   um indicador discreto basta. Desenhe essa variante; hoje ela não é distinguida da primeira carga.
4. **Vazio (nenhum item salvo)**: ícone, "Nenhum filamento salvo ainda", "Salve seus filamentos uma
   vez e reutilize em cada cálculo." e o botão "Adicionar filamento".
5. **Vazio da busca** (desktop): "Nada encontrado para essa busca" / "Tente outro termo, ou limpe a
   busca para ver tudo de novo." + "Limpar busca". Nunca confundir com o vazio do catálogo.
6. **Erro**: alerta de perigo com "Não foi possível carregar seu catálogo." e botão
   "Tentar novamente".
7. **Sem permissão (conta não ativa)**: estado calmo com ícone de coroa, sem preço e sem data.
8. **Offline com cache**: aviso informativo "Modo leitura offline" acima da lista, e cada cartão com
   a legenda "pode estar desatualizada" — jamais em tom de erro.
9. **Premium pausado**: aviso informativo "Premium pausado" + legenda "somente leitura" nos cartões;
   a lista continua completa.
10. **Movimento reduzido**: com `prefers-reduced-motion`, o esqueleto perde o brilho pulsante e fica
    estático — legível, não parado-quebrado.

## Viewports
- **390px (mobile)** — é onde o Catálogo nasceu e onde o esqueleto foi desenhado em 2026-07-02.
- **1280px (desktop)** — o corte do mestre-detalhe: lista em **uma** coluna + ficha de 560px.
- **1920px** — acima de 1600px a lista vira **duas colunas** de cartões ao lado da ficha; o esqueleto
  precisa mostrar essa forma, senão o load a 1920px continua parecendo outra tela.

## Regras que o desenho não pode quebrar
- **Continuidade de forma**: o esqueleto tem a geometria do conteúdo que vai chegar. Nada de salto de
  layout quando os dados aparecem — mesma altura de cartão, mesma coluna, mesma posição do botão.
- **Nenhum número inventado**: sem "0 filamento(s)", sem preços de exemplo, sem contagem chutada
  enquanto carrega. Barra cinza é honesta; número falso não.
- **Falha de rede nunca vira "não é premium"**: carregando é carregando; erro é o alerta com "Tentar
  novamente"; sem permissão é o estado de coroa. Três coisas distintas, três formas distintas.
- **Contraste medido no fundo real**: o item 14 do r2 existe porque o esqueleto sumia no tema escuro.
  A medição que fechou o item foi **1,79:1** contra o fundo do cartão — desenhe para pelo menos isso
  em ambos os temas, e diga o valor nos comentários da prancheta.
- **Anúncio para leitor de tela**: a região carregando precisa continuar anunciando "Carregando…";
  um esqueleto puramente visual não pode calar o que o spinner já dizia.
- **Alvo ≥44px** para o botão de adicionar e para o botão de limpar busca, que permanecem clicáveis.

## Armadilhas já pagas neste projeto
- **Esqueleto invisível no escuro** — pedido duas vezes (fixes item 16, r2 item 14) antes de ficar
  visível. Não repita: valide o tom claro E o escuro.
- **Nome sem espaço estoura a página** — um filamento com 500 caracteres colados gerou **4.948px** de
  rolagem horizontal a 1440px. O cartão-esqueleto define a largura máxima; o cartão real quebra a
  palavra. Nenhum dos dois pode empurrar a grade.
- **Rolagem no eixo vertical que o headless não vê** — a ficha de 560px rola por dentro
  (`max-height` da janela) e é fixa ao topo; se o esqueleto da ficha for mais alto que a janela, ele
  precisa rolar por dentro também, não esticar a página.
- **Frase honesta em placeholder** — nada do que precisa ser lido ("Modo leitura offline",
  "pode estar desatualizada") pode viver dentro de um campo ou ser cortado por reticências.
- **Piscar em carga rápida** — com cache quente a lista chega em poucos milissegundos; um esqueleto
  que aparece e some em 80ms é pior que nenhum. Trate o tempo mínimo/atraso explicitamente no desenho.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual** (as duas versões de cada uma):

1. `390 · Catálogo carregando` — barra de ferramentas presente + 3 cartões-esqueleto.
2. `390 · Catálogo carregado` (referência lado a lado, para provar que nada salta de posição).
3. `1280 · Catálogo carregando` — grade `1fr / 560px` inteira, com o esqueleto da ficha à direita.
4. `1920 · Catálogo carregando` — lista de esqueletos em duas colunas + ficha.
5. `Recarga em segundo plano` — lista real com o indicador discreto.
6. `Anatomia do esqueleto` — o novo primitivo em detalhe: variantes barra-de-texto e bloco, alturas,
   raios, cor de base e cor de brilho nos dois temas, versão sem animação, com os valores de
   contraste anotados.

Reutilize os primitivos existentes e nomeie-os na prancheta: o cartão da lista e o cartão da ficha são
`tf-card` (o da lista em modo interativo); a barra de ferramentas usa `tf-inputwrap` + `tf-input` para
a busca e `tf-button` `sm` para "Adicionar filamento"; os avisos são `tf-alert` (`info` para offline e
premium pausado, `danger` para o erro de carga); os vazios são `tf-empty`; o indicador de recarga em
segundo plano é o `tf-spinner` `sm` já existente. **Só um primitivo novo é autorizado**: `tf-skeleton`
(variantes texto e bloco), porque ele não existe no DS e o protótipo dependia dele.

## Perguntas em aberto para o dono
1. Durante o carregamento, o botão "Adicionar filamento" e a busca ficam **habilitados** (dá para
   começar a cadastrar antes de a lista chegar) ou desabilitados até os dados existirem?
2. Existe um tempo mínimo/atraso desejado antes de mostrar o esqueleto (por exemplo, nada por 150ms e
   depois esqueleto por pelo menos 300ms), ou o esqueleto aparece sempre, mesmo em cache quente?
3. A ficha de 560px durante a primeira carga deve mostrar esqueleto de formulário (Filamentos e
   Impressoras editam ali dentro) ou o esqueleto do resumo (Produtos e Kits só resumem e mandam para
   o editor de página cheia)? São dois conteúdos diferentes atrás da mesma moldura.
