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

## O mapa funcional de Kits / BOM multi-peça

### O que é a área Kits

O vendedor de impressão 3D às vezes não anuncia uma peça: anuncia um **conjunto** ("suporte + base", "kit de 3 vasos"). A aba **Kits** é onde ele monta esse conjunto peça por peça e vê o preço do kit inteiro — custo total, preço de varejo, preço de atacado e, se ele usa marketplaces, quanto sai o anúncio e quanto sobra líquido em cada canal.

### Como ele chega e o que encontra

- **Aba 3 da navegação** (`/kits`, rótulo "Kits") → cai no **compositor vazio**, pronto para montar um kit novo.
- **`/kits?id=<id>`** → o mesmo compositor **hidratado com um kit salvo** (veio da aba Kits dentro do Catálogo, ou de um "Salvar kit" que acabou de acontecer). As peças chegam já resolvidas pelo servidor.
- **`/kits?id=<id>&copy=true`** → duplicar: carrega os mesmos dados, o nome ganha o sufixo "(cópia)" e **salvar cria um kit novo** — nada é escrito sem o vendedor mandar.
- **`/catalogo?tab=kits`** → a *lista* de kits salvos (quarta pílula do Catálogo, ao lado de Filamentos · Impressoras · Produtos). Não é uma segunda tela de edição: abrir uma linha manda de volta para `/kits?id=`.

A rota `/kits` é **pública** — quem está deslogado ou sem Premium chega nela e vê um teaser honesto, nunca um chute para fora.

### O que a área guarda, e o que ela só calcula

Um kit salvo guarda **estrutura, nunca dinheiro**: nome, ordem das peças, quantidade e, por peça, ou uma **referência viva** a um produto do catálogo ou os valores próprios daquela peça. Preço **nenhum** é armazenado — ele é recalculado do zero a cada abertura, pelo motor `pricing-core`, que roda **no aparelho e offline**. Por isso a linha da lista de kits só sabe dizer "3 peça(s)", jamais um valor.

As leituras (kits salvos, produtos do catálogo) vêm do servidor e ficam num **cache local por conta**; se a rede falhar, o cache continua servindo e a tela diz que o dado pode estar desatualizado. **As escritas de kit são só online** — o servidor é quem decide o direito de gravar, então não existe fila/outbox para "Salvar kit" e não existe confirmação otimista: o toast "Kit salvo." e o recibo só aparecem depois de uma resposta real.

### De que depende

Catálogo de **tarifas de marketplace** servido + cacheado (alimenta os preços por canal de todas as peças de uma vez) · **entitlement** consultado no servidor (`active` · `lapsed` · `none`) · **sessão Firebase** · o catálogo de **produtos** do vendedor (o seletor de peça) · o motor `pricing-core`.

### O que a área alimenta depois

- **Salvar kit** escreve no catálogo do vendedor: cada peça que não é referência vira um **produto novo em Produtos** (materialização) — e é isso que o recibo pós-salvamento conta.
- **Salvar em Orçamentos** congela o kit como documento (aba Orçamentos): o preço de hoje vira registro imutável, itemizado peça a peça. Sai da esfera do "vivo".
- Um kit salvo também pode virar base de um cálculo na aba Calcular.

### Como muda por estado

| estado | o que o vendedor vê |
|---|---|
| **grátis / deslogado** | nenhum compositor: só o cabeçalho e o teaser Premium honesto |
| **Premium ativo** | tudo: compor, salvar, duplicar, congelar em Orçamentos |
| **Premium pausado (lapsed)** | **criar** está fechado (painel calmo de reativação + "Ver meus kits"); **reabrir e recalcular** um kit salvo continua funcionando, com faixa informativa no topo; "Salvar kit" continua **visível** e responde honestamente ao ser tocado; "Salvar em Orçamentos" **não existe** ali |
| **offline** | calcular funciona inteiro; leituras vêm do cache; salvar kit falha e diz por quê — falha de rede nunca é vendida como "você não tem Premium" |
| **sessão expirada** | volta ao teaser deslogado; o "Entrar" promete voltar para `/kits` |
| **plano não verificável** | estado próprio: "Verificando seu plano…" ou a parede "Não foi possível verificar seu plano." + "Tentar novamente" — deliberadamente diferente de "você não tem Premium" |

## O ponto exato de inserção desta peça

- **Onde vive:** Cartão logo acima da barra "Total do kit". No mobile ele rola no fluxo normal (a barra do total é que fica colada no rodapé); no desktop é o PRIMEIRO cartão da coluna direita de 480px, com o total logo abaixo dele. Some inteiro quando nenhuma peça usa marketplace.
- **Como o vendedor chega:** Aparece sozinho assim que ao menos uma peça tem um canal de marketplace configurado. É onde o vendedor confere quanto sai o anúncio do kit em cada canal e quanto sobra líquido.
- **Vizinhança imediata:** Título "Preços por canal (kit)" e, embaixo, um bloco por marketplace, separados por uma linha fina. Cada bloco: o nome do canal ("Mercado Livre", "Shopee") e QUATRO linhas de dinheiro — "Varejo · Preço do anúncio", "Varejo · Recebido líquido", "Atacado · Preço do anúncio", "Atacado · Recebido líquido" — mais uma legenda pequena "{n} peça(s) somaram neste canal" e, quando for o caso, "{n} peça(s) sem preço neste canal — não entrou na soma.". Dois blocos = 8 linhas de dinheiro e até 4 legendas. Existem dois blocos de ausência: um que diz "Nenhuma peça com preço neste canal." e um bloco sintético — um canal que aparece SEM nenhum número, só com a legenda de exclusão, porque todas as suas peças eram inválidas ali.
- **Dados que chegam (e o que ela devolve):** Os rollups por canal vêm somados do pricing-core (soma sobre as peças válidas × quantidade); as contagens de peças puladas por falha de preenchimento são contadas pela página e mescladas aqui. A tela não multiplica nem soma nada.
- **O que acontece depois:** Nada é clicável: é leitura. Mas é ele que o vendedor usa para decidir o preço do anúncio, e é o número que será congelado se ele tocar "Salvar em Orçamentos" logo abaixo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Cartão "Preços por canal (kit)" — a soma do kit em cada marketplace

## O que desenhar

O cartão que mostra, para cada marketplace usado nas peças do kit, quanto o kit inteiro precisa ser
anunciado e quanto sobra líquido — em varejo e em atacado. Vive na aba **Kits** (`/kits`), dentro do resumo:
no mobile rola em fluxo normal acima da barra fixa "Total do kit"; no desktop (≥1280px) mora na coluna
direita de **480px**, `sticky` inteira. Quem lê é o vendedor no meio da montagem, já com custo e preço na
mão, decidindo se anunciar o kit em cada canal fecha a conta. O cartão só existe quando ao menos uma peça
tem canal — sem canal nenhum ele não é renderizado (nem título, nem zero), e essa ausência é deliberada.

## Por que este prompt existe

A **honestidade** deste cartão foi desenhada; a **densidade** não. O protótipo (canvas 018, linhas 224-228)
mostra o cartão com **uma linha por marketplace** — "Mercado Livre · Clássico" e "Shopee" — um valor cada e
a legenda honesta como subtítulo. O app emite **quatro linhas de dinheiro por marketplace** mais uma ou duas
legendas: com dois canais são 8 valores e até 4 legendas num cartão que ninguém julgou. Além disso, dois
estados de ausência não existem em nenhuma prancheta: o bloco vazio ("Nenhuma peça com preço neste canal.")
e o bloco **sintético** — um marketplace que aparece sem nenhum número, só com a legenda de exclusão.
`ux-bom.md` §6.1 item 3 já marcava este protótipo como *honesty-critical / High*; nunca foi feito.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/bom/channel-rollup.tsx` (+ `shared/ui/breakdown-row.css`,
`features/bom/assembly-summary.css`, `pages/bom/bom-page.css`).

Estrutura atual, de cima para baixo, dentro de um `tf-card` com `padding="md"`:

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título do cartão | "Preços por canal (kit)" | é um `<p>` em 14px semibold — **não** é cabeçalho |
| Nome do marketplace | "Mercado Livre" / "Shopee" / "Amazon" / "Outro" / "Canal" | "Canal" é o rótulo de um slot sem marketplace escolhido |
| Linha 1 | "Varejo · Preço para anunciar" | `tf-brow` |
| Linha 2 | "Varejo · Recebido líquido" | `tf-brow` |
| Linha 3 | "Atacado · Preço para anunciar" | `tf-brow` |
| Linha 4 | "Atacado · Recebido líquido" | `tf-brow` |
| Legenda de contribuição | "3 peça(s) somaram neste canal" | 12px, `--text-muted` |
| Legenda de exclusão | "1 peça(s) sem preço neste canal — não entrou na soma." | 12px, `--text-muted`, só quando houver |
| Bloco vazio | "Nenhuma peça com preço neste canal." | substitui as 4 linhas |

→ **Os rótulos são concatenação de duas taxonomias**: a legenda do nível ("Varejo") mais o rótulo do
resultado ("Preço para anunciar"). Quatro rótulos longos e quase iguais empilhados fazem o olho comparar
palavra por palavra em vez de número com número — o desenho deve resolver isso, provavelmente agrupando
por nível (Varejo / Atacado) com o par anúncio/líquido dentro.

→ **A hierarquia visual está invertida e é um defeito medível.** As quatro linhas de um mesmo marketplace
são separadas por um filete `--border-subtle` (regra `.tf-brow + .tf-brow`), mas a fronteira **entre
marketplaces** usa `var(--border-soft, transparent)` — e `--border-soft` **não existe** em nenhum arquivo
de tokens do projeto. Ou seja: a separação mais forte do cartão é hoje literalmente invisível, nos dois
temas, e a mais fraca é a que se vê. Com dois canais o vendedor lê 8 linhas como uma lista só.

→ **A modalidade some.** O protótipo escreve "Mercado Livre · Clássico"; o app escreve só "Mercado Livre".
A soma é agregada **por marketplace**, não por marketplace+modalidade — duas peças, uma em Clássico e
outra em Premium, caem no mesmo bloco. Ver "Perguntas em aberto".

→ **O frete existe no dado e não aparece.** O cálculo carrega `freightCostVarejo`/`freightCostAtacado`
somados do kit e o cartão nunca os mostra; o frete já está descontado dentro de "Recebido líquido". Não é
mentira, mas é a mesma família do defeito A2 do hotfix (frete deduzido sem lugar onde se ver).

## Conteúdo e dados reais

- **Valores**: dinheiro pt-BR (`R$ 1.234,56`), fonte numérica tabular, à direita. Exemplos verdadeiros
  de um kit de 3 peças no Mercado Livre: anúncio varejo **R$ 187,40**, líquido varejo
  **R$ 132,88**, anúncio atacado **R$ 141,60**, líquido atacado **R$ 99,17**. Um kit grande chega a
  **R$ 1.234,56** e a quatro dígitos com facilidade — desenhe com esse valor, não com R$ 24,24.
- **Contagens**: inteiros ≥ 0. O "(s)" está na copy literal, não é plural resolvido → fica feio com n = 1;
  se achar que vale mudar, aponte, mas **não** reescreva a frase sozinho: ela é homologada.
- **Quantos blocos**: um por marketplace usado no kit, sem teto declarado. Hoje são no máximo 4 nomes
  conhecidos + "Canal", então desenhe **até 4 blocos** para ver a altura real.
- **Derivado**: todos os valores são somas Σ(valor da peça × quantidade) calculadas no motor. A tela não
  soma nada e não pode inventar zero: quando nenhuma peça alimentou o canal, os quatro valores vêm nulos.

## Estados obrigatórios

1. **Repouso, um canal** — 4 valores + "3 peça(s) somaram neste canal".
2. **Repouso, dois canais** — o caso denso: 8 valores + 2 legendas. É o estado que precisa de julgamento.
3. **Parcial** — canal com números **e** exclusão: as 4 linhas + "2 peça(s) somaram neste canal" +
   "1 peça(s) sem preço neste canal — não entrou na soma." As duas legendas convivem, e a segunda não pode
   parecer erro (não é alerta, não é vermelho — é uma constatação calma).
4. **Vazio** — nenhuma peça com preço naquele canal: o nome do marketplace + "Nenhuma peça com preço neste
   canal." e **nenhum número**. Nunca R$ 0,00.
5. **Sintético** — o canal existe só porque **todas** as suas linhas tinham campo inválido: nome +
   "Nenhuma peça com preço neste canal." + "2 peça(s) sem preço neste canal — não entrou na soma.". Zero
   dinheiro na tela; nunca foi desenhado e é o estado mais estranho — um marketplace sem um único valor.
6. **Ausência total do cartão** — nenhum canal em nenhuma peça: o cartão inteiro não é renderizado.
   Desenhe a prancheta da coluna **sem** ele, para mostrar que o vazio aqui é silêncio, não uma moldura oca.
7. **Canal sem marketplace escolhido** — o bloco se chama "Canal" (o slot ainda não nomeou o marketplace).
8. **Valor extremo** — quatro dígitos + milhar em todas as 8 linhas, para provar que rótulo e número não
   colidem.

Não há estados de carregamento, erro de rede, offline, degradado ou premium pausado **neste** cartão: ele
lê um cálculo local que já está em memória. O plano e o offline são resolvidos antes, na página.

## Viewports

- **Mobile 390px** — obrigatório: é onde o cartão nasceu e onde a densidade dói. Rola em fluxo normal,
  acima da barra fixa "Total do kit". Largura útil real ~358px com o padding do cartão.
- **Desktop 1280px** — obrigatório: a coluna direita tem **480px** fixos e é `sticky` com
  `max-height: calc(100dvh - 64px)` e rolagem própria. Com 3-4 canais o cartão sozinho passa da altura da
  coluna: mostre como ele se comporta aí (o resumo dividindo espaço com o total e o botão de salvar).

## Regras que o desenho não pode quebrar

- **Ausência nunca vira zero.** Canal sem contribuição mostra a frase, jamais R$ 0,00 — o zero fabricado é
  a mentira que este cartão existe para evitar.
- **Exclusão dita, não escondida.** Toda peça que ficou de fora aparece contada. Nenhuma legenda de
  exclusão pode ser cortada, colapsada atrás de "ver mais" ou virar tooltip: honestidade não mora em
  camada escondida (nem em placeholder — a lição do 016/PR-F).
- **Procedência do número.** Cada valor é soma do kit inteiro (peça × quantidade), não preço de uma peça —
  legível sem exigir dedução.
- **Não é alerta.** A legenda de exclusão é informativa: sem vermelho, sem ícone de erro, sem badge de
  perigo. Vermelho aqui faria o vendedor achar que o produto recusou algo.
- **Contraste medido** das legendas `--text-muted` em 12px contra a superfície real do cartão, nos dois temas.
- Se o desenho introduzir controle interativo (expandir/recolher um canal, por exemplo), alvo **≥44px**.

## Armadilhas já pagas neste projeto

- **Filete que não existe**: `--border-soft` sem definição = separador transparente. Qualquer separação que
  você desenhar precisa apontar para um token que existe (`--border-subtle` / `--border-strong`).
- **Valor longo estoura a coluna**: já aconteceu aqui — a linha de detalhamento teve de aprender a quebrar
  porque um valor grande empurrava rolagem horizontal a 390px. Desenhe com R$ 1.234,56 em todas as linhas.
- **Rótulo longo trava o número**: na barra fixa, "Preço atacado" (111px) não coube em ~101px e obrigou
  rótulos curtos próprios; os rótulos daqui são ainda maiores ("Varejo · Preço para anunciar") — meça.
- **Texto ocluso passa em teste**: um rótulo cortado por overflow continua "visível" para asserção textual.
  A prova é geométrica, e por isso o desenho precisa declarar o que cede quando falta largura (o rótulo,
  nunca o número).
- **Rolagem no eixo Y também conta**: a coluna do desktop rola sozinha, e um cartão que a estoura empurra
  o total do kit para fora do campo de visão.

## Entregável

Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:

1. `Kit · canais 390px` — um canal, estado de repouso.
2. `Kit · canais 390px · dois canais` — o caso denso, 8 valores + 2 legendas.
3. `Kit · canais 390px · vazio + sintético` — os dois estados de ausência lado a lado.
4. `Kit · canais 1280px coluna` — dentro da coluna de 480px, com o cartão "Total do kit" abaixo e o bloco
   de salvar, mostrando a altura acumulada com 3 canais.
5. `Kit · canais 1280px · sem canais` — a coluna sem o cartão, para provar o silêncio.

Reutilize os primitivos: contêiner `tf-card` (padding md); cada valor num `tf-brow` (`__label` / `__sub` /
`__val`, o valor em fonte numérica tabular à direita); o nome do marketplace vira `tf-brow__label` de bloco
ou subtítulo do cartão — não crie cabeçalho novo se um já resolve. Legendas em `--fs-caption` /
`--text-muted`. Se propuser agrupar por nível, use os rótulos curtos existentes ("Varejo", "Atacado") e
diga onde entram "Preço para anunciar" e "Recebido líquido". Anote em cada prancheta qual token de borda
separa os blocos.

## Perguntas em aberto para o dono

1. **A modalidade entra no nome do bloco?** O protótipo escreve "Mercado Livre · Clássico"; o app agrega
   por marketplace e escreve só "Mercado Livre". Se duas peças usam modalidades diferentes do mesmo
   marketplace, elas hoje somam no mesmo bloco — mostrar "Clássico" seria falso. Manter agregado por
   marketplace (e o desenho abandona a modalidade) ou passar a separar por marketplace+modalidade?
2. **O frete somado do kit deve aparecer?** O dado existe (`freightCostVarejo`/`freightCostAtacado`) e hoje
   só está embutido no "Recebido líquido". Depois do hotfix A2 (frete descontado num campo que mostrava
   R$ 0,00), vale decidir se o kit mostra o frete total ou continua só no líquido.
3. **Atacado sempre visível?** Metade das linhas é atacado. Se o vendedor não vende atacado, são 4 números
   inúteis por canal. O atacado deve poder ficar recolhido — e, se sim, isso vale para este cartão só ou
   para o resumo inteiro do kit?
4. **"1 peça(s)"** — a copy homologada carrega o "(s)" literal. Fica como está ou o desenho pode pedir
   plural resolvido ("1 peça somou neste canal")?
