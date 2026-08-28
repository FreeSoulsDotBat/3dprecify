# Seletor (Select) — o cursor ▾ e a lista que a marca não controla

## O que desenhar
O controle de escolha única do Precifica3D: uma moldura `tf-inputwrap` de 48px de altura com um
`tf-select` dentro e o caractere `▾` literal encostado à direita. É por ele que o vendedor escolhe
**o marketplace do canal**, **a modalidade** (Clássico/Premium/Profissional/Individual), **o perfil
de vendedor da Shopee**, **o ritmo da máquina e o prazo de payback**, e ainda **o filamento salvo, a
impressora salva e o produto salvo** do catálogo. Ou seja: as escolhas que mudam o preço final e as
que puxam dados prontos. Ele vive na tela **Calcular**, na ficha do **Produto** (Catálogo) e no
**editor de linha de Kit** — sempre dentro de um `tf-field`, com rótulo em cima. A lista que se abre
ao tocar é a do **sistema operacional** (roda no celular, popup no desktop) — não é desenhável, e
essa é justamente a decisão que precisa ser encarada aqui.

## Por que este prompt existe
A ficha classifica como `PROTOTIPO_PARCIAL`, e o verificador adversarial foi preciso: **o estado
fechado-com-escolha ESTÁ desenhado pelo dono** — `Abas-Desktop.dc.html`, linhas 137-138, dois
seletores completos na ficha do Catálogo a 1920px, com o `▾` literal, sob os rótulos "Filamento
salvo" e "Impressora salva" em `tf-field__label--tight`. O dono viu o `▾` e o manteve (isso
neutraliza a objeção "Icons: Lucide, no emoji"). **Sobra sem desenho nenhum**: o placeholder (uma
primeira `<option>` desabilitada de valor vazio), o **desabilitado**, o **erro**, o seletor a
**390px** e a **lista aberta** — que, por decisão do código, é do sistema e a marca não pinta.
Nenhuma tela do ui_kit tem Select.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/shared/ui/select.tsx` + `select.css` + `field.css`.

Estrutura atual, exatamente: `<div class="tf-inputwrap tf-selectwrap">` → `<select class="tf-input
tf-select">` → `<span class="tf-select__caret">▾</span>`, com `aria-hidden` no caret.

| Coisa | Como está hoje |
|---|---|
| Altura da moldura | `--control-h` = **48px** (acima do alvo de 44px, ok) |
| Caret | caractere `▾`, cor `--text-strong`, tamanho `--fs-sm`, colado a `--space-4` da direita |
| Folga do texto | `padding-right: --space-5` no `select` para o rótulo longo não passar sob o `▾` |
| Cursor | `pointer` na moldura; `not-allowed` quando desabilitado |
| Foco | anel no **wrapper** (`:focus-within`), borda vira `--focus-ring` |
| Erro | `tf-inputwrap--error`: borda `--danger` + halo `--danger` 38%, vence o foco |
| Desabilitado | `tf-inputwrap--disabled`: fundo `--bg-muted` + **`opacity: 0.6`** |
| Lista aberta | nativa; `color-scheme` por tema pinta o popup, e `option:checked` recebe `--selection-bg`/`--selection-fg` (no escuro, `--accent-soft`) |

→ **O `error` do Select é código morto hoje**: varri as 11 chamadas (`calculator-form.tsx`,
`calcular-page.tsx`, `produto-page.tsx`, `bom-line-editor.tsx`) e **nenhuma** passa `error`. Ou seja,
um seletor inválido hoje só mostra a mensagem embaixo, sem a moldura vermelha que o NumberField ao
lado ganha. Precisa de desenho para virar real.
→ **O desabilitado tem um buraco medido**: o Premium pausado congela a ficha do Produto com
`<fieldset disabled>` (`produto-page.tsx:298/366/386`). Isso desabilita o `<select>` nativo, mas
**não** aplica `tf-inputwrap--disabled` na `<div>` de fora — a moldura continua com cara de ativa e o
`▾` continua em `--text-strong`. O desenho precisa dizer como o congelado se parece.
→ **`opacity: 0.6` no bloco inteiro** derruba o contraste do rótulo dentro do controle junto com a
borda. Prefira apagar por token (texto `--text-faint`, fundo `--bg-muted`) a apagar por opacidade.
→ A **categoria** NÃO é este componente (a ficha da auditoria diz que sim, e está errada): ela usa o
`CategoryPicker` próprio, com busca e caminho completo. Este prompt não cobre categoria.

## Conteúdo e dados reais

Textos literais que já existem — **não reescreva**:

- Rótulos: `"Marketplace"` · `"Modalidade"` · `"Você vende como"` · `"Mais de 450 pedidos nos últimos
  90 dias?"` · `"Com que frequência ela roda?"` · `"Em quantos anos quer que ela se pague?"` ·
  `"Filamento salvo"` · `"Impressora salva"` · `"Usar produto salvo"`.
- Opções de marketplace: `"Mercado Livre"`, `"Shopee"`, `"Amazon"`, `"Outro"`.
- Modalidade: `"Clássico"`, `"Premium"`, `"Profissional"`, `"Individual"`.
- Perfil do vendedor: `"Pessoa física (CPF)"`, `"Pessoa jurídica (CNPJ)"`; volume: `"Sim"`, `"Não"`.
- Ritmo (a opção mais larga, que já estourou layout): `"Poucas horas por semana"`, `"Quase todo dia"`,
  `"Praticamente o dia todo"`. Payback: `"1 anos"` … `"5 anos"` → **"1 anos" é copy ruim** e está no
  produto (`paybackYearsLabel: "{n} anos"`); trate como defeito de conteúdo a resolver no desenho.
- Placeholders: `"Selecione"` (perfil do vendedor) · `"Escolher…"` (filamento/impressora) ·
  `"— Manual —"` (linha de kit sem produto vinculado — é uma **opção válida**, não um vazio).
- Legenda derivada logo abaixo do par ritmo/payback: `"≈ R$ 3,47 por hora de impressão"`
  (`derivedCaption`, o número vem do cálculo).
- Erro de carga dos itens salvos, hoje mostrado em `Alert tone="danger"` acima dos dois seletores:
  `"Não foi possível carregar seus itens salvos agora."` + botão `"Tentar novamente"`.
- Premium pausado, em `Alert tone="info"`: `"Reative o Premium"` / `"Reative o Premium para voltar a
  criar e editar. Seus itens estão salvos."`

Dados reais das listas: filamentos/impressoras/produtos são nomes livres do usuário (ex.: `"PLA
Prata 1kg"`, `"Bambu Lab A1 mini"`, `"Vaso hexagonal 12cm"`) — **sem limite prático de comprimento**,
é aí que o texto encosta no `▾`. As listas variam de 1 a dezenas de itens.

## Estados obrigatórios

1. **Repouso, com escolha feita** — o único já desenhado (canvas 018, l.137-138). Rótulo tight em
   cima, valor em `--text-strong`, `▾` à direita.
2. **Repouso, vazio (placeholder)** — a primeira linha desabilitada de valor vazio: `"Selecione"` /
   `"Escolher…"`. Deve **parecer não respondido**, em `--text-faint`, nunca uma escolha já feita —
   na Shopee, "sem resposta" cai no catch-all e o preço muda; o vazio precisa se ler como vazio.
3. **Hover** — borda `--border-strong`; cursor de ponteiro na moldura inteira, não só no texto.
4. **Foco (teclado)** — anel na moldura inteira; um `▾` e um `select` nunca desenham dois anéis.
5. **Aberto** — a lista é do SO. Desenhe o que o app CONTROLA: como o controle fica enquanto o popup
   está aberto e como a linha selecionada aparece (`--selection-bg`/`--selection-fg`; no escuro,
   `--accent-soft` + `--text-strong`). Mostre a prancheta com a nota de que o resto é do sistema.
6. **Desabilitado por Premium pausado** — a ficha congelada. Precisa se ler como "pausado, seus
   dados estão aí", ao lado do alerta `"Reative o Premium"` — nunca como quebrado.
7. **Erro** — borda `--danger` + mensagem `--danger-text` abaixo. Hoje não existe na prática; desenhe
   para poder existir.
8. **Lista vazia / catálogo indisponível** — hoje o cartão inteiro some quando não há itens salvos
   (silêncio deliberado para "você ainda não salvou nada") e vira `Alert tone="danger"` quando a
   leitura falha. Desenhe os dois: o "nada salvo ainda" e o erro com retry.
9. **Offline** — os itens salvos vêm do cache local; o seletor funciona normal. **Falha de rede não
   pode aparecer como "não é Premium"** — se houver qualquer marca de offline, ela diz rede.

## Viewports
- **390px (mobile)** — obrigatório, é onde a decisão nasceu (a roda do sistema). Mostre o pior caso
  medido: `"Poucas horas por semana"` (≈197px do próprio texto) e um nome de filamento longo; a
  1 coluna, dois seletores empilhados.
- **1280px (desktop)** — o corte do 018. Aqui a roda nativa **não** é a affordance certa e a
  pergunta continua aberta (ver §Perguntas). Desenhe o par lado a lado na grade de 2 colunas.
- **1920px** — o desenho do dono já existe; reproduza para conferência de coerência, com os mesmos
  rótulos "Filamento salvo" / "Impressora salva".

## Regras que o desenho não pode quebrar
- O `▾` é o **único** ornamento; nada de segunda seta, sombra interna ou gradiente na moldura — ela
  tem de ser irmã visual do NumberField ao lado, mesmos tokens de borda/foco/erro.
- Alvo de toque ≥44px: a moldura tem 48px e a **área clicável é a moldura inteira**, incluindo o `▾`.
- Contraste medido contra o fundo real (`--surface-card`), nos dois temas, inclusive no desabilitado.
- **Freemium é binário**: o seletor de marketplace desabilitado por plano vem sempre acompanhado da
  frase honesta `"Vender em marketplaces faz parte do Premium."` — em texto próprio, **fora** do
  campo; frase honesta nunca mora dentro de placeholder.
- O valor escolhido é uma **intenção do vendedor** — nada aqui pode sugerir que o app escolheu por
  ele (o catch-all da Shopee é exatamente esse risco).

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado**: a 360/390px o par ritmo/payback só cabe empilhado —
  `auto-fit, minmax(240px, 1fr)` existe porque a opção mais larga não tinha folga nenhuma.
- **Rótulo comprido sob o caret**: o `padding-right` existe por isso; um nome de filamento de 40+
  caracteres tem de truncar com reticências **antes** do `▾`, nunca por baixo dele.
- **Texto ocluso passa em teste** — `toBeVisible` aprova elemento sobreposto; layout se prova com
  caixas. Entregue o desenho com as medidas explícitas.
- **Rótulo de 2 linhas desalinha o par**: `tf-field__label--tight` reserva UMA linha; misturar tight
  e não-tight na mesma linha empurra um seletor 15-16px abaixo do irmão.
- **Popup branco em tema escuro** já aconteceu; a causa-raiz foi `color-scheme` por tema. O desenho
  precisa mostrar o tema escuro com o popup escuro.

## Entregável
Pranchetas, em **escuro (padrão) e claro (first-class)**:
1. Anatomia do controle (repouso com escolha, repouso vazio/placeholder, hover, foco) — 1280px.
2. Os 4 estados críticos: erro, desabilitado por Premium pausado, lista vazia, erro de carga com
   retry — 390px.
3. O par ritmo/payback a 390px com o texto mais largo real, e a 1280px lado a lado.
4. Os dois seletores da ficha do Catálogo a 1920px, batendo com o canvas do dono.
5. Uma prancheta só para o **aberto**: o controle + a nota do que é do sistema + como a linha
   selecionada é pintada, nos dois temas.

Reutilize os primitivos existentes: moldura `tf-inputwrap` (com `--error` / `--disabled`), campo
`tf-input tf-select`, caret `tf-select__caret`, envelope `tf-field` com `tf-field__label--tight`,
mensagem `tf-field__error`, aviso `tf-alert--info` / `tf-alert--danger`, botão `tf-btn--secondary`
para "Tentar novamente". **Não crie primitivo novo** — se algum estado não couber nos que existem,
diga qual e por quê em vez de inventar.

## Perguntas em aberto para o dono
1. **Desktop**: a lista nativa do SO fica, ou o desktop ganha um popup próprio da marca? O código
   escolheu nativo pelo celular; a 1280/1920px isso é uma escolha herdada, nunca decidida. Se a
   resposta for "popup próprio", o escopo deste desenho dobra.
2. **`"{n} anos"`** gera `"1 anos"`. Corrigimos para `"1 ano"` (singular) ou trocamos a redação toda?
3. **Placeholder do perfil do vendedor**: `"Selecione"` deixa o cálculo cair no catch-all (a maior
   alíquota). O seletor deve avisar isso na própria linha, ou continua sendo trabalho só do selo de
   procedência que fica abaixo?
4. **Congelado por Premium pausado**: o seletor mostra o valor escolhido (só sem poder trocar) ou
   apaga junto com o resto do campo?
