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

- **Onde vive:** Rota /catalogo, ocupando o corpo do painel da seção — no desktop toma a largura toda e leva junto a coluna da ficha, que não chega a existir neste estado.
- **Como o vendedor chega:** A leitura da seção falhou e não há cache do aparelho para servir: rede caiu antes da primeira carga, servidor fora do ar, ou — no caso irmão — o servidor negou a leitura por plano.
- **Vizinhança imediata:** Acima: a faixa de cabeçalho com título e pílulas de seção (o vendedor ainda pode trocar de aba). Abaixo: nada. Duas formas coexistem no mesmo lugar: (a) um alerta de tom perigo com o título "Não foi possível carregar seu catálogo." e, DENTRO do corpo do alerta, um botão secundário pequeno "Tentar novamente" com 8px de respiro acima; (b) quando o servidor responde plano insuficiente, um estado vazio com ícone de coroa que traz APENAS um título — sem corpo, sem botão, sem saída.
- **Dados que chegam (e o que ela devolve):** Recebe o erro tipado da leitura (código e mensagem já traduzidos). A distinção entre as duas formas é feita pelo código "plano necessário"; qualquer outro erro cai no alerta vermelho.
- **O que acontece depois:** "Tentar novamente" repete a leitura no lugar, sem sair da tela: sucesso troca o alerta pela lista; nova falha mantém o mesmo alerta. O estado de coroa não oferece nenhuma ação — o caminho de volta é trocar de aba ou ir para a Conta.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Catálogo que não carregou: o caminho de volta

## O que desenhar

O estado da aba **Catálogo** quando a leitura da lista falha e não há nada em cache para mostrar — e o
estado irmão, que mora no mesmo ponto do código, em que o servidor recusa a leitura por falta de Premium
ativo. É a área de conteúdo abaixo do cabeçalho "Catálogo" e das pílulas de seção (**Filamentos ·
Impressoras · Produtos · Kits**): no lugar da lista de itens salvos aparece hoje um bloco de erro. Quem
vê é o vendedor premium que abriu o app com internet ruim, com o servidor fora do ar, ou com a assinatura
em estado que o servidor não reconhece como ativa — normalmente no meio de um cálculo, indo buscar um
filamento salvo. Esse mesmo painel serve as quatro seções, então o desenho vale igual para Filamentos,
Impressoras, Produtos e Kits.

## Por que este prompt existe

O estado não foi inventado do zero: o protótipo de 2026-07-02 (`-fixes.md`, item 17) especificou
nominalmente "estado 'Não foi possível carregar. Tente de novo.' + botão 'Tentar novamente'" e a V2 marcou
`load-error+retry` como entregue — o rótulo do botão tem autoridade e não muda. O que **nunca foi
desenhado** é: (1) o título que o código realmente usa, diferente do especificado; (2) o **recipiente** —
alguém decidiu que isso seria um alerta vermelho com um botão pequeno enfiado dentro do corpo dele, em vez
de um estado de página com ação própria; (3) a consequência no desktop, porque o ramo de erro vem **antes**
do ramo de largura no código e por isso engole também a coluna da ficha; (4) o ramo `ENTITLEMENT_REQUIRED`,
que não tem autoridade nenhuma — o protótipo só conhecia a conta grátis (que vê um estado vazio COM
descrição e ação) e não conhecia um 403 de leitura para uma conta premium pausada/inativa.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/catalog/catalog-panel.tsx` (ramos de `list.isError`),
`catalog-master-detail.css`, `shared/i18n/messages.pt-br.ts`.

| Ramo | O que aparece hoje | Problema |
| --- | --- | --- |
| Falha de leitura sem cache | `Alert` tom **danger** (fundo/borda de erro, ícone `circle-alert`, `role="alert"`), título **"Não foi possível carregar seu catálogo."**, e dentro do corpo do alerta um botão secundário **pequeno** "Tentar novamente" | → o botão é a única saída da tela e está no tamanho `sm`, dentro de um bloco de aviso; → o alerta vermelho ocupa a largura inteira e não tem corpo de texto, só título + botão; → nada explica que os itens continuam salvos no servidor |
| Leitura recusada por Premium | `EmptyState` com ícone de coroa e **só** o título **"Salvar faz parte do Premium."** — sem descrição e **sem nenhuma ação** | → beco sem saída: nenhum botão, nenhum caminho para reativar; → a frase fala de **salvar** enquanto o que falhou foi **ler** — é a mensagem errada nesse lugar |
| Ao tocar "Tentar novamente" | a nova busca torna a lista "carregando", então o bloco de erro **some inteiro** e vira um `Spinner` centralizado com folga vertical; falhando de novo, o alerta vermelho volta | → o conteúdo salta duas vezes e o botão não dá sinal nenhum de que foi apertado |
| Desktop ≥1280px | o ramo de erro vem antes do ramo de largura: some a grade mestre-detalhe inteira (lista à esquerda + ficha fixa de **560px** à direita), somem a busca "Buscar no catálogo…", a contagem "{n} filamento(s)" e o botão "Adicionar filamento" | → uma faixa vermelha de ~1200px de largura com um botão de ~140px perdido dentro dela |

Vizinhança que **já está desenhada e é o contraste que interessa**: quando a leitura falha mas existe cache
no aparelho, o painel mostra um alerta **tom info** (nunca vermelho) com título "Modo leitura offline" e
corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."; e o
Premium pausado mostra "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para
criar ou editar, reative o Premium." — os dois calmos, com título **e** corpo. O estado de falha total é o
único da família que grita e o único sem corpo explicativo.

## Conteúdo e dados reais

- Título atual (literal): **"Não foi possível carregar seu catálogo."** — o protótipo pedia "Não foi
  possível carregar. Tente de novo."; escolha uma e diga qual, mas mantenha o par título curto + frase de
  apoio.
- Ação (literal, com autoridade, **não reescrever**): **"Tentar novamente"**.
- Estado irmão de entitlement (literal hoje): **"Salvar faz parte do Premium."**
- Frases irmãs da mesma família, para calibrar tom e evitar cinco jeitos de dizer a mesma coisa:
  "Não foi possível carregar seus orçamentos." (Histórico), "Não foi possível carregar seus itens salvos
  agora." (seletor do cálculo), "Algo deu errado." / "Recarregar" (a tela cheia de erro do app — superfície
  diferente, não copie a linguagem dela aqui).
- O que a tela perdida continha, e que o desenho do erro precisa deixar recuperável: busca ("Buscar no
  catálogo…"), contagem ("3 filamento(s)"), "Adicionar filamento" / "Adicionar impressora" /
  "Adicionar produto" / "Montar kit", e a ficha do item selecionado.
- Nenhum dado numérico do vendedor aparece neste estado: não há preço, não há data. Não desenhe valores
  falsos de exemplo dentro do bloco de erro.

## Estados obrigatórios

1. **Erro de carga (repouso)** — o estado principal: título, uma frase de apoio honesta e a ação
   "Tentar novamente". A frase de apoio precisa dizer o que é verdade: os itens continuam salvos, o que
   falhou foi buscar a lista agora.
2. **Ação em foco por teclado** — anel de foco visível contra o fundo do bloco (que pode ser vermelho suave;
   meça o contraste contra ESSE fundo, não contra o fundo da página).
3. **Hover** e **pressionado** da ação.
4. **Nova tentativa em andamento** — hoje não existe: desenhe o que substitui o salto de conteúdo (ação em
   carregamento no próprio lugar, ou o bloco mantido com indicação de que está buscando). Sem prometer
   sucesso antes do servidor responder.
5. **Falhou de novo** — o que muda na segunda tentativa seguida (a mesma tela repetida sem reconhecimento
   nenhum é o pior caso).
6. **Leitura offline (cache presente)** — NÃO é este bloco: mostre lado a lado, no tom info, para provar
   que falha de rede com dados em mãos nunca vira vermelho.
7. **Premium pausado** — alerta info calmo acima da lista carregada, com a lista intacta.
8. **Sem permissão de leitura (`ENTITLEMENT_REQUIRED`)** — precisa de título, corpo e **uma ação**. Hoje
   tem só um título.
9. **Erro no desktop com a ficha** — como a coluna de 560px se comporta quando não há lista: some, vira
   espaço vazio, ou o bloco de erro ocupa a faixa inteira? É a decisão central do desenho.

## Viewports

- **Mobile 390px** — a lista é a tela inteira; o bloco de erro é tudo o que o vendedor vê. Alvo da ação
  ≥44px de altura e largura confortável para o polegar.
- **Desktop 1280px** — o primeiro pixel do mestre-detalhe (lista + ficha de 560px). É aqui que a decisão
  sobre a coluna da ficha aparece.
- **Desktop 1920px** — acima de 1600px a lista vira duas colunas; um bloco de erro esticado por ~1550px de
  largura é o caso feio a resolver (largura máxima de leitura, centralizado ou ancorado à esquerda).

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como falta de Premium**, e o inverso também não: o bloco de erro de carga
  não pode conter oferta, preço, data ou CTA de assinatura.
- **Nada de preço nem de data** em qualquer estado de Premium (regra vigente na casa).
- **Freemium é binário**: a conta grátis já encontra o teaser antes desta tela; este estado é de conta
  premium, e confundir os dois é o defeito que ele já tem.
- **A frase honesta vive em elemento de largura cheia**, nunca dentro de um `placeholder` nem cortada por
  reticências — armadilha já paga neste projeto.
- **Vermelho é para o que falhou de verdade e não tem plano B.** Se existe cache, é info. O desenho precisa
  deixar essa hierarquia óbvia entre os três blocos.
- **Alvo de toque ≥44px** e contraste medido contra o fundo real do bloco, nos dois temas.
- Sem transbordo horizontal em nenhum viewport: nomes longos sem espaço já geraram 4.948px de rolagem
  nesta mesma tela, e o bloco de erro herda a mesma faixa.

## Armadilhas já pagas neste projeto

- Um estado que **substitui a página inteira** no desktop leva junto colunas que não têm relação com a
  falha — é exatamente o que acontece aqui com a ficha de 560px.
- Um botão pequeno dentro de um alerta passa em qualquer teste de texto e some aos olhos de quem está
  frustrado: teste visual, não textual.
- Estado vazio **sem ação** já foi julgado beco sem saída neste app (o vazio de busca ganhou "Limpar
  busca" justamente por isso).
- Conteúdo que salta (erro → spinner → erro) foi reprovado antes; o retorno visual tem que acontecer no
  lugar onde o dedo tocou.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como igual**:

1. Erro de carga — mobile 390px (repouso · ação em foco · nova tentativa em andamento).
2. Erro de carga — desktop 1280px, mostrando o que acontece com a coluna da ficha.
3. Erro de carga — desktop 1920px, com a largura máxima de leitura resolvida.
4. Comparativo dos três blocos empilhados: falha total (vermelho) · leitura offline com cache (info) ·
   Premium pausado (info) — para provar a hierarquia.
5. Sem permissão de leitura (`ENTITLEMENT_REQUIRED`) com título, corpo e ação, em 390px e 1280px.

Reutilize os primitivos existentes, sem criar componente novo: `tf-alert` (tons `danger`/`info`) para os
blocos de aviso, `tf-empty` (ícone + título + descrição + ação) para o estado de página, `tf-btn` nas
variantes `secondary`/`ghost` para as ações, `tf-spinner` para a busca em andamento, `tf-card` para a
moldura da área de conteúdo. Se a sua decisão for tirar a ação de dentro do alerta, mostre-a como
`tf-empty` com ação — o primitivo já existe e já tem esse encaixe.

## Perguntas em aberto para o dono

1. O bloco de erro deve ser **alerta vermelho** ou **estado de página** (`tf-empty` com ícone, corpo e
   ação)? Os dois primitivos existem; a escolha muda o peso visual da falha.
2. Vale o título do código ("Não foi possível carregar seu catálogo.") ou o do protótipo ("Não foi possível
   carregar. Tente de novo.")? E as quatro variantes irmãs — Catálogo, Orçamentos, seletor do cálculo —
   convergem para uma frase só?
3. No `ENTITLEMENT_REQUIRED` de **leitura**, qual é a ação? Levar para a Conta/reativação, ou só explicar?
   E qual frase, já que "Salvar faz parte do Premium." fala de escrita num erro de leitura?
4. No desktop, o erro ocupa a faixa inteira ou fica só na coluna da lista, com a coluna da ficha exibindo
   um estado próprio de "nada selecionado"?
