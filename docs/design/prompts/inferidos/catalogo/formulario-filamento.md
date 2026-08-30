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

- **Onde vive:** Duas casas, o MESMO componente: abaixo de 1280px dentro da folha lateral de criar/editar, logo abaixo do título dela; a partir de 1280px dentro da ficha de 560px da coluna direita, na seção Filamentos, logo abaixo do cabeçalho da ficha (rótulo "Filamento salvo" + nome + ícones) e de eventuais alertas.
- **Como o vendedor chega:** O vendedor toca "Adicionar filamento", ou seleciona um filamento (no desktop, um clique no cartão já traz o formulário preenchido à direita; no celular, o toque abre a folha).
- **Vizinhança imediata:** Uma COLUNA única com gap de 12px, nesta ordem: "Nome" (texto, obrigatório, com exemplo no placeholder) · "Material" (texto, sem marca de obrigatório e sem a etiqueta "opcional" — um terceiro estado) · "Custo do rolo" (numérico com prefixo R$, obrigatório) · "Peso do rolo" (numérico com sufixo kg, obrigatório). Abaixo do último campo: o alerta vermelho de falha de gravação (quando há), depois o alerta de reativação (quando o Premium está pausado) e, por fim, a linha de ações alinhada à direita — "Voltar" + "Salvar". Não existe campo de cor.
- **Dados que chegam (e o que ela devolve):** Em edição, os quatro valores do filamento salvo, com números já normalizados para vírgula decimal; em criação, campos vazios. Validação por campo aparece sob o rótulo em erro. Devolve ao servidor o payload de fio (dinheiro como texto decimal).
- **O que acontece depois:** Salvo de verdade, o filamento passa a aparecer na lista, no resumo ("PLA · R$ 89,90 / 1 kg") e no seletor "Usar do catálogo" da Calcular e do editor de produto. O "Salvar" permanece habilitado mesmo com o formulário inválido — o erro só aparece na tentativa. Na ficha do desktop, o erro de gravação também aparece acima do formulário; "Voltar" ali apenas limpa o erro, sem fechar nada.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Lista do Catálogo no mobile (linha do item + contagem + botão adicionar)` · `Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)` · `Barra de ferramentas da lista no desktop (busca + contagem + adicionar)` · `Estado "nada encontrado" da busca do Catálogo` · `Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção)` · `Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita)` · `Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo)` · `Carregando o Catálogo (spinner centralizado onde havia skeleton)` · `Erro ao carregar o Catálogo (alerta + "Tentar novamente")` · `Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item)` · `Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação)` · `Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam)` · `Folha (Sheet) de criar/editar filamento e impressora no mobile` · `Formulário de impressora (5 campos, com dica de consumo e um campo opcional)` · `Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas)` · `Seletor de filamento e impressora do produto (com a opção "— Manual —")` · `Estado "precisa de atenção" / referência manual do produto` · `Telas de recado do editor de produto (pré-requisito e produto não encontrado)` · `Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação)`

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

# Formulário de filamento (Catálogo → aba Filamentos)

## O que desenhar
O formulário com que o vendedor cadastra e edita um filamento no Catálogo — quatro campos hoje: **Nome**, **Material**, **Custo do rolo** e **Peso do rolo**. É a peça que alimenta TODO o cálculo de material do produto: o custo por grama sai de `custo do rolo ÷ peso do rolo`, então um erro de unidade aqui contamina cada preço sugerido do app. Ele aparece em dois lugares diferentes, com o MESMO conteúdo: no mobile, dentro de uma gaveta (Sheet) com título "Novo filamento" / "Editar filamento"; no desktop ≥1280px, embutido na ficha da direita do mestre-detalhe (a ficha É o editor — o item selecionado na lista da esquerda abre já editável, com kicker "Filamento salvo" e o nome do item como cabeçalho). Origem no código: `apps/web/src/features/catalog/filament-form.tsx`, `catalog-controls.tsx`, `catalog-schema.ts`.

## Por que este prompt existe
Autoridade de desenho **PARCIAL**: o canvas antigo desenhou os quatro rótulos, mas nunca desenhou este formulário inteiro. O que se decidiu sem desenho: (a) a **coluna única** em que os campos são empilhados, contra o canvas, que os põe numa grade que reflui (`repeat(auto-fit, minmax(170px, 1fr))`); (b) o campo **"Cor"** — pedido por §E5 do protótipo ("Filamento: nome, cor, custo do rolo (R$), peso (kg)") e pela correção nº 34, marcada PARTIAL — **nunca foi construído**; (c) a **unidade do peso**: o canvas escreve "Peso do rolo" com sufixo **g** (valor 1000), o código usa **kg**; (d) a marcação de obrigatoriedade — Nome/Custo/Peso levam asterisco, **Material não leva nem asterisco nem a tag "opcional"**, um terceiro estado que nenhuma autoridade definiu; (e) o botão **Salvar segue habilitado com o formulário inválido**, contra o pedido explícito da correção nº 17, marcada NOT FIXED por duas rodadas seguidas. O rótulo "Material" NÃO é inferido (está no canvas) — o mapeamento original errava nesse ponto.

## O que já existe hoje (não invente do zero — corrija)

| Campo | Rótulo literal | Controle | Marcação | Placeholder |
|---|---|---|---|---|
| 1 | "Nome" | texto livre | asterisco `*` | "Ex.: PLA Azul" |
| 2 | "Material" | texto livre | → **nada**: nem `*` nem "opcional" | "Ex.: PLA" |
| 3 | "Custo do rolo" | numérico, prefixo forte **R$** | asterisco `*` | "0,00" |
| 4 | "Peso do rolo" | numérico, sufixo **kg** | asterisco `*` | "0,00" |

- Ordem atual: exatamente essa, empilhada em **coluna única** com espaçamento uniforme. → o canvas pedia grade; o desenho precisa decidir e mostrar o agrupamento (Nome/Material como identidade, Custo/Peso como o par que vira R$/g).
- Rodapé: dois botões alinhados à **direita** — "Voltar" (fantasma) e "Salvar" (primário) ou "Salvar alterações" quando é edição. → "Voltar" existe porque a palavra "cancelar" é proibida na copy do produto (colide com cancelamento de assinatura); mantenha o rótulo.
- → **"Salvar" nunca desabilita.** Com campos vazios ou inválidos ele está clicável e só falha depois. Duas rodadas de correção pediram o contrário.
- → O campo "Nome" não tem tratamento visual próprio nenhum além do frame padrão (correção nº 16, também NOT FIXED).
- → O MESMO campo de peso, no formulário da Calculadora, mostra um aviso de plausibilidade quando o número parece gramas; **no Catálogo esse aviso não existe** — aqui, onde o valor fica salvo e se propaga, o vendedor não é avisado.

## Conteúdo e dados reais
- **Custo do rolo**: dinheiro em pt-BR, agrupamento de milhar aplicado **ao sair do campo** (digitou `120`, ao desfocar vira `R$ 120,00`; `12345,67` vira `12.345,67`). Exemplo realista de rolo: **R$ 129,90**; exemplo grande que precisa caber sem estourar a coluna: **R$ 1.234,56** e o extremo **R$ 9.999.999.999,99** (o teto é excludente em 10.000.000.000).
- **Peso do rolo**: quantidade com sufixo "kg", vírgula decimal. Valor comum: **1** (um rolo de 1 kg); também plausível **0,75** e **5**. Teto excludente em 1.000.000 kg. Precisa ser **estritamente maior que zero** — é denominador.
- **Material**: texto livre, opcional de fato (vai `null` quando vazio) — mas não declarado como opcional na tela.
- **Derivado, hoje invisível no formulário**: a linha-resumo do item na lista mostra `PLA · R$ 129,90 / 1 kg`. O custo por grama, que é o que o app realmente usa, nunca aparece.
- Mensagens de erro literais, por campo: "Campo obrigatório." · "Informe um número válido." · "Não pode ser negativo." · "Valor muito alto." · e, só no peso, **"O peso do rolo deve ser maior que zero."**
- Sucesso: toast "Filamento salvo." — dispara **só depois de um 2xx real**, nunca em offline nem em conta pausada.

## Estados obrigatórios
- **Repouso** (criar): quatro campos vazios com os placeholders acima; nenhum erro visível.
- **Repouso** (editar): campos preenchidos com o item salvo; no desktop, dentro da ficha com kicker "Filamento salvo" + nome do item + ações de ícone (lápis/lixeira) no topo direito.
- **Foco / hover / pressionado**: anel de foco visível em campo e em botão, inclusive sobre o campo com erro (o anel não pode desaparecer dentro da borda vermelha).
- **Erro por campo**: a borda do campo muda e a mensagem aparece ABAIXO do controle, substituindo qualquer dica. Desenhe pelo menos um campo em erro e um caso com **dois campos em erro ao mesmo tempo** (é o caso real de um formulário vazio submetido).
- **Salvando**: o botão primário mostra carregamento; os campos continuam legíveis.
- **Erro de escrita (rede)**: faixa de alerta em tom de perigo ACIMA dos botões, com a frase literal **"Criar e editar precisam de conexão."** — a gaveta/ficha permanece aberta com os valores digitados intactos. Nunca vender falha de rede como limite de plano.
- **Premium pausado (somente leitura)**: TODOS os campos inertes, "Salvar" **some** (fica só "Voltar") e entra um alerta informativo com título **"Reative o Premium"** e corpo **"Reative o Premium para voltar a criar e editar. Seus itens estão salvos."** Tom calmo, sem preço, sem data.
- **Estado que falta e o desenho precisa resolver**: **Salvar desabilitado** enquanto o formulário estiver inválido — com a razão dita em texto, não só um botão apagado (um botão cinza sem explicação é um beco).

## Viewports
- **390px (mobile)** — obrigatório: aqui o formulário vive dentro da gaveta, com o teclado ocupando metade da tela. Mostre a gaveta com o cabeçalho "Novo filamento", os quatro campos e o rodapé de ações; e um segundo quadro com um campo em erro para provar que a mensagem não empurra o rodapé para fora.
- **1280px (desktop, o corte real)** — obrigatório: o formulário dentro da ficha da direita, cuja largura é de ~560px ao lado da lista. É o pior caso da grade: dois campos lado a lado precisam caber em 560px sem que "Custo do rolo" ou o valor `R$ 1.234.567,89` sejam cortados.
- **1920px** — opcional, só se a grade mudar de forma; se não mudar, diga que é a mesma da de 1280px.

## Regras que o desenho não pode quebrar
- A unidade mostrada tem de ser **a mesma que o número significa**. Se o desenho escolher gramas, o rótulo, o afixo e o exemplo precisam concordar entre si — a divergência kg/g é exatamente o defeito que este prompt existe para fechar.
- Frase honesta **nunca dentro de placeholder**: placeholder carrega só exemplo de número/texto; explicação vai em elemento de largura cheia (já custou caro neste projeto — o sufixo do placeholder foi cortado na tela).
- Conta pausada e falha de rede são coisas **diferentes** e não podem usar o mesmo tom: rede = perigo; plano pausado = informativo.
- Nada de sucesso otimista: o "salvo" só existe depois da confirmação do servidor.
- Alvo de toque ≥ 44px em todo botão e ícone de ação; contraste medido contra o fundo real do cartão da ficha (que não é o fundo da página).
- Obrigatoriedade tem de ser **binária e consistente**: ou o campo é obrigatório (asterisco) ou é opcional (tag "opcional"). Não pode sobrar um campo sem nenhuma das duas marcas.

## Armadilhas já pagas neste projeto
- **Estouro horizontal medido**: valores longos de dinheiro já estouraram coluna em PDF e em cartão. Desenhe com `R$ 1.234.567,89` no campo, não com `R$ 0,00`.
- **Placeholder que corta a frase**: um sufixo explicativo posto em placeholder ficou clipado no dispositivo real.
- **Texto ocluso passa em teste**: um elemento sobreposto ainda "existe" para o teste. Se dois campos ficarem lado a lado a 560px, prove no desenho que o afixo "R$"/"kg" não invade o valor.
- **Rótulo de duas linhas desalinha a grade**: "Custo do rolo" e "Peso do rolo" cabem em uma linha a 1280px, mas o desenho precisa dizer o que acontece quando não cabem (linha de base alinhada ou não).

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não um remendo)**:
1. Gaveta mobile 390px — criar, repouso.
2. Gaveta mobile 390px — dois campos em erro + "Salvar" no estado desabilitado proposto.
3. Ficha desktop 1280px — editar, repouso, com valores grandes reais.
4. Ficha desktop 1280px — erro de escrita ("Criar e editar precisam de conexão.") e, ao lado, o estado **Premium pausado** com o bloco "Reative o Premium".
5. Um recorte da grade proposta (Nome/Material · Custo/Peso) com a decisão de agrupamento explicada em legenda.

Reutilize os primitivos existentes, **sem criar novos**: o frame de campo com rótulo/marcação/erro (`tf-field`, com `tf-field__req` para o asterisco e `tf-field__optional` para a tag), a moldura de entrada (`tf-inputwrap`, variante de erro `tf-inputwrap--error`, afixos `tf-inputwrap__affix` para "R$" e "kg"), o campo numérico pt-BR, os botões (`tf-btn` primário para Salvar, fantasma para Voltar), o alerta (`tf-alert` em tons perigo e informativo), o cartão da ficha (`tf-card`) e a grade que reflui (`tf-costs-grid`). Nomeie na entrega qual primitivo cobre cada parte.

## Perguntas em aberto para o dono
1. **A unidade do peso é kg ou g?** O canvas diz g, o produto diz kg, e o rolo real é vendido em 1 kg / 1.000 g. Mudar a unidade muda o dado salvo de todo mundo — é decisão de produto, não de desenho.
2. **O campo "Cor" entra?** Foi pedido duas vezes pelo protótipo e nunca construído. Se entrar, é um quinto campo (opcional?) ou substitui/acompanha "Material"?
3. **"Material" é opcional declarado** (ganha a tag "opcional") **ou passa a obrigatório?** Hoje não é nem uma coisa nem outra.
4. **O formulário deve mostrar o custo por grama derivado** (ex.: "R$ 0,13 por grama") enquanto o vendedor digita? É o número que o app realmente usa e hoje nunca é mostrado.
5. **O aviso de plausibilidade de peso** que existe na Calculadora ("Confira o peso do rolo: {v} kg. O rolo comum tem 1 kg — se você informou gramas, 1.000 g são 1 kg. Nada foi recusado.") deve aparecer também aqui, onde o valor fica salvo?
