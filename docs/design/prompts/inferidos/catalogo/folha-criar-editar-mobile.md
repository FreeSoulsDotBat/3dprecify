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

- **Onde vive:** Folha lateral que entra pela DIREITA em altura cheia, sobre a rota /catalogo abaixo de 1280px. Só existe nas seções Filamentos e Impressoras (produto e kit navegam em vez de abrir folha).
- **Como o vendedor chega:** Três gestos abrem a mesma folha: o botão "Adicionar filamento/impressora" da linha de contagem (modo criar), o toque na área clicável de um item (modo editar) e o botão de lápis do item (modo editar). Acima de 1280px ela não é usada: o formulário mora na ficha de 560px.
- **Vizinhança imediata:** Por baixo fica a tela do Catálogo inteira, escurecida — cabeçalho, pílulas de seção e lista. Dentro da folha, uma coluna com gap de 16px: primeiro o título ("Novo filamento" / "Editar filamento" / "Nova impressora" / "Editar impressora"), e logo abaixo o formulário completo da entidade. As ações vêm do próprio formulário, no FIM do conteúdo, alinhadas à direita: "Voltar" (fantasma) + "Salvar"/"Salvar alterações" — não há rodapé fixo, elas rolam com o conteúdo. Quando o salvamento falha, um alerta vermelho é injetado ENTRE o último campo e os botões, empurrando-os para baixo no instante em que o dedo ia neles.
- **Dados que chegam (e o que ela devolve):** Em modo editar, recebe os valores do item já convertidos para o formato pt-BR dos campos; em modo criar, campos vazios. Devolve ao servidor a gravação (só online), com dinheiro em formato de fio. Com Premium pausado, abre inerte e sem botão salvar.
- **O que acontece depois:** Um 2xx real fecha a folha, dispara um aviso efêmero de sucesso ("Filamento salvo.") e atualiza a lista por baixo. Qualquer falha mantém a folha ABERTA com a frase específica (offline → "precisa de conexão"; erro do servidor → sua frase em pt-BR) e nada é dado como salvo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Folha de criar/editar filamento e impressora (mobile)

## O que desenhar
A folha (sheet) modal que abre por cima do Catálogo quando o vendedor toca "Adicionar filamento" / "Adicionar impressora", ou toca uma linha da lista para editar. É a única porta de entrada dos dois cadastros que alimentam todo o cálculo de preço: o filamento (custo e peso do rolo) e a impressora (valor, vida útil, consumo, manutenção). Quem usa é o vendedor Premium, normalmente de pé perto da impressora, com o teclado numérico aberto, digitando quatro ou cinco números que ele acabou de ler numa etiqueta ou numa nota fiscal. Vive dentro da aba Catálogo (seções Filamentos / Impressoras); ao salvar com sucesso a folha fecha e um toast confirma. Produtos e Kits NÃO usam esta folha — eles navegam para um editor de página cheia.

## Por que este prompt existe
A peça inteira foi inferida por IA: `catalog-panel.tsx` (linhas 452-476) monta um `SheetContent side="right"` — gaveta lateral de altura cheia — e as ações "Voltar"/"Salvar" vêm de dentro do próprio formulário, alinhadas à direita no FIM do conteúdo, sem rodapé fixo. Nenhuma autoridade de desenho pediu isso: a §D.2 do documento de design (linhas 197-198) define o componente como "Sheet / bottom-sheet — painel radius xl (24px), `--surface-overlay` de fundo, ENTRA DE BAIXO (mobile) / centralizado (desktop)", e o protótipo de 2026-07-02 (`CatalogScreen.jsx`, linhas 70-74) implementa `Sheet placement="bottom"` com rodapé próprio de DOIS botões `full` lado a lado (Cancelar | Salvar). Ou seja: **o código contraria uma regra de desenho explícita**, e o único texto que justifica a gaveta lateral é um comentário citando uma spec textual. O canvas do 018 trocou a gaveta pela ficha lateral no DESKTOP (≥1280px) e não tocou no mobile — abaixo de 1280px a gaveta lateral continua sendo o que o vendedor vê.

## O que já existe hoje (não invente do zero — corrija)
Chrome da folha: painel ancorado à DIREITA, `top:0; bottom:0`, largura `min(92vw, 26rem)` (≈359px num viewport de 390px), cantos arredondados só à esquerda, `padding: --space-5`, `overflow:auto`, scrim `--surface-overlay` cobrindo o resto. Botão "X" de fechar (`aria-label` "Fechar") absoluto no canto superior direito, alvo ≥44×44px; o título já reserva espaço à direita para ele. Fecha por X, Esc e toque no scrim.

Ordem atual do conteúdo, de cima para baixo: título → campos → (Alert de erro de gravação, quando houver) → (Alert de Premium pausado, quando houver) → linha de botões `flex justify-end` ("Voltar" fantasma + "Salvar").

Títulos literais: "Novo filamento" · "Editar filamento" · "Nova impressora" · "Editar impressora".

**Filamento**

| Rótulo | Tipo | Obrigatório | Placeholder / afixo | Exemplo real |
|---|---|---|---|---|
| "Nome" | texto | sim | "Ex.: PLA Azul" | PLA Azul Fosco |
| "Material" | texto | não | "Ex.: PLA" | PLA |
| "Custo do rolo" | número, prefixo R$ | sim | — | R$ 110,50 |
| "Peso do rolo" | número, sufixo kg | sim, > 0 | — | 1 kg |

**Impressora**

| Rótulo | Tipo | Obrigatório | Afixo / dica | Exemplo real |
|---|---|---|---|---|
| "Nome" | texto | sim | "Ex.: Ender 3" | Ender 3 V2 |
| "Valor da máquina" | número, prefixo R$ | sim | — | R$ 1.899,00 |
| "Vida útil da máquina" | número | sim, > 0 | sufixo "h" | 3.600 h |
| "Consumo médio" | número | sim | sufixo "kW" + dica "Consumo médio real da impressora, não a potência de placa (~0,12 kW)." | 0,12 kW |
| "Reserva de manutenção" | número | não | prefixo R$ + sufixo "/h", tag "opcional" | R$ 0,50 /h |

→ **Problema 1 — a ancoragem.** Gaveta lateral no celular, contra a §D.2 e contra o protótipo. Desenhe a folha ENTRANDO DE BAIXO, radius xl nos cantos superiores, altura máxima 85vh (o skin `tf-dialog--sheet-bottom` já existe no DS e não é usado aqui).
→ **Problema 2 — as ações rolam com o conteúdo.** Com 5 campos e o teclado aberto, "Salvar" some abaixo da dobra. O protótipo tinha rodapé fixo com dois botões de largura cheia lado a lado.
→ **Problema 3 — o erro empurra o botão.** O Alert de erro de gravação é injetado ENTRE os campos e os botões: no instante em que a gravação falha, "Salvar" desce ~64px, exatamente onde o dedo já estava indo. Resolva ancorando as ações e colocando o erro onde ele não desloque o alvo.
→ **Problema 4 — "Material" parece obrigatório.** Ele é opcional mas não recebe a marca "opcional" que "Reserva de manutenção" recebe. Dois campos opcionais, duas aparências.
→ **Problema 5 — "Voltar" para descartar.** O rótulo é herdado de uma proibição de copy (a palavra "cancelar" é banida do módulo de mensagens por causa da política de cobrança), mas num formulário "Voltar" lê como navegação, não como descartar o que foi digitado.

## Conteúdo e dados reais
Todos os números são strings pt-BR (vírgula decimal, ponto de milhar) com afixo desenhado dentro do campo, não digitado. Faixas plausíveis: custo do rolo R$ 80,00–R$ 250,00; peso do rolo 1 kg (o rolo comum); valor da máquina R$ 900,00–R$ 15.000,00; vida útil 3.600 h; consumo 0,12 kW; reserva R$ 0,20–R$ 2,00 por hora. Tetos reais que disparam "Valor muito alto.": R$ 10.000.000.000 para dinheiro, 1.000.000 para horas e kg, 100.000 para kW. Mensagens de validação literais: "Campo obrigatório." · "Informe um número válido." · "Não pode ser negativo." · "Valor muito alto." · "O peso do rolo deve ser maior que zero." · "A vida útil deve ser maior que zero." Nada aqui é derivado nem calculado — a folha só coleta; o preço é recalculado depois, em outra tela. Contagem: um filamento tem 4 campos, uma impressora tem 5 — a folha nunca é longa, e mesmo assim hoje ela rola.

## Estados obrigatórios
- **Repouso — criar**: campos vazios com placeholders, "Salvar".
- **Repouso — editar**: campos preenchidos com os valores salvos, botão "Salvar alterações".
- **Foco**: anel de foco visível no campo, incluindo com o teclado aberto (o campo focado não pode ficar debaixo do teclado).
- **Pressionado / hover** nos dois botões e no X.
- **Erro de validação por campo**: moldura de erro no campo + a frase pt-BR abaixo dele; acontece ao sair do campo (onTouched), não a cada tecla.
- **Salvando**: "Salvar" com spinner; os campos continuam legíveis (hoje não são bloqueados) — decida e mostre se ficam inertes.
- **Erro de gravação (offline)**: alerta de perigo com "Criar e editar precisam de conexão." — a folha NÃO fecha e nada é dado como salvo.
- **Erro de gravação (sem Premium ativo)**: alerta de perigo com "Salvar faz parte do Premium."
- **Erro de gravação (sessão expirada)**: "Sua sessão expirou. Entre novamente."
- **Erro de gravação (genérico)**: "Algo deu errado. Tente novamente."
- **Premium pausado (somente leitura)**: todos os campos inertes, o botão "Salvar" DESAPARECE (só resta "Voltar") e entra um alerta informativo — nunca de perigo — com título "Reative o Premium" e corpo "Reative o Premium para voltar a criar e editar. Seus itens estão salvos."
- **Sucesso**: a folha fecha e um toast de sucesso diz "Filamento salvo." ou "Impressora salva." — só depois de a gravação ter realmente acontecido no servidor.
- **Teclado aberto**: desenhe explicitamente esta prancheta. É o estado normal desta peça, não uma exceção.

## Viewports
Desenhe em **390px** — é onde a peça vive e onde ela está errada. Desenhe também **768px** (tablet retrato): a folha lateral continua sendo o que aparece em qualquer largura abaixo de 1280px, e a bottom-sheet precisa de uma regra de largura máxima aí (o protótipo não cobria essa faixa). **Não** desenhe 1280px ou 1920px: a partir de 1280px o Catálogo mostra mestre-detalhe e o formulário passa a viver na ficha à direita, fora do escopo desta peça.

## Regras que o desenho não pode quebrar
- Falha de rede nunca é vendida como falta de Premium, e falta de Premium nunca é vendida como erro técnico: são dois alertas com tons e frases diferentes, ambos literais.
- O toast de sucesso só existe depois de um salvamento real. Não desenhe confirmação otimista.
- Premium pausado é calmo, não punitivo: tom informativo, e os dados do vendedor continuam visíveis e legíveis.
- Frases honestas ("Criar e editar precisam de conexão.", a linha de reativação) moram em elementos de largura cheia, nunca dentro de um placeholder ou de um campo que corte o texto.
- Todo alvo de toque ≥44×44px — X de fechar, botões do rodapé, campos.
- Contraste medido contra o fundo real do painel sobre o scrim, não contra o fundo da página.
- Nenhum campo desta folha aceita ser inventado ou reordenado: são exatamente os 4 do filamento e os 5 da impressora, com esses rótulos.

## Armadilhas já pagas neste projeto
- **O alerta que empurra o botão** — é o defeito central desta ficha. Qualquer coisa que apareça acima das ações desloca o alvo no pior momento possível.
- **Overflow horizontal medido** (016/PR-B): num painel de ≈359px, "Vida útil da máquina" com sufixo "h" e "Reserva de manutenção" com "R$ … /h" são os candidatos naturais a estourar. Verifique com valores longos: R$ 15.000,00 e 3.600 h.
- **Rolagem no eixo vertical não aparece em teste headless**: a folha rolar é invisível para o automatizado e óbvia para o dedo. Mostre onde o conteúdo corta.
- **Texto ocluso passa em teste**: o botão X sobrepõe o canto do título — desenhe a reserva de espaço, não confie no acaso.
- **Frase honesta cortada em placeholder** (016/PR-F): placeholders carregam só exemplos curtos ("Ex.: PLA Azul"); nenhuma regra ou aviso vive dentro de um campo.

## Entregável
Pranchetas, tema **escuro** como padrão e **claro** como equivalente de primeira classe (repita ao menos as pranchetas 1, 3 e 5 no claro):
1. "Novo filamento" em repouso, 390px, bottom-sheet com rodapé fixo.
2. "Editar impressora" com os 5 campos preenchidos, 390px, mostrando a rolagem do corpo e o rodapé parado.
3. Erro de gravação offline, com o rodapé no mesmo lugar de antes do erro.
4. Premium pausado (somente leitura), sem "Salvar".
5. Teclado numérico aberto sobre a folha, com o campo "Consumo médio" focado e sua dica visível.
6. Erro de validação em dois campos ao mesmo tempo + "Salvar" com spinner.
7. A mesma folha em 768px.

Reutilize os primitivos existentes, não crie novos: o skin de folha inferior do `Dialog`/`Sheet` (`tf-dialog--sheet-bottom`, já no DS), o `X` de fechar do próprio Dialog, `Field` para rótulo/dica/erro/tag "opcional", `tf-input`/`tf-inputwrap` para texto, `NumberField` para os numéricos com afixo, `Alert` tom perigo para erro de gravação e tom informativo para a reativação, `Button` fantasma para a ação de sair e `Button` primário com estado de carregamento para salvar, `toast` de sucesso. Indique no desenho qual primitivo é cada parte.

## Perguntas em aberto para o dono
1. **Ancoragem**: confirmamos a volta para a folha inferior (§D.2 + protótipo de 2026-07-02), ou a gaveta lateral fica por alguma razão que só a spec textual registra? O desenho muda inteiro conforme a resposta.
2. **Rodapé**: dois botões de largura cheia lado a lado como no protótipo (Voltar | Salvar), ou "Salvar" de largura cheia com a saída secundária acima? E o erro de gravação: fixo acima do rodapé, ou no topo do corpo, junto ao título?
3. **A palavra de saída**: "Voltar" continua, ou trocamos por algo que diga que o digitado será descartado (a palavra "cancelar" segue proibida no produto)?
4. **Descartar com alterações**: hoje X, Esc e toque no scrim fecham a folha sem perguntar nada, perdendo o que foi digitado. Deve haver confirmação quando houver alteração pendente?
5. **Avisos de plausibilidade**: o Calcular avisa quando "Consumo médio", "Vida útil", "Peso do rolo" e "Reserva de manutenção" recebem valores implausíveis (ex.: "Confira o consumo: 120 kW…"). Esta folha, que grava exatamente os mesmos campos, não avisa nada. Os avisos devem passar a existir aqui?
