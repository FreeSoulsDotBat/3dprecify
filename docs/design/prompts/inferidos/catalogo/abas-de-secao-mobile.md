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

- **Onde vive:** Topo da rota /catalogo, dentro da faixa `.tf-catalogo-head`. No celular a faixa quebra em duas linhas: título "Catálogo" na primeira, a bandeja segmentada ocupando a largura na segunda, imediatamente acima do painel da seção.
- **Como o vendedor chega:** É a primeira coisa que o vendedor vê ao entrar na aba Catálogo; ele usa para pular de Filamentos para Impressoras, Produtos ou Kits. Também chega aqui de volta depois de salvar um produto (o app devolve o vendedor com a pílula Produtos já ativa).
- **Vizinhança imediata:** Acima: o título da página (e, no celular, a barra superior do shell com o logo). Abaixo: as faixas de aviso do painel (offline / Premium pausado) quando existem, e em seguida a linha de contagem + "Adicionar". A bandeja é uma pílula por seção, na ordem fixa Filamentos · Impressoras · Produtos · Kits, com a ativa destacada; a bandeja rola na horizontal quando as quatro não cabem, com a barra de rolagem escondida — em 360px a pílula Kits pode ficar fora da vista sem nenhuma pista de que existe mais coisa à direita.
- **Dados que chegam (e o que ela devolve):** Recebe qual seção está ativa a partir do parâmetro `?tab=` da URL (padrão Filamentos) e a lista fixa de quatro rótulos. Devolve a seção escolhida reescrevendo a URL (sem empilhar histórico), o que troca o painel montado abaixo.
- **O que acontece depois:** Trocar de pílula desmonta o painel anterior e monta o da nova seção — a busca digitada e o item selecionado no desktop nascem limpos. Escolher Kits mostra a lista de kits salvos aqui mesmo; abrir um deles é que leva para /kits.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)

## O que desenhar
A bandeja segmentada que fica no topo da tela **Catálogo** e troca a seção exibida logo abaixo:
Filamentos, Impressoras, Produtos e Kits. É o único jeito de o vendedor sair de uma seção para
outra dentro do Catálogo — não há menu, link ou gesto alternativo. Ela aparece imediatamente
abaixo do título "Catálogo" e imediatamente acima do painel da seção ativa (contador + botão de
adicionar + lista). Quem usa é o vendedor no celular, quase sempre logo depois de abrir o app
para conferir ou cadastrar um insumo. O foco deste prompt é o **mobile estreito**, onde as quatro
pílulas não cabem numa linha e a solução atual esconde a quarta sem avisar.

## Por que este prompt existe
Autoridade `PROTOTIPO_PARCIAL`: o protótipo de origem (§E5) pedia **duas** pílulas
("Filamentos|Impressoras"); o `CatalogScreen.jsx` do protótipo instanciava **três**
(filamento/impressora/produto). **Kits é a quarta pílula e não aparece em nenhuma das quatro
autoridades** — entrou por decisão de implementação. E o comportamento em tela estreita também
foi decidido no CSS, não no desenho: a bandeja declara rolagem horizontal com a **barra de
rolagem deliberadamente escondida** e os rótulos com quebra proibida. Ou seja: quando não cabe,
rola — e nada na tela diz que existe mais coisa à direita. O que nunca foi desenhado é essa
escolha e o seu indício de transbordo. O único ponto que a auditoria já cobria (alvo de toque de
44px) o código honra.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/catalogo/catalogo-page.tsx`, `catalogo-page.css`,
`apps/web/src/shared/ui/segmented.tsx` + `segmented.css`.

| Item | Valor real hoje |
| --- | --- |
| Rótulos, nesta ordem | "Filamentos" · "Impressoras" · "Produtos" · "Kits" |
| Nome do grupo (leitor de tela) | "Seções do catálogo" |
| Seção inicial | Filamentos (ou a que vier na URL: `?tab=products`, `?tab=kits`…) |
| Ícones | **nenhum** nas pílulas do Catálogo (o componente aceita ícone, mas aqui não usa) |
| Contadores | **nenhum** na pílula; a contagem vive abaixo, no painel ("12 filamento(s)") |
| Tamanho | pequeno: rótulo de 12px, peso 600, padding 8px/12px, altura mínima 44px |
| Bandeja | fundo `--bg-muted`, canto pílula (999px), padding 4px, gap 4px entre pílulas |
| Pílula selecionada | fundo `--surface-raised` + sombra sutil + texto `--accent-text` |
| Foco de teclado | contorno de 2px em `--accent`, afastado 2px |
| Teclado | um único ponto de tabulação; setas percorrem e trocam a seção; Home/End vão às pontas |
| Transbordo | rola na horizontal, **sem barra visível**, sem sombra/gradiente/seta de borda |
| Quebra de linha | a **faixa** título+bandeja quebra (título em cima, bandeja embaixo); as **pílulas** nunca quebram entre si |

Espaço disponível: a coluna de conteúdo tem 16px de recuo de cada lado, então sobram **358px a
390px** e **328px a 360px** de viewport. A soma estimada das quatro pílulas (≈ 90 + 96 + 77 + 50,
mais gaps e padding) fica **na casa de 330px** — cabe raspando a 390px e **estoura a 360px**.
Estimativa a medir no desenho, não número fechado.

→ **Problema 1**: a 360px a pílula "Kits" fica além da borda de um contêiner cuja barra de rolagem
foi escondida. Não existe seta, sombra, gradiente, recorte de meia-pílula nem marcador de posição:
o vendedor não tem como saber que a seção existe.
→ **Problema 2**: a pílula selecionada pode nascer fora da vista quando a tela abre por link direto
(`?tab=kits`) — hoje nada garante que a seção ativa esteja visível ao entrar.
→ **Problema 3**: não há estado **pressionado**. O único retorno é a transição de cor em 0,15s.
→ **Problema 4**: a diferença entre ativa e inativa é fundo + sombra + cor do texto; o peso da
fonte é 600 em todas. No tema escuro isso já falhou com contraste 1,00:1 (bandeja e pílula eram o
mesmo #14151a) — corrigido em 2026-08-15, mas o desenho precisa deixar o relevo explícito nos dois
temas.

## Conteúdo e dados reais
- Os quatro rótulos são copy homologada e **não devem ser reescritos nem abreviados** sem decisão do
  dono: "Filamentos", "Impressoras", "Produtos", "Kits". "Kits" é a mais curta (4 caracteres) e
  "Impressoras" a mais longa (11) — a assimetria de largura é real e o desenho tem de conviver com ela.
- Nada de número dentro da pílula hoje. O que o painel mostra logo abaixo, por seção:
  "{n} filamento(s)", "{n} impressora(s)", "{n} produto(s)", "{n} kit(s)" — ex.: "12 filamento(s)".
- Botão de ação do painel, à direita do contador: "Adicionar filamento" / "Adicionar impressora" /
  "Adicionar produto" / "Montar kit".
- Acima da bandeja: o título "Catálogo". No rodapé do app: a barra fixa de 64px com Calcular ·
  Catálogo · Kits · Orçamentos · Conta.

## Estados obrigatórios
- **Repouso (não selecionada)**: texto em `--text-muted`, fundo transparente sobre a bandeja.
- **Selecionada**: relevo (fundo + sombra) + texto de destaque; legível **sem depender da cor**,
  no escuro e no claro.
- **Hover**: só existe com mouse; no mobile não conte com ele para nada.
- **Pressionado**: hoje inexistente → desenhe.
- **Foco de teclado**: contorno visível **por cima** da pílula selecionada (não pode sumir justo no
  item já destacado).
- **Transbordo à direita / à esquerda**: o estado que falta. Precisa de um indício de que há mais
  seções fora da vista, e de um jeito de a seção ativa estar sempre visível ao entrar na tela.
- **Carregando o painel**: a bandeja **continua inteira e clicável**; quem carrega é o painel
  (indicador centralizado abaixo). A bandeja nunca vira esqueleto.
- **Erro de carga**: bandeja intacta; abaixo, alerta de perigo "Não foi possível carregar seu
  catálogo." com o botão "Tentar novamente".
- **Offline (leitura)**: bandeja intacta; acima do painel, alerta de **tom informativo** (nunca
  perigo) "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e
  editar precisam de conexão."
- **Premium pausado**: bandeja intacta e as quatro seções navegáveis; alerta informativo
  "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou
  editar, reative o Premium." As linhas da lista ganham a legenda "somente leitura".
- **Sem permissão (grátis ou deslogado)**: **a bandeja não existe** — a tela inteira vira o teaser
  único de Premium. Desenhe essa ausência para deixar claro que não há uma versão "abas mortas".
- **Vazio**: não se aplica à bandeja — são sempre quatro pílulas fixas. O vazio é do painel
  ("Nenhum filamento salvo ainda" etc.).
- **Desabilitado**: não existe hoje e não deve ser inventado.

## Viewports
- **Mobile 360px** — o caso que motiva o prompt: é onde "Kits" cai fora da vista. Obrigatório.
- **Mobile 390px** — a largura padrão de homologação do projeto; mostrar o limite raspando.
- **Desktop 1280px (referência, 1 prancheta)** — no desktop as quatro pílulas ficam **na mesma linha
  do título, à direita**, já desenhado no canvas do 018 a 1920px. Entra só para provar que a solução
  do transbordo no mobile **não muda** o que já está homologado no desktop. Não redesenhe o desktop.

## Regras que o desenho não pode quebrar
- **Nenhuma seção pode ser invisível.** Uma seção que existe e não se anuncia é a mesma classe de
  desonestidade que esconder uma degradação: se as quatro cabem, mostre as quatro; se não cabem,
  mostre que há mais.
- **Alvo de toque ≥ 44px de altura**, inclusive no tamanho pequeno — regra já paga e honrada; não a
  perca ao encolher pílulas para fazer caber.
- **Zero rolagem horizontal da PÁGINA.** Rolagem dentro de um contêiner que se declara rolável é
  aceitável; a página empurrada para o lado é defeito duro.
- **Contraste medido contra o fundo real** (a bandeja `--bg-muted`, não o fundo da página), nos dois
  temas: indicador de estado ≥ 3:1, e a seleção nunca sinalizada só por matiz.
- **Freemium binário**: ou o Catálogo inteiro está disponível, ou é o teaser. Nada de aba com cadeado.
- **Falha de rede nunca vendida como falta de Premium** — offline usa tom informativo, não o teaser.
- **Frase honesta nunca dentro de placeholder** nem cortada: as frases de offline/pausado vivem em
  elementos de largura cheia.

## Armadilhas já pagas neste projeto
- **Teste headless não enxerga barra de rolagem clássica** — um transbordo real passou despercebido
  porque só se mediu um eixo. Aqui a barra está escondida de propósito: nenhum sinal automático vai
  denunciar o corte. O indício tem de ser desenhado.
- **`toBeVisible` passa em elemento fora da vista ou ocluso.** A pílula "Kits" cortada é exatamente
  esse caso: existe no DOM, responde a teste, e o vendedor não vê.
- **Contraste medido contra o fundo errado** — o mesmo componente, dentro de um cartão, já ficou com
  cartão, bandeja e pílula na mesma cor.
- **Rótulo longo estourando a coluna** — "Impressoras" é o pior caso; qualquer solução que dependa de
  truncar precisa mostrar como fica o texto cortado, não fingir que não acontece.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como cidadão de primeira classe** (as duas
versões de cada uma):
1. 360px — as quatro pílulas com "Filamentos" ativa e o indício de transbordo à direita.
2. 360px — "Kits" ativa, chegando por link direto: como a bandeja mostra que a seleção está no fim.
3. 390px — repouso, com o painel abaixo (contador "12 filamento(s)" + "Adicionar filamento").
4. 390px — foco de teclado sobre a pílula selecionada, e estado pressionado.
5. 390px — offline: bandeja + alerta informativo "Modo leitura offline".
6. 390px — Premium pausado: bandeja + alerta "Premium pausado".
7. 1280px — referência: título "Catálogo" e as pílulas na mesma linha, à direita (não redesenhar).

Reutilize os primitivos existentes: a bandeja e as pílulas são `tf-segmented` /
`tf-segmented__item` / `tf-segmented__item--selected` no tamanho pequeno; o título é
`tf-page-header` + `tf-title`; os avisos são o alerta do DS nos tons `info` e `danger`; o botão de
adicionar e o "Tentar novamente" são o botão do DS (secundário, pequeno); ícones vêm do conjunto do
DS. Se a solução do transbordo exigir um elemento novo (seta, gradiente de borda, marcador de
posição), descreva-o como **variação de `tf-segmented`**, não como primitivo novo.

## Perguntas em aberto para o dono
1. **"Kits" deve mesmo ser a quarta seção do Catálogo?** Existe uma seção "Kits" na barra inferior
   (`/kits`) *e* uma pílula "Kits" aqui. Nenhuma autoridade de desenho previu a quarta pílula, e é a
   duplicidade que cria o aperto de largura. Manter as quatro, ou o Catálogo volta a ter três?
2. Se as quatro ficam: quando não couberem, o que é preferível — **rolar com indício visível**,
   **encolher os rótulos** ou **quebrar em duas linhas**? Isso muda a solução inteira e é decisão de
   produto, não só de estética.
3. As pílulas devem carregar **contagem** (ex.: "Filamentos 12")? Hoje o número só existe abaixo, e
   colocá-lo na pílula agrava a largura.
4. A **ordem** atual (Filamentos → Impressoras → Produtos → Kits) é intencional por frequência de
   uso, ou pode mudar para pôr a mais usada primeiro?
