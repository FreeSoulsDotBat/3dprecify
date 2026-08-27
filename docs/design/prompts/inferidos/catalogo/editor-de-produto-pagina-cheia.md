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

- **Onde vive:** A rota /catalogo com `?produto=<id>` ou `?produto=novo`: substitui TODO o conteúdo da aba Catálogo — some o cabeçalho com as pílulas de seção, some a lista, some a ficha de 560px. Continua dentro do shell (barra de abas no celular, menu lateral no desktop) e NÃO participa do mestre-detalhe nem a 1920px.
- **Como o vendedor chega:** Quatro gestos levam aqui: "Adicionar produto" na seção Produtos, o toque/lápis num produto da lista no celular, o botão "Abrir para editar" da ficha de 560px no desktop, e a materialização de um kit (que cria produtos, depois abertos por aqui).
- **Vizinhança imediata:** De cima para baixo: o título "Novo produto"/"Editar produto" — SEM qualquer botão de voltar ou fechar no topo; o alerta de atenção quando o produto está sem vínculos; o alerta "Premium pausado" quando é o caso; um cartão com o campo "Nome do produto" MAIS o botão "Salvar produto" MAIS o alerta de erro de gravação (a ação principal mora aqui, no alto); um segundo cartão com os dois seletores de catálogo; então a grade de DUAS colunas herdada da Calcular (à esquerda Custos da peça, Mão de obra e acabamento, Outros custos; à direita Markup e a seção Marketplace); e por fim o rodapé com o preço e as ações de persistência.
- **Dados que chegam (e o que ela devolve):** Recebe o produto salvo (ou campos padrão, em criação), as listas de filamentos e impressoras para os seletores, o catálogo de tarifas servido+cacheado para os canais e o estado do plano. O preço é recalculado ao vivo pelo motor a cada tecla — nenhum preço é lido de lugar nenhum, porque nenhum é guardado.
- **O que acontece depois:** "Salvar produto" grava online e, com um 2xx real, dispara o aviso de sucesso e devolve o vendedor a /catalogo já na aba Produtos. Falha mantém a página aberta com a frase honesta no cartão do nome. O produto salvo passa a alimentar a lista, o seletor de peça dos kits, os orçamentos congelados e as simulações.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Editor de produto em página cheia (Catálogo → Produtos)

## O que desenhar
A tela inteira em que o vendedor cria ou edita um **produto** do Catálogo Premium: o maior formulário do
aplicativo. Ela abre a partir da aba **Produtos** do Catálogo (rota `/catalogo?produto=novo` ou
`?produto=<id>`) e **substitui a página do Catálogo inteira** — as pílulas de abas somem, o cabeçalho vira
"Novo produto" / "Editar produto" e não existe nenhuma outra saída na tela. Quem usa é o vendedor premium
que já salvou pelo menos um filamento e uma impressora e agora quer congelar uma peça no catálogo com todos
os custos, o markup e os canais de marketplace dela. Ao salvar, a tela fecha e volta para a aba Produtos.
Origem no código: `apps/web/src/pages/catalogo/produto-page.tsx` (linhas 272–453) e
`apps/web/src/pages/catalogo/catalogo-page.tsx`.

## Por que este prompt existe
Autoridade de desenho: **NENHUMA**. Nenhuma prancheta, em nenhuma das quatro fontes, jamais desenhou esta
tela. O inventário E1–E9 prevê "form add/editar" em *sheet* só para filamento e impressora; produto aparece
apenas como terceiro segmento de **lista**. O protótipo `CatalogScreen.jsx` trata "produto" com o MESMO
sheet de dois campos — não é remotamente esta tela. E o `research.md` §E do 018 registra por escrito
"Rejeitado: recompor o formulário completo de Produto dentro de 560px" e manda manter "o editor de página
cheia que já existe" — uma decisão textual, sem artboard. Ou seja: a composição inteira (onde mora o
Salvar, a ordem dos blocos, a ausência de saída no topo, e o fato de a tela não participar do mestre-detalhe
do desktop nem a 1920px) foi inferida por IA. Este achado é o **pai** de três outros:
`seletor-de-filamento-e-impressora`, `recados-do-editor-de-produto` e `rodape-do-editor-de-produto` — aqui
desenhamos a **composição e a hierarquia**; o miolo de cada peça tem prompt próprio.

## O que já existe hoje (não invente do zero — corrija)
Ordem vertical atual, de cima para baixo, coluna única centralizada:

| # | Bloco | Conteúdo real hoje |
|---|---|---|
| 1 | Cabeçalho | "Novo produto" ou "Editar produto". → **Sem botão de voltar, fechar ou cancelar. Não há saída.** |
| 2 | Recado (condicional) | Alerta informativo "Vincule um filamento e uma impressora salvos" + "Os valores atuais foram mantidos e continuam editáveis." |
| 3 | Recado (condicional) | Alerta informativo "Premium pausado" + "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." |
| 4 | Cartão nome + ação | Campo "Nome do produto" (obrigatório, placeholder "Ex.: Vaso G") **e** o botão primário "Salvar produto" **e** o alerta de erro de gravação. → **A ação principal mora no primeiro cartão, no alto, a mais de uma tela de distância do preço que o vendedor está conferindo.** |
| 5 | Cartão de referências | Título "Usar do catálogo", legenda "Preenche os campos com o item salvo — você ainda pode editar tudo.", dois selects: "Filamento salvo" e "Impressora salva", ambos com placeholder "Escolher…". |
| 6 | Corpo, coluna esquerda | "Custos da peça" · "Mão de obra e custos" · "Outros custos" (lista de custos nomeados que o vendedor adiciona). |
| 7 | Corpo, coluna direita | "Markup" · "Marketplace" (canais de venda, cada um com marketplace, modalidade, categoria e tarifas). |
| 8 | Rodapé | O resultado de preço vivo (ou o alerta "Confira os campos destacados para ver o preço."), o botão "Salvar em Orçamentos" e o botão "Salvar simulação". |

Duas colunas só a partir de 1024px; abaixo disso tudo vira uma pilha só, na ordem 6 → 7 → 8.

→ **Largura**: esta página tem teto próprio de **1120px** e **não** recebeu o alargamento de 1720px que as
quatro telas redesenhadas do 018 ganharam. Medido: a 1920px sobram ~400px de margem morta de cada lado
enquanto o formulário mais denso do produto se espreme em 1120px.
→ **Nenhum estado de "há alterações não salvas"** existe: sair da tela descarta tudo, em silêncio.

## Conteúdo e dados reais
- **Nome do produto** — texto, obrigatório. Exemplo real: `Vaso G`.
- **Custos da peça**: "Custo do rolo" (R$, obrigatório — ex.: `R$ 129,90`) · "Peso do rolo" (kg, obrigatório
  — ex.: `1`) · "Gramas usadas" (g, obrigatório — ex.: `85`) · "Consumo médio" (kW, obrigatório — ex.:
  `0,15`) · "Tarifa de energia" (R$/kWh — ex.: `R$ 0,92`) · "Reserva de manutenção" (R$/h) · "Taxa de falha"
  (%) · "Valor da máquina" (R$ — ex.: `R$ 2.400,00`) · "Vida útil da máquina" (h) · tempo de impressão em
  **h e min**.
- **Mão de obra e custos** (todos opcionais): "Tempo de acabamento" (h) · "Valor do acabamento" (R$/h) ·
  "Mão de obra (horas)" (h) · "Valor da hora" (R$/h).
- **Outros custos**: lista variável, cada item com nome e valor em R$; pode estar vazia.
- **Markup**: "Markup varejo" (%, obrigatório — ex.: `250`) e "Markup atacado" (%, obrigatório).
- **Marketplace**: um ou mais canais; o conjunto de campos **muda conforme o marketplace escolhido** (trocar
  o marketplace apaga a categoria, a modalidade e as tarifas do anterior — elas pertenciam a outra
  taxonomia). Desenhe o cartão de canal preparado para ter de 3 a 7 campos.
- **Rodapé de resultado** (derivado, nunca digitado, nunca armazenado — recalculado a cada tecla): "Material",
  "Energia", "Máquina", "Falha / perdas", "Acabamento", "Mão de obra", "Custo total", "Preço varejo",
  "Preço atacado" e, por canal, "Preço para anunciar" e "Recebido líquido". Números verdadeiros de semente:
  custo total `R$ 16,16`, preço varejo `R$ 24,24`, recebido líquido `R$ 21,01`.

## Estados obrigatórios
1. **Repouso — criação** (`?produto=novo`): cabeçalho "Novo produto", nome vazio, selects em "Escolher…",
   campos com valores padrão, rodapé já mostrando um preço.
2. **Repouso — edição**: cabeçalho "Editar produto", tudo preenchido, e o rodapé ganha "Salvar em
   Orçamentos" e "Salvar simulação" (só existem em produto já salvo).
3. **Carregando o produto**: a lista ainda não respondeu — cabeçalho + um `Spinner` centralizado, nada mais.
4. **Não encontrado**: alerta informativo "Não encontramos este produto." + botão secundário "Voltar ao
   catálogo". Nunca um formulário em branco.
5. **Pré-requisito ausente** (criar sem nenhum filamento ou impressora salvos): alerta informativo "Para
   criar um produto, salve antes um filamento e uma impressora no catálogo." + "Voltar ao catálogo". O
   formulário **não** aparece.
6. **Nome vazio ao salvar**: erro no campo — "Dê um nome ao produto."
7. **Campos inválidos ao salvar**: alerta de perigo no cartão do nome — "Confira os campos destacados antes
   de salvar." E, no rodapé, no lugar do preço: "Confira os campos destacados para ver o preço."
8. **Salvando**: o botão "Salvar produto" em estado de carregamento (spinner dentro do botão).
9. **Falha de gravação**: a página **fica aberta**, com um alerta de perigo e a frase específica do erro
   (rede, sessão expirada, servidor). Nunca perder o que foi digitado, nunca vender falha de rede como
   "não é premium".
10. **Referência solta / degradado**: o select mostra "— Manual —" no lugar de "Escolher…", e o topo traz
    "Vincule um filamento e uma impressora salvos" + "Os valores atuais foram mantidos e continuam
    editáveis." Os campos seguem editáveis e o preço segue sendo calculado. O recado **some sozinho** no
    instante em que os dois selects são preenchidos.
11. **Premium pausado (lapsed)**: leitura e cálculo continuam completos, **toda** a entrada fica inerte
    (nome, selects e o corpo de duas colunas inteiro), o botão "Salvar produto" **desaparece** e no lugar
    dele entra "Reative o Premium" + "Reative o Premium para voltar a criar e editar. Seus itens estão
    salvos." Precisa ser visível já na primeira renderização — nunca uma surpresa na hora de salvar.
12. **Foco, hover, pressionado, desabilitado** em campos, selects e nos três botões — inclusive o foco
    visível dentro do estado inerte do item 11, que hoje é o único sinal de que ali havia um campo.

## Viewports
- **390px (mobile)** — obrigatório: é a tela em que o produto nasceu e a pilha de 8 blocos é a experiência
  real. Mostre a rolagem longa e onde o Salvar cai em relação ao preço.
- **1280px (desktop, o corte do 018)** — obrigatório: é onde as duas colunas ligam e onde o desenho precisa
  decidir a barra de ação.
- **1920px** — obrigatório: é o caso que expõe o problema medido (teto de 1120px, ~400px mortos de cada
  lado) e onde o dono precisa ver a alternativa desenhada antes de decidir.

## Regras que o desenho não pode quebrar
- **Freemium é binário**: esta tela só existe atrás do portão premium. Não desenhe meia-tela, campo
  borrado ou preço escondido para não-assinante — quem não é premium não chega aqui.
- **Nenhum preço é armazenado**: todo número do rodapé é recalculado ao vivo. O desenho não pode sugerir
  "preço salvo" nem "última atualização".
- **Degradação dita, não escondida**: a referência solta é informada com calma e os valores continuam
  editáveis; nunca um muro de erro, e nunca afirmar que algo "foi removido" (o dado não sabe se foi).
- **Falha de rede nunca é vendida como limite de plano**, e vice-versa.
- **Frase honesta nunca mora em placeholder**: "Preenche os campos com o item salvo — você ainda pode editar
  tudo." e qualquer aviso vivem em elemento de largura cheia, com espaço para quebrar em duas linhas.
- **Alvo de toque ≥ 44px** em selects, botões de remover linha de "Outros custos" e de canal.
- **Contraste medido contra o fundo real do cartão**, não contra o fundo da página — inclusive no estado
  inerte do premium pausado (cinza sobre cinza é o risco óbvio ali).

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido nos DOIS eixos**: o headless não enxerga barra de rolagem clássica; já
  perdemos um item por medir só X. A 390px a linha de canal de marketplace é a candidata a estourar.
- **Valor astronômico**: o preço tem rolagem própria dentro do bloco de valor justamente porque um número
  gigante já esticou a página inteira. Desenhe o bloco de preço sabendo que `R$ 1.234.567,89` precisa caber
  ou rolar **dentro do cartão**, sem empurrar o layout.
- **Texto ocluso passa em teste**: um elemento totalmente coberto ou fora da coluna ainda "existe" para o
  código. Layout se homologa com caixa, então entregue as pranchetas com as áreas medíveis explícitas.
- **Sufixo cortado**: já tivemos placeholder com a parte honesta clipada. Rótulo e unidade ("R$/kWh", "h",
  "%") precisam de espaço próprio, não podem depender do campo estar largo.
- **A tela não participa do mestre-detalhe do 018**: qualquer proposta de aproximá-la das outras quatro
  telas é uma mudança de produto, não um detalhe visual — trate como proposta, marcada como tal.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class, não um afterthought)**:
1. `Editar produto — 1920px, repouso` (o caso que expõe a largura morta).
2. `Editar produto — 1280px, repouso` (duas colunas ligadas).
3. `Novo produto — 390px, repouso` (a pilha completa, com a rolagem indicada).
4. `390px — referência solta` (o "— Manual —" + o recado que some sozinho).
5. `1280px — Premium pausado` (tudo inerte, sem Salvar, com a linha de reativação).
6. `1280px — falha de gravação` + `390px — campos inválidos` (os dois erros, com a frase literal).
7. `390px — carregando` e `390px — não encontrado` / `pré-requisito ausente` (podem dividir uma prancheta).

Reutilize os primitivos existentes, sem inventar nenhum: o cabeçalho de página para o título; o cartão
padrão para cada bloco; o campo com rótulo/erro/obrigatoriedade para todo input; o select do design system
para os dois seletores; o botão primário para "Salvar produto" e secundário para "Salvar em Orçamentos" e
"Salvar simulação"; o alerta nas três tonalidades (informativo para recados e premium pausado, perigo para
erro de gravação e para o preço inválido); o spinner de carregamento; e o bloco de preço grande já existente
para "Preço varejo" / "Preço para anunciar". Se o desenho precisar de uma barra de ação fixa, componha-a com
cartão + botão existentes e diga explicitamente que é uma composição nova, não um primitivo novo.

## Perguntas em aberto para o dono
1. **Onde mora o "Salvar produto"?** Hoje está preso ao cartão do nome, no topo. As alternativas mudam a
   tela inteira: barra de ação fixa no rodapé da janela, cartão de ação junto ao preço no fim, ou uma faixa
   de cabeçalho com título + Salvar. Qual você quer?
2. **A tela precisa de uma saída explícita?** Hoje não há voltar, cancelar nem fechar — só o gesto do
   sistema. Se entrar um "Voltar ao catálogo" no topo, o que acontece com as edições não salvas: descarta em
   silêncio, pergunta, ou salva?
3. **Esta tela entra no mestre-detalhe do 018 a 1920px** (lista de produtos à esquerda, editor à direita) ou
   segue sendo página cheia e apenas ganha o teto de 1720px das outras quatro? O `research.md` §E rejeitou
   encaixá-la nos 560px da ficha, mas não decidiu esta terceira via.
4. **O cartão "Usar do catálogo" continua sendo um cartão separado** ou se funde ao cartão de identidade do
   produto (nome + filamento + impressora numa só faixa de identificação)?
5. **A ordem "custos à esquerda, markup + marketplace à direita" é obrigatória?** Ela existe hoje só porque
   herda a tela Calcular; se o produto puder ter ordem própria, o desenho tem muito mais liberdade — mas
   isso quebra a paridade visual com a Calcular, que já foi um requisito explícito.
