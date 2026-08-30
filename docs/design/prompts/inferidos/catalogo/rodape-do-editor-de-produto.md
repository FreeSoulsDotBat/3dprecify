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

- **Onde vive:** Editor de produto em página cheia (/catalogo?produto=…): o bloco final, abaixo da grade de duas colunas de custos/markup/marketplace, atravessando a largura da página. É o fim da rolagem.
- **Como o vendedor chega:** O vendedor termina de preencher (ou revisar) o produto e desce até aqui para conferir o preço. É onde ele confirma se o número faz sentido — e o botão que realmente salva o produto ficou lá em cima, fora de vista, no cartão do nome.
- **Vizinhança imediata:** Três coisas empilhadas com peso visual parecido e nenhuma hierarquia declarada: primeiro o bloco completo de resultado (o preço em destaque e o detalhamento item a item de como se chegou nele) — ou, quando não dá para calcular, um alerta vermelho no lugar dele; depois o botão de registrar orçamento (que abre a folha de "Salvar em Orçamentos"); e por último, centralizado por conta própria, o botão de salvar simulação (que abre a folha de "Salvar simulação").
- **Dados que chegam (e o que ela devolve):** O resultado vem do motor de cálculo, recalculado ao vivo a cada alteração do formulário e das tarifas do catálogo servido. As duas ações de persistência só existem quando o produto JÁ está salvo E o preço é válido — num produto novo elas simplesmente não estão lá, e aparecem depois do primeiro salvamento sem que nada explique a mudança.
- **O que acontece depois:** Registrar orçamento congela o preço da tela como um registro imutável, marcado com ESTE produto como origem, e o registro passa a viver na aba Orçamentos (indo para a fila se estiver offline). Salvar simulação guarda a configuração referenciando o produto, e ela reaparece em "Minhas simulações", recalculada com as tarifas do dia em que for reaberta. Nenhuma das duas salva o produto em si — isso continua sendo o botão do topo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)`

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

# Rodapé do editor de produto — o preço recalculado e as três ações que disputam o fim da página

## O que desenhar
O bloco final da página cheia de edição de produto (`/catalogo` → aba Produtos → abrir/criar um produto).
Depois do nome, dos dois seletores de catálogo (filamento e impressora) e das duas colunas de custos e
marketplace, vem este rodapé, que atravessa a largura inteira: o preço recalculado ao vivo com o
detalhamento de como ele foi montado e, embaixo dele, duas ações de persistência — "Salvar em Orçamentos"
e "Salvar simulação". Quem usa é o vendedor premium que acabou de ajustar um produto do catálogo e precisa
decidir o que fazer com o número que está vendo. É o último momento da tela: se a hierarquia aqui estiver
errada, ele erra a ação e só descobre depois.

## Por que este prompt existe
O bloco de resultado TEM desenho — o protótipo de 2026-07-02, §E4, desenha `PriceHero` com `tone="accent"`
e glow roxo, o detalhamento itemizado em `BreakdownRow` e a última linha em `emphasis="total"`, e o item 33
de `-fixes.md` moveu deliberadamente o glow do botão Salvar para o `PriceHero`, fixando que o foco visual
é a conta. O que nunca foi desenhado é o que veio DEPOIS dele: as duas ações de persistência e o
empilhamento das três coisas. O protótipo só conhecia "Ação Salvar → dispara bottom-sheet de upsell";
Orçamentos (§E6) e Simulações não existiam no inventário. Hoje as três estão empilhadas com peso visual
parecido, e a quarta ação — "Salvar produto", a única que grava o produto — ficou lá em cima, dentro do
primeiro cartão, fora de vista no momento da decisão.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/catalogo/produto-page.tsx` (rodapé), `features/calculator/calculator-form.tsx`
(`PriceResults`), `features/calculator/calculator-form.css` (`.tf-calc-footer`).

Ordem atual, de cima para baixo:

| # | Peça | Quando aparece | Observação |
|---|------|----------------|------------|
| 1 | Detalhamento + preços (`PriceResults`) | sempre que o cálculo é válido | tem desenho (§E4) |
| 1b | Alerta `danger` "Confira os campos destacados para ver o preço." | quando NÃO há resultado | ocupa o lugar inteiro do resultado |
| 2 | Botão secundário com ícone `save` (18px) "Salvar em Orçamentos" | só produto JÁ SALVO + preço válido + Premium ativo | some sem explicar |
| 3 | Botão secundário com ícone `save` (18px) "Salvar simulação" | mesmas condições | envolvido num `flex justify-center` avulso |
| — | "Salvar produto" | no primeiro cartão, no topo da página | **não está no rodapé** |

→ **Os dois botões são visualmente idênticos**: mesma variante secundária, mesmo ícone, mesmo tamanho,
rótulos que começam com a mesma palavra ("Salvar…"). Nada diz que um congela um valor para sempre e o
outro guarda uma estratégia que recalcula amanhã.
→ **O alinhamento diverge no mobile**: até 1024px o rodapé é uma coluna `stretch`, então "Salvar em
Orçamentos" nasce com a largura toda e "Salvar simulação", por causa do `flex justify-center`, nasce com a
largura do texto e centralizado. Dois botões irmãos, dois formatos. Acima de 1024px o rodapé centraliza
tudo e limita cada bloco a 720px, e a diferença some — ou seja, o defeito só existe onde o vendedor mais usa.
→ **A ordem contradiz a tela irmã**: em Calcular (`calcular-page.tsx`), o mesmo rodapé traz "Salvar
simulação" ANTES de "Salvar em Orçamentos". O corpo das duas telas é declaradamente idêntico (SC-305) e o
fim delas não é.
→ **A ação principal está fora do rodapé.** O vendedor chega ao fim com três botões e nenhum deles é o que
salva o produto que ele acabou de editar.
→ **As duas ações nunca aparecem durante a criação.** Num produto novo, ambas estão ausentes; ao salvar,
o app navega de volta para a lista. Elas só existem quando ele reabre o produto — e nada avisa isso.

## Conteúdo e dados reais
O detalhamento é um cartão com linhas rótulo→valor, todas em `R$`, na ordem: "Material", "Energia",
"Máquina", "Falha / perdas", "Acabamento", "Mão de obra", mais uma linha por item de "Outros custos"
(nome que o vendedor digitou), depois "Custo total" com ênfase `total`. Em seguida, ainda no mesmo cartão,
a derivação: "Preço varejo" com sublegenda "markup 50%" e ênfase `accent`, e "Preço atacado" com sublegenda
"markup 30%". Linhas opcionais em zero aparecem esmaecidas, não somem.

Exemplo verdadeiro (é a semente do produto): Custo total **R$ 16,16** · Preço varejo **R$ 24,24** ·
Preço atacado **R$ 21,01**. Desenhe também um caso alto — **R$ 128.940,00** — porque valor grande já quebrou
esta tela.

Quando há canais ativos, o mesmo cartão ganha, abaixo de uma divisória, o título "Preços por canal" e, por
canal, o par "Preço para anunciar" / "Recebido líquido". Sem canal ativo, o bloco inteiro não existe.

Abaixo do cartão vêm os cartões de preço sugerido (varejo e atacado sempre juntos), com as legendas
"Varejo" e "Atacado" — lado a lado onde couber, empilhados a partir de ~360px.

Os dois botões abrem folhas (bottom-sheets), não gravam direto. "Salvar em Orçamentos" abre a folha
homônima, com a introdução "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje.",
o campo "Rótulo (opcional)" (dica "Cliente, pedido…"), "Validade da proposta" em "dias" e a escolha
"Preço que você está cotando" entre "Varejo" e "Atacado". "Salvar simulação" abre a sua, com "Guardamos a
estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de
hoje.", "Nome" e "Nota (opcional)", e ecoa a base como "Base de custo: {nome do produto} (referência do
catálogo)". As folhas já têm desenho próprio; aqui interessa o gatilho, não o interior.

## Estados obrigatórios
- **Repouso, produto salvo e Premium ativo** — resultado completo + os dois botões. É o estado que precisa
  de hierarquia desenhada.
- **Sem resultado válido** — no lugar de todo o bloco de resultado, um alerta `danger` com a frase exata
  "Confira os campos destacados para ver o preço.". Os dois botões desaparecem junto (não há preço a
  guardar). Desenhe o rodapé inteiro assim, não só o alerta.
- **Produto novo, ainda não salvo** — resultado presente, os dois botões ausentes. Hoje sem nenhuma
  explicação; o desenho precisa resolver isso (ver Perguntas).
- **Premium pausado** — a página inteira acima já mostra o alerta `info` "Premium pausado…" e some com
  "Salvar produto"; aqui no rodapé o preço continua sendo recalculado normalmente (a leitura nunca é
  cortada) e os dois botões simplesmente somem. Desenhe o rodapé nesse estado.
- **Aviso de resultado zerado** — dentro do detalhamento, quando o custo dá R$ 0,00, um aviso que não mora
  em campo nenhum (não há campo culpado).
- **Atacado acima do varejo** — alerta `info`, entre o cartão e os cartões de preço, com a frase
  "O preço de atacado ficou acima do varejo. Nada foi recusado — só confira se é isso mesmo." Tom `info`
  de propósito: nada foi recusado.
- **Foco, hover, pressionado** nos dois botões — e eles ficam lado a lado no desktop, então o estado de
  foco precisa distinguir qual dos dois está selecionado sem depender de cor sozinha.
- **Desabilitado / carregando** — o gatilho pode vir desabilitado; a submissão dentro da folha tem estado
  de envio.
- **Offline** — os dois se comportam de forma OPOSTA e o rodapé não conta isso: "Salvar em Orçamentos"
  funciona offline e vira pendente ("Pendente neste dispositivo. Sincroniza sozinho quando houver
  conexão."), enquanto "Salvar simulação" é recusado com "Salvar uma simulação precisa de conexão.".

## Viewports
- **390px** — obrigatório: é onde a assimetria de alinhamento existe e onde a coluna única faz as três
  peças competirem em sequência. Desenhe repouso, sem-resultado e produto-novo.
- **1280px** — obrigatório (é o corte desktop do produto): o rodapé centraliza e limita cada bloco a 720px,
  então sobra espaço lateral e os dois botões podem conviver numa linha. Mostre repouso e Premium pausado.
- 1920px opcional, só se a solução mudar de forma (não deve: o teto de 720px já governa).

## Regras que o desenho não pode quebrar
- **Freemium é binário e as ações são premium-only por decisão do dono**: sem Premium ativo elas não são
  botões cinzas nem iscas — não existem. O desenho não pode inventar um estado "bloqueado clicável".
- **Rede caindo nunca vira "não é premium"** e vice-versa: o texto de pendência fala de conexão, o de
  Premium fala de Premium, e nenhum dos dois é usado no lugar do outro.
- **Procedência do número**: nenhum preço aqui é guardado — tudo é recalculado ao vivo. O rodapé não pode
  sugerir "preço salvo".
- **Congelado ≠ recalcula**: Orçamentos congela o valor no dia; Simulações recalcula ao reabrir. Se o
  desenho não deixar essa diferença visível ANTES do clique, ele não resolveu o problema desta peça.
- Frase honesta nunca dentro de placeholder, sempre em elemento de largura cheia.
- Alvo de toque ≥44px, inclusive quando os dois botões dividirem uma linha no desktop.
- Contraste medido contra o fundo real do cartão, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- Preço de seis dígitos já quebrou no meio do número (`950.096` em duas linhas) porque a grade era fixa em
  duas colunas a 360px. Qualquer arranjo lado a lado precisa de piso de largura e empilhar antes de cortar
  o dígito.
- Overflow horizontal medido nos DOIS eixos: um assert de texto passa em elemento ocluído ou estourado, e
  headless não enxerga barra de rolagem clássica.
- Botão que nasce fora da viewport já aconteceu nesta base (100,5px de estouro), e a primeira correção
  ainda deixava 467px — desenhe a largura máxima explicitamente.
- Sufixo de placeholder cortado: legenda que explica não pode viver colada ao número dentro do campo.

## Entregável
Pranchetas: (1) 390px repouso completo, (2) 390px sem resultado, (3) 390px produto novo, (4) 1280px
repouso, (5) 1280px Premium pausado — cada uma em **escuro (padrão) e claro (first-class)**. Reutilize os
primitivos existentes, sem criar novos: `Card` (`padding="md"`) para o detalhamento, `BreakdownRow` para
cada linha, `PriceHero`/os cartões de preço para varejo e atacado, `Alert` nos tons `danger` e `info`,
`Button` variante secundária com `Icon name="save"` nos dois gatilhos, e a folha (`Sheet`) apenas indicada,
não redesenhada. Entregue explicitamente: a hierarquia proposta entre resultado, ação principal e ações
secundárias, e como o vendedor enxerga a diferença entre "congelar hoje" e "recalcular depois" sem ler as
folhas.

## Perguntas em aberto para o dono
1. **Qual é a ação principal no fim desta página?** "Salvar produto" mora no topo. Ela desce para o rodapé,
   é repetida nos dois lugares, ou continua onde está e o rodapé assume que o produto já foi salvo?
2. **A ordem das duas ações**: aqui é Orçamentos → Simulação; em Calcular é Simulação → Orçamentos. As duas
   telas devem ser unificadas, e qual ordem manda?
3. **Produto novo**: as duas ações continuam simplesmente ausentes, ou aparecem desabilitadas com uma linha
   dizendo que precisam do produto salvo antes?
4. **Premium pausado**: o rodapé fica calado (o alerta do topo já explicou) ou repete ali, ao lado do preço,
   que salvar está pausado?
5. **A assimetria offline** (Orçamento pende, Simulação recusa) deve ser dita antes do clique, no rodapé,
   ou continua aparecendo só dentro da folha?
