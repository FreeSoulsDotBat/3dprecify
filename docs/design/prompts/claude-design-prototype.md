# Prompt para Claude Design — PROTÓTIPO CLICÁVEL do Precifica3D (marca Truth's Forge)

> Cole este documento inteiro como briefing no Claude Design. Objetivo: um **protótipo clicável de alta
> fidelidade** (jornada navegável, não telas soltas nem só o Design System), com dados MOCK, nos temas
> **Dark (padrão)** e **Light (first-class)**. Todos os valores de token abaixo são REAIS — não adivinhe,
> use exatamente estes HEX/medidas.

---

## A. Papel + objetivo

Você é o(a) designer de UI do Precifica3D. Projete um **protótipo clicável de alta fidelidade, mobile-first e
totalmente responsivo (desktop)**, cobrindo a **jornada inteira** do produto com **telas interligadas** (o
usuário navega de verdade: toca, abre seções, troca de aba, dispara o upsell). Entregue **os dois temas**:
**Dark é o padrão**, **Light é first-class**. Copy 100% em **pt-BR**, tom direto e técnico-cordial, "fala em
números", sem bajulação. Locale único: **pt-BR / BRL**.

Não é para entregar só o Design System nem telas isoladas — é para entregar o **fluxo navegável completo**
(Nível B, visão completa) descrito na seção E.

---

## B. Produto, persona e proposta de valor

**Precifica3D** é uma calculadora de precificação (PWA mobile-first, SaaS) para quem **vende impressão 3D no
Brasil**. O usuário insere seus custos e recebe um **preço sugerido confiável com breakdown transparente** —
de um cálculo simples (material + markup) até o modelo completo (energia, máquina/depreciação, falha,
acabamento, taxas de marketplace, BOM multi-peça), mais catálogo salvo, histórico e simulador de marketplace.

**Persona:** vendedor(a) maker **MEI solo**, prático, que precisa de um preço rápido e correto em que possa
confiar. **Proposta de valor (a marca "Truth's Forge" = verdade forjada):** a matemática do preço é
**transparente e legível** — o app mostra a conta inteira, item por item. Personalidade: confiante, precisa,
enérgica, com toque premium; nunca corporativo-estéril, nunca grunge.

**Freemium (binário, sem quota):** **calcular e ver o breakdown é sempre grátis e offline**; **persistir é
Premium** (salvar cálculo, catálogo, histórico, export PDF/CSV, cenários de marketplace). NÃO existe contador
"3 de 5" nem "taste it first" — isso é débito de brief antigo. A fronteira é binária: computar = grátis;
qualquer persistência = Premium (ilimitado).

---

## C. Marca e Design System — COLÁVEL e EXATO

Regra visual da marca: **color-blocking chapado, SEM gradiente por padrão**; grandes planos preto/branco
carregam a estrutura; acentos saturados usados com parcimônia (**um acento por zona**). Glow/rim-light sutil
só no elemento focal (hero/CTA). **Um acento, um glow, um grafismo por zona** — nunca poluir.

### C.1 Paleta de marca (institucionais + secundárias)

| Papel | Token | HEX |
|---|---|---|
| Roxo (assinatura: CTAs, destaques, estado ativo) | `--tf-purple` | `#7800ff` |
| Laranja (energia: ações secundárias, badges) | `--tf-orange` | `#f7931e` |
| Ciano (suporte: info, links, superfícies "fresh") | `--tf-cyan` | `#15bddc` |
| Preto | `--tf-black` | `#000000` |
| Branco | `--tf-white` | `#ffffff` |
| Roxo profundo (detalhe/ícone, pressed) | `--tf-purple-deep` | `#5a16a6` |
| Âmbar profundo (pressed laranja) | `--tf-amber-deep` | `#bd6c0e` |
| Teal profundo (link/texto ciano no light) | `--tf-teal-deep` | `#0b8196` |

Rampas de estado (escurecer chapado no hover/press, sem gradiente):
`--tf-purple-hover #6500d6` · `--tf-purple-active #5a16a6` · `--tf-purple-soft #f1e7ff` · `--tf-purple-soft-2 #e6d4ff`
· `--tf-orange-hover #e27f0c` · `--tf-orange-active #bd6c0e` · `--tf-orange-soft #fdeed8`
· `--tf-cyan-hover #11a7c4` · `--tf-cyan-active #0b8196` · `--tf-cyan-soft #e0f6fb`.

Rampa neutra (cast frio leve):
`0 #ffffff · 50 #f6f6f8 · 100 #ededf1 · 150 #e4e4ea · 200 #d7d8e0 · 300 #b9bbc6 · 400 #8c8f9d · 500 #6a6d7b
· 600 #4d505c · 700 #353841 · 800 #1f2128 · 900 #14151a · 950 #0b0c0f`.

Status: `--tf-success #1aa06a` · `--tf-danger #ef3340` · `--tf-info #15bddc` (=ciano) · `--tf-warning #f7931e`
(=laranja). Deep: success `#137a50`, danger `#c41f2b`.

### C.2 Tokens semânticos — LIGHT (tema first-class)

- Fundo: `--bg-base #ffffff` · `--bg-subtle #f6f6f8` · `--bg-muted #ededf1` · `--bg-inverse #000000`
- Superfície: `--surface-card #ffffff` · `--surface-raised #ffffff` · `--surface-sunken #f6f6f8` ·
  `--surface-overlay rgba(11,12,15,0.55)`
- Texto: `--text-strong #0b0c0f` · `--text-body #1f2128` · `--text-muted #4d505c` · `--text-faint #6a6d7b`
- Sobre acento: `--text-on-accent #ffffff` (sobre roxo) · `--text-on-energy #000000` (sobre laranja/ciano)
- Link: `--text-link #0b8196` (teal profundo, para bater 4.5:1 no branco)
- Bordas: `--border-subtle #d7d8e0` · `--border-default #b9bbc6` · `--border-strong #0b0c0f` ·
  `--border-accent #7800ff`
- Acento: `--accent #7800ff` · `--accent-hover #6500d6` · `--accent-active #5a16a6` ·
  `--accent-contrast #ffffff` · `--accent-soft #f1e7ff` · `--accent-text #7800ff` (roxo como texto, ~5.6:1 no branco)
- Energia: `--energy #f7931e` · `--energy-hover #e27f0c` · `--energy-active #bd6c0e` · `--energy-contrast #000000`
- Foco/seleção: `--focus-ring #7800ff` · `--selection-bg #7800ff` · `--selection-fg #ffffff`

### C.3 Tokens semânticos — DARK (tema PADRÃO)

- Fundo: `--bg-base #000000` · `--bg-subtle #0b0c0f` · `--bg-muted #14151a` · `--bg-inverse #ffffff`
- Superfície: `--surface-card #14151a` · `--surface-raised #1f2128` · `--surface-sunken #0b0c0f` ·
  `--surface-overlay rgba(0,0,0,0.66)`
- Texto: `--text-strong #ffffff` · `--text-body #e4e4ea` · `--text-muted #8c8f9d` · `--text-faint #b9bbc6`
- Sobre acento: `--text-on-accent #ffffff` (sobre roxo) · `--text-on-energy #000000` (sobre laranja/ciano)
- Link: `--text-link #15bddc` (ciano puro no dark)
- Bordas: `--border-subtle #1f2128` · `--border-default #353841` · `--border-strong #ffffff` ·
  `--border-accent #7800ff`
- Acento: `--accent #7800ff` · `--accent-hover #8a2bff` · `--accent-active #6500d6` ·
  `--accent-contrast #ffffff` · `--accent-soft rgba(120,0,255,0.18)` · `--accent-text #b79aff` (roxo como
  texto no dark, ~5:1 sobre #14151a — **use este, nunca #7800ff como texto no dark**)
- Energia: `--energy #f7931e` · `--energy-hover #ffa42f` · `--energy-active #bd6c0e` · `--energy-contrast #000000`
- Foco/seleção: `--focus-ring #9a4bff` · `--selection-bg #7800ff` · `--selection-fg #ffffff`
- Soft de status re-tingidos: info `rgba(21,189,220,0.16)` · warning `rgba(247,147,30,0.16)` ·
  success `rgba(26,160,106,0.16)` · danger `rgba(239,51,64,0.16)`

**Regra de contraste (WCAG 2.2 AA, obrigatória):** texto sobre **roxo = BRANCO**; texto sobre
**laranja/ciano = PRETO**. Contraste ≥ 4.5:1. Nunca usar `#7800ff` como cor de texto no dark (use
`--accent-text #b79aff`).

### C.4 Tipografia (carregar via Google Fonts)

- **Display / wordmark:** **Paytone One** (stand-in do Peace Sans até vendorizar o real) — sempre
  **UPPERCASE + Bold**. Usada em logotipo, hero, callouts de marca.
- **Títulos secundários:** **Lilita One** (majoritariamente UPPERCASE).
- **Corpo / UI / labels / numerais:** **Inter**. Todos os readouts de dinheiro/quantidade usam Inter com
  **figuras tabulares**: `font-feature-settings: "tnum" 1, "lnum" 1, "cv05" 1`.
- **Sem monospace** (o manual não tem "data strip" mono — não invente uma).
- Carregar assim no `<head>`:
  `https://fonts.googleapis.com/css2?family=Paytone+One&family=Lilita+One&family=Inter:wght@400;500;600;700&display=swap`
- Stacks: display `"Paytone One", "Lilita One", system-ui, sans-serif` · título `"Lilita One", "Paytone One",
  system-ui, sans-serif` · corpo `"Inter", system-ui, sans-serif`.

**Escala tipográfica (rem, 1rem=16px):** caption `0.75` · sm `0.8125` · body-sm `0.875` · base `1` ·
md `1.125` · lg `1.375` · xl `1.75` · 2xl `2.25` · 3xl `3` · 4xl `3.75` · hero `clamp(2.5rem,7vw,4.5rem)` ·
**price `clamp(2.5rem,9vw,3.75rem)`**. Line-height: none 1 · tight 1.06 · snug 1.2 · normal 1.5 ·
relaxed 1.65. Peso: 400/500/600/700. Tracking: tight `-0.02em` · snug `-0.01em` · wide `0.02em` ·
caps `0.06em`.

### C.5 Radius, spacing, elevação, ring, glow, motion

- **Radius:** xs 6 · sm 10 · **md 14 (inputs/botões)** · **lg 18 (cards)** · **xl 24 (sheets/painéis hero)** ·
  2xl 32 · **pill 999 (chips, segmented, tags)**.
- **Spacing (grade 4px):** 1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 7=28 · 8=32 · 10=40 · 12=48 · 14=56 ·
  16=64 · 20=80 · 24=96. Gutter mobile=16, desktop=32. Stack padrão=16. Gap entre campos=12. Section-gap=32.
- **Sizing:** **touch mínimo 44px (AA)** · control sm 36 · **control padrão 48** · **control-lg 56 (hero CTA)** ·
  ícones 16/20/24. Larguras: coluna mobile `--app-max 460px` · conteúdo desktop `--content-max 1120px` ·
  bottom tab bar `64px` · topbar `56px`.
- **Elevação (flat/matte, sombra apertada, baixa dispersão):**
  xs `0 1px 2px rgba(11,12,15,.06)` · sm `0 2px 6px rgba(11,12,15,.08)` · md `0 6px 18px -6px rgba(11,12,15,.14)` ·
  lg `0 16px 40px -12px rgba(11,12,15,.2)`. No **dark**, sombras mais fortes:
  sm `0 2px 8px rgba(0,0,0,.55)` · md `0 8px 22px -6px rgba(0,0,0,.65)` · lg `0 20px 48px -12px rgba(0,0,0,.7)`.
  Rim-light (topo em superfície metálica): `inset 0 1px 0 rgba(255,255,255,.14)`.
- **Glow focal (só hero/CTA, um por zona):** roxo `0 10px 30px -8px rgba(120,0,255,.5)` · laranja
  `0 10px 30px -8px rgba(247,147,30,.45)` · ciano `0 10px 30px -8px rgba(21,189,220,.42)`.
- **Anel de foco (AA 1.4.11):** largura 3px. `--ring: 0 0 0 3px var(--focus-ring), 0 0 0 6px
  color-mix(in srgb, var(--focus-ring) 28%, transparent)`. **Regra do input em foco: a BORDA do input usa a
  MESMA cor do anel** (`--focus-ring`: light `#7800ff`, dark `#9a4bff`) → um traço só. Nunca borda de uma cor
  + anel de outra (o bug de borda dupla já foi corrigido; não reintroduza).
- **Motion (enérgico, preciso):** instant 80ms · fast 130ms · padrão 190ms · slow 280ms · slower 440ms.
  Easings: out `cubic-bezier(.22,.8,.28,1)` · in `cubic-bezier(.5,0,.75,.3)` · in-out
  `cubic-bezier(.45,0,.2,1)` · spring `cubic-bezier(.34,1.56,.64,1)`. Press-scale `0.97`. Respeitar
  `prefers-reduced-motion`.

### C.6 Logo e grafismos

Símbolo = monograma da forja (lâmina/espada + arco de faísca laranja + banner curvo roxo) + wordmark
**"TRUTH'S FORGE"**. No app, use **só o símbolo** em espaços compactos (header, favicon, nav). **Não** deformar,
recolorir ou apertar o logo (clear-space ≥ 2.5× o módulo). Kit de grafismos recoloríveis (DNA curvo do logo):
**arco** (energia/faísca), **espada** (o resultado forjado), **linha curva** (um floreio conectivo), **onda**
(divisor/ritmo de banner). Use **um** floreio orgânico por tela para quebrar a geometria — ótimos em
empty-states, headers e onboarding. Nunca poluir.

---

## D. Componentes — reutilizar e criar

### D.1 REUTILIZAR (já existem no código; respeitar API e estados)

- **Card** — painel matte base. Variantes: `default | flat | outline | ghost | inverse | accent`. Padding:
  `none | sm | md | lg`. `interactive` (hover-lift + foco de teclado, para cards clicáveis; vira `role=button`
  com `tabIndex`). Usa `--surface-card`, `--radius-lg (18px)`, `--shadow-card (sm)`.
- **Field** — wrapper label+hint+erro com ARIA correto. Props: `label`, `required` (mostra `*`), `optional`
  (tag "opcional" à direita), `hint`, `error` (substitui o hint, dispara `aria-invalid` e `role=alert`).
- **NumberField** — input de dinheiro/quantidade pt-BR. Props: `size sm|md|lg`, `currency` (prefixo **R$**),
  `unit` (sufixo: g, kg, kWh, h, %), `error`. Vírgula decimal, `inputmode="decimal"` (teclado numérico
  mobile), placeholder `0,00`, figuras tabulares. Prefixo R$ à esquerda, unidade à direita.
- **PriceHero** — o readout hero do preço (resultado focal). Props: `label` (ex.: "Preço sugerido"), `value`
  (formatado pt-BR, tnum), `caption` (ex.: "Varejo · markup 50%"), `prefix "R$"`, `tone plain|accent|energy|
  inverse|success`, `size md|default|lg`, `center`, `decimals`. **Use `tone="accent"` + glow roxo** no
  resultado principal. Renderiza inteiro/decimais em spans separados (decimais menores).
- **BreakdownRow** — uma linha itemizada do breakdown. Props: `label`, `sublabel`, `value` (número pt-BR ou
  string), `color` (bolinha de legenda tipo chart), `emphasis default|muted|accent|negative|total`, `prefix`,
  `decimals`. Empilhe várias; marque a última como `emphasis="total"`; taxas negativas (marketplace) usam
  `emphasis="negative"` com sinal "−".

### D.2 CRIAR (alinhados aos tokens acima)

- **Button** — primary (fundo `--accent`, texto branco, glow roxo opcional só no CTA hero) / secondary
  (outline `--border-default`) / ghost (sem fundo). Alturas **44 / 48 / 56** (sm/padrão/hero-lg), radius md
  (14px), press-scale 0.97, foco = `--ring`. Badge Premium quando a ação é gated.
- **Tabs / BottomBar (mobile) + Sidebar (desktop)** — mesma IA: **Calcular · Catálogo · Histórico · Conta**.
  BottomBar altura 64px, ícone 24 + label caption, item ≥44px, estado ativo em roxo (`--accent`). Sidebar
  esquerda no desktop com os mesmos itens.
- **Chip de catálogo** — pill (radius 999) para filtrar/selecionar filamento/impressora; estados
  default/selected (selected = `--accent-soft` + borda accent).
- **Badge Premium** — pequeno, **laranja** (`--energy`, texto preto), rótulo "Premium". Marca ações gated.
- **Sheet / bottom-sheet** — painel radius xl (24px), `--surface-overlay` de fundo, entra de baixo (mobile) /
  centralizado (desktop). Usado no upsell contextual.
- **Toast** — feedback efêmero (sucesso/erro/info), radius md, sombra sm.
- **Skeleton** — placeholders de loading (linhas/cards) com shimmer discreto respeitando reduced-motion.
- **Segmented control** — pill, para Varejo × Atacado no mobile e seleções binárias.
- **Collapsible section** — cabeçalho tocável (≥44px) com chevron; usado nas seções avançadas da calculadora.
- **Offline banner** — faixa discreta em **ciano de info** (`--info` / soft), texto "Offline — o cálculo
  continua funcionando".

---

## E. Inventário de telas do protótipo (Nível B — jornada completa)

Ordem da jornada navegável: **Splash → Login → App shell (4 abas) → Calcular → Catálogo → Histórico → Conta →
Upsell**. Todas interligadas.

### E1. Splash
"Verificando sessão…" — símbolo da marca centralizado + um grafismo (arco) sutil. Fundo `--bg-base`.

### E2. Login / auth gate
- Símbolo/wordmark, **proposta de valor em 1 linha** (ex.: "O preço certo, com a conta inteira à mostra.").
- Botão **"Entrar com Google"** (primary, 56px, um por tela).
- Estados: **idle** · **erro** ("Não foi possível entrar. Tente novamente.") · **offline** (login pode ficar
  indisponível; comunicar claramente que o cálculo funciona após autenticar) · **notConfigured** ("Login
  indisponível: Firebase não configurado neste ambiente.").
- Copy existente: título "Entrar", subtítulo "Faça login para calcular seus preços."

### E3. App shell — 4 abas
- **Header minimalista**: só logo/símbolo. **Migração header→tabs (resolve o cramping mobile, TD-017):**
  identidade (email), **Sair** e **toggle de tema** SAEM do header e vão para a aba **Conta**.
- Navegação: **BottomBar** no mobile / **Sidebar** no desktop. Troca de aba **instantânea**.
- **Offline banner** discreto em ciano quando sem rede; ações de rede (salvar/sync) ficam **desabilitadas**.

### E4. Calcular (formato-alvo E1 — a tela central)
- **Inputs básicos sempre visíveis** com **recompute AO VIVO** (o preço muda enquanto digita, cálculo é
  client-side/offline):
  - **Custo do rolo** (R$) · **Peso do rolo** (kg) · **Gramas usadas** (g) · **Markup** (%).
  - Label do markup: **"Markup"**; hint: **"Margem sobre o custo (não sobre o preço de venda)."**
  - Validação: **peso do rolo = 0 → "O peso do rolo deve ser maior que zero."** (Field em erro). Negativos
    rejeitados. Gramas=0 ou markup=0 são válidos.
- **Seções COLÁVEIS (progressive disclosure):** **Energia · Máquina/Depreciação · Falha · Marketplace**.
  Regra: mostre **1 aberta + 1 fechada** no protótipo — **nunca tudo aberto de uma vez** (não intimidar).
  Campos ilustrativos por seção (do modelo-alvo, marcar como ilustrativos):
  - **Energia:** tempo de impressão (h), potência (kW), tarifa (kWh ~R$0,80). energia = tempo·potência·tarifa.
  - **Máquina/Depreciação:** valor da máquina, h/dia, dias/mês, payback (meses), nível de uso → desgaste.
  - **Falha:** % de falha (aplicada ao custo).
  - **Marketplace:** canal (Shopee / ML Clássico / ML Premium / Nenhum) → taxa fixa (R$) + comissão (%).
    Mostrar como **taxa negativa** no breakdown → **líquido**.
- **Seletor catalog-driven:** dropdowns **Filamento ▾** e **Impressora ▾** (puxam do catálogo) + link
  **"inserir manualmente"** como fallback sempre disponível.
- **Resultado:**
  - **PriceHero** (`tone="accent"` + glow roxo) com **preço sugerido**, label "Preço sugerido", caption ex.
    "Varejo · markup 50%".
  - **Breakdown itemizado completo** (BreakdownRow empilhado): material, energia, máquina, mão de obra, falha,
    margem, **taxa de marketplace (negativa)** → **líquido** (`emphasis="total"`). Torna a conta transparente.
  - **Varejo × Atacado:** **desktop = 2 colunas** lado a lado; **mobile = segmented control** (Varejo|Atacado)
    + **linha-resumo**. Markup padrão varejo +50% / atacado +30% (ilustrativos).
- **Ação Salvar** → dispara **bottom-sheet de upsell** (persistir é Premium). O cálculo em si NUNCA é gated.
- **Exemplo mínimo (cravar no protótipo):** custo R$100, peso 1kg, 20g, markup 50% → **material R$2,00**,
  **preço sugerido R$3,00**. **Exemplo completo E1:** custo R$201,11, peso 2kg, 158g, markup 30% →
  material ~R$15,89, sugerido ~R$20,65 (mais as demais linhas ilustrativas do breakdown).

### E5. Catálogo (CRUD mock)
- **Lista** de filamentos/impressoras em **Card interativo** (chips pill para alternar Filamentos|Impressoras).
- **Empty-state educativo** + seed **"Começar com filamentos comuns"** (com um grafismo/onda).
- **Form add/editar:**
  - **Filamento:** nome, cor, custo do rolo (R$), peso (kg).
  - **Impressora:** modelo, valor (R$), h/dia, dias/mês, payback (meses), **nível de uso → desgaste:**
    Básico 10% / Médio 20% / Profissional 30% / Intenso 45%.
- **Salvar → dispara sheet Premium** (catálogo é persistência).

### E6. Histórico
- **Lista mock** de orçamentos salvos (data, produto, preço).
- **Empty-state "gated" para free** — vitrine de upsell **honesta** (mostra o que o Premium destrava, sem
  dark-pattern).
- **Detalhe do cálculo** = snapshot congelado (inputs + breakdown reproduzível) + **Exportar** (PDF/CSV,
  Premium).

### E7. Conta
- **Email Google** (identidade migrada do header) · **plano atual** (Free/Premium) · **toggle de tema**
  (Dark↔Light, migrado do header) · **Sair** · **Sobre / versão**.

### E8. Upsell (sem checkout — E6 fora de escopo)
- **Bottom-sheet contextual** (dispara ao tocar Salvar/Exportar/Adicionar): título tipo **"Calcular é grátis;
  salvar é Premium"**, apoio na copy existente **"Calcular e ver a conta é grátis. Salvar e exportar fazem
  parte do Premium."**, botões **"Agora não"** e **"Ver planos"**. Honesto, sem dark-pattern.
- **Tela de planos Free × Premium** (mensal / anual): comparação clara de recursos; preços como placeholder
  **"R$ —"** (ainda não definidos). **SEM checkout real.**

### E9. Transversais
- **Banner offline** (ciano info) presente no shell quando sem rede.
- **Erro global** — envelope ADR-0002 (`code` → frase pt-BR amigável), **nunca stack trace**.
- **404** — página de rota inexistente, on-brand (um grafismo, link de volta ao shell).

---

## F. Interações do protótipo (clicável — precisa funcionar de verdade)

1. **Recompute ao vivo** na calculadora: digitar em qualquer input básico atualiza PriceHero + breakdown
   instantaneamente (mock reativo).
2. **Progressive disclosure:** abrir/fechar as 4 seções avançadas (começa com 1 aberta + 1 fechada).
3. **Varejo × Atacado:** desktop 2 colunas; mobile segmented control alterna o resultado + linha-resumo.
4. **Catalog-driven + manual:** escolher Filamento/Impressora no dropdown preenche os campos; "inserir
   manualmente" libera edição direta.
5. **Upsell só na fronteira de persistência:** Salvar/Exportar/Adicionar → sheet Premium. **Cálculo nunca é
   gated** (sem paywall no compute).
6. **Troca de aba instantânea** (BottomBar/Sidebar).
7. **Login/logout fullscreen** (Login E2 ↔ shell; Sair na Conta volta ao Login).
8. **Alternância de tema** (toggle na Conta) — Dark (padrão) ↔ Light, sem reload, tokens themeáveis.

---

## G. Matriz de estados (para cada superfície interativa)

Definir **loading · empty · error · success · disabled · offline** onde aplicável:

| Superfície | loading | empty | error | success | disabled | offline |
|---|---|---|---|---|---|---|
| Login | — | — | erro de entrada | sessão ok → shell | — | login indisponível, cálculo ok |
| Calcular (inputs) | — | placeholders | peso=0 → validação | recompute ao vivo | inputs bloqueados se sync | banner ciano, cálculo funciona |
| Resultado/breakdown | skeleton | zerado (0,00) | — | preço + breakdown | — | mantém cálculo |
| Catálogo lista | skeleton | empty educativo + seed | falha ao carregar | itens listados | — | leitura mock ok, salvar off |
| Catálogo form | — | — | validação de campo | salvo (sheet Premium) | salvar off se sem rede | salvar desabilitado |
| Histórico | skeleton | gated (vitrine upsell) | falha | lista mock + detalhe | — | leitura mock, export off |
| Exportar | spinner curto | — | falha | arquivo pronto (mock) | disabled se free | desabilitado |
| Upsell sheet | — | — | — | "Ver planos" | — | — |
| Conta | — | — | — | tema/logout aplicados | — | logout ok, sync off |

Erros sempre em frase pt-BR amigável (envelope ADR-0002), nunca stack.

---

## H. Entregáveis

- **Todas as telas** (E1–E9) em **mobile (~390px)** e **desktop**, em **DARK (padrão)** e **LIGHT**.
- **Estados-chave preenchidos:**
  - Calc mínima com o **exemplo R$100/1kg/20g/50% → material R$2,00, sugerido R$3,00**.
  - Um **exemplo completo E1** com breakdown itemizado (material, energia, máquina, mão de obra, falha,
    margem, taxa marketplace negativa → líquido) + varejo × atacado.
  - **Validação peso=0** ("O peso do rolo deve ser maior que zero.").
  - **Empty states** (catálogo educativo + seed; histórico gated).
  - **Sheet de upsell** contextual + tela de planos Free×Premium (preços "R$ —").
  - **Banner offline** ativo.
- **Telas interligadas** — protótipo navegável de ponta a ponta (fluxo da seção F).
- **Especificação dos tokens usados** por tela, **mapeável para as CSS vars existentes** (nomes `--accent`,
  `--surface-card`, `--radius-lg`, etc.), para o handoff ao código ser 1:1.

**Dados mock realistas (marcar como ILUSTRATIVOS, NÃO recomendação de preço):**
- Filamentos: **PLA / PETG / ABS**, custo do rolo **~R$90–160/kg**.
- Impressoras: linha **Ender 3 / Creality / Bambu Lab**.
- Tarifa de energia: **~R$0,80/kWh**.
- Canais de marketplace ilustrativos (Shopee, ML Clássico, ML Premium, Nenhum).

---

## I. NÃO faça (don'ts)

- Gradiente por padrão; skeuomorfismo; cor fora da marca; deformar/recolorir o logo.
- Enterrar o resultado (o PriceHero é o foco).
- Abrir **todas** as seções avançadas de uma vez (intimida).
- Dark-pattern de upsell; **paywall no cálculo** (computar é sempre grátis).
- Inventar preço de plano (use "R$ —").
- Usar `#7800ff` como cor de texto no dark (use `--accent-text #b79aff`).
- Borda de foco de cor diferente do anel (um traço só, `--focus-ring`).
- Monospace (não existe no manual).
- Mais de um acento / um glow / um grafismo por zona.

---

## J. Itens em aberto e assunções (marcar no protótipo)

- **Preços de plano deferidos** — placeholders "R$ —"; estrutura Free × Premium (mensal/anual) definida, valor não.
- **Fontes de display são stand-in:** **Paytone One** substitui **Peace Sans** até vendorizar o `.woff2`
  real; **Lilita One** e **Inter** são definitivas.
- **Dados mock são ILUSTRATIVOS** (filamentos, impressoras, tarifa, canais) — não são recomendação de preço
  nem valores reais de mercado.
- **Sem checkout** (E6 fora de escopo): o fluxo de upsell termina na tela de planos.
- **Entitlement binário**: sem quota/contador; qualquer persistência é Premium (fonte:
  `docs/product/business-rules.md`).

---

*Fim do briefing. Produza o protótipo clicável completo, Dark (padrão) + Light, mobile-first e responsivo,
com os tokens exatos acima.*
