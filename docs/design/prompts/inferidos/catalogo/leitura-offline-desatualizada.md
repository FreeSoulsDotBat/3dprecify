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

- **Onde vive:** Dois lugares ao mesmo tempo na rota /catalogo: (1) uma faixa no TOPO do painel da seção, acima de tudo — acima da busca no desktop, acima da linha contagem+Adicionar no celular; (2) uma linha extra dentro de CADA item da lista, nos dois ramos (quarta linha do cartão no desktop, quarta linha da área clicável no celular).
- **Como o vendedor chega:** O vendedor abre o Catálogo sem rede (ou com o servidor fora): a leitura online falha, o cache do aparelho responde, e a área continua utilizável em modo leitura.
- **Vizinhança imediata:** A faixa é um alerta de tom informativo, título "Modo leitura offline", corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." — logo abaixo do cabeçalho da página e imediatamente acima do corpo da lista. Ela pode conviver com o banner offline global do shell, que fica ainda mais acima e diz outra coisa. A linha por item, "pode estar desatualizada", entra em caption cinza sob o resumo, no mesmo estilo da nota de atenção e do "somente leitura". O botão "Adicionar" continua ATIVO ao lado da contagem.
- **Dados que chegam (e o que ela devolve):** Vem do sinalizador de leitura servida por cache depois de uma falha online; os itens exibidos são os do cache local por conta, sem data de captura nem carimbo de quando foram lidos.
- **O que acontece depois:** Quando a rede volta e uma leitura online funciona, faixa e linhas somem juntas e a lista se atualiza. Se o vendedor insistir em criar/editar offline, o formulário permanece aberto e recebe uma frase honesta de que precisa de conexão — nada vai para fila, nada é salvo por baixo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Catálogo em leitura offline — a faixa "Modo leitura offline" e a marca "pode estar desatualizada"

## O que desenhar
O estado do Catálogo (abas Filamentos · Impressoras · Produtos · Kits) quando a leitura online falhou
mas o aparelho ainda tem os itens salvos em cache: o vendedor abre o app na feira, sem sinal, e a
lista aparece completa — só que ninguém garante que aquilo é o que está no servidor. Hoje esse
momento produz três avisos diferentes ao mesmo tempo (a faixa global do shell, uma faixa dentro do
painel e uma linha em CADA item da lista) enquanto o botão "Adicionar filamento" continua convidando
para uma ação que só vai falhar na hora de salvar. Desenhe **como o Catálogo conta essa verdade uma
vez só**, no lugar certo, em mobile e desktop, sem transformar um estado calmo (dados servem, escrita
não) num campo minado de alertas.

## Por que este prompt existe
Ninguém desenhou esta peça: a faixa do painel, a linha por item e a convivência entre os três sinais
foram inferidas por IA a partir de texto de requisito. Pior — a autoridade que existe **contradiz o
código**. O protótipo de 2026-07-02 (§E3/§E9) desenha um "offline banner discreto em ciano" **no
shell**, e só; não há faixa dentro do painel nem rótulo por linha, e o `CatalogScreen.jsx` do
protótipo não tem nenhum dos dois. §E3 é explícito: "ações de rede (salvar/sync) ficam
DESABILITADAS"; a matriz §G repete "offline: leitura mock ok, salvar off" para a lista e "salvar
desabilitado" para o formulário. **O botão ativo é uma divergência do desenho, não uma lacuna.** E a
copy canônica do §D.2 é "Offline — o cálculo continua funcionando", diferente das duas frases que
estão no ar. O canvas do 018 (`Abas-Desktop.dc.html`) não desenha offline em nenhum dos quatro
artboards — o desktop nunca viu esse estado.

## O que já existe hoje (não invente do zero — corrija)
Três sinais podem aparecer simultaneamente:

| # | Onde | Texto literal | Gatilho real |
|---|---|---|---|
| 1 | Faixa full-bleed acima da barra superior (shell inteiro) | "Você está offline. O cálculo continua funcionando." | `navigator.onLine === false` |
| 2 | Alerta tom `info` no topo do painel do Catálogo | Título "Modo leitura offline" · corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." | a leitura online falhou **e** existe cache com itens |
| 3 | 3ª linha de legenda dentro de cada card da lista | "pode estar desatualizada" | o mesmo gatilho de #2, repetido item a item |

→ **Os gatilhos 1 e 2 não são a mesma coisa** e o desenho atual finge que são: dá para ter #2 sem #1
(o servidor devolveu erro com a rede funcionando) e #1 sem #2 (offline com cache válido e recente).
Nada na tela diferencia "você está sem internet" de "não consegui falar com o servidor".

→ **A linha por item se multiplica**: 30 filamentos salvos = 30 vezes "pode estar desatualizada" na
mesma tela, dizendo o que a faixa já disse uma vez.

→ **O convite continua de pé**: o botão "Adicionar filamento" (primário, com ícone `plus`) segue
ativo; a gaveta abre, o formulário aceita tudo, e só ao tocar Salvar aparece "Criar e editar precisam
de conexão." No desktop é pior: a ficha à direita **é** o editor do filamento/impressora, com Salvar
ativo, 560px de campos editáveis que não têm para onde ir.

→ **As linhas empilham**: um produto degradado offline com Premium pausado mostra, no mesmo card,
"Vincule um filamento e uma impressora salvos" + "pode estar desatualizada" + "somente leitura" — três
legendas cinza indistinguíveis abaixo do nome.

## Conteúdo e dados reais
- Card de filamento: nome em `--text-strong` semibold; resumo em legenda `--text-muted`, ex.:
  `PLA · R$ 129,90 / 1 kg`.
- Card de impressora, ex.: `R$ 2.499,00 · 2.000 h · 0,15 kW`. Kit: `3 peça(s)`. Produto: nomes das
  referências, ou `manual` quando a referência sumiu.
- Contador acima da lista: `12 filamento(s)` / `4 impressora(s)` (legenda, não título).
- Desktop ≥1280px: barra de ferramentas com busca (placeholder "Buscar no catálogo…", ícone `search`
  18px), o contador e o botão Adicionar; lista à esquerda em `minmax(0,1fr)`, ficha fixa de 560px à
  direita, gap `--space-6`. A ficha tem sobretítulo "Filamento salvo" / "Impressora salva" /
  "Produto salvo" / "Kit salvo" e o nome como `h2`.
- Mobile 390px: lista de cards `padding sm`, com botões-ícone de editar (`pencil`), duplicar (`copy`)
  e excluir (`trash-2`) à direita do bloco de texto.
- A faixa global usa fundo `--tf-info-soft` com texto `--info-text` (o par medido em V3), ícone
  `info` 18px, centralizada, sem animação. Nenhum número, nenhuma data, nenhum horário de última
  sincronização existe hoje — **não invente "atualizado há 2 h" se o dado não existe** (ver perguntas).

## Estados obrigatórios
1. **Online, repouso** — nenhuma faixa, nenhuma linha extra. É o contraste que dá sentido a todos os outros.
2. **Leitura offline / desatualizada (o foco)** — a lista completa e usável + o aviso, uma vez. Frase base:
   "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."
3. **Offline do aparelho (shell)** — "Você está offline. O cálculo continua funcionando." Mostre como
   ela convive com o item 2 sem repetir a mesma informação duas vezes.
4. **Carregando** — spinner centralizado, sem lista fantasma.
5. **Erro sem cache** — alerta `danger` "Não foi possível carregar seu catálogo." com botão secundário
   "Tentar novamente". Nunca confundir com o estado 2: aqui não há nada para mostrar.
6. **Vazio real** — "Nenhum filamento salvo ainda" / "Salve seus filamentos uma vez e reutilize em cada cálculo."
7. **Vazio da busca** (desktop) — "Nada encontrado para essa busca" + "Limpar busca".
8. **Escrita bloqueada** — o que acontece ao tocar Adicionar/Salvar offline: hoje a gaveta abre e o
   erro "Criar e editar precisam de conexão." só aparece depois do toque em Salvar. Desenhe o
   comportamento que o desenho original pedia (ação inerte/desabilitada com o porquê visível ao lado)
   **e** o estado de erro pós-toque, para o dono comparar.
9. **Premium pausado** — "Premium pausado" / "Seus itens continuam aqui e podem ser usados no
   cálculo. Para criar ou editar, reative o Premium." + legenda "somente leitura" por item.
10. **Offline + Premium pausado + item degradado no mesmo card** — o pior empilhamento possível;
    mostre a hierarquia que impede as três legendas de virarem uma mancha cinza.
11. **Foco e hover** no card da lista e no botão Adicionar (o card do desktop é um `button` com
    `aria-current` no selecionado — o selecionado e o focado precisam ser distinguíveis).

## Viewports
- **390px** — obrigatório: é onde o offline realmente acontece (feira, cliente, celular). Mostre a
  faixa global + a do painel + um card com todas as legendas empilhadas, para medir a altura que
  sobra para a lista.
- **1280px** — obrigatório: o mestre-detalhe do 018 nunca teve este estado desenhado, e é onde a
  ficha-editor de 560px fica ativa oferecendo edição impossível.
- **1920px** opcional, só se a decisão de layout mudar entre 1280 e 1920.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como falta de Premium** e vice-versa: os cofres são diferentes,
  as frases são diferentes, os tons são diferentes. Offline é `info`, calmo; nunca `danger`.
- **A degradação é dita, não escondida**: sumir com o aviso para "ficar limpo" é a solução errada;
  a certa é dizê-lo uma vez, no lugar certo.
- **Nenhuma frase honesta dentro de placeholder** — placeholder só carrega número/exemplo.
- **Nenhum número inventado**: não existe timestamp de sincronização no produto.
- Alvos de toque ≥44px, contraste medido contra o fundo real do card (não contra o fundo da página).
- O mobile do 018 é código intocado: o que você desenhar para 390px deve caber no card atual, não
  exigir uma reescrita da lista.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado**: 100,5px de estouro e um botão nascido fora do
  viewport passaram por mais de mil testes verdes. Cada faixa nova come altura no 390px — desenhe
  com um nome longo de filamento e `R$ 2.499,00` no resumo.
- **Headless não vê a barra de rolagem clássica**: o eixo vertical também estoura; um painel com
  três avisos empurra o primeiro item da lista para fora da dobra.
- **Frase cortada por elemento estreito**: "Seus itens salvos continuam aqui para usar no cálculo."
  tem 51 caracteres — mostre-a em elemento de largura cheia, quebrando em duas linhas se preciso.
- **Texto ocluso passa em teste**: legendas empilhadas dentro de um card com botões-ícone à direita
  colidem no 390px sem que nenhuma asserção reclame.

## Entregável
Pranchetas, tema escuro (padrão) **e** claro, ambos tratados como primeiros:
1. `390 · Catálogo online` (referência) e `390 · Catálogo em leitura offline` (a proposta).
2. `390 · Card com todas as legendas` (degradado + offline + somente leitura).
3. `390 · Tentativa de criar offline` — a proposta de ação inerte + o erro pós-toque, lado a lado.
4. `1280 · Mestre-detalhe em leitura offline` — lista + ficha de 560px, deixando claro o que a ficha
   pode ou não fazer.
5. `1280 · Erro sem cache` vs `1280 · Leitura offline` — a diferença entre os dois, explícita.

Reutilize os primitivos existentes, sem criar novos: `Alert` tom `info` para o aviso do painel e tom
`danger` para o erro sem cache; a faixa do shell é o componente de banner já existente (fundo
`--tf-info-soft`, texto `--info-text`, ícone `info`); `Card` para a linha da lista; `EmptyState`
(ícones `package` / `crown`) para vazio e sem permissão; `Button` primário para Adicionar e
`secondary` para "Tentar novamente"; `Spinner` para carregando; `Icon` para `plus`, `pencil`, `copy`,
`trash-2`, `search`.

## Perguntas em aberto para o dono
1. **Qual dos três sinais sobrevive?** O desenho original prevê só a faixa do shell. Manter a faixa
   do painel (que fala de escrita, coisa que a do shell não fala) e matar a linha por item? Ou manter
   a linha por item porque ela é a única que marca *o dado*, e não *o app*?
2. **Adicionar/Salvar ficam desabilitados offline** (§E3 e §G do protótipo) **ou continuam ativos com
   falha honesta no fim** (código de hoje)? Desabilitar cumpre o desenho, mas esconde o motivo se não
   vier uma frase junto; deixar ativo cumpre "nada é fingido", mas gasta o trabalho do vendedor.
3. **"Sem internet" e "servidor não respondeu" são o mesmo aviso para o vendedor?** Hoje são dois
   gatilhos distintos com aparência quase igual.
4. **Qual copy vale**: o §D.2 canônico "Offline — o cálculo continua funcionando" ou as duas frases
   já implementadas e homologadas em outras telas?
5. **Vale registrar quando o cache foi salvo** ("salvo há 2 dias")? O produto não tem esse dado hoje;
   se a resposta for sim, isso vira requisito, não desenho.
