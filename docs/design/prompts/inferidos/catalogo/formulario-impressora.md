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

- **Onde vive:** As mesmas duas casas do formulário de filamento, na seção Impressoras: na folha lateral abaixo de 1280px, e dentro da ficha de 560px da coluna direita a partir de 1280px. É o formulário mais alto da área — é por causa dele que a ficha do desktop tem rolagem interna própria (altura máxima igual à janela menos a goteira).
- **Como o vendedor chega:** Pelo botão "Adicionar impressora" da barra/linha de contagem, ou selecionando uma impressora salva na lista.
- **Vizinhança imediata:** Coluna única com gap de 12px, nesta ordem: "Nome" (texto, obrigatório) · "Valor da máquina" (R$, obrigatório) · "Vida útil da máquina" (sufixo h, obrigatório) · "Consumo médio" (sufixo kW, obrigatório, ÚNICO campo com uma dica sob o rótulo — a que pede o consumo médio real, não o da placa) · "Reserva de manutenção" (R$ com sufixo /h, único marcado com a etiqueta "opcional"). Abaixo: alerta de erro de gravação, alerta de reativação em Premium pausado, e as ações "Voltar" + "Salvar" à direita. Na ficha do desktop, esse rodapé pode ficar abaixo da dobra da própria ficha, exigindo rolagem dentro dos 560px.
- **Dados que chegam (e o que ela devolve):** Em edição, os cinco valores da impressora salva já normalizados; em criação, vazios. A vida útil tem regra própria (precisa ser maior que zero — é denominador do custo por hora). Devolve o payload de fio ao servidor.
- **O que acontece depois:** Salva, a impressora alimenta a lista (resumo "R$ 2.400,00 · 4680 h · 0,12 kW"), o seletor da Calcular e o seletor do editor de produto, e é dela que saem valor, vida útil, consumo e reserva ao serem escolhidos lá. Falha mantém a superfície aberta com a frase honesta.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Formulário de impressora — os 5 campos que decidem depreciação e energia

## O que desenhar
O formulário de cadastro/edição de uma impressora no Catálogo (aba **Impressoras**). É o formulário mais
longo do Catálogo e o único que alimenta dois custos que o vendedor não enxerga sozinho: a **depreciação
da máquina** (valor ÷ vida útil) e a **energia** (consumo × horas × tarifa). O vendedor chega aqui uma vez
por impressora — no primeiro uso do produto, ou quando compra máquina nova — e depois só reencontra a peça
para conferir/ajustar. Ela aparece em dois lugares diferentes: no **mobile**, dentro de uma gaveta (Sheet)
ancorada à direita, aberta por "Adicionar impressora" ou por tocar num item da lista; no **desktop
(≥1280px)**, o formulário É a ficha do mestre-detalhe — a coluna direita de 560px, com a lista de
impressoras à esquerda. É o MESMO formulário nos dois lugares, montado em molduras diferentes.

## Por que este prompt existe
A auditoria classificou como `PROTOTIPO_PARCIAL`: o canvas 018 desenha os cinco campos com rótulos,
prefixos e sufixos idênticos aos implementados, e o DS documenta as props `hint` e `optional` do `Field` —
então o conjunto de campos e a FORMA da dica/tag têm desenho. Sobrevive sem autoridade nenhuma:
(a) a **ordem** — o canvas põe *Consumo médio* antes de *Vida útil da máquina*, o código faz o contrário;
(b) o **texto da dica** e a decisão de dar dica a UM campo só; (c) **qual** campo leva a tag "opcional";
(d) o arranjo em **coluna única** contra a grade do canvas; (e) o comportamento dentro dos **560px** da
ficha — este formulário é literalmente o motivo de a ficha ter rolagem interna própria (research §F: "o
caso do formulário de impressora com todos os campos"). Um protótipo antigo (§E5) descrevia outra
impressora — "modelo, h/dia, dias/mês, payback, nível de uso" — que pertence ao modelo de precificação
**descartado**; não use essa referência.

## O que já existe hoje (não invente do zero — corrija)
Ordem implementada, com os textos literais em pt-BR:

| # | Rótulo (literal) | Prefixo | Sufixo | Obrigatório | Ajuda |
|---|---|---|---|---|---|
| 1 | "Nome" | — | — | sim (`*`) | placeholder "Ex.: Ender 3" |
| 2 | "Valor da máquina" | `R$` | — | sim (`*`) | nenhuma |
| 3 | "Vida útil da máquina" | — | `h` | sim (`*`) | nenhuma |
| 4 | "Consumo médio" | — | `kW` | sim (`*`) | dica: "Consumo médio real da impressora, não a potência de placa (~0,12 kW)." |
| 5 | "Reserva de manutenção" | `R$` | `/h` | não | tag "opcional" à direita do rótulo |

Rodapé: dois botões alinhados à direita — "Voltar" (fantasma) e "Salvar" (primário) ou "Salvar alterações"
no modo edição. Título da gaveta: "Nova impressora" / "Editar impressora". Sucesso: toast "Impressora
salva." — e só depois de um 2xx real.

→ **A ordem diverge do canvas.** O canvas põe Consumo médio (3º) antes de Vida útil (4º). Decida uma e
diga qual, porque a ordem é o roteiro mental: "quanto custou → quanto tempo dura → quanto gasta de luz".

→ **A dica some quando o campo erra.** O `Field` do DS troca a dica pela mensagem de erro. Ou seja: a
única frase que impede o vendedor de copiar a potência da etiqueta desaparece exatamente quando ele
digitou algo errado nesse campo. Resolva no desenho (dica e erro coexistindo, ou a ajuda saindo do rodapé
do campo para um `InfoTip` no rótulo).

→ **A ajuda é desigual entre a Calculadora e o Catálogo.** Os MESMOS três campos (Consumo médio, Vida útil
da máquina, Reserva de manutenção) já têm textos longos homologados de `InfoTip` na Calculadora — ex.:
"A impressora se gasta imprimindo. Espalhar o preço dela pelas horas faz cada peça devolver um pedaço da
máquina… Ex.: 1.200 h/ano × 3 anos = 3.600 h." Aqui, nenhum deles aparece. O vendedor que cadastra a
impressora pelo Catálogo tem MENOS ajuda do que quem digita o mesmo número na Calculadora.

→ **Os avisos de plausibilidade não rodam aqui.** A frase "Confira o consumo: {v} kW. Acima de 5 kW já é
faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer watts: 120 W
são 0,12 kW. Nada foi recusado." existe e é disparada na Calculadora, não neste formulário. Um 350 (watts
digitado como kW) é salvo em silêncio e envenena todo cálculo futuro.

→ **A linha de resumo da lista discorda do canvas.** Implementado: "R$ 2.400,00 · 4680 h · 0,12 kW".
Canvas: "0,12 kW · 4.680 h de vida útil" com o dinheiro à parte. Note o `4680` sem separador de milhar.

## Conteúdo e dados reais
Use estes valores — são os do canvas 018 e são plausíveis:

- **Ender 3 V3** — Valor R$ 2.400,00 · Vida útil 4.680 h · Consumo 0,12 kW · Reserva R$ 0,50 /h
- **Bambu A1 mini** — Valor R$ 1.899,00 · Vida útil 3.600 h · Consumo 0,10 kW · Reserva R$ 0,40 /h

Formato e limites reais: números em pt-BR (vírgula decimal); campos de dinheiro ganham agrupamento de
milhar **ao sair do campo** ("2400,00" vira "2.400,00"). Teclado numérico no mobile. Placeholder padrão dos
numéricos: "0,00". Vida útil deve ser **> 0** (é denominador). Tetos: valor da máquina < R$ 10.000.000.000,
vida útil < 1.000.000 h, consumo < 100.000 kW, reserva < 1.000.000.000.000 /h. "Reserva de manutenção" em
branco vale **zero** — não é erro. Desenhe um caso longo: nome com 60+ caracteres sem espaço (o vendedor
cola código de modelo), e um valor de 10 dígitos, para provar que a coluna de 560px aguenta.

## Estados obrigatórios
1. **Repouso** — os 5 campos vazios (criar) ou preenchidos (editar).
2. **Foco** — anel de foco visível em campo, botão e no card da lista.
3. **Hover / pressionado** — nos dois botões do rodapé e nos cards da lista (desktop).
4. **Erro por campo**, com as frases literais: "Campo obrigatório." · "Informe um número válido." ·
   "Não pode ser negativo." · "Valor muito alto." · e a específica da vida útil: "A vida útil deve ser
   maior que zero." Mostre um quadro com o formulário em erro múltiplo.
5. **Salvando** — botão "Salvar" em carregamento; os campos continuam legíveis.
6. **Falha de escrita** — alerta de perigo acima do rodapé, com o texto honesto que o servidor der.
7. **Offline** — alerta calmo (info, nunca perigo) no topo do painel: título "Modo leitura offline",
   corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão.";
   e o bloqueio de escrita: "Criar e editar precisam de conexão."
8. **Degradado (cache antigo)** — legenda "pode estar desatualizada" sob o item na lista.
9. **Premium pausado (lapsed)** — o formulário inteiro inerte, "Salvar" **substituído** pela linha de
   reativação: título "Reative o Premium", corpo "Reative o Premium para voltar a criar e editar. Seus
   itens estão salvos."; e no topo, "Premium pausado" / "Seus itens continuam aqui e podem ser usados no
   cálculo. Para criar ou editar, reative o Premium." O botão "Voltar" continua ativo.
10. **Vazio do catálogo** — "Nenhuma impressora salva ainda" / "Salve os dados da sua impressora uma vez e
    reutilize em cada cálculo." + botão "Adicionar impressora".
11. **Carregando a lista** — spinner; **erro de carga** — "Não foi possível carregar seu catálogo." +
    "Tentar novamente".

## Viewports
- **Mobile 390px** — a gaveta lateral em altura cheia, com teclado numérico aberto: prove que o rodapé
  "Voltar / Salvar" e o campo em foco convivem com o teclado.
- **Desktop 1280px** — o corte onde o mestre-detalhe nasce: lista à esquerda em coluna única + ficha de
  560px à direita, com os 5 campos e o rodapé. É AQUI que se decide a rolagem interna da ficha: mostre o
  estado em que o formulário é mais alto que a janela.
- **Desktop 1920px** — a lista vira duas colunas de cards; a ficha continua com 560px fixos.

## Regras que o desenho não pode quebrar
- **Freemium é binário e calmo**: sem Premium ativo, nada de CRUD falso — a interceptação acontece no
  toque, não no envio. Nenhum preço e nenhuma data na linha de reativação.
- **Falha de rede nunca é vendida como "não é premium"**, e vice-versa. Offline é info; erro de escrita é
  perigo; premium pausado é info.
- **Frase honesta nunca mora em placeholder** (o placeholder recorta). A dica do consumo, a tag "opcional"
  e a legenda de degradação vivem em elementos de largura cheia.
- **Alvos ≥44px** em botões, cards da lista e ícones de ação (duplicar/excluir).
- **Contraste medido contra o fundo real** — inclusive o card selecionado da lista, que troca o fundo.
- **Procedência do número**: a reserva de manutenção é por HORA (o sufixo "/h" não pode sumir no
  estreitamento); o consumo é medido, não é o da etiqueta.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não estimado**: um nome de 500 caracteres sem espaço já gerou 4.948px de
  rolagem horizontal a 1440px no card da lista. Desenhe o nome longo quebrando.
- **Texto ocluso passa em teste**: `toBeVisible` aprova elemento coberto. A ficha rola por dentro
  (`max-height` da janela) — se o rodapé "Salvar" ficar fora da área rolável, ninguém salva.
- **Sufixo cortado**: no 390px, um sufixo largo compete com o rótulo pela mesma linha apertada; por isso o
  gatilho de ajuda fica na LINHA DO RÓTULO, nunca na linha do controle.
- **A máscara de milhar se perde ao reabrir programaticamente** (follow-up conhecido) — desenhe o valor
  reaberto já agrupado: "R$ 2.400,00", não "2400".
- **Screenshot só vale em 1:1**; assertiva geométrica pega o que o texto não pega.

## Entregável
Pranchetas, tema **escuro como padrão** e **claro como first-class** (ambos desenhados, não derivados):
1. Mobile 390px — gaveta em repouso (criar, campos vazios).
2. Mobile 390px — gaveta em edição preenchida (Ender 3 V3), com teclado numérico.
3. Mobile 390px — erros múltiplos + a dica do consumo coexistindo com o erro.
4. Desktop 1280px — mestre-detalhe completo, ficha com os 5 campos e rodapé.
5. Desktop 1280px — ficha rolando por dentro (topo e fim visíveis em dois recortes).
6. Desktop 1920px — lista em duas colunas + ficha.
7. Premium pausado (um viewport basta) e Offline (um viewport basta).
8. Nome longo/valor de 10 dígitos, no 1280px.

Reutilize os primitivos: o quadro de campo (rótulo + `*` obrigatório + tag "opcional" + dica + erro) é o
`Field`; os quatro numéricos são `NumberField` com prefixo `R$` / sufixos `h`, `kW`, `/h`; o Nome é o
input de texto simples; rodapé com `Button` fantasma + `Button` primário com estado de carregamento;
avisos com `Alert` nos tons info/perigo; vazio com `EmptyState`; ficha e cards da lista com `Card`;
gatilho de ajuda com `InfoTip`. **Não crie primitivo novo** — se algo parecer faltar, diga qual e por quê,
em vez de desenhar um componente inédito.

## Perguntas em aberto para o dono
1. **Ordem dos campos**: canvas (Valor → Consumo → Vida útil → Reserva) ou código (Valor → Vida útil →
   Consumo → Reserva)? A ordem muda o roteiro de raciocínio do vendedor.
2. **Nível de ajuda**: os três campos (Consumo, Vida útil, Reserva) recebem os `InfoTip` longos já
   homologados na Calculadora, ou o Catálogo fica só com a dica curta do consumo? Hoje o mesmo vendedor
   tem ajudas diferentes para o mesmo número em telas diferentes.
3. **Aviso de plausibilidade neste formulário**: o "Confira o consumo… Nada foi recusado." deve aparecer
   ao salvar uma impressora com 350 kW, ou o aviso continua exclusivo da Calculadora?
4. **Vida útil por ritmo**: a Calculadora já oferece derivar as horas por ritmo de uso + payback
   ("Com que frequência ela roda?" / "Em quantos anos quer que ela se pague?"). O cadastro da impressora
   deve oferecer o mesmo caminho, ou continua pedindo horas cruas?
5. **Resumo do item na lista**: "R$ 2.400,00 · 4.680 h · 0,12 kW" (código, com milhar corrigido) ou
   "0,12 kW · 4.680 h de vida útil" com o valor à parte (canvas)?
