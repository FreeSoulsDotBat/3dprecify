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

- **Onde vive:** Espalhado por quatro pontos da área: (1) faixa no topo do painel de /catalogo, acima da lista; (2) uma linha extra em cada item da lista; (3) dentro dos formulários de filamento/impressora (na folha lateral no celular, na ficha de 560px no desktop); (4) no topo e no primeiro cartão do editor de produto em página cheia.
- **Como o vendedor chega:** O assinante em atraso — o pagamento falhou, a carência venceu — abre o Catálogo normalmente. Nada o avisou antes: ele descobre aqui.
- **Vizinhança imediata:** A faixa é um alerta informativo (nunca vermelho) com título "Premium pausado" e corpo "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium.", posicionada acima do corpo da lista e abaixo do cabeçalho — e só quando a lista tem itens e não está em erro nem offline. Nos itens, "somente leitura" entra como mais uma caption cinza sob o resumo. Nos formulários, TODOS os campos ficam inertes de uma vez (o cinza padrão do navegador, sem tratamento próprio) e, no rodapé, o botão "Salvar" some: no lugar dele entra um alerta informativo "Reative o Premium" / "Reative o Premium para voltar a criar e editar. Seus itens estão salvos.", ao lado de um "Voltar" que continua ativo.
- **Dados que chegam (e o que ela devolve):** O estado "pausado" vem do servidor (mesma leitura de plano que as outras abas usam) e é só apresentação — o servidor continua sendo quem barra a escrita. Nenhuma data, nenhum valor de cobrança chega a esta área.
- **O que acontece depois:** A leitura continua completa e os itens seguem utilizáveis no cálculo. Tocar a lixeira NÃO abre a confirmação de exclusão: leva à mesma superfície somente-leitura da edição, para não oferecer uma ação destrutiva que falharia no envio. O caminho de reativação é a aba Conta — este texto não leva lá por conta própria.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Premium pausado no Catálogo — a faixa calma, o formulário inerte e a linha de reativação

## O que desenhar
O estado que o assinante **em atraso** encontra ao abrir o Catálogo (`/catalogo`, abas Filamentos ·
Impressoras · Produtos · Kits). O servidor devolve `status: "lapsed"` e a tela inteira muda de modo: tudo
continua legível e utilizável no cálculo, mas nada pode ser criado, editado ou excluído. Precisa ser
desenhado em três lugares que hoje foram montados por peças: (1) a **faixa** acima da lista, (2) a
**ficha/formulário inerte** (à direita no desktop ≥1280px, dentro da gaveta no mobile, e na página cheia
de Produto), e (3) o **rodapé de reativação** que toma o lugar do Salvar. É o vendedor que já pagou, tem
dados salvos e voltou para trabalhar — o tom é calmo e não punitivo, nunca um paywall.

## Por que este prompt existe
Nada disso foi desenhado. O estado foi composto por inferência em quatro pontos independentes do código
(`catalog-panel.tsx`, `filament-form.tsx`, `printer-form.tsx`, `produto-page.tsx`), e o resultado visual do
formulário congelado é **o cinza nativo do navegador** de um `<fieldset disabled>` — nenhum token, nenhum
contraste medido, nenhuma decisão. O protótipo de 2026-07-02 **não cobre isto e cobre outra coisa**: o
canvas só conhece `plano ∈ {premium, free}` (`CatalogScreen.jsx`), o `writeBlocked` dele é `!isPremium`
— modela o GRÁTIS, não o pausado — e o badge "somente leitura" que aparece lá é atributo **da linha**
(TPU Flex), não do plano. E o §B do prompt original crava a fronteira como **binária** ("computar =
grátis; qualquer persistência = Premium"): "pausado" é um terceiro estado que a autoridade de desenho
nega existir. Sem desenho: a faixa, o formulário inerte, a linha de reativação e o desvio da lixeira.

## O que já existe hoje (não invente do zero — corrija)
**Faixa acima da lista** — `Alert` tom `info`, título **"Premium pausado"**, corpo **"Seus itens continuam
aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium."**
→ Só aparece se `!offline && !erro && lista.length > 0`. Com o catálogo **vazio**, ou **offline**, ou em
erro de carga, a faixa **some** e o vendedor fica sem nenhuma explicação para os campos apagados.

**Cada item da lista** ganha uma quarta legenda: **"somente leitura"**, no mesmo tamanho e na mesma cor
das outras legendas (resumo, nota, "pode estar desatualizada").
→ Quatro legendas empilhadas iguais; o estado do plano fica indistinguível de um dado do item.

**Formulário (gaveta no mobile / ficha de 560px no desktop)** — todos os campos dentro de um `fieldset`
desabilitado de uma vez.
→ Aparência = cinza do sistema operacional. Não há foco, não há explicação por campo, e o contraste do
texto apagado sobre o fundo escuro nunca foi medido.

**Rodapé** — o botão **"Salvar" / "Salvar alterações"** simplesmente **desaparece**; no lugar entra um
`Alert` `info` com título **"Reative o Premium"** e corpo **"Reative o Premium para voltar a criar e
editar. Seus itens estão salvos."**, ao lado de um **"Voltar"** que continua ativo.
→ A linha manda reativar e **não oferece caminho nenhum** para reativar (nenhum botão/link para a Conta).

**Ícones da linha (e do cabeçalho da ficha no desktop)** — lápis, cópia e lixeira continuam com aparência
normal. Tocar a **lixeira** abre a ficha somente-leitura em vez do confirmar de exclusão.
→ Honesto no efeito (não finge que exclui e depois falha), desonesto na aparência: o ícone promete excluir.

**Botão "Adicionar filamento" / "Adicionar impressora"** na barra da lista continua **totalmente ativo**;
abre "Novo filamento" com todos os campos inertes. Idem o ícone de duplicar.

## Conteúdo e dados reais
Filamento — **Nome** (obrigatório, placeholder "Ex.: PLA Azul") · **Material** ("Ex.: PLA") · **Custo do
rolo** (R$, obrigatório) · **Peso do rolo** (kg, obrigatório).
Impressora — **Nome** ("Ex.: Ender 3") · **Valor da máquina** (R$, obrigatório) · **Vida útil da máquina**
(h, obrigatório) · **Consumo médio** (kW, obrigatório, dica "Consumo médio real da impressora, não a
potência de placa (~0,12 kW).") · **Reserva de manutenção** (R$/h, **opcional**).
Resumos reais da lista: `PLA · R$ 89,90 / 1 kg` e `R$ 1.899,00 · 2.000 h · 0,12 kW`.
Contadores: "3 filamento(s)", "2 impressora(s)". Cabeçalho da ficha no desktop: kicker "Filamento salvo" /
"Impressora salva" acima do nome.
Produto e Kit **não** editam na ficha: a ficha resume e mostra **"Abrir para editar"** (que, pausado, leva
à página cheia igualmente inerte). Na página de Produto o preço **continua sendo recalculado ao vivo** com
os valores salvos — o número está vivo enquanto os campos estão congelados, e o desenho precisa dizer isso.

## Estados obrigatórios
- **Repouso pausado (lista cheia)**: faixa "Premium pausado" + itens completos + legenda "somente leitura".
- **Campo inerte**: precisa de um tratamento próprio (não o cinza do sistema) — valor legível, rótulo
  legível, unidade legível, e a clara ausência de cursor de edição.
- **Foco/hover/pressionado sobre o que ficou inerte**: nada deve responder como se aceitasse escrita; o que
  continua clicável ("Voltar", "Abrir para editar", busca, seleção de item) responde normalmente.
- **Rodapé de reativação**: sem "Salvar", com "Reative o Premium" + corpo, e "Voltar" ativo ao lado.
- **Pausado + offline** (os dois ao mesmo tempo): hoje só aparece "Modo leitura offline" / "Seus itens
  salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." — a faixa de pausado
  é suprimida. Desenhe a composição honesta das duas causas.
- **Pausado + catálogo vazio**: "Nenhum filamento salvo ainda" / "Salve seus filamentos uma vez e reutilize
  em cada cálculo." com o botão Adicionar — e nenhuma menção ao plano pausado. Corrigir.
- **Carregando**: spinner centralizado (a faixa ainda não existe).
- **Erro de carga**: `Alert` `danger` "Não foi possível carregar seu catálogo." + "Tentar novamente".
- **Leitura barrada pelo servidor (403)**: estado vazio com ícone de coroa e o texto **"Salvar faz parte do
  Premium."** → é copy de escrita usada numa falha de leitura; marcar como problema.
- **Busca sem resultado (desktop)**: "Nada encontrado para essa busca" / "Tente outro termo, ou limpe a
  busca para ver tudo de novo." + "Limpar busca" — precisa conviver com a faixa de pausado.
- **Nunca assinou (`none`)**: NÃO é este estado — cai no teaser Premium padrão. As duas telas não podem
  ficar parecidas a ponto de confundir quem já pagou com quem nunca pagou.

## Viewports
- **390px (mobile)**: lista em cartões + gaveta lateral com o formulário inerte. A faixa e as legendas
  competem por altura com a lista — mostre a dobra.
- **1280px (desktop, o corte real)**: mestre-detalhe, lista à esquerda e ficha de **560px fixos** à direita,
  com a faixa acima das duas colunas e a barra de busca/contador/Adicionar no topo da lista.
- **1920px**: a lista passa a **duas colunas** (regra em ≥1600px) e a ficha continua com 560px — é onde a
  faixa fica mais larga e mais fácil de ignorar.
Existe nos dois mundos; nenhum pode ser pulado.

## Regras que o desenho não pode quebrar
- **Pausado ≠ grátis ≠ offline ≠ erro.** Três causas diferentes, três frases diferentes; nunca vender falha
  de rede ou plano pausado como a mesma coisa.
- **Leitura permanece completa**: nenhum dado do vendedor pode ser escondido, borrado ou truncado por causa
  do plano. O que congela é a escrita.
- **Sem preço e sem data** na linha de reativação (mesma régua de honestidade do teaser).
- **Nada finge funcionar**: o bloqueio aparece **antes** do toque, não no "Salvar".
- **Frase honesta em elemento de largura cheia**, nunca dentro de placeholder ou de campo que corta.
- **Alvo ≥44px** para tudo que continua tocável; contraste do texto inerte **medido contra o fundo real**
  do card, nos dois temas — este é o ponto exato em que o cinza nativo falha hoje.

## Armadilhas já pagas neste projeto
- Nome de item colado pelo vendedor **sem espaços** gerou 4.948px de rolagem horizontal a 1440px; o card da
  lista precisa quebrar palavra, e a ficha de 560px também.
- Legenda apagada que passa em teste de texto e é ilegível na tela: `toBeVisible` não enxerga oclusão nem
  contraste — a faixa e o "somente leitura" precisam ser lidos numa imagem, não numa asserção.
- Valor grande (`R$ 1.899,00 · 2.000 h · 0,12 kW`) estourando a coluna do resumo em 390px.
- Frase honesta cortada por caber só em sufixo de placeholder — já aconteceu e voltou como regra.

## Entregável
Pranchetas, tema **escuro (padrão)** e **claro (first-class)**:
1. 390px — lista pausada com a faixa, três itens reais e a legenda "somente leitura".
2. 390px — gaveta "Editar filamento" inerte, com o rodapé de reativação e "Voltar".
3. 1280px — mestre-detalhe pausado completo (busca + contador + Adicionar + ficha inerte de 560px).
4. 1920px — a mesma tela com a lista em duas colunas.
5. Página cheia de Produto pausada: faixa no topo, cartão de nome com a linha de reativação no lugar do
   "Salvar produto", grade de custos/markup/marketplace inerte e o preço recalculado ao vivo.
6. Uma prancheta de **especificação do campo inerte**: um mesmo campo (rótulo + unidade + valor) em
   repouso editável, inerte, inerte-com-foco-tentado e inerte em erro pré-existente.
Reutilize os primitivos: `tf-card` para item e ficha, `tf-card--interactive` / `--selected` para a seleção
no desktop, o alerta de tom `info` para a faixa e para a linha de reativação, `tf-inputwrap` + `tf-input`
para os campos (crie a **variante inerte** deste primitivo, não um campo novo), o botão fantasma para
"Voltar" e os ícones de linha, e o estado vazio existente para busca/catálogo vazio. Nenhum primitivo novo.

## Perguntas em aberto para o dono
1. A linha "Reative o Premium" **oferece um caminho** (botão para a Conta/assinatura) ou continua sendo só
   um aviso sem ação? Hoje ela manda reativar e não abre porta nenhuma.
2. Com o plano pausado, o botão **"Adicionar filamento"** deve continuar ativo abrindo um formulário inerte,
   ficar desabilitado, ou sumir? Cada opção é uma tela diferente.
3. Os ícones de **lixeira e lápis** mudam de rótulo/forma quando pausado (ex.: virar um só "Ver"), ou
   continuam iguais e só desviam o destino?
4. A faixa "Premium pausado" deve aparecer **também** com o catálogo vazio, com erro de carga e junto do
   aviso de offline — e, nesse último caso, as duas frases convivem ou uma vence?
5. O estado pausado pode mostrar **quando** o acesso pausou ou até quando os dados ficam guardados? Hoje não
   mostra nada disso, e é a primeira pergunta de quem está em atraso.
