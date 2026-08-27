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

- **Onde vive:** Rota /catalogo, em qualquer largura: substitui TODO o corpo do painel da seção — e no desktop isso significa a largura inteira, sem a grade de duas colunas (a ficha de 560px simplesmente não existe neste estado).
- **Como o vendedor chega:** É o primeiro contato do vendedor Premium com a área: ele assina, abre o Catálogo e não salvou nada ainda. Também aparece ao trocar para uma seção que ele nunca usou (tem filamentos, nunca cadastrou impressora).
- **Vizinhança imediata:** Acima: a faixa de cabeçalho com o título e as quatro pílulas de seção — que continuam lá e continuam clicáveis. Abaixo: nada. O bloco é centralizado, com um ícone genérico de caixa (o MESMO para as quatro seções), um título por seção ("Nenhum filamento salvo ainda", "Nenhuma impressora salva ainda", "Nenhum produto salvo ainda", "Nenhum kit salvo ainda"), uma linha de corpo explicando o porquê de salvar, e UM botão principal em largura de bloco ("Adicionar filamento" / "Adicionar produto" / "Montar kit").
- **Dados que chegam (e o que ela devolve):** Chega quando a leitura terminou sem erro e devolveu zero itens — a distinção entre "não tenho nada" e "a busca não achou" é feita antes. Não há semente de dados: o cache local nasce vazio e nada é pré-preenchido.
- **O que acontece depois:** O botão abre exatamente o mesmo caminho de criação do resto da seção: folha lateral (filamento/impressora), editor de página cheia (produto) ou o compositor (kit). Assim que o primeiro item é salvo de verdade, este bloco some e a lista toma o lugar.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Catálogo vazio: o primeiro contato de cada seção (Filamentos · Impressoras · Produtos · Kits)

## O que desenhar
O estado de **catálogo vazio por seção** — a tela que o vendedor Premium vê no seu primeiro dia, quando
abre `Catálogo` e ainda não salvou nada. São quatro variações da mesma peça, uma por aba da barra
segmentada (`Filamentos`, `Impressoras`, `Produtos`, `Kits`), e cada uma é o único conteúdo da página
naquele momento: acima dela ficam só o título "Catálogo" e as pílulas de seção; abaixo, nada. É o
onboarding real do produto — o vendedor acabou de pagar, entrou para "guardar meus filamentos" e o que
ele encontra aqui decide se ele salva o primeiro item ou fecha o app. Existe em mobile (390px) e em
desktop (≥1280px, onde a seção normalmente é um mestre-detalhe de duas colunas).

## Por que este prompt existe
A auditoria classificou esta peça como `PROTOTIPO_PARCIAL`: a **estrutura** foi desenhada em 2026-07-02 e
o código a seguiu quase à risca (título "Nenhum {label} salvo", uma linha de corpo, um botão primário
"Adicionar {label}"). O que se perdeu na tradução foram três coisas. (1) O protótipo trazia **grafismo de
marca por seção** — espada para filamento/produto, arco para impressora, 84px; o código usa o mesmo
ícone genérico `package` de 28px nas quatro. (2) O protótipo tinha **duas ações**: a primária e um CTA
secundário de semeadura, "Começar com filamentos comuns", verificado renderizado na V3 (semeava PLA/PETG/
ABS); o construído tem uma só — a busca no código de hoje não encontra nenhuma linha de semeadura. (3) E
uma que nenhuma autoridade cobre: **o vazio dentro do mestre-detalhe do desktop**. Hoje o ramo do vazio é
avaliado antes do ramo de largura, então acima de 1280px o vazio ocupa a largura inteira e a coluna da
ficha, a busca e a contagem simplesmente não existem — a tela muda de arquitetura entre "zero itens" e
"um item".

## O que já existe hoje (não invente do zero — corrija)
A caixa vazia é o primitivo `tf-empty`: coluna centrada, largura máxima 28rem, `padding` generoso,
ícone dentro de um quadrado arredondado de 56px com fundo `accent-soft`, título, descrição em texto
esmaecido e um slot de ação.

| Seção | Título (literal) | Corpo (literal) | Botão primário |
|---|---|---|---|
| Filamentos | "Nenhum filamento salvo ainda" | "Salve seus filamentos uma vez e reutilize em cada cálculo." | "Adicionar filamento" |
| Impressoras | "Nenhuma impressora salva ainda" | "Salve os dados da sua impressora uma vez e reutilize em cada cálculo." | "Adicionar impressora" |
| Produtos | "Nenhum produto salvo ainda" | "Salve uma peça com seus custos e reabra com o preço sempre recalculado." | "Adicionar produto" |
| Kits | "Nenhum kit salvo ainda" | "Monte um kit com várias peças e reabra com o preço sempre recalculado." | "Montar kit" |

Essa copy é boa e foi homologada — **não reescreva os títulos nem os corpos**. O que precisa de desenho é
o resto:

- → **O ícone é o mesmo nas quatro seções** (`package`, 28px). O produto já tem o primitivo de grafismo de
  marca (`arco`, `espada`, `linha-curva`, `onda`), hoje usado no 404 e na tela de erro. Traga-o de volta
  para cá, em ~84px, com uma escolha por seção.
- → **Só existe uma ação.** O segundo caminho (semear exemplos) sumiu, e com ele o único jeito de o
  vendedor ver o catálogo funcionando antes de digitar um formulário inteiro.
- → **No desktop o vazio quebra a arquitetura da tela.** Com ≥1 item a seção é `lista (flexível) + ficha
  de 560px`, com uma barra de ferramentas em cima (campo de busca de até 420px, contagem "3 filamento(s)"
  alinhada à direita, botão "Adicionar filamento"). Com 0 itens, nada disso aparece: o `tf-empty` de 28rem
  fica sozinho e centrado num container de ~1600px, virando uma ilhota de conteúdo num oceano vazio.
- → **Vazio + Premium pausado não se falam.** O aviso "Premium pausado" só aparece quando existe pelo
  menos um item; num catálogo vazio o vendedor pausado vê "Adicionar filamento" como se pudesse salvar, e
  só descobre a verdade depois do clique, na gaveta que abre em modo leitura.
- Existe um **vazio diferente** já desenhado à parte: o da busca ("Nada encontrado para essa busca" /
  "Tente outro termo, ou limpe a busca para ver tudo de novo." / "Limpar busca"). Ele **não** é esta peça
  — não os unifique; dizer "nenhum filamento salvo" quando o vendedor tem 40 filamentos e filtrou seria
  mentira sobre os dados dele.

## Conteúdo e dados reais
- Cabeçalho da página: título "Catálogo" e a barra segmentada rotulada "Seções do catálogo" com as quatro
  pílulas. No desktop título e pílulas dividem a mesma faixa; no mobile a faixa quebra em duas linhas.
- Contagem (só quando há itens, mas útil para calibrar a barra): "{n} filamento(s)", "{n} impressora(s)",
  "{n} produto(s)", "{n} kit(s)"; um kit resume como "{n} peça(s)".
- Nenhum número de dinheiro aparece nesta peça — um catálogo vazio não tem preço, e a lista do catálogo
  nunca mostra preço nem quando está cheia (o preço é sempre recalculado ao abrir o item).
- Se o desenho propuser exemplos de semente, use nomes que o produto já usa como exemplo em outros
  lugares: "PLA Azul" para filamento, "Ender 3" para impressora, "Vaso G" para produto.
- Rótulos de ação já existentes que o desenho pode reaproveitar: "Tentar novamente", "Limpar busca",
  "Reative o Premium" / "Reative o Premium para voltar a criar e editar. Seus itens estão salvos."

## Estados obrigatórios
1. **Vazio em repouso** (o caso principal, quatro variantes): grafismo da seção, título, corpo, ação(ões).
2. **Carregando** — hoje é apenas um `Spinner` centrado com respiro vertical, sem texto. Desenhe o que
   ocupa esse instante para que o vazio não pisque como se fosse resposta ("vazio" e "ainda não chegou"
   não podem parecer a mesma coisa).
3. **Erro de leitura** — faixa de tom perigo com "Não foi possível carregar seu catálogo." e botão
   secundário "Tentar novamente". Isto **substitui** o vazio; uma falha de rede jamais pode ser desenhada
   como "você não tem nada salvo".
4. **Offline (leitura degradada)** — faixa informativa (nunca perigo) "Modo leitura offline" + "Seus itens
   salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." Combinada com o vazio,
   o desenho tem de deixar claro que a ação primária vai falhar enquanto não houver conexão
   ("Criar e editar precisam de conexão.").
5. **Premium pausado + vazio** — o estado que hoje não existe: mostrar o aviso "Premium pausado" com
   "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." e
   apresentar a ação de forma honesta (reativar em vez de prometer um salvamento que será recusado).
6. **Sem direito (conta grátis / servidor recusou a leitura)** — caixa calma com ícone de coroa e a frase
   "Salvar faz parte do Premium." Não é o vazio do catálogo; é o convite honesto.
7. Estados de controle da ação primária: repouso, foco visível, hover, pressionado, desabilitado e
   carregando (quando a semente estiver gravando).

## Viewports
- **Mobile 390px** — a peça existe no mobile e é onde a maioria dos vendedores vê o app pela primeira vez.
  O grafismo de 84px + título + corpo + ação(ões) precisam caber acima da dobra, com a barra segmentada
  de quatro pílulas ainda visível.
- **Desktop 1280px** — o corte exato em que a seção vira mestre-detalhe (`lista + ficha de 560px`).
  Desenhe o vazio **dentro** dessa arquitetura: decida se a barra de ferramentas continua visível, o que
  ocupa a coluna da ficha quando não há item selecionado, e como a caixa vazia se ancora sem virar uma
  ilhota perdida.
- **Desktop 1920px** — acima de 1600px a lista de itens vira duas colunas; mostre que o vazio nessa
  largura não vira um bloco de 28rem centrado num vão de 1600px.

## Regras que o desenho não pode quebrar
- **Zero item salvo é um fato, falha de rede é outro.** Erro e offline têm superfícies próprias; nunca
  desenhe uma delas com a cara do vazio.
- **Freemium é binário e explícito**: ou a conta pode salvar, ou a peça diz que salvar é do Premium. Nada
  de botão que parece funcionar e recusa depois do clique.
- **Frase honesta nunca vive dentro de placeholder** — "Criar e editar precisam de conexão." e a linha do
  Premium pausado moram em elementos de largura cheia, não como sufixo de um campo.
- **Toda ação com alvo ≥44px**, inclusive o CTA secundário, que tende a nascer pequeno e "de texto".
- **Contraste medido contra o fundo real** do cartão/da caixa, nos dois temas — o quadrado do ícone usa
  fundo suave de acento e é onde o contraste costuma cair.
- Se houver semeadura, ela **grava dados na conta do vendedor**: o desenho tem de deixar isso explícito
  antes do clique e prever como o vendedor desfaz (excluir item por item já existe, com confirmação
  "Excluir “{nome}”?" / "Esta ação não pode ser desfeita.").

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado**: nomes colados pelo vendedor já produziram 4.948px de
  rolagem horizontal a 1440px nesta mesma tela. Se o desenho propuser um cartão de exemplo/semente,
  ele precisa quebrar nome longo sem espaço.
- **Texto ocluso passa em teste**: uma caixa centrada dentro de uma grade de duas colunas pode ser
  empurrada para fora da área visível sem que nenhuma verificação textual reclame — ancore a caixa na
  coluna certa e mostre a geometria.
- **Frase cortada em placeholder**: já aconteceu de a frase honesta ser posta como sufixo de campo e
  aparecer truncada. Placeholder carrega exemplo, não promessa.
- **O ícone genérico é o sintoma, não a doença**: quatro seções com a mesma arte fazem o vendedor achar
  que trocou de aba e nada mudou.

## Entregável
Pranchetas, no tema **escuro** (padrão) e no **claro** (first-class, não uma variação de cortesia):
1. Mobile 390px — as quatro variantes de vazio lado a lado (Filamentos, Impressoras, Produtos, Kits).
2. Mobile 390px — vazio + offline, e vazio + Premium pausado.
3. Desktop 1280px — vazio dentro do mestre-detalhe, com a decisão sobre barra de ferramentas e coluna da
   ficha visível.
4. Desktop 1920px — o mesmo em largura larga (lista em duas colunas quando cheia).
5. Uma prancheta de estados da ação: repouso/foco/hover/pressionado/desabilitado/carregando, e as
   superfícies vizinhas que substituem o vazio (carregando, erro, sem direito).

Reaproveite os primitivos existentes em vez de criar novos: a **caixa vazia** (`tf-empty`) com seus três
slots (arte, título, descrição, ação); o **grafismo de marca** (`tf-grafismo`, nomes `espada`, `arco`,
`linha-curva`, `onda`) no lugar do ícone genérico; o **botão** primário para a ação principal e o
secundário/fantasma para a ação de semeadura; a **faixa de aviso** (`tf-alert`, tons informativo e
perigo) para offline/erro/pausado; a **barra segmentada** (`tf-segmented`) para as pílulas de seção; o
**cartão** (`tf-card`) para qualquer exemplo ou para a coluna da ficha. Se algo realmente não existir,
diga qual primitivo faltou em vez de inventar um irmão parecido.

## Perguntas em aberto para o dono
1. **A semeadura volta?** O protótipo tinha "Começar com filamentos comuns" (PLA/PETG/ABS) e o produto de
   hoje não tem nada disso. Gravar itens na conta do vendedor em um clique é decisão de produto:
   entra, e para quais seções (impressora comum? produto de exemplo? kit?), ou fica de fora?
2. **Qual grafismo para Kits?** O protótipo só nomeou espada (filamento/produto) e arco (impressora); a
   seção Kits nasceu depois e não tem arte atribuída.
3. **No desktop, o vazio mantém a busca e a contagem visíveis?** Manter dá estabilidade de layout entre
   0 e 1 item; esconder dá uma tela de boas-vindas mais limpa. As duas são defensáveis e mudam o desenho.
4. **Produtos e Kits têm pré-requisito**: um produto exige um filamento e uma impressora salvos antes
   ("Para criar um produto, salve antes um filamento e uma impressora no catálogo."). O vazio de Produtos
   deve levar o vendedor de volta para Filamentos quando esse pré-requisito não estiver cumprido, ou
   apenas informar?
