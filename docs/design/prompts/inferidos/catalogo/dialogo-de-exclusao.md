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

- **Onde vive:** Sobreposição central, sobre a rota /catalogo. Aberta pelo botão-ícone de lixeira: no celular, o último dos ícones da linha do item; no desktop, o ícone no canto superior direito da ficha de 560px. Por baixo continua tudo — cabeçalho, lista e ficha — escurecido.
- **Como o vendedor chega:** O vendedor decidiu apagar um filamento, impressora, produto ou kit salvo e tocou a lixeira. É a única ação destrutiva da área. Com Premium pausado esse toque nem chega aqui: desvia para a ficha somente-leitura.
- **Vizinhança imediata:** Dentro do diálogo, empilhados com gap de 12px: o título "Excluir «{nome do item}»?", a descrição "Esta ação não pode ser desfeita.", em seguida — só quando o item é referenciado — um alerta informativo com a consequência real ("Este filamento é usado em 3 produto(s). Eles manterão os últimos valores, editáveis."), depois, se o envio falhar, um alerta vermelho com a frase honesta do erro, e no rodapé, alinhados à direita: "Voltar" (fantasma) e "Excluir" (vermelho, com giro enquanto a exclusão está em voo).
- **Dados que chegam (e o que ela devolve):** Recebe o item alvo (nome ecoado no título) e, para filamento/impressora, a contagem de produtos que o referenciam, calculada contra a lista de produtos já carregada. Devolve a exclusão ao servidor — nunca offline, nunca em fila.
- **O que acontece depois:** Sucesso fecha o diálogo e a lista se atualiza sem o item; no desktop, a ficha da direita cai automaticamente para o primeiro item visível, nunca para uma ficha órfã. Os produtos que referenciavam o item excluído passam a pedir atenção, com os últimos valores preservados e editáveis. Falha mantém o diálogo aberto com o alerta vermelho dentro dele.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo)` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Confirmar exclusão de um item do catálogo

## O que desenhar
O diálogo modal centrado que aparece quando o vendedor toca a lixeira de um **filamento** ou de uma
**impressora** salvos no Catálogo (aba Catálogo → Filamentos / Impressoras). É a única ação destrutiva do
Catálogo: quem chega aqui já decidiu tocar a lixeira, e este é o último ponto em que ele descobre a
consequência real — se o item estiver referenciado por produtos, esses produtos **perdem o vínculo** e passam
a viver com os últimos valores copiados. O diálogo precisa ser desenhado nas duas topologias: sobre a lista
de cartões do mobile (390px) e sobre o mestre-detalhe do desktop (≥1280px), onde a lixeira mora na cabeça da
ficha do item selecionado e o diálogo cobre lista **e** ficha ao mesmo tempo.

## Por que este prompt existe
Este diálogo inteiro foi construído por inferência: nenhum protótipo, nenhuma rodada de auditoria e nenhuma
prancheta cobre exclusão no Catálogo (o `ListItem` do protótipo tem um único trailing, o lápis). Nunca foi
desenhado: a hierarquia entre corpo, aviso de referências e erro; como o modal se comporta sobre o
mestre-detalhe; e o que acontece **enquanto a exclusão está em voo**. Há ainda uma contradição explícita: o
canvas 018 desenha, na cabeça da ficha, um botão **de texto** "Excluir" (`tf-btn--danger-ghost`), enquanto o
código usa um ícone-lixeira ghost nos dois ramos — mobile e desktop. Uma das duas está errada e o desenho
tem de decidir qual.

## O que já existe hoje (não invente do zero — corrija)
Estrutura atual do diálogo, de cima para baixo (`catalog-panel.tsx`, `Dialog variant="center"`,
`width: min(92vw, 32rem)`, `max-height: 85vh`, `padding: --space-6`, gap `--space-3`):

| Ordem | Peça | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | `DialogTitle` | `Excluir “PLA Azul”?` (template: `Excluir “{nome}”?`) | aspas tipográficas curvas; o nome vem do item e pode ser longo → **problema de layout** |
| 2 | `DialogDescription` | `Esta ação não pode ser desfeita.` | genérico; não diz **o que** se perde |
| 3 | `Alert tone="info"` (condicional) | `Este filamento é usado em 3 produto(s). Eles manterão os últimos valores, editáveis.` / `Esta impressora é usada em 3 produto(s). Eles manterão os últimos valores, editáveis.` | só aparece quando n > 0 |
| 4 | `Alert tone="danger"` (só após falha) | ex.: `Criar e editar precisam de conexão.` · `Salvar faz parte do Premium.` · `Algo deu errado. Tente novamente.` | nasce **dentro** do diálogo, depois do clique |
| 5 | Par de botões, alinhado à direita | `Voltar` (ghost) + `Excluir` (danger, com `loading`) | "Voltar", não "Cancelar" — a palavra "cancelar" é proibida no módulo de copy (FR-014) |

→ **Problema 1**: a informação mais importante (item usado em N produtos) está em terceiro lugar, num
`tone="info"` — o mesmo tom do banner de offline —, abaixo de uma frase genérica que não informa nada.
→ **Problema 2**: `{n} produto(s)` com parênteses é copy de programador. Com n = 1 lê-se "1 produto(s)".
→ **Problema 3**: a mensagem de falha offline diz **"Criar e editar precisam de conexão."** dentro de um
diálogo cuja ação é *excluir*. É honesta quanto à causa e mentirosa quanto ao verbo.
→ **Problema 4**: nada distingue visualmente "este item não é usado por ninguém" de "este item é usado por
9 produtos" antes de o vendedor ler o texto.
→ **Problema 5**: nome muito longo no título (o campo Nome não tem limite curto) e um contador de 3 dígitos
no aviso são os dois pontos onde o modal de 32rem estoura.

## Conteúdo e dados reais
- **Nome do item**: string livre, obrigatória, do vendedor. Exemplos reais de semente: `PLA Azul`,
  `Ender 3`. Desenhe também com um nome de estouro: `PETG Translúcido Premium — bobina 1kg Voolt`.
- **Contagem de referências**: inteiro derivado no cliente (produtos cujo `filamentId`/`printerId` é o
  item). Faixa plausível 0–999; 0 = o aviso simplesmente não existe. Desenhe com **3** e com **1**.
- **Tipo do item**: filamento ou impressora — muda só a palavra inicial do aviso.
- **Nenhum valor em dinheiro aparece neste diálogo.** O que se perde é o vínculo, não um preço. Se o
  desenho quiser mostrar contexto do item (ex.: `R$ 89,90 / kg`), isso é conteúdo novo — ver Perguntas.
- Não há campo de digitação de confirmação hoje (nada de "digite o nome para confirmar").

## Estados obrigatórios
1. **Repouso, item sem referências** — título, frase de irreversibilidade, Voltar + Excluir. Sem aviso.
2. **Repouso, item referenciado** — o mesmo, com o aviso `Este filamento é usado em 3 produto(s). Eles
   manterão os últimos valores, editáveis.` em destaque **acima** ou fundido ao corpo.
3. **Foco de teclado** — o foco entra no diálogo; mostre o anel em `Voltar` e em `Excluir` (o destrutivo
   nunca deve ser o foco inicial).
4. **Hover / pressionado** em `Excluir` (danger) e em `Voltar` (ghost).
5. **Em voo (`loading`)** — `Excluir` com spinner; desenhe explicitamente se `Voltar` fica desabilitado e
   se o overlay ainda aceita clique fora. Hoje isso nunca foi desenhado e é o estado mais frágil.
6. **Falha após tentativa** — o `Alert tone="danger"` aparece dentro do diálogo, o diálogo **permanece
   aberto** e os botões voltam a repouso: o vendedor pode tentar de novo ou voltar. Frases reais:
   `Criar e editar precisam de conexão.` (falha de transporte, status 0), `Salvar faz parte do Premium.`
   (403 de direito), `Não encontramos o que você procura.`, `Algo deu errado. Tente novamente.`
7. **Sucesso** — não há toast de exclusão: o diálogo fecha e a linha some da lista. No desktop a ficha da
   direita cai automaticamente para o próximo item válido. Desenhe o "depois" do desktop.
8. **Offline (leitura)** — a lista mostra `Modo leitura offline` acima; a lixeira **continua clicável** e
   o diálogo abre normalmente; a recusa só chega no estado 6.
9. **Premium pausado** — este diálogo **nunca abre**: a lixeira, com `lapsed`, redireciona para a superfície
   de reativação (`Reative o Premium` / `Reative o Premium para voltar a criar e editar. Seus itens estão
   salvos.`). Desenhe isso como nota, não como variante do modal — a regra é "não mostre destrutivo que vai
   falhar".

## Viewports
- **390px (mobile)** — obrigatório: é onde o vendedor age. O modal ocupa 92vw; o par de botões e o aviso
  precisam caber sem rolagem interna com nome longo + aviso + erro simultâneos.
- **1280px (desktop)** — obrigatório: é a topologia nova (mestre-detalhe 018). Mostre o modal sobre lista +
  ficha, com o overlay cobrindo as duas colunas, e mostre a origem do clique (lixeira na cabeça da ficha).
- 1920px é opcional: o modal tem largura fixa de 32rem e não muda; se desenhar, é só para provar o
  centramento sobre um mestre-detalhe largo.

## Regras que o desenho não pode quebrar
- **Freemium binário e falha de rede nunca vendida como Premium**: a falha offline não pode virar convite a
  assinar, e o 403 de Premium pausado não pode parecer erro de rede.
- **A consequência é dita, não escondida**: quando há produtos referenciando o item, a informação tem de ser
  legível antes de o polegar alcançar o botão vermelho — não abaixo dele, não em cinza de legenda.
- **Nenhuma frase honesta dentro de placeholder** e nenhuma frase honesta truncada: o aviso de referências
  vive em elemento de largura cheia, com quebra de linha.
- **Alvo ≥44px** em `Voltar` e `Excluir` inclusive a 390px; e a lixeira que abre o diálogo idem.
- **Contraste medido contra o fundo real** — o card do diálogo fica sobre o overlay, não sobre o fundo da
  página; o vermelho de `Excluir` e o texto sobre ele precisam do contraste medido nessa superfície, nos
  dois temas.
- **Um botão destrutivo nunca é o alvo mais fácil por acidente**: peso visual e posição devem tornar
  "Voltar" o caminho barato.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não presumido**: título com nome longo dentro de `min(92vw, 32rem)` já é a
  forma clássica do estouro que passou em teste de texto (`toContainText` não vê colisão).
- **Texto ocluso passa em teste**: com aviso + erro + botões, o modal pode passar de `85vh` a 390px e criar
  rolagem interna — desenhe esse caso cheio, não só o vazio.
- **Placeholder que corta a frase** (016): nada de espremer "Eles manterão os últimos valores, editáveis."
  numa linha secundária de uma linha só.
- **Aviso de tom errado**: `tone="info"` para a consequência real e `tone="info"` para offline usam a mesma
  cor; quem lê rápido não separa "seu catálogo está velho" de "3 produtos vão perder o vínculo".

## Entregável
Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:
1. 390px — repouso sem referências.
2. 390px — repouso com referências (n = 3) e nome longo.
3. 390px — em voo + falha (duas pranchetas ou uma dividida), com a frase de erro real.
4. 1280px — o modal sobre o mestre-detalhe, com a ficha visível atrás do overlay.
5. 1280px — o "depois" do sucesso: item fora da lista, ficha caindo para o próximo item.
6. Um detalhe da cabeça da ficha resolvendo a contradição botão-de-texto × ícone-lixeira.

Reutilize os primitivos existentes, sem criar novos: `tf-dialog` (variante centrada) com
`tf-dialog__overlay`, `tf-dialog__title` para o título, o parágrafo de corpo do diálogo para a frase de
irreversibilidade, `tf-alert` (`info` para referências, `danger` para falha), `tf-btn--ghost` para "Voltar"
e `tf-btn--danger` para "Excluir" com o estado `loading` já previsto no botão. Se o aviso de referências
precisar de mais peso, prefira mudar a **posição e o tom já existentes** a inventar um novo bloco.

## Perguntas em aberto para o dono
1. O aviso de referências deve subir para **antes** de "Esta ação não pode ser desfeita." (virando o corpo
   principal) ou continuar como alerta abaixo? É uma decisão de produto sobre o que o vendedor lê primeiro.
2. `{n} produto(s)` deve virar copy com plural real ("é usado em 1 produto" / "em 3 produtos")? Trocar
   afeta copy já em produção.
3. A frase de falha offline deve ganhar uma variante para exclusão (hoje diz "Criar e editar precisam de
   conexão." dentro de um diálogo de excluir), ou o dono aceita a frase genérica?
4. A cabeça da ficha do desktop fica com **botão de texto "Excluir"** (como o canvas 018 desenhou) ou com
   **ícone de lixeira** (como o código faz)? A resposta muda também o mobile, que hoje espelha o código.
5. Excluir com sucesso deve mostrar um toast de confirmação? Hoje não mostra nenhum — a única evidência é a
   linha sumir.
