# DoD Evidence — 019-porte-design

## V0 — a medição que dimensiona a PR-A (2026-08-27)

Medição, não conserto. Nenhum arquivo de produto foi alterado nesta tarefa (T001). Fonte: `docs/design/handoff-019/README.md` (§1/§2/§3 + "Vocabulário e marca") e `docs/design/handoff-019/tf-components.css` (`grep NOVO`, 29 marcadores).

| # | item | classe (a/b/c) | evidência (arquivo:linha) | o que a PR-A faz |
| --- | --- | --- | --- | --- |
| 1 | `tf-aviso` | c | grep vazio em `apps/web/src` (busca `tf-aviso`); folha: `docs/design/handoff-019/tf-components.css:320` (`/* ---- tf-aviso (NOVO...) ---- */`) | construir o primitivo (3ª categoria de mensagem) |
| 2 | `tf-plist` | c | grep vazio em `apps/web/src`; folha: `tf-components.css:918` (`/* ---- tf-plist (NOVO...) ---- */`) | construir a lista densa do Catálogo (390px) |
| 3 | `tf-table` | c | grep vazio em `apps/web/src`; folha: `tf-components.css:1000` (`/* ---- tf-table (NOVO...) ---- */`) | construir a tabela densa do Catálogo ≥1024px |
| 4 | `tf-segmented--split` | c | `apps/web/src/shared/ui/segmented.css:43,47` só têm `--sm`/`--md`, sem `--split`; folha: `tf-components.css:703` | adicionar o modificador `--split` a `segmented.css` |
| 5 | `tf-btn--full` / `--half` | c | `apps/web/src/shared/ui/button.css:40,45,52,62,70,77,88,98,101` — só `--sm/--lg/--primary/--secondary/--ghost/--danger/--danger-ghost/--glow/--loading`, nenhum `--full`/`--half`; folha: `tf-components.css:213,216` | adicionar as duas larguras a `button.css` |
| 6 | `tf-frozen` (vs `<fieldset disabled>`) | c | `apps/web/src/features/catalog/filament-form.tsx:56` (`<fieldset disabled={readOnly} className="flex flex-col gap-3 border-0 p-0 m-0">`) e `apps/web/src/pages/catalogo/produto-page.tsx:298,366,386` (`<fieldset disabled={lapsed} className="contents">`) — nenhum tem classe `tf-frozen`, nenhum CSS de esmaecimento (nem opacity nem `background: var(--bg-muted)`) acompanha o `disabled` nativo hoje; folha: `tf-components.css:667` | construir `tf-frozen` e aplicá-lo aos 3 fieldsets (a classe some, o `disabled` nativo fica) |
| 7 | `tf-alert--compact` + `tf-alert__action` | b (compact existe local, geometria DIFERENTE) / c (`__action` não existe) | local: `apps/web/src/features/calculator/shopee-warnings.css:5-14` (`padding: var(--space-2) var(--space-3)` = 8px/12px, sem `gap`, `align-items: center`); folha: `tf-components.css:740` (`padding: var(--space-3); gap: var(--space-2); align-items: flex-start` = 12px/8px/topo). `tf-alert__action`: grep vazio em `apps/web/src`; folha: `tf-components.css:749-764` | subir `tf-alert--compact` ao DS com a geometria da folha (12px/8px/flex-start) — a versão local de `shopee-warnings.css` fica retrocompatível ou é substituída; construir `tf-alert__action` |
| 8 | `tf-alert__close` | c | grep vazio em `apps/web/src` (nenhuma dispensa em `tf-alert` hoje); folha: `tf-components.css:770-779` (alvo 44px por pseudo-elemento, caixa 20px) | construir `tf-alert__close`; decisão do dono: dispensa vale até a fonte mudar |
| 9 | `--warning-text` / `tf-alert--warning` | c | grep vazio em `apps/web/src/styles/tokens/colors.css` para `--warning-text`; o que existe é `--tf-amber-deep: #bd6c0e` em `apps/web/src/styles/tokens/colors.css:30` (linha 40 mapeia `--tf-orange-active: var(--tf-amber-deep)`, não um par `-text`); README §2 cita `--tf-warning-deep`, que **não existe** — confirmado grep vazio; folha usa `--tf-amber-deep` de fato (`tf-components.css:90,296`) | criar `--warning-text` (valor = `--tf-amber-deep`) + `tf-alert--warning` |
| 10 | `tf-badge--warning` | c (warning) / a (success/danger já existem) | `apps/web/src/shared/ui/badge.css:20-29` tem `.tf-badge--neutral/--info/--success/--danger`; nenhum `--warning`. grep `badge--warning` em `apps/web/src` vazio | adicionar só `.tf-badge--warning`; success/danger ficam intocados |
| 11 | wordmark PNG | a (confirmado) | `apps/web/src/shared/ui/logo.tsx:29-31` já serve `/brand/logo/logo-inteira-{white,black}.png` para `variant="full"`; `tf-lockup` só aparece em comentário histórico, `apps/web/src/widgets/top-bar/top-bar.test.tsx:52` ("a full lockup is the owner's PNG artwork now, not the `tf-lockup` SVG") — nenhum uso ativo | nenhuma ação (já correto) |
| 12 | TabBar rótulo 12px→10px | c | `apps/web/src/widgets/app-nav/app-nav.css:79` — `.tf-nav--tabbar .tf-nav__item { font-size: var(--fs-caption); }`; `--fs-caption: 0.75rem` (12px) em `apps/web/src/styles/tokens/typography.css:26` — hoje é 12px, alvo é 10px | reduzir para 10px + 7px de respiro (novo valor, não token existente — checar se vale token novo ou valor local) |
| 13 | grafismos em 404/erro | a (já usam Grafismo) — mas ver nota | `apps/web/src/pages/not-found/not-found-page.tsx:4,14` (`<Grafismo name="arco" .../>`) e `apps/web/src/pages/error/error-page.tsx:6,48` (`<Grafismo name="espada" .../>`) — ambos JÁ usam o componente | nenhuma ação nas 2 telas atuais; README diz "grafismos **fora** das telas 404/erro" — leitura: a decisão é ESTENDER Grafismo a OUTRAS telas (não remover das 2 que já têm) — confiança 70%, checar com designer-ux/product-owner antes de escopar a PR-A |
| 14 | anel de foco (`:focus-visible`) | a/b misto — ver "o que a PR-A faz" | `button.css:30` (`outline:none; box-shadow: var(--ring)`) · `app-nav.css:39-45` (`outline:none; background: var(--accent-soft); box-shadow: inset 0 0 0 var(--ring-width) var(--focus-ring)`, + `forced-colors` fallback `outline:2px solid Highlight`) · `segmented.css:74-77` (`outline: 2px solid var(--accent); outline-offset: 2px`) · `switch.css:47-50` (`outline:none` no host, `box-shadow: var(--ring)` na track) · `field.css:147-149` (`.tf-input:focus-visible { box-shadow: none }` — o anel real vive em `.tf-inputwrap:focus-within`, não medido aqui) | decisão do dono é REMOVER o anel — mudança abrangente em 5 arquivos, cada um com mecanismo próprio (outline vs box-shadow vs background); PR-A precisa decidir arquivo a arquivo, não um `:focus-visible{outline:none}` global |
| 15 | adaptação 1 — `var(--border)`→`--border-default` | a | `apps/web/src/styles/tokens/colors.css:99,166` já declara `--border-default`; usado em `button.css:65`, `card.css:16` | nenhuma ação (produto já no nome certo; a folha é que precisou da troca) |
| 16 | adaptação 2 — `fixed`→`absolute` no toaster/TabBar | a | produto usa `position: fixed` de propósito e corretamente: `app-nav.css:56` (`.tf-nav--tabbar`) e `toast.css:4` — são a MOLDURA real (janela), não a moldura de prancheta; a troca para `absolute` é só um artefato da prancheta simulando um telefone dentro da página | nenhuma ação |
| 17 | adaptação 3 — URLs de ícone → cópia local | a (mecanismo equivalente, nome diferente) | produto NÃO usa uma var `TF_ICON_BASE` (grep vazio em todo `apps/web`) — os ícones são inlined como componentes React (`apps/web/src/shared/ui/icon.tsx:10-39`, comentário na linha 7: "o mesmo 43-SVG source também vive em `public/brand/icons/lucide`"); cópia estática confirmada em `apps/web/public/brand/icons/lucide/*.svg` (33 arquivos) | nenhuma ação; README cita `TF_ICON_BASE` mas essa variável não existe no repo — o mecanismo real (inline + cópia estática local, 0 URL externa) já cumpre a intenção. Confiança 85% |
| 18 | adaptação 4 — componente React → classe CSS | n/a (não verificável por grep único) | é uma regra de tradução da folha para o porte, não um estado do produto a medir | nada a medir aqui; aplicar a regra durante a implementação de cada primitivo |
| 19 | adaptação 5 — `text-decoration:none` via preflight | a | `apps/web/src/styles/global.css:4` (`@import "tailwindcss"`) traz o preflight do Tailwind, que já neutraliza `text-decoration` em `a`; nenhuma regra `text-decoration: none` redundante encontrada em `button.css` | nenhuma ação |
| 20 | adaptação 6 — `clamp(...cqw...)` vs `12vw` | a | `apps/web/src/shared/ui/price-hero.css:119` — `.tf-price--lg .tf-price__amount { font-size: clamp(3rem, 12vw, 4.75rem); }` — produto já usa `vw` (não `cqw`), piso/teto batem com os da folha | nenhuma ação — reverter para `cqw`/`container-type` REINTRODUZIRIA a adaptação de prancheta |
| 21 | adaptação 7 — `flex:0 0 auto` vs `min-width:0` no `__int` | a | `price-hero.css:13` (`.tf-price { min-width: 0 }`), `:83` (`.tf-price__amount { min-width: 0 }`), `:105` (`.tf-price__int { min-width: 0 }`) — produto já usa `min-width: 0` nos 3 níveis, coerente com o D2/015-A6 documentado no próprio arquivo (linhas 11-13, 80-95, 106-114) | nenhuma ação |
| 22 | adaptação 8 — `tf-price--rola` (máscara) | c, mas NÃO portar | grep vazio em `apps/web/src` para `tf-price--rola` (correto — README/§3 item 8 marca como "dispositivo de prancheta, NÃO portar") | nenhuma ação — item explicitamente fora de escopo |

### Fatos medidos

- `--tf-amber-deep: #bd6c0e` — `apps/web/src/styles/tokens/colors.css:30`. Não existe `--tf-warning-deep` no produto (grep vazio) nem `--warning-text` (grep vazio); a folha (`tf-components.css:90,296`) já usa `--tf-amber-deep`, coerente com a nota do README de que "`--tf-warning-deep`, que já existe" está **errada** — o valor real que existe é `--tf-amber-deep`.
- Rótulo atual da TabBar: **12px** (`var(--fs-caption)` = `0.75rem`, `apps/web/src/styles/tokens/typography.css:26`), aplicado em `apps/web/src/widgets/app-nav/app-nav.css:79`. Alvo do porte: 10px com 7px de respiro (ainda não portado).
- `:focus-visible` existentes hoje, um por arquivo/mecanismo (nenhum removido): `button.css:30` (`box-shadow: var(--ring)`) · `app-nav.css:39` (`background: var(--accent-soft)` + `box-shadow: inset ...`, com fallback `forced-colors` na linha 45) · `segmented.css:74` (`outline: 2px solid var(--accent); outline-offset: 2px`) · `switch.css:47,50` (`outline:none` no host + `box-shadow: var(--ring)` na track) · `field.css:147` (`box-shadow: none` — desliga o anel duplo do input cru, o anel real do campo mora em `.tf-inputwrap:focus-within`, fora do escopo desta busca).

## O que a V0 mudou no dimensionamento

Das 22 linhas classificadas: **10 (c)** — não existem e entram integralmente na PR-A (`tf-aviso`, `tf-plist`, `tf-table`, `tf-segmented--split`, `tf-btn--full/--half`, `tf-frozen`, `tf-alert__action`, `tf-alert__close`, `--warning-text`/`tf-alert--warning`, `tf-badge--warning`, TabBar 10px) — **11**, corrigindo a contagem: os 10 primitivos do §1 (exceto `tf-phone-scroll`, fora de escopo) + o token do §2 + o rótulo da TabBar (item 12) somam 12 pontos de construção real; **1 (b)** — `tf-alert--compact` existe local mas com geometria errada (8/12px, `align-items:center`) e precisa subir ao DS com a geometria da folha (12/8px, `flex-start`), sem duplicar a regra; **8 (a)** confirmados sem ação (wordmark, `position:fixed`, ícones locais, preflight, `12vw`, `min-width:0`, `--border-default`, grafismos 404/erro já presentes); **1 item (14, anel de foco)** é misto — 5 mecanismos distintos já existem e a decisão do dono é REMOVÊ-LOS, o que é trabalho real mas de NATUREZA DIFERENTE de "construir" (é subtrair 5 regras espalhadas, não uma regra nova). Isso ENCOLHE a PR-A frente à leitura ingênua do §1 (que listava 9 primitivos "novos" + 1 token): a superfície real de construção é menor em dois pontos (wordmark e ícones já resolvidos por mecanismo equivalente) e maior em um ponto que o §1 não nomeia como primitivo (a remoção do anel de foco, item 14, e a extensão de Grafismo a outras telas, item 13, ambos vindos de "Vocabulário e marca"). O README também erra um fato (§2 diz que `--tf-warning-deep` "já existe" — não existe; o valor real é `--tf-amber-deep`), o que a PR-A deve corrigir na hora de nomear o novo token.

### T002 — contraste de `--tf-amber-deep` (`#bd6c0e`) como TEXTO (2026-08-27)

Método: WCAG 2.x sRGB (luminância relativa, mesmo cálculo do `a11y-targets-contrast.spec.ts`), fundo do
tema escuro = card `#14151a`; o "soft" escuro é `rgba(247,147,30,.16)` **composto** sobre o card (o fundo
real do badge/alert, o pior caso — lição CF-036/037 no próprio `colors.css`).

| cor de texto | claro · sobre `#ffffff` | claro · sobre `--tf-warning-soft` `#fdeed8` | escuro · sobre card | escuro · sobre soft@card |
| --- | --- | --- | --- | --- |
| `#bd6c0e` (`--tf-amber-deep`, atual) | **3,95** ✗ | **3,46** ✗ | 4,61 | 3,53 ✗ |
| `#a35c0b` | 5,13 | 4,49 ✗ (por 0,01) | — | — |
| **`#9a570a`** (candidato) | **5,61** ✓ | **4,92** ✓ | — | — |
| `#f7931e` (`--tf-orange`, base) | — | — | **7,94** ✓ | **6,08** ✓ |

**Veredito: `#bd6c0e` REPROVA AA como texto nos dois fundos do tema claro** (3,95 e 3,46 < 4,5). A
decisão do dono (27/08) já cobre isto: escurece-se **só o texto**. `--warning-text` nasce então com dois
valores, no padrão que `--danger-text`/`--success-text` já seguem em `colors.css`: claro `#9a570a`
(5,61 / 4,92 — passa nos dois fundos, o primeiro tom que passa sobre o soft com folga; `#a35c0b` falha
por 0,01) e escuro `var(--tf-orange)` (7,94 / 6,08, a mesma regra "o tom base, mais claro, lê no plano
escuro" do bloco INV-3/4). Ícone, badge e botão seguem em `--tf-amber-deep`/`--tf-orange` — o laranja
da marca não muda (ADR-0032 §4). Consequência para a T020: a folha do design escreve
`--warning-text: var(--tf-amber-deep)`; o porte **não** copia essa linha — copia a intenção com o valor
que passa, e registra a divergência na cópia congelada.

### T003 — o tamanho real da troca canal → marketplace (2026-08-27)

Busca literal `canal|canais` (case-insensitive; o `\b` do PowerShell/rg não pega o plural com acento e
retornou 0 — a contagem é por substring, confirmada linha a linha).

| onde | ocorrências | observação |
| --- | --- | --- |
| `apps/web/src/**` (produto, tudo) | **63** | o texto visível mora em `messages.pt-br.ts` |
| └ `apps/web/src/shared/i18n/messages.pt-br.ts` | **31** | é o escopo da US2/T032 — só texto visível; chaves/símbolos ficam |
| `apps/web/tests/**` (e2e) | **95** | asserções de string, escopo da T033 |
| └ `cf-010-*` (homologação automatizada) | 53 | um único arquivo concentra mais da metade |
| `backend/**` | 0 | nada a fazer |
| `packages/pricing-core` | 2 | comentários/identificadores — **não** são texto visível, ficam |

Substituem os "374" da prancheta: o número real de frases a trocar é **31** no produto e **95**
asserções a acompanhar no e2e. `channelSet`, `channelFieldPlan`, rotas e nomes de arquivo ficam
intactos (spec §Clarifications — vocabulário é texto visível, não símbolo).

### T006 — a guarda "uma classe tf-*, um arquivo" ficou VERMELHA (2026-08-27)

`apps/web/src/styles/tf-class-uniqueness.test.ts`. O extrator conta **definições** (seletor composto sem
combinador, todas as classes `tf-*`) e ignora overrides contextuais (`.escopo .tf-x`, `.tf-a > .tf-b`) e
variantes de feature (`.tf-badge.fee-seal`) — a primeira versão contava tudo e acusava 9 "duplicatas",
7 delas legítimas; o refino está provado por um caso de unidade dentro do próprio teste.

Resultado no dia: **1 duplicata real, e não a que a task previa.**

- `tf-grafismo → shared/ui/grafismo.css × styles/base.css` — **achado novo**. `base.css:173` define
  cor/`pointer-events`/`user-select`; `grafismo.css:3` define largura/altura/máscara — e o comentário de
  `grafismo.css` DECLARA a divisão ("colour / pointer-events live in styles/base.css"). Duas casas para um
  nome, de propósito, e por isso invisível até uma guarda perguntar. Fecha na T021 (os 4 declarativos de
  `base.css` mudam para `grafismo.css`; `base.css` fica sem `tf-grafismo`).
- `tf-alert--compact` **NÃO acende a guarda hoje**: em `src` só existe a definição local de
  `features/calculator/shopee-warnings.css:5`; a versão da folha ainda mora em `docs/design/handoff-019/`.
  A guarda protege a **transição** da T021 — subir a variante a `alert.css` sem apagar a local fica
  vermelho. A task previa o vermelho pelo caso errado; o registro corrige.

### T007 — dispositivos de prancheta: verde, e não-vácuo provado (2026-08-27)

`apps/web/src/styles/prancheta-devices.test.ts` — 2/2 verdes (`src` e `dist` quando existir). Prova de
não-vacuidade: um `src/styles/_tmp-vacuidade.css` com `.x-tmp.tf-phone-scroll {}` fez o teste falhar
com `"tf-phone-scroll em styles/_tmp-vacuidade.css"`; removido, 2/2 verdes de novo; o arquivo temporário
não existe mais (`ls` confirma).

**Adendo T006 (mesmo dia): o vermelho vira dívida DECLARADA, não vermelho permanente.** Um teste vermelho em
`src/styles/` derruba o `gate:all` no pre-push e no CI até a T021 — e vermelho permanente ensina "roda de
novo" (lição 014/US5). A guarda ganhou `DIVIDA_CONHECIDA` (1 entrada: `tf-grafismo`, motivo e task ao lado)
e um SEGUNDO teste que exige que cada entrada da lista **ainda esteja duplicada** — pagar a dívida sem tirar
da lista fica vermelho. Efeito: a guarda está viva desde já para qualquer duplicata NOVA (a promoção da
T021 que esquecer de apagar `shopee-warnings.css` acende), e a T021 é obrigada a esvaziar a lista. Prova de
não-vacuidade continua sendo o vermelho medido acima (o run sem a lista).

### T030 (parcial, 2026-08-27) — 404/erro sem grafismo · TabBar 10px

O item 13 da V0 (confiança 70%: "estender Grafismo a outras telas?") está resolvido pela **prancheta
24c**, que é explícita: *"As duas telas de borda ficam sem grafismo. O produto põe o arco no 404 e a
espada no erro, acima do título — … um ornamento acima dela só empurra a saída para baixo."* Leitura
correta do README ("grafismos fora das telas 404/erro") = **tirar** das duas. Feito: `Grafismo` removido
de `not-found-page.tsx` e `error-page.tsx` (o componente continua no DS, exportado; hoje sem consumidor no
app), `.tf-notfound` ganha `justify-content: center; text-align: center` (folha l.905, verbatim),
`.tf-error` já era idêntico à folha. TabBar: `.tf-nav--tabbar .tf-nav__label { font-size: 10px }`
(folha l.864); o respiro ≥7px por lado é medido na T025. Testes das três áreas: 17/17 verdes.

### T011/T017/T015/T020 — `Frozen` + `--warning-text` (dev-frontend, 2026-08-27)

- `shared/ui/frozen.{tsx,css,test.tsx}`: `<fieldset disabled class="tf-frozen">` sem prop que desligue o
  `disabled` (o vermelho achou um bug real antes do verde: `{...rest}` depois de `disabled` deixava um
  `disabled={false}` vencer — ordem invertida). 5/5.
- **Divergência README × folha, decidida pela folha**: o README §1 diz "`background: var(--bg-muted)`
  obrigatório"; o comentário da própria folha (`tf-components.css:674-679`) diz que `--bg-muted` empatava
  com o cartão no escuro e a regra real usa `background: var(--border-subtle)`. A regra 1 (folha
  verbatim) venceu; está no comentário de abertura de `frozen.css`. A T016 mede o contraste real
  (≥5,67:1 / ≥18,23:1) contra ESSE fundo.
- `colors.css`: `--warning-text` claro `#9a570a` · escuro `var(--tf-orange)` (números da §T002 no
  comentário); `token-parity` baseline 87→88, 3/3. `--warning-soft` NÃO criado (levaria a baseline a 89
  contra o número da T015; o CSS usa `--tf-warning-soft`, que existe nos dois temas).

### T028 — o export e o vocabulário (2026-08-27, medido antes da T032)

`grep -rin "canal" backend/app` = **0** (confirma a T003) e `grep -in "canal|marketplace" backend/app/services/
quote_render.py backend/app/api/export.py` = **0**: o PDF escreve só `Preço de varejo`/`Preço de atacado`
(`_BASIS_CAPTION`) + o conteúdo do payload congelado; o CSV são "rows equal the stored snapshots exactly"
(FR-513). Consequência: a palavra "canal"/"marketplace" NUNCA nasce no servidor — o export de um snapshot
antigo não pode mudar com a fatia (imutabilidade ADR-0019 + zero string) e o de um snapshot novo só diz o
que o payload diz (nomes de marketplace — Shopee/Amazon/ML — não a palavra). A T028 fica satisfeita por
ESTRUTURA; a asserção e2e que sobra é a negativa (o PDF/CSV baixados não contêm "canal"), acrescentada ao
round-trip existente de `history-export.spec.ts` na T034.

### T029 · T032 · T033 (dev-frontend ×2, 2026-08-27)

- **Foco zerado** em 11 arquivos, cada um pelo mecanismo próprio: `button`, `card --interactive`, `app-nav`
  (+ o fallback `forced-colors`), `segmented`, `switch`, `field` (`.tf-inputwrap:focus-within` fica SÓ com
  `border-color: var(--accent)`; o anel de ERRO `--error:focus-within` é validação, não foco — fica),
  `dialog__x`, `toast__close`, `category-picker__option`, e o **reset global** de `styles/base.css` (não
  estava no inventário da V0 — o grep achou). `_diag-foco.spec.ts` (018) apagado. Órfãos: `--ring`,
  `--focus-ring` (mantidos; `token-parity` 88). 81/81.
- **Vocabulário**: 17 folhas trocadas em `messages.pt-br.ts` (a guarda T027 listava 22 entradas — 5 eram
  a mesma folha em linha dupla); zero hard-code fora de `messages`; gênero "o marketplace"; comentários
  de engenharia com "canal" ficam. T033: **1 asserção** (`bom-page.test.tsx:509`) — os demais 94 achados
  da T003 já assertavam via `messages` ou são nomes de teste/identificadores/metadados de relatório.
  977/977 verdes; `tsc` 0.
**Adendo T028**: a asserção negativa NÃO foi ao e2e — `history-export.spec.ts` explica que os streams do
ReportLab são deflatados e um grep nos bytes "passa quer a linha esteja no documento quer não". Foi para
`backend/tests/test_export.py::TestQuoteContentAdversarialData::test_the_quote_never_says_canal`, que lê o
texto decodificado do PDF completo (opt-in do detalhamento + sobretaxa + kit) e exige `len(text) > 100`
antes do negativo. 2/2 verdes, ruff limpo.

### T016 · T025 · T024 — a primeira rodada no browser (2026-08-27)

Stack real (build + emulador 9500 + backend via `run_e2e_server.py` + Postgres compose — o Docker daemon
tinha caído desde a T005; subido de novo). `porte-medidas.spec.ts` **8/8** (chromium + mobile): Frozen —
dica e rótulo ≥4,5:1 nos dois temas contra o fundo real pintado e opacidade 1 no contêiner; Plist — 12
itens a 390px com ≥9 inteiros em 844px; TabBar — os 5 rótulos a 10px, sem transbordo, ≥7px de respiro
por lado.

**Achado colateral do vocabulário (classe T033 que o grep por "canal" NÃO vê):** com "Remover canal" →
"Remover marketplace", `getByLabel("Marketplace")` passou a casar DOIS controles por substring (o select
e o botão de remover) — `calculator-layout.spec.ts` quebrou por *strict mode violation*. Correção: `{ exact:
true }` em **19 locators / 8 specs** (calculator 8, marketplace-premium 3, scenarios 2, scenarios-manage 2,
calculator-layout/category-picker/shopee-profile-volumoso/porte-screenshots 1 cada). Lição: uma troca de
vocabulário muda o NOME ACESSÍVEL, e locators por substring são asserções implícitas.

`focus-none.spec.ts` (T024) falhou por dois bugs MEUS, não do produto: `getByRole("switch").first()` pegava
o switch de sobretaxa, que nasce `disabled` (foco não chega — correto do produto); e `filter({ has })` com
`.first()` dentro não é relativo. Corrigidos (switch habilitado; a moldura é `input.locator("..")`).
Rerun na rodada completa (T034).

### T034 — a rodada completa achou uma dívida do 018 (2026-08-27)

E2E completo local: **318 passaram · 24 falharam · 30 skipped · 8 não rodaram** (3,8 min). Das 24, **20 são
IDÊNTICAS às do job E2E do CI no merge do 018** (`6a1a55a`, run 33016384802: 20 failed / 304 passed) —
o 018 entrou em `develop` com o E2E do CI VERMELHO, e o ground line/dod-evidence do 018 não registrou isso.
Classe única: *strict mode violation* — o mestre-detalhe do 018 (chromium ≥1280) renderiza a lista E a
ficha, e `getByText("PLA Azul")`/`getByText("Valor cotado")`/`getByText("R$ 15,99/mês")` passaram a
resolver 2 elementos (span da lista + h2 da ficha; oferta inline + diálogo). As outras 4 eram o `focus-none`
campo (transição de `border-color` lida a meio caminho — `expect.poll`, lição do rail do 018). O CI tinha
ainda 1 flaky mobile (`catalog.spec.ts:183`) que aqui passou.

Decisão: os 20 são dívida do 018 e a PR-A NÃO pode chamar "e2e verde" sem pagá-la — corrigidos em commit
SEPARADO (`test(018): …`), delegado com a regra "escopar o locator ao painel pretendido; se a duplicação for
defeito de produto (ex.: dois convites numa tela), reportar, não mascarar".

**Adendo T034 — a dívida paga e os dois defeitos que ela escondia (qa-software, 381k tokens · 61 min).**
Os 20 strict-mode do 018 foram escopados ao painel certo em 13 specs (helpers `itemVisible`,
`historicoDetail`, `openCatalogItem`, `ledgerCard`; a oferta inline `#tf-conta-oferta` substitui o diálogo
para vendedor livre no desktop; 4 `getByText(planPremium)` exatos). Achados extras: no mestre-detalhe o
clique na lista SELECIONA (precisa de "Abrir para editar" para navegar); em ≥1280 filamento/impressora
editam inline na ficha; o "Voltar" do 404 do histórico não existe de propósito em ≥1280 (a lista é o
caminho). Dois testes ficaram vermelhos de propósito porque a duplicação era **defeito de produto**:
1. **Oferta duplicada via `?assinar=1`** (`conta-page.tsx`): a intenção da URL abria a gaveta por cima da
   oferta inline — 2 preços, 4 rádios de período — a violação de "um convite por tela" (016/US1) que o botão
   da linha já evitava. **Corrigido** (`e99a334`): a gaveta só existe sem coluna; `?assinar=1` leva à coluna.
   Teste jsdom (`conta-desktop.test.tsx`): 2 rádios e nenhum `dialog`; sem a correção → 4 (vermelho visto).
2. **Ficha offline presa em erro no mestre-detalhe** (`history-offline.spec.ts:35`): registro gravado
   offline, sincronizado, reaberto por clique → a coluna mostra "Não foi possível carregar" enquanto a lista
   mostra o valor certo; nunca em mobile. Em diagnóstico no browser real (dev-frontend) — hipótese: o
   auto-abrir do mestre-detalhe monta `useSnapshot` (`retry: false`) ainda offline e o erro fica travado.
Flakies observadas (não tocadas): `catalog.spec.ts:192` mobile (o item 21 do CI); `billing.spec.ts`
SC-701/703 só quando corre na MESMA invocação que `billing-teasers` (o cabeçalho do arquivo já avisa —
banco compartilhado).

### T034 — a rodada final (2026-08-27)

E2E completo contra a stack real, com os dois `fix(018)` dentro: **350 passaram · 0 falharam · 30 skipped ·
3,6 min · exit 0** (antes: 318 / 24). Os 30 skipped são os de sempre (projeto mobile × specs desktop-only e
vice-versa). Inclui `focus-none` (T024) verde nos dois projetos e nas duas larguras, `porte-medidas` 8/8, e
os 13 specs re-escopados do 018. `price-hero.css`: diff vs `develop` = 0 linhas (T022).

**Adendo T024 — a prova de não-vácuo, feita duas vezes (a primeira estava ERRADA).** Prova 1: anel
temporário em `.tf-btn:focus-visible` (`button.css`), build fresco, `focus-none` chromium → **4 passaram**.
Primeira leitura minha: "a guarda é vácua, `locator.focus()` não aciona `:focus-visible`". Leitura ERRADA:
o alternador de tema é `button.tf-topbar__theme`, sem `tf-btn` — a prova mirava um seletor que o controle
testado não tem. Prova 2: regra GLOBAL `:focus-visible { outline: 2px solid red !important; box-shadow: …
!important }` em `base.css` → **4 falharam** ("botão: outline solid 2px", "campo (input): outline solid
2px"); revertida (0 mudanças no git). A guarda VÊ anel. De quebra o foco passou a chegar por TECLADO (Tab →
Shift+Tab de volta), a modalidade em que `:focus-visible` é garantido — mais fiel ao usuário real, e sem
custo. Lição: a prova de não-vácuo também pode ser vácua; ela tem de mirar o MESMO elemento que a guarda.

**T021 — re-medida da seção Shopee a 360px** (`evidencias/pr-a/medidas-shopee-360-{dark,light}.json`): o selo
"Frete aferido pode gerar cobrança retroativa" mede **75px** (286px de largura) com a geometria da folha;
a A5/016 o tinha levado de 248px a **60px**. Diferença **+15px**, acima dos ~8px que o research §A previu
— o padding 12px e o corpo em coluna (`gap: 2px`) custam mais que a estimativa. Seção Shopee inteira a
360px: 968px (a A5 media 1248 antes e 1152 depois). Consequência honesta: a PR-A devolve 15 dos 188px que
a A5 economizou; a linha continua UMA (título + ⓘ inline). Screenshots 1:1 em `evidencias/pr-a/`
(10 arquivos: TabBar 390, 404, selo compact, seção Shopee, Frozen × 2 temas); a tela de ERRO não tem rota.

### T022 · T034 · T035 — o gate e o PR (2026-08-27)

`pnpm gate:all` no pre-push (o MESMO comando do CI, D4): **verde** — frontend 161 arquivos / **1808** testes,
cobertura 88,82% (statements), depcruise/boundaries/typecheck ok; backend **474 passed**, 1 skipped;
`migration-guard` ok. Push confirmado por `ls-remote` (= HEAD `29dafec`). PR aberto contra `develop`
assertando as AUSÊNCIAS (zero classe duplicada · zero dispositivo de prancheta · zero `tf-lockup` · zero anel ·
zero "canal" visível · zero "canal" no PDF · `price-hero.css` intocado) e pedindo o flip do **ADR-0032**.
Estado da fatia: **CORREÇÃO DECLARADA** — nada homologado até a Rodada 1 fechar.

---

## PR-B — Premium sem parede (US3) · branch `019-pr-b-premium` (do develop `ebf3ec0`, pós-merge do PR #59)

### T042 — a transcrição (2026-08-28)

- **Pranchetas congeladas** (DesignSync `get_file`, nenhuma truncada): `Premium - O Caminho Sem Parede` e
  `Catalogo - Os Estados da Lista`, escuro verbatim + claro derivado pela transformação enumerável da T009
  (invariantes: 0 `rgba(255,255,255`, 7/6 blocos `light` = os blocos `dark`, `<h1>` com " — claro"). Hashes em
  `design/README.md`.
- **A 32h não existe no remoto** (listagem de 28/08: 33 pranchetas × 2 temas, nenhuma "entrada com intenção"/
  deslogado). O comportamento JÁ existe (`TeaserUpgrade` → `/sign-in?redirect=/conta?assinar=1`); a copy do
  prompt `docs/design/prompts/019-lote32h-deslogado.md` entra quando a prancheta existir — **follow-up
  declarado**, não omissão.
- **Copy transcrita byte a byte** (`messages.pt-br.ts`): as 6 frases da 32c (`catalogo.didatico{Filaments,
  Printers,Products,Kits}Body`, `historico.didaticoBody`, `scenarios.didaticoBody`); `catalogo.emptyFilamentsTitle`
  → "Nenhum filamento cadastrado" (32a: "o título perdeu o ainda" — vale para quem paga E para quem não paga);
  `historico.didaticoTitle` "Nenhum orçamento registrado" (32f); `premiumTeaser.salvarFazParteDoPremium` (32b/32f);
  `premiumTeaser.fazerUmCalculo` (32f); `billing.reactivateAction` "Reativar Premium" (32e).
  `catalogo.reactivateBody` conferido contra a 32e: **idêntico** — não duplicado.
- **O que a prancheta NÃO desenhou e por isso NÃO foi escrito**: os títulos do vazio de impressora/produto/kit e de
  simulação (a 32c só traz as frases). Ficam os títulos de hoje (`emptyPrintersTitle`… "salva ainda") — o
  argumento do "ainda" da 32a se aplicaria, mas copy é do dono: **ponto para a segunda passada**.

### T036 · T043 — `premiumGate` + o vazio didático (2026-08-28)

- `shared/billing/premium-gate.ts`: função PURA, zero imports (guarda de grafo no teste). Cinco estados; `stale`
  nunca promove (recebe o `data` que o hook já resolveu — fresco ou lembrado); status que o servidor não emite =
  `unknown`. **Decisão registrada**: sessão `loading` → `unknown` (não é "deslogado": ainda não se sabe; na prática
  `main.tsx` segura o app nesse estado). Vermelho provado: `Cannot find module './premium-gate'` → 8/8 verdes.
- `shared/billing/vazio-didatico.tsx`: compõe `EmptyState` (`tf-empty` existente), **sem CSS próprio** (T006
  continua a guarda), e carrega o ÚNICO `TeaserUpgrade` da tela; `teaser={false}` quando o formulário inerte está
  aberto (o rodapé dele passa a ser o único — T041 conta nos dois estados).
- `TeaserUpgrade` ganha `variant="secondary"`, `label`, `price={false}` — o botão secundário sem preço do rodapé
  (32b/32e) é o MESMO elemento do vazio (mesmo href, mesma intenção preservada), nunca um segundo link.
- **Divergência de autoridade, registrada para o dono**: a 32a diz do vazio didático "Nenhuma coroa, nenhum preço,
  nenhuma menção a plano — o convite vem depois"; a FR-1906 exige "invariante um-teaser mantido" e a T041/SC-006
  contam exatamente UM convite por tela no estado de lista. **A FR ganhou**: o vazio carrega o `TeaserUpgrade`
  (linha de preço + "Assinar Premium") abaixo do botão de adicionar. Se o dono preferir a leitura da prancheta,
  a mudança é `teaser={false}` por padrão + relaxar a contagem no estado de lista.

### T037 · T038 · T106 · T044 · T045 — o Catálogo sem parede (dev-frontend, 2026-08-28)

- **Onde a parede morava e o que entrou no lugar**: `catalogo-page.tsx:105-113` (o `if (signedOut || none) return
  <PremiumTeaser>`) SAIU inteira; `catalog-panel.tsx` decide o corpo por `gate` (`premiumGate`), e os ramos
  `ENTITLEMENT_REQUIRED` (o 403 do servidor para quem nunca teve) e "lista vazia sem consulta" (deslogado) leem
  IGUAL — o `VazioDidatico`, nunca a coroa. A prop `lapsed?: boolean` (013/FB-02) virou `gate: PremiumGate` nos 4
  painéis (`kits-panel` era o único sem `useEntitlement`; ganhou).
- **A barreira é a AUSÊNCIA do handler** (research §E-2), em duas camadas: `filaments-panel`/`printers-panel` só
  passam `create`/`update` quando `gate === "active"`; `renderForm.onSubmit` é opcional e o `<form>` fica SEM
  `onSubmit` fora de `active` (botão `type="button" disabled` — não existe caminho de submit); e
  `handleSubmit`/`handleInlineSubmit` retornam sem toast e sem fechar quando o writer falta — **o toast falso
  (T106, achado 01 da auditoria) morreu**: `await create?.(body)` resolvia `undefined` e caía no `toast` +
  `setSheet(null)` como se um 2xx tivesse acontecido.
- **O rodapé da prancheta 32b/32e** vive em `catalog-controls.tsx` (`PremiumFooterNote` + `PremiumInviteCta`,
  reusados por `FilamentForm`/`PrinterForm`/`ProdutoPage` — a regra lapsed/free/signed-out/unknown escrita uma vez):
  `<p>` ANTES da linha de botões (`salvarFazParteDoPremium`; no lapsed `reactivateBody`), linha
  `justify-between` com o `TeaserUpgrade` secundário sem preço à esquerda e "Salvar"/"Salvar alterações"
  SEMPRE renderizado e `disabled` à direita. O `<Alert title={reactivateTitle}>` saiu (32d). `produto-page.tsx`:
  os 3 fieldsets viram `<Frozen>` fora de `active` — fecha a brecha pré-existente do logado `none` em
  `/catalogo?produto=novo` com formulário VIVO (013/FB-02 só cobria `lapsed`).
- **Mestre-detalhe (32g)**: lista vazia + gate≠active + `renderForm` → vazio à esquerda **sem convite** e a ficha
  inerte de criação à direita com o único convite. **Defeito achado na revisão do main loop, antes do e2e**: o
  agente entregou `teaser={sheet === null}` no vazio dessa composição — dois "Assinar Premium" no desktop
  (o `teaser-sweep` a 1920 teria pego); corrigido para `teaser={false}`. Segundo ajuste da revisão: a ordem de
  decisão deixava um `lapsed` com cache vazio e a rede falhando cair no vazio didático — agora cai no erro de
  carga (a ordem da prancheta 29: erro antes de vazio).
- **Decisões do executor, para a segunda passada**: "Voltar" sai do rodapé inerte (o Sheet tem o X; a 32b só
  desenha dois itens) — na ficha inline do desktop também; `unknown` = Salvar disabled sozinho, sem frase e sem
  convite (nunca presume); `catalogo.lapsedTitle/lapsedBody` apagadas (T038) e as 6 asserções de ausência que as
  citavam passaram a mirar o texto literal antigo; `catalogo.reactivateTitle` ficou órfã (a T090 vigia).
- **Desvio de processo, registrado**: o cluster do Catálogo NÃO seguiu vermelho-por-task estrito — painel, 4
  painéis, 2 formulários e `ProdutoPage` mudam de contrato juntos e nada renderiza coerente pela metade; o
  agente implementou e testou em conjunto e disse isso em vez de inventar um log. O vermelho real que a suíte
  pegou depois: `cf.save` × `cf.saveChanges` no modo edit (1 caso).
- Verde: `src/features/catalog` + `src/pages/catalogo` **108/108**; suíte inteira do web **1374/1374**; tsc/eslint
  limpos.

### T039 · T111 · T112 · T046(Orçamentos/Simulações) — Histórico e a folha (dev-frontend, 2026-08-28)

- `historico-page.tsx:75/:80` (`TeaserShell`) e `scenarios-list-sheet.tsx:462/:475-476` (`showTeaser`) SAÍRAM;
  `free-nunca-teve`/`signed-out` veem o `VazioDidatico` (quotes/scenarios) com "Fazer um cálculo" → `/calcular`
  (na folha, fechar É ir para a calculadora). `lapsed`/`active` byte-idênticos.
- T111: `HistoryListState.error: ApiError | null` (aditivo); **corolário necessário**: `ScenarioListState`
  ganhou o mesmo campo (`entities/scenario/use-scenarios.ts`, fora da lista da task — sem ele a T112 não
  distingue 403 de rede). T112: `ScenarioListBody` tem o ramo `ENTITLEMENT_REQUIRED` → vazio didático quando o
  gate é `unknown` mas o servidor já disse 403.
- Efeito colateral adotado: `pages/calcular/calcular-scenarios.test.tsx` (2 casos assertavam o teaser dentro
  da folha). `SheetDescription` (`listSubtitle`) some no estado de porta (016/T010-A1: a descrição pertence à
  lista).
- Verde: historico + scenarios + entities + calcular + shared/billing **341/341**.

### T046 — Kits sem parede (dev-frontend, 2026-08-28)

- Vermelho capturado ANTES: 4 casos (`bom-teaser.test.tsx` ×3, `bom-page.test.tsx` T072-A10) — exatamente os
  que assertavam a parede. `BomGatePanel` e a parede de criação do lapsed SAÍRAM (decisão 3 do dono, 27/08:
  montar sem salvar é permitido); o composer compõe para todos; 0 linhas + gate≠active → `VazioDidatico kits`
  (com o convite); ≥1 linha → rodapé com `salvarFazParteDoPremium` + convite secundário + "Salvar kit"
  `disabled={gate !== "active" || saving}`. Os dois ramos são mutuamente exclusivos — nunca dois convites.
  `bom.lapsedBanner` mantido. Teste novo: compor (adicionar/remover/editar) NUNCA chama mutação, nos 4 estados.
- Verde: `src/pages/bom` **50/50**.

### T115 · T114 — a guarda por método e o helper (dev-backend, 2026-08-28)

- **Achado que vale mais que a task**: `test_every_catalog_route_carries_the_gate` era **VÁCUO** — no
  `fastapi==0.138.1` o `app.routes` não achata os `include_router` (ficam em `_IncludedRouter`, com o prefixo
  em `include_context.prefix`), então a varredura por `route.path.startswith(prefixo)` encontrava **zero rotas**
  e o loop passava sem exercitar nada (o comentário dizia "vacuous today, arms itself when PR-B lands" — estava
  vácuo por outro motivo). O novo `_flatten_routes(app)` recursa e reconstrói o path: **43 rotas gated**
  (filaments · printers · products · boms · history+export · scenarios), todo `POST/PUT/PATCH/DELETE` com
  `require_entitlement`, todo `GET` com uma das duas portas; sanidade `write_routes > 0` e `read_routes > 0`.
  **Não-vácuo por mutação**: `POST /filaments` → `require_catalog_read` ⇒ vermelho na linha 260; revertido,
  `git diff --stat backend/app` vazio. Rodado com o banco: **10/10**.
- T114: `grantPremium(email, { expiresAt? })` repassa `--expires <ISO>`; a chamada antiga continua (15 specs).
  A T040 usa o SQL de `vencerGrants` (o mesmo de `billing-lifecycle`) em vez do `expiresAt`, porque um grant
  que já nasce vencido não deixa criar os itens que o cenário "lapsed-com-itens" precisa — a REGRA do lapso,
  não a passagem do tempo.

### T040 · T041 · T108 · T109 — a stack real (2026-08-28)

- `tests/e2e/premium-sem-parede.spec.ts` (3 cenários × chromium+mobile): grátis (vazio → inerte → dica do
  consumo com `opacity` 1 no texto E no fieldset → kits compõe com Salvar disabled → Orçamentos "Fazer um
  cálculo" → `/calcular` → folha de Simulações), grant vencido com itens (lista + preenchido + "Reative" +
  "Reativar Premium" + "Salvar alterações" disabled), deslogado (o mesmo caminho + `?tab=products` → o
  `beforeLoad` manda ao sign-in com `produto=novo` na intenção + "Assinar Premium" → sign-in → oferta aberta).
  Em cada cenário: **0 escritas** (`page.route` contando POST/PUT/PATCH/DELETE) e **0 entradas** no
  IndexedDB `history:outbox:*`. **18/18** na rodada final.
- As rodadas anteriores acharam 4 causas, todas de teste: 2 âncoras antigas do teaser que os greps não pegaram
  (`bom.spec.ts:173` via alias local `pt`; `catalog.spec.ts:61`), `getByText("Reative o Premium")` casando por
  substring com o `reactivateBody`, e a URL pós-login `/conta?assinar=%221%22` — o router serializa a intenção
  como JSON e a Conta lê `assinar === "1"` (a oferta abre; o que se asserta é a oferta, não a grafia).
- T041/T109: âncora "a tela renderizou" = título do vazio didático; `teaser-sweep` conta o convite nos DOIS
  estados (lista e formulário aberto) nas duas larguras; `cf-011-048` só chama "teaser sem verificar" quando o
  CONVITE aparece com o plano em 500. 3 âncoras que nenhuma task citava (`kits-save`, `pages-desktop-width`,
  `bom.spec`) adotadas.

### Screenshots 1:1 (T047) — `evidencias/pr-b/` (2026-08-28)

32 PNGs (`porte-screenshots-pr-b.spec.ts`, `PORTE_SCREENSHOTS=1`): grátis × {vazio, form inerte, dica da
impressora, kits vazio, kits composer, orçamentos, simulações} · vencido × {lista, form preenchido} · deslogado
× {vazio, form} a 390px, nos 2 temas; e a 1920px deslogado × {catálogo, kits, orçamentos} + grátis × {filamentos,
impressoras}. Conferidas pelo main loop contra as pranchetas: 32a/32b/32e/32g batem. **Observações para a
segunda passada**: (1) o custo no edit inerte mostra "94,9" (o zero à direita some — formatação pré-existente do
formulário de edição, não desta fatia); (2) a ficha inerte do desktop (32g) não tem o título "Novo filamento" +
"Voltar" que a prancheta desenha no cartão; (3) o vazio didático carrega a linha de preço + "Assinar Premium"
(decisão FR-1906 × 32a, registrada em §T043). Medição (`medidas-pr-b.json`): convites por tela, fieldsets
congelados, vazios e transbordo horizontal em cada captura — ver a tabela abaixo.

| medida (`medidas-pr-b.json`, 30 capturas, chromium) | valor |
| --- | --- |
| convites (`teaser-upgrade-cta`) por captura | **1** em 27; **0** em `lapsed-catalogo-lista` (o convite mora no formulário — a lista não o tem, 32e) e em `free-catalogo-1920-light` (a captura correu antes do entitlement resolver: gate `unknown` = sem convite, por desenho; a mesma tela no tema escuro mediu 1); **2** em `free-simulacoes-vazio` (medição da PÁGINA inteira: `/calcular` tem a própria superfície premium por desenho — o `teaser-sweep` conta dentro da folha, e lá é 1) |
| `fieldset.tf-frozen` presentes | 1 em toda captura de formulário (mobile e 1920), 0 nas listas/vazios |
| transbordo horizontal (`scrollWidth − clientWidth`) | **0** em todas as 30 |

### T107 — a guarda de AUSÊNCIA (qa-software, 2026-08-28)

`src/pages/premium-write-absence.test.tsx` (solto em `pages/` de propósito: é a única posição que pode importar
`catalogo-page`, `bom-page` e `historico-page` juntas sob o eslint-boundaries) — **38 testes**: 4 painéis do
Catálogo + `CatalogoPage` em 3 modos (abas, `?produto=novo`, `?produto=<id>`) + `BomPage` + `HistoricoPage`, cada
um nos 4 estados não-`active`; em cada caso clica em TODO botão habilitado (até 5 passadas — abre Sheet/Dialog e
clica no que aparece) e submete todo `<form>`; **zero chamadas** em 18 hooks de escrita espiados. A lista dos
18 é PROVADA completa por leitura (`readFileSync` de `entities/{catalog,bom,history}/use-*.ts` + regex
`^export function use(Create|Update|Delete|Record)\w+`): um hook de escrita novo que nasça fora da guarda a
deixa vermelha. Não-vácuo: `FilamentsPanel` em `active` salva de verdade — `useCreateFilament().mutateAsync`
chamado exatamente 1×, os outros 17 intocados. Suíte inteira do web: **1412/1412**.

**Dois achados do agente, fechados no main loop pelo princípio da fatia (handler AUSENTE, não `if`)**:
(1) `remove` era passado INCONDICIONALMENTE pelos 4 painéis e a lixeira só desviava para a edição com
`gate === "lapsed"` — nos outros gates uma lista com itens (hoje inalcançável, escondida pelo vazio) chamaria
`remove.mutateAsync` de verdade; agora `remove?` é opcional, só chega em `active`, e "sem `remove` ⇒ a lixeira
abre a edição" (o intercepto do 013/FB-02, sem depender do nome do estado). (2) o "Salvar kit" tinha
`onClick={save}` sempre presente e só `disabled` — passou a `onClick={gate === "active" ? … : undefined}`.
Re-rodado: catalog + catalogo + bom + a guarda **196/196**, tsc/eslint limpos.

### T047 · T048 — a rodada completa, o gate e o PR (2026-08-28)

- **E2E completo** contra a stack real (emulador 9500 · Postgres 5433 · backend 8100 · stub 8200): **351 passed ·
  4 failed · 1 flaky · 46 skipped · 3,1 min**. Os 4 = 2 casos × 2 projetos de `scenarios.spec.ts` (:250/:278)
  assertando o teaser antigo DENTRO da folha via alias local `pt` — a quinta âncora que nenhuma task citava,
  adotada (vazio didático + `scenarios.didaticoBody`); re-rodada `scenarios` + `overflow-geometria`: **16/16**.
  O flaky (`overflow-geometria` mobile, 1ª tentativa "Target page, context or browser has been closed" no
  `setViewportSize`) é infra do browser, não geometria — verde no retry e na re-rodada; registrado porque o
  projeto já pagou por vermelho intermitente (US5/US8), e este NÃO é da classe de produto.
- **SC-1903 provado nos 4 caminhos**: `git diff origin/develop -- backend/app/entitlement backend/app/api
  backend/app/models backend/app/services` = **vazio** + `test_entitlement_gate.py` 10/10 (a guarda por método).
- **Commits da fatia** (branch `019-pr-b-premium`, do develop `ebf3ec0`): `18eb6ac` transcrição + núcleo ·
  `e2f3f93` produto + testes novos · `fc0e975` asserções adotadas (separado, research §J) · `2d55795` T107 +
  simetria remove/Salvar + screenshots · o fechamento (scenarios.spec + ledger + esta seção).
- **Push e abertura do PR-B**: autorizados pelo dono em 28/08 — push confirmado por `ls-remote` = HEAD `c5a4ec1`
  (gate do pre-push verde) e **PR #60** aberto contra `develop` (https://github.com/FreeSoulsDotBat/3dprecify/pull/60). O corpo do PR está pronto (assertando as AUSÊNCIAS: diff vazio no servidor,
  0 escritas, 0 outbox, 0 toast falso, 1 convite por estado, 0 classe `tf-*` nova) e as 6 decisões a ratificar
  na segunda passada estão listadas nele. Estado da fatia: **CORREÇÃO DECLARADA**.
- **`pnpm gate:all` (o mesmo comando do pre-push/CI): VERDE** — frontend 163 arquivos / **1876** testes, cobertura
  89,46% (statements), format/lint/boundaries/depcruise/typecheck ok; backend ruff + format + basedpyright limpos,
  **474 passed**, 1 skipped, import-linter ok (3m45s de pytest).
- Token ledger: fechado com os reais (1,04M nos executores vs ~650k estimados; o cluster do Catálogo 2,3× o
  previsto).

---

## PR-C — Comportamentos da calculadora (US4) · branch `019-pr-c-calculadora` (do develop `daec0f2`, pós-merge do PR #60)

### T055 — a transcrição (2026-08-28)

- **4 pranchetas congeladas** (DesignSync, nenhuma truncada; claras derivadas pela transformação da T009 —
  7/7/7/6 blocos `light` = os `dark`). Hashes em `design/README.md`.
- **Copy transcrita** (`messages.pt-br.ts`): `plausibilidade.entendi` "Entendi" · `fechoComRecusa` "Corrija o campo
  acima para calcular." (14b: quando o aviso convive com uma recusa, o fecho "Nada foi recusado." mentiria) ·
  `machineCost.estimar/ajustar` (SUBSTITUEM `adjustButton`/`backToEstimateButton`, apagados) ·
  `readoutLabel` "Custo da máquina por hora de impressão" · `readoutDivisao` "de {valor} ÷ {horas} h" ·
  `ressalvaSemValor` "falta o valor da máquina" · a confirmação da 15e em 4 chaves (`confirmTitle`, `confirmBody`,
  `confirmUse`, `confirmKeep`; `{anos}` recebe o rótulo já flexionado — a lição do T031) · `seals.commissionLabel`
  "Comissão" · `verFonte` · `dispensar` · `fonteTitle` "Fonte da comissão" · `fonteConferida` · `fonteAviso`.
  `derivedCaption` apagada (T057: obsoleta).
- **Confronto com `LIMIARES`** (decisão 5 do dono): a prancheta 14 usa 120 kW, R$ 12/kWh, 3 h, 1.000 kg, 150 h,
  3.000.000.000 — TODOS acima/abaixo dos limiares do produto (5 kW · R$ 5 · 100 h · 50 kg · 100 h · 2^31−1);
  nenhum exemplo de gramas aparece na prancheta (o "850 g" do brief não está nela) — o limiar de 50.000 g fica.
- **Leituras que divergem das tasks, registradas**: (1) a **15e** desenha a confirmação de troca de modo como
  `tf-alert--warning` INLINE no bloco ("nasce onde o segmented está… e não cobre a tela"), com os dois números
  em disputa cada um no seu botão — a T057 dizia "diálogo center" (palpite da auditoria, antes da transcrição).
  **A prancheta ganha**: inline, sem cobrir a tela. (2) a **14b** mostra o caso erro+aviso com o valor 0 e uma
  LIÇÃO sem cabeça ("Se você pensou em anos…") — o módulo puro não gera aviso para 0 (`> 0` no guard), e uma
  copy "só-lição" por campo não existe; a T049 é implementada como está escrita (o aviso do valor comprometido
  PERSISTE quando a validação recusa, com o fecho trocado e sem "Entendi"); o caso "0 → lição" fica registrado
  como follow-up de copy para o dono. (3) a **14c** desenha uma "marca da seção" (`{n} avisos`, sem contar os
  dispensados) que nenhuma task da Phase 6 pede — follow-up. (4) a prancheta **10** ("A Conta e os Precos")
  redesenha o rodapé inteiro (segmented Varejo|Atacado, barra de proporção, markup no cabeçalho, "Preços por
  marketplace" como seção) — NADA disso está na US4/Phase 6; fica como lacuna para o dono decidir onde entra.

### T059 · T054 — T212: a leitura PARA e vai ao dono (2026-08-28)

A T059 manda registrar QUAL elemento gruda antes de codar, e parar se a leitura implicar mover o bloco no DOM
mobile. **Leitura**: a prancheta 10 **não nomeia elemento fixo algum** — o rodapé é conta → barra → segmented →
marketplaces → cartão de preço, tudo em fluxo. O research §I manda `position: sticky` **no topo** da coluna do
formulário. Mas o bloco de preço é o **ÚLTIMO** elemento do DOM (`.tf-calc-footer`, `calcular-page.tsx:572`):
um `sticky; top` nele **nunca gruda** (ele nunca é rolado para fora por cima — não há nada depois dele), e um
`sticky; bottom` o põe **exatamente no slot do toaster** (`toast.css:6`, `bottom: calc(var(--tabbar-h) + …)`) que
o §I proíbe. Logo, cumprir o T212 exige **mover o resumo para o topo do DOM mobile ou criar um segundo elemento**
— a mudança estrutural que a T059 manda PARAR. **⛔ DONO**, com três opções: (a) uma barra-resumo compacta NOVA
no topo do formulário mobile (`sticky; top`, "Preço varejo · R$ 24,24", `data-testid="price-summary-sticky"`) —
recomendada: não move nada, não briga com o toaster, é a "exceção mobile autorizada" no espírito; (b) mover o
cartão de preço para o topo (muda a ordem de leitura que a prancheta 10 desenha); (c) `sticky; bottom` acima da
TabBar aceitando a colisão com o toaster (o §I rejeita). T054 (o e2e) espera a mesma decisão.

### T049 · T050 · T056 · T118 · T051 · T057 — plausibilidade + bloco da máquina (dev-frontend, 2026-08-28)

- **Vermelho capturado**: T049 — `Cannot read properties of undefined (reading 'replace')` (a chave `adjustButton`
  apagada na T055) + os casos novos (aviso não nascia no blur, fecho não trocava); T050 — módulo inexistente;
  T051 — readout/segmented/confirmação inexistentes. `computeCalculator.test.ts` 28/28, `PRICING_MODEL_VERSION`
  **"4.1.0"** intocado (rodado, não editado).
- **O aviso** (prancheta 14): `useAvisoDeCampo(nome, bruto, temErro)` em `shared/lib/use-aviso-de-campo.ts` (React +
  store; `shared` pode ter hooks; `features/calculator` E `widgets/bom-line-editor` importam de lá) — `useRef` com
  o valor ao vivo, `useState` com o valor COMPROMETIDO no blur, dispensa pela chave `campo:valorNormalizado` no
  `plausibility-dismiss-store.ts` (zustand puro, SEM `persist` — "nesta sessão"). `ControlledField`/`TimeHmField`
  extraídos em `ControlledFieldBody`/`TimeHmFieldBody` (hook dentro do `render` do `Controller` viola
  `rules-of-hooks`). O `<Aviso>` é IRMÃO do `Field` dentro de `.calc-field-cell` (14f: cresce na célula, não empurra
  o vizinho); "Entendi" via `action`; com ERRO junto o fecho troca (`fechoNormal` → `fechoComRecusa`, `String.replace`
  no texto pronto — toda frase termina literalmente em "Nada foi recusado.") e o "Entendi" não aparece (14b).
  `AvisoDeResultado` → `<Aviso lines=[…]>` (14d: dois fatos, dois `<p>`). `fmtMoney` (2 casas sempre) para
  tariff/laborRate/maintenance/custoAbsurdo — "R$ 6.000.061,60", nunca "R$ 6.000.061,6". Achado real do teste: o
  store é singleton de sessão e VAZAVA dispensa entre casos do mesmo arquivo — `afterEach` limpa.
- **O bloco da máquina** (prancheta 15): `<Segmented split role="radiogroup">` Estimar/Ajustar (nome do grupo =
  `fields.machineLifetime`, corrigido na revisão: o agente tinha posto a pergunta do ritmo); `<MachineCostReadout>`
  nos DOIS modos — rótulo + `formatBRL(perHour)` grande + "de R$ X ÷ N h"; some quando `currentHours <= 0` (15c: não
  há divisão por zero) e ganha a ressalva `--warning-text` + valor em `--text-muted` quando `machineValueNum === 0`
  (15d); a confirmação é INLINE (`<Alert tone="warning" role="alertdialog">`, 15e — não o diálogo center que a
  T057 dizia): só ao tocar "Estimar" vindo de "Ajustar" com `detectRitmoMode(horas) === null`; "Usar {novo} h"
  aplica; "Manter {atual} h" fecha e o segmented continua em "Ajustar"; NADA sobrescrito antes do "Usar".
- **Divergências registradas**: 15f (segmented `size="sm"` na linha do título ≥1024px) NÃO implementada — a
  Calculadora corta em 1024 e `useIsWide` mede 1280; fica `split size="md"` em toda largura (ponto para o dono).
  `.tf-field__aviso` (T118) NÃO apagada: `features/bom/bom-line-card.tsx` ainda a consome (o aviso de quantidade
  da linha de kit como parágrafo solto — a 14e manda virar `tf-aviso`; fora do cluster, follow-up). O comentário
  de `field.css:166` corrigido (o módulo sempre morou em `shared/lib`).
- `Aviso` e `Segmented` ganharam `...rest` (para `data-testid`); testids: `aviso-<campo>` (sobrevive),
  `machine-readout`, `machine-mode`, `machine-confirm`.

### T052 · T058 — o selo de procedência (dev-frontend, 2026-08-28)

- **Vermelho**: `fee-seal.test.tsx` reescrito contra o `Badge` antigo — 12 falhas / 14 passes (as 14 = lógica pura de
  `feeSealState`). Depois: **102/102** no trio (`fee-seal`, `fee-seal-dismiss-store`, `fee-prefill`);
  `tf-class-uniqueness` verde.
- **Badge → `Alert compact`** (prancheta 13): o bloco que respalda um NÚMERO (comissão: tom info/neutral; taxa
  fixa: neutral) com rótulo `commissionLabel`/`fixedFeeSource` + citação em 2 linhas (`.fee-seal__cite`, clamp) +
  "para {categoria}" + data + "Ver fonte" (só com `sourceUrl` — a semente não tem, 13b·3) + "Dispensar" (`onDismiss`
  do `Alert`, chave `${marketplace}::${source}::${effectiveDate ?? reviewedOn}` em `localStorage`, 50 recentes,
  degrada para memória em aba privada). "Ver fonte" abre `Dialog` center com `fonteTitle`, a citação inteira,
  `fonteConferida`, o link (`target=_blank rel=noopener`) e `fonteAviso` com o nome do marketplace. O catch-all vira
  LINHA do corpo em `--warning-text` (13b·5 — em pílula estourava a 360px); "pode estar desatualizada" continua
  pílula, DENTRO do corpo (13c). `adjusted`/`estimate`/`none` continuam `Badge` (accent/info/warning) — a T052
  dizia `Alert compact`; **a prancheta 13b ganhou** (são qualificadores, não procedência). `fee-seal.css` perdeu o
  remendo `.tf-badge.fee-seal`. `fee-prefill.ts` passa `sourceUrl` (aditivo) fora da semente; a janela de
  desatualização é 45 dias (o comentário dizia 30 — corrigido). `tf-badge--accent`/`--sm` portados de
  `tf-components.css:511-518` (a prancheta pede accent, que não existia). Ordem fixa no sítio (13d): comissão →
  taxa fixa → pílulas, `flex-col`.
- **O que faltou, registrado**: ícone `wifi` (13b·3, embutida) não existe no `ICONS` e o `Alert` fixa o ícone por
  tom — renderiza `info`; o chevron decorativo do "Ver fonte" omitido; o diálogo da taxa fixa reusa o título
  "Fonte da comissão" (só uma string transcrita; não inventar "Fonte da taxa fixa") e usa "vigente desde" como data
  (a entrada não tem `lastReviewed` próprio para a taxa fixa).

### T053 · T060 — precision e a hidratação (dev-frontend, 2026-08-28)

- `NumberField.precision` (default 2; o `formatDecimal(n, 2)` hardcoded do blur era a perda — o comentário "nunca
  muda o valor semântico" era falso para 4 casas) · `CalcFieldMeta.precision` + `tariffPerKwh: 4` · `ControlledNumber`
  repassa · `ControlledField` repassa. `number-field.test.tsx` +5 casos; **não-vácuo por mutação**: `precision` →
  `2` de volta ⇒ 3/13 vermelhos exatamente nos casos de precisão; revertido. `calculator-model.test.ts`: energia =
  100 h × 1 kW × 0,8734 = **87,34** com `toBe` (igualdade numérica, SC-1905).
- **Achado real (o "R5" do 016 tinha um bug próprio)**: `scenario-bridge.ts` `moneyLeafToPtBr` chamava
  `formatDecimal(n, 2)` para TODO leaf de dinheiro — uma tarifa salva "0.8734" **reabria como "0,87"**, corte de
  VALOR (a recomputação seguinte usava 0,87), não só de exibição. Corrigido: `moneyLeafToPtBr(leaf, precision)` +
  `FIELD_PRECISION` (`calculator-schema.ts`, derivado de `COST_FIELDS`; hoje `{ tariffPerKwh: 4 }`) nos dois call
  sites de escalares. Vermelho capturado ANTES ("0,87" × "0,8734"; "0,00" × "0,0000"); depois **29/29** no bridge.

### T061 — gate, e2e, screenshots e o PR (2026-08-28)

- **E2E completo** (stack real): **354 passed · 2 failed · 58 skipped · 2,9 min** — as 2 (×2 projetos) eram
  `marketplace-premium.spec.ts:135` `getByText("Frete")` casando por SUBSTRING com a citação do selo da Amazon
  ("…inclui frete"), que agora vive num `<p>` próprio; adotada com `exact: true`; re-rodada verde. Outras 2
  âncoras adotadas antes: `calculator.spec.ts` (`adjustButton` → rádio "Ajustar"; "Referência" → "Comissão").
- **Screenshots 1:1** (`porte-screenshots-pr-c.spec.ts`, 390px × 2 temas, 16 PNGs): aviso no blur (tela + bloco),
  readout nos 2 modos, confirmação inline, selo compacto, "Ver fonte" aberto, selo dispensado após reload.
  Conferidas contra 14b/15a/15e/13a. **Dois defeitos que só a imagem mostrou**: "1200 h/ano" sem agrupamento
  (a 15e escreve "1.200") — corrigido com `fmtHoras`; e a URL do "Ver fonte" INQUEBRÁVEL transbordando o diálogo
  a 390px — corrigido (`overflow-wrap: anywhere` + exibição sem esquema, como a 13a·2), re-capturado 2/2.
- **`pnpm gate:all`: VERDE** — frontend 166 arquivos / **1916** testes, cobertura 89,53%; backend **474 passed**,
  ruff/format/basedpyright/import-linter ok. `PRICING_MODEL_VERSION` 4.1.0 (28/28 no pacote).
- **Push e abertura do PR-C**: autorizados pelo dono em 28/08 — push confirmado por `ls-remote` = HEAD `4831395`
  (gate do pre-push verde: 1923 unit · 474 backend) e **PR #61** aberto contra `develop`
  (https://github.com/FreeSoulsDotBat/3dprecify/pull/61). Estado: **CORREÇÃO DECLARADA**.

### As decisões do dono (2026-08-28) aplicadas na PR-C

O dono respondeu às 8 pendências listadas depois da primeira rodada (spec §Clarifications, sessão 28/08):

1. **T212** → prompt de correção para o Claude Design (`docs/design/prompts/019-pr-c-correcoes.md` §1, também em
   `uploads/` do projeto `a90ed7d4`): o preço provisório acompanha o preenchimento e se MESCLA com o cartão final
   ao chegar ao fim. T059/T054 **esperam a prancheta**.
2. **Confirmação de modo → diálogo** (prompt §2). O inline da 15e fica até a prancheta nova (T144).
3. **Pílulas ficam** (13b) — nada muda.
4. **Hook criado**: `useIsCalcWide()` (`CALC_WIDE_QUERY` 1024px como limiar NOMEADO em `use-is-wide.ts`, o caminho
   que o ADR-0031 §Follow-ups prescreve — nunca um segundo `matchMedia` solto); a 15f implementada: ≥1024 o
   segmented "Estimar · Ajustar" fica `size="sm"` na linha do título "A máquina" (um único `Segmented` por vez —
   dois radiogroups montados seria o erro que o ADR evita). Teste com `installMatchMedia(1024)`, vermelho antes.
   **Achado**: a 15a desenha o título "A máquina" + um ⓘ "Sobre o custo da máquina" em TODAS as larguras; o
   produto não tinha título no bloco. "A máquina" transcrito (`machineCost.blockTitle`) e mostrado no ramo
   desktop; o ⓘ espera a copy do dono (o corpo não está na prancheta).
5. **As 8 copies só-lição aprovadas** (`plausibilidade.licao.<campo>`, a da tarifa lendo
   `TOOLTIP_REF_TARIFA_MEDIA_NACIONAL`): campo RECUSADO com lição escrita mostra SÓ a lição (sem "Confira…", sem
   "Entendi"), ignorando dispensa — `licaoDeCampo` puro + a regra no hook; não-vácuo por mutação (`licao = null`
   ⇒ `machine-readout` vermelho no caso "vida útil = 0").
6. **14c (marca da seção) e 14e (linha de kit)** → prompt §3/§4 para o design detalhar os estados; T145/T146
   esperam a prancheta.
7. **Prancheta 10 → PR-F**: T141–T143 na Phase 9.
8. **Como no design**: ícone `wifi` verbatim do projeto (lucide, 4 paths) no `ICONS` + cópia estática;
   `Alert.icon` (prop aditiva) para o selo embutido; chevron rotacionado no "Ver fonte" (botão e link).

---

## PR-D — Recálculo do Catálogo (US5) · branch `019-pr-d-recalculo` (do develop `4ec2c0b`, pós-merge do PR #61) · **escalação OPUS** (ADR-0022)

### T074 — a transcrição (2026-08-29)

- **2 pranchetas congeladas** (`Catalogo - Lista e o Recalculo`, `Catalogo - O Item Aberto`; DesignSync, nenhuma
  truncada; claras pela transformação da T009 — 11/11 e 7/7 blocos). Hashes em `design/README.md`.
- **Copy transcrita** (`messages.catalogo`, `catalogForm`, `premiumTeaser`): `priceChangedCount` "{n} preços mudaram
  desde a sua última visita" (+ `priceChangedOne` pelo molde — só o plural foi desenhado), `priceWasLabel` "era
  {valor}", `savedAtLabel` "Salvo em {data}", os cabeçalhos do item aberto (17a/17g: `suggestedRetail`,
  `capRecalculated`, `capUnchanged`, `capFixed`, `stoppedPrice`, `capStopped`), `fixedByYou` "Preço fixado por
  você", `unfix` "Voltar a acompanhar o custo", `fixedOverNote` (17c), `keepPrice` "Manter {valor}",
  `acceptNewPrice`, `duplicateCopySuffix` " (cópia)" + o diálogo da 17d (herda / não herda), `nameConflict` "Este
  nome já está no catálogo" + `nameRequired` + `nameConflictHint` + `nameCounter` (17b), o item parado (16f/17g),
  a aba Kits (17e), as colunas da `tf-table` (16g), `deleteProductBody` (16e), `calculoContinuaGratis` (brief
  US13 AC5 — sem consumidor nesta fatia, ver abaixo).
- **Leituras registradas** (divergências prancheta × decisões): (1) os lotes 16/17 são ANTERIORES ao lote 32 — a
  16c ("Nada salvo ainda") e a 16d (gate do free) foram superadas pelo caminho sem parede da PR-B; NÃO transcritas;
  (2) as abas "Peças · Kits" da 16a são as 4 abas do produto (32a confirma); (3) o contador "36 de 60" da 17b ×
  teto 120 do adendo do ADR-0033 (decisão do dono 27/08) — 120 vence, `NAME_MAX = 120`; (4) a segunda frase do
  aviso da 16b ("O filamento PLA Cinza subiu de R$ 89,90 para R$ 96,00/kg em 03/06") exige histórico de custo de
  insumo que a observação de preço NÃO guarda — não transcrita, **lacuna para o dono**; (5) a 17c desenha a nota
  do item fixado como `tf-aviso` (info) e a spec US5 AC3/T068 pedem tom ATENÇÃO — a spec ganha, copy verbatim;
  (6) a 17b limita a edição do item aberto ao NOME ("quem muda números é a Calculadora") — o produto tem o
  formulário completo do produto (`produto-page.tsx`), que a PR-D mantém (fora do escopo da US5).
- **Fixture `name-norm.json`: 18 → 22 casos** (NBSP interno, BOM nas pontas, NEL PRESERVADO, `İ`), com a classe de
  espaço explícita documentada no `$comment`.

### T130 · T063(ts) · FE-1a — as folhas compartilhadas (dev-frontend, 2026-08-29)

- `shared/lib/name-norm.ts`: `nameNorm`/`nameNormKey`/`NAME_MAX = 120`, vetor `contracts/fixtures/name-norm.json` **22/22** nos dois
  idiomas (a classe de espaço é escrita com os MESMOS escapes de codepoint; NEL preservado nos dois). `use-is-wide.ts`: `LIST_DENSE_QUERY`
  (1024) + `useIsListDense()` ao lado de `WIDE_QUERY` — **ADR-0031 §Emenda 2** escrita (três limiares nomeados, nenhum fora do arquivo).
  `format-date.ts` promovido a `shared/lib` (as 2 cópias absorvidas; fuso do aparelho declarado no comentário). Commit `630f1b1`.

### T071 · T062 · T063(py) · T129 · T077 · N1 — a migração 0008 (dev-estrutura-de-dados **opus**, 2026-08-29)

- **Migração `0008`** em 6 passos LITERAIS da auditoria §SQL: `price_observations` (UNIQUE por conta+item, 4 CHECKs, FK só para
  `accounts`), `products.seller_fixed_price` Numeric(12,2) + `seller_fixed_at` + CHECK, `name_norm` nas 4 tabelas com **backfill em
  Python** (a função de normalização **congelada** dentro da migração — não importa `app/lib`, para que uma mudança futura da regra não
  reescreva o passado), desempate `(2)` só entre linhas VIVAS, `left(…, 200)` com reserva para o sufixo (`base[:200 - len(" (n)")]`),
  `NOT NULL` + índice único PARCIAL por dono; downgrade simétrico.
- **`PriceObservation`** + `seller_fixed_price/at` no modelo; `name_norm` com `default=_name_norm_default` **no INSERT apenas** (o UPDATE
  passa pelo funil da API — decisão registrada para o dono, abaixo). Docstring do invariante reescrito (ADR-0033 §1).
- `app/lib/name_norm.py` como FOLHA — contrato novo no import-linter (`app.lib` não importa nada de `app`). `test_name_norm.py`: 22/22
  do MESMO vetor (falha explícita se o fixture não existir).
- `test_migration_0008.py` (8 testes) afirma o estado pós-upgrade **e é não-vácuo por mutação**: sem o índice parcial, sem o CHECK
  de `seller_fixed_price`, e com o backfill desligado o teste morre.
- **T129**: `_dedup_match` (`boms.py`) casa por `name_norm` — emenda datada ao ADR-0017 §3 (reversível para "exato + (2)").
- **T077**: a Clarification da 007 (`spec.md:410`) é TEXTUALMENTE o ADR-0033 §5 (diff vazio). Commit `55721ce`. Ledger: ~154,7k.

### T072 · T073 · T064 · T065 · T066 · T070 — as rotas e o funil do nome (dev-backend **opus**, 2026-08-29)

- **`GET/PUT /api/v1/price-observations`** (`price_observations.py`): upsert em lote ≤500 por `(subjectKind, subjectId)` na linha
  única da conta; `(kind,id)` repetido no lote ⇒ 422; `observedPrice` com escala > 2 ⇒ 422 (validador `exponent >= -2`);
  `observedAt` carimbado pelo SERVIDOR; `GET` → `require_catalog_read` (`lapsed` 200, `none` 403), `PUT` → `require_entitlement`.
  `test_price_observations.py`: 8 funções/20 casos.
- **`PATCH /api/v1/products/{id}`** `{ sellerFixedPrice }` (`ProductPatchIn`, `extra="forbid"`): grava e devolve; `null` desfixa e ZERA
  `sellerFixedAt` (do servidor); outra chave ⇒ 422; `lapsed` ⇒ 403; produto de outro dono ⇒ 404. **A não-composição é provada**:
  `ProductOut` congelado — a rota não devolve nenhum preço calculado, e o teste afirma a AUSÊNCIA da chave. `test_products_fixed_price.py`:
  9 funções/18 casos.
- **Nome único nos 7 sítios** via `api/naming.py::commit_with_unique_name` — o chamador entrega a linha limpa; TODA escrita corre no
  callback `apply` sob `begin_nested()` (SAVEPOINT); colisão ⇒ sufixo `(n)` em silêncio (Q5), até 50 tentativas ⇒ 422. **Mutação**: sem o
  SAVEPOINT o kit morre (a transação inteira aborta na 1ª colisão). **Corrida** provada com duas sessões concorrentes observadas por
  `pg_stat_activity` — a segunda espera o lock do índice e sai como `(2)`. `test_catalog_name_conflict.py`: 9 funções/24 casos.
  Achado lateral: `pieceName` de kit sem teto virava **500** — agora `max_length=120` ⇒ 422.
- **T070 contrato**: os TRÊS comandos do CI, da raiz, duas vezes — diff vazio na 2ª (idempotente). `PriceObservationIn/Out`,
  `PriceObservationsOut`, `ProductPatchIn`, `fix_product_price_api_v1_products__product_id__patch` no cliente gerado.
- **Conformidade**: `extra="forbid"` no ITEM do array (`PriceObservationIn`) fazia o Schemathesis não terminar (>4 min no
  `additionalProperties:false` aninhado); trocado por `@model_validator(mode="before")` que rejeita chaves desconhecidas com o mesmo 422 —
  o CONTRATO perde a linha `additionalProperties:false` no item (o comportamento é o mesmo). ⛔ ratificação do dono no PR.
- Backend: **577 passed**, ruff/basedpyright/import-linter ok. Commit `8a78b5f`. Ledger: ~272,5k.

### T067 · T075 · T127 — a camada de dados das observações (dev-frontend, 2026-08-29)

- `entities/catalog/price-observations.ts` — `usePriceObservations()` (query `["price-observations", uid]`, só autenticado,
  `staleTime` curto, **sem cache de dispositivo**: `providers.test.tsx` varre o IDB antes/depois da troca de conta e afirma que
  NENHUMA chave `price-observations` existe — prova, não comentário); 403 `ENTITLEMENT_REQUIRED` ⇒ `entitlementDenied` e
  NENHUM erro visível; `derivePriceChanges` PURA em centavos (item sem observação não conta — nunca "0 mudaram", nunca "era
  R$ 0,00"); `useObservePrices().observe(items, catalogVersion?)` — PUT em lote chamado pela TELA depois do commit, online-only
  (offline ⇒ zero PUT, nada no outbox), dedupe por ASSINATURA (`kind:id:preço` ordenados) na montagem do hook, falha
  SILENCIOSA (`onError` vazio de propósito; só o 2xx invalida). 13 testes com o motor REAL (nenhum mock de `pricing-core`).
  Asserção de grafo: o módulo não importa `features` nem `catalog-cache`.
- `useFixProductPrice()` (PATCH) em `use-catalog.ts` no molde de `useUpdateProduct`; `readSellerFixedPrice(p)` em
  `catalog-cache.ts` colapsa `undefined` (entrada cacheada ANTES da 0008) e `null` no MESMO "não fixado" — nunca `0`. 243/243.
- Revisão do main loop: `byKey` memoizado por resposta (um `Map` novo a cada render viraria loop no `useEffect` da tela).
  Commit `cd78f68`. Ledger: ~144k.

### T124 · T076 · T068 · T125 — as telas (dev-frontend, 2026-08-29)

- **T124** o recálculo mora em `pages/catalogo/catalogo-page.tsx` (fronteira: `features/catalog` ↛ `features/calculator`,
  depcruise 0 violações): `computeFromForm(productToForm(p))` por produto, SÓ com filamentos e impressoras resolvidos
  ("envenenamento": com referência carregando o mapa fica vazio e NENHUM PUT sai); degradado (`productNeedsAttention`) fica
  fora do mapa; `observe()` roda num `useEffect` pós-commit com a lista completa, guardado por `gate === "active"` (a barreira
  é a AUSÊNCIA da chamada — `premium-write-absence.test.tsx` estendido para `observe`/`useFixProductPrice`). Revisão do main
  loop (`5128402`): a marca só avança com a LISTA visível (ficha `?produto=` aberta ou deep-link não marcam os outros itens),
  nunca depois de um GET falhado por rede (senão o PUT sobrescreveria um "era" nunca visto), e leva `catalogVersion`.
- **T076** `catalog-panel.tsx`: `rowPrice?/rowWas?/rowFlag?/rowMeta?`; mestre-lista e lista mobile com a linha densa
  `tf-plist__*` (classes byte a byte dentro do `master-item` existente — o `<Plist>` componente não aceita `data-testid`/
  `aria-current`, decisão registrada); `<Table>` na faixa **1024–1279** (`useIsListDense() && !useIsWide()`, colunas Peça ·
  Preço sugerido · Antes · Salvo em · Ações, travessão onde não mudou); ≥1280 o mestre-detalhe do 018 intacto.
  `products-panel.tsx` (puro, tudo por prop): faixa `priceChangedCount/One`, "era"/"Salvo em" (fuso do aparelho), item fixado
  (preço grande = declaração, flag "fixado"), `productPriceOverFixed` (`product-price-state.ts`, NÃO reusa
  `productNeedsAttention`) ⇒ `<Alert tone="warning">` + "Voltar a acompanhar o custo", "Manter {valor}", diálogo de duplicar
  17d (`" (cópia)"`, não herda `sellerFixedPrice`, degradado continua degradado). `produto-page.tsx`: cabeçalho 17g nos 4
  estados, bloco 17c, Manter/Aceitar, e a **recusa de nome ANTES do submit** (17b: `nameConflict` por `nameNormKey` contra a
  lista carregada excluindo o próprio id, `nameConflictHint`, contador `n de 120`, `maxLength`). `kits-panel.tsx`: `kitMeta`.
- **T068** `products-panel.test.tsx` +12 casos (12 produtos com preço na linha, 3 mudados ⇒ "3 preços mudaram…" + "era R$
  38,90" + "Salvo em 12/05" com `observedAt` que cruza a meia-noite UTC; fixado; custo > fixado ⇒ Alert; desfixar; duplicar;
  degradado sem 0,00; n=1); `produto-page.test.tsx` +2 (recusa antes do submit sem chamar `create`; editar sem mudar o próprio
  nome não se recusa). Adotados por MARCAÇÃO (stub novo, nenhum comportamento antigo mudou): `products-attention`,
  `catalogo`, `catalogo-teaser`, `premium-write-absence`; 6 fixtures `ProductOut` pós-0008.
- **T125** `pages/catalogo/fixed-price-property.test.tsx`: por LEITURA DO FONTE, fora de `features/catalog/**` e
  `pages/catalogo/**` nenhum arquivo de produção em `pages/**`+`features/**` lê `sellerFixedPrice`/`observedPrice`/
  `price-observations` (lista de exceções VAZIA; `entities`/`shared` são a camada de dados e ficam de fora por definição);
  e um render: o número grande da ficha vem de `recomputed` ou de `sellerFixedPrice`, nunca de `observedPrice`.
- Front **1526/0**, tsc 0, eslint 0, prettier ok, depcruise 0. Commits `33d51f5` + follow-up do nome. Ledger: ~448k + ~428k
  (o follow-up retomado após a interrupção da sessão — o transcript sobreviveu; nada foi refeito).
- **Sem preço nesta fatia: Kits** (não há função pronta para o total do kit na lista — T124 previa; `KitsPanel` ganhou só
  `kitMeta`). **Ícone `lock`** não existe em `icon.tsx` — a flag "fixado" vai só com texto; "parado" usa `triangle-alert`.
  **Ações da linha** continuam os botões discretos (a folha de ações da 16e não está nas tasks).

### T069 — o e2e na stack real (qa-software, 2026-08-29, duas rodadas)

- `tests/e2e/catalog-recalculo.spec.ts` — 7 cenários, valores REAIS capturados: (1) sem observação ⇒ nenhuma faixa, nem "0
  mudaram"; sair/voltar ⇒ preço idêntico; (2) filamento 100→120 ⇒ "1 preço mudou desde a sua última visita" + `product-row-was`
  = "era {preço capturado antes}" (igualdade de STRING com o valor da linha na visita anterior, nunca número fixo); (3) "Manter
  {era}" na FICHA ⇒ o aviso de atenção aparece já ao fixar (o custo de hoje JÁ passava o fixado — o raciocínio "só numa 3ª
  edição" estava errado e o teste corrigiu), filamento → 150 ⇒ preço travado, "Voltar a acompanhar o custo" ⇒ volta ao
  recomputado; (4) "Gancho" + `"gancho "` pela API com o bearer da sessão ⇒ **201** (nunca 409/422) nome final `"gancho (2)"`
  — a ficha barra ANTES do submit, por isso a prova do servidor é pela rota; (5) densidade 390 `ul.tf-plist` · 1024/1279
  `table.tf-table` com os 4 cabeçalhos · 1280/1920 `master-item` sem `tf-table`, overflow horizontal 0 em todas; (6)
  **envenenamento**: `page.route` atrasando filaments/printers 3 s ⇒ 0 PUT na janela de 1,5 s; libera ⇒ exatamente 1 PUT —
  só reproduz com o IDB uid-keyed LIMPO (com cache quente `isLoading` nunca liga: `isFetching && items.length === 0`); (7)
  offline ⇒ 0 PUT.
- **Armadilhas de teste que a stack real ensinou**: a marca se autocorrige em ~30 ms no localhost (GET→PUT→GET no trace) —
  para flagrar a janela "mudou" o PUT é abortado por `page.route` durante a asserção; `getByText(nome)` sem `exact` casava o
  resumo de um PRODUTO que só MENCIONA o filamento; funções de edição assumiam a lista visível quando a página estava na
  ficha; **`pnpm --filter … test:e2e -- x.spec --workers=1` roda a suíte INTEIRA e ignora as flags** (o `--` sobrevive ao
  repasse e o playwright o lê como fim de opções) — invocar `pnpm --filter @3dprecify/web exec playwright test …` direto.
- Rodada final (4 arquivos: T069 + screenshots + `catalog.spec` + `premium-sem-parede.spec`, `--workers=1` confirmado no log):
  **48 passed · 6 flaky · 0 failed** — os 6 são o `grant_premium` "no existing account matches" (corrida JIT×CLI já documentada
  em `history-helpers.ts`), verdes no retry. Após a remoção do bloco da lista: T069 9 passed (1 flaky idem) + screenshots
  14/14. A primeira rodada (antes do fix da `tf-plist`) tinha rodado a suíte COMPLETA por acidente: 366 passed / 58 skipped.

### T078 — screenshots, o achado que não era, e o que a imagem achou (2026-08-29)

- **34 capturas 1:1 nos dois temas** em `evidencias/pr-d/` + `medidas-pr-d.json` (33 entradas, `overflowX: 0` em
  390/1024/1279/1280/1920): faixa "3 preços mudaram" + "era" + "Salvo em" a 390 (`tf-plist`), `tf-table` 1024/1279,
  mestre-detalhe 1280/1920, ficha nos 4 estados (recalculado · sem mudança · fixado · parado), aviso do fixado, flag "fixado"
  na lista, diálogo de duplicar, recusa de nome repetido.
- **A imagem achou o que a asserção não viu** (a lição do 014, de novo): (a) a lista a 390 montava CARTÕES com os spans
  `tf-plist__*` soltos — nome em 3 linhas, 4 itens na dobra; nenhuma asserção de texto reclamava. Corrigido: `ul.tf-plist` +
  `tf-plist__row` (`cde9469`). (b) O FE-2 tinha inventado um bloco ACIMA da lista ("{nome} · Manter R$ X" por produto mudado
  + um Alert por fixado) que nenhuma prancheta desenha — a captura mostrava a lista duplicada. Removido (`fcf34a5`): a LISTA
  não escreve; Manter/Aceitar (16b·2) e o aviso com "Voltar a acompanhar" (17c) vivem no item aberto.
- **O achado que não era**: 5 capturas mostravam a pílula "Filamentos" clara com "Produtos" selecionada. Reproduzido no
  browser real, pixel a pixel ((174,175,176) e (24,24,31) idênticos à captura): é a `transition: background-color .15s` do
  Segmented congelada ~40 ms depois do `setTheme` — `rgba(255,255,255,.66)` sobre o escuro. Produto certo; a captura passou a
  usar `animations: "disabled"`. Corolário: **antes de culpar o produto por uma captura, reproduza a captura** — o dev server e
  o build de produção, deslogados, já mostravam a pílula certa; só a sequência exata do spec (clique → troca de tema →
  captura imediata) reproduzia.
- `medidas-pr-d.json`: a 1ª rodada gravou `{}` (o `afterAll` do último worker sobrescrevia — a armadilha da PR-C); agora funde.
- Gate final: frontend 1994/1994 (cobertura 89,7%) · backend 577 passed (cov 84%) · exit 0. Drift-guard 2× diff vazio. Push autorizado pelo dono ("pode", 29/08) — **PR #62** aberta contra `develop` (`855709a`), CORREÇÃO DECLARADA.

### Pontos que o dono ratifica no PR-D (registrados aqui para não sumirem)

1. O contrato sem `additionalProperties:false` no item do array (acima).
2. `name_norm` com default no MODELO (INSERT) — o UPDATE só normaliza pelo funil da API; um `UPDATE` cru fora da API deixaria
   `name_norm` velho (o índice parcial ainda impede duplicata, mas o valor divergiria do nome).
3. `observedPrice` com 3+ casas ⇒ 422 (a spec não fixa; a alternativa seria arredondar em silêncio — rejeitamos o silêncio num leaf de dinheiro).
4. A regra do sufixo: "Gancho" existente + `"gancho "` novo ⇒ nome FINAL `"gancho (2)"` (o nome enviado, aparado, mais o sufixo — não
   o nome do primeiro).
5. A 2ª frase do aviso da 16b (a causa do aumento) não é derivável — não transcrita (T074, leitura 4).
6. Contador 60 → 120 (adendo do ADR-0033).
7. A nota do item fixado com tom ATENÇÃO (spec) onde a 17c desenha info.
8. **O preço "parado" (16f/17g)**: a prancheta mostra o VALOR de quando você salvou com a legenda "Preço parado · de {data}"
   — o FE-2 seguiu a prancheta e o preço do item degradado vem da última OBSERVAÇÃO. O ADR-0033 §1 diz "o app não exibe um
   preço que calculou no passado"; aqui ele exibe, mas ROTULADO como passado. As tasks (T068) diziam "degradado sem preço". É
   uma leitura de design × ADR — o dono decide (o guard T125 continua valendo: fora do Catálogo ninguém lê a observação).
9. Na LISTA, o item fixado-acima-do-custo e o item mudado ganharam um bloco compacto acima da lista/tabela (sem prancheta
   própria — no modo navegação não existe "item aberto" inline); é um trade-off de engenharia marcado para revisão de design.
10. A recusa de nome antes do submit está só no formulário do PRODUTO (17b); filamentos/impressoras/kits dependem do sufixo
    silencioso do servidor — estender exige mudar `CatalogPanelProps.renderForm` (3 painéis + testes). Fica para o dono.

---

## PR-F — Simulações desktop + as divergências (US7) · branch `019-pr-f-simulacoes` (do develop `6cbe1c3`, pós-merge do PR #62)

### T094 (pranchetas) · T141 — a transcrição (2026-08-29)

- **4 pranchetas congeladas** (`Simulacoes - A Estrategia Viva`, `As Escritas Congeladas` × 2 temas): as escuras verbatim via
  DesignSync; as claras EXISTEM no remoto e foram lidas — diferem do escuro só pelos pares da T009 + o véu da 20a (`.55→.42`);
  as locais saem da transformação com esse par (README). Hashes no README.
- **Leituras**: a 20g (1280) se declara **"proposta, não leitura do código"** (coluna fixa de 300px "invenção" do desenhista) — a
  DECISÃO 2 do dono manda a lista para a coluna larga de `/calcular` (T095); a 20g ainda mostra os dois preços lado a lado e uma
  `tf-table` de marketplaces, ANTERIORES ao lote 10 — onde divergem, a 10d manda ("um preço grande por vez também aqui").
  As Escritas (30a–30g) são as guardas D1/D2: 30b é o T091; 30e/30f trazem 3 das 7 frases "Premium pausado" do T090.
- **T141** (prancheta 10, já congelada na PR-C): só 4 frases eram NOVAS — `markupHeader` "markup {varejo}% no varejo · {atacado}%
  no atacado", `proportionCaption` "O peso de cada custo no total. As cores são as das bolinhas acima" (**a 2ª frase "metade do
  seu custo é material" é EXEMPLO** — a 10d nem repete "bolinhas"; até o dono decidir uma regra para a frase dinâmica, só a parte
  fixa é exibida), `marketplaceLevelHint`, `summaryLine` "{nivel} · markup {pct}%". As seis frases da 10c JÁ existiam
  (`invalidNote`, resultado zerado, `avisoAtacadoAcimaDoVarejo` — os acentos que a prancheta corrige já estavam corrigidos —,
  `freightHint`, `negativeLiquido`, `noFeeHint`, a faixa sem tarifa).

### T094 (baseline) · T090 · T091 — antes de tocar código (qa-software, 2026-08-29)

- **Baseline** `evidencias/pr-f/baseline-mobile/`: gaveta "Minhas simulações" (2 salvas, uma com nota) e barra de contexto a 390 e
  360 nos dois temas (8 PNGs, `animations: "disabled"`); `medidas-baseline.json`: `widthRatio()` de `/calcular` (o método de
  `pages-desktop-width.spec.ts:17-29`) **1280 = 93,8% · 1440 = 93,3% · 1920 = 66,7%**, idêntico com e sem simulação aberta (a
  lista ainda era gaveta), overflow 0 nos dois eixos em todas as combinações. É a referência da T093 ("mobile idêntico") e da
  comparação desktop pós-T095.
- **T090 (D1)**: as ocorrências REAIS de "Premium pausado" hoje são **6 vivas + 1 apagada** — `conta.planLapsed`,
  `bom.lapsedTitle`, `bom.lapsedBanner`, `historico.lapsedBanner`, `scenarios.lapsedTitle`, `scenarios.writeLapsed`;
  `catalogo.lapsedTitle` SAIU na PR-B (T038, prancheta 32e — migrou para `catalogo.reactivateBody`) e o teste registra o porquê.
  Snapshot conjunto inline; **mutação**: "Premium Pausado" numa chave ⇒ 2 vermelhos; revertido.
- **T091 (D2)**: `scenarios-list-sheet.tsx:413/:150` e `scenario-context-bar.tsx:233/:205` leem `t.renameSheetTitle`/`t.rename`
  (prancheta 30b: "se um dia divergirem, vão divergir em silêncio") — guarda por referência de chave no fonte; **mutação**:
  bifurcar para `t.rename` no título ⇒ vermelho; revertido, diff vazio.

### T092 · T095 · T093 · T098 · T097 — a lista na coluna larga (dev-frontend B, 2026-08-29)

- `ScenarioListBody` → `export function ScenariosList` no MESMO arquivo; `scenarios-wide.test.tsx` prova UMA instância: largo
  (`installMatchMedia(desktopLarge)`) monta a lista direta e zero `<dialog>`; estreito, a gaveta de sempre. O ramo `showTeaser` que
  a task cita já tinha saído na PR-B (o vazio didático/`premiumGate` vive num lugar só).
- **DECISÃO 2 aplicada**: ≥1280 a lista vive num `<aside data-testid="scenarios-wide-aside">` sticky de 320px ao lado da
  calculadora, DENTRO da mesma `.tf-calc-page` (a `section` que o `widthRatio()` mede não muda — por isso 93,8/93,3/66,7% são
  IDÊNTICOS ao baseline); a gaveta não monta; "Minhas simulações" rola+foca a coluna; "Fazer um cálculo" do vazio rola de volta.
  O corte 1024 de `calculator-form.css` fica intocado (os dois limiares convivem — emenda 2 do ADR-0031). A 20g se declarava
  "proposta" (300px fixos do desenhista) — a coluna é 320px pelos dois primitivos existentes não truncarem cedo (registrado).
- **T093**: overflow 0 nos dois eixos a 1280/1440/1920; gaveta 390/360 comparada ao baseline por `boundingBox` + `overflowX`
  (não há `pngjs`/`pixelmatch` no lockfile — comparação por geometria, não por frase).
- **Q1/Q2** (T098): `catalogo.searchEmpty` com `{termo}` no molde de `historico.searchEmpty`; `staleHint` por linha fora do mestre e
  do `tf-plist` — só a faixa "Modo leitura offline".
- **A11-r** (T097, só medição): `a11r.json` — tf-table 1024 = 9 · 1279 = 9 · mestre-detalhe 1280 = 7 · 1920 = 14.
- **Adoção com achado**: o projeto Chromium do Playwright usa 1280×720 por padrão — exatamente o limiar de `useIsWide`; os helpers
  de `scenarios*.spec` abriam a gaveta e passaram a não achar `<dialog>`. Fixados a 900×900 (abaixo dos DOIS limiares). Uma tentativa
  a 1024 achou a linha "PLA Azul" **oculta** na `tf-table` da PR-D (`tf-table__name` `max-width:0`) — **investigado no T099**.

### T142 · T143 — o rodapé da prancheta 10 (dev-frontend C, 2026-08-29)

- `price-results.test.tsx` (15 casos, vermelho primeiro; não-vácuo por mutação: sem `<CostProportionBar>` o teste da barra morre):
  a conta TERMINA no custo total (ausência das linhas de preço), `markupHeader` com os percentuais reais, barra com N segmentos
  (mesmas 6+N parcelas do detalhamento — `custoTotal = sumMoney([...])` no `pricing-core`, soma 100% ±1; sem custo > 0 a barra não
  renderiza), Segmented Varejo|Atacado (default Varejo; `role="radiogroup"` como o `MachineMode` do mesmo arquivo — a prancheta
  marca `tablist` na marcação estática, padrão de interação, não copy), cartão grande um por vez (atacado escolhido =
  **`tf-price--neutral`**, tom novo em `price-hero.css`, único acréscimo ao DS), linha-resumo `summaryLine`, os números de cada
  marketplace seguem o nível, "Preços por marketplace" seção própria ANTES dos cartões com `marketplaceLevelHint`, sem Premium a
  seção NÃO existe no DOM; os seis estados da 10c. **Reversão datada do 016/US5 FR-907-AC2**: as bolinhas voltam (`BreakdownRow`
  `color`, já existente) com os tokens da prancheta (`--tf-purple/teal/orange` + `-deep`, hexes idênticos: #5a16a6 #0b8196 #bd6c0e).
- **T143**: R$ 950.096,00 (o número exato da 10b, produzido pelo motor com `costPerRoll=950096`) sem transbordo em X e Y no cartão
  e no `.tf-price__amount` a 360/390/1280/1920; a 1280 o bloco ≤ 721px e centralizado (±2px). 14 capturas nos dois temas
  (`rodape-*`), `medidas-pr-f.json` fundido. Achado de captura corrigido no spec: a 1ª leva fotografava o topo — `scrollIntoView`
  no `price-hero`. Adoções por MARCAÇÃO em `calculator.spec.ts` (4: contagens 4→2 porque o Segmented governa; `getByText` exato →
  regex porque o cartão divide o valor em spans) e `produto-page.test.tsx` (matcher sobre `.tf-price__amount`, main loop).
- Copy que a T141 não listou e a prancheta traz byte a byte: `aria-label="Nível de preço"` → `sections.priceLevelLabel` (registrado).
  `.tf-brow__dot` herdado do 016 é 10×10/raio 3 onde a prancheta desenha 8px redondo — para o dono.
- Unit 475/475 · e2e `calculator-layout` + `calculator` 66 passed / 0 failed nos dois projetos.

### T099 — gate, e2e completo, screenshots e o que a stack real achou (qa-software ×2 + main loop, 2026-08-29)

- **E2E completo** (508 testes, chromium + mobile, `--workers=1`): 363 passed · 12 failed · 3 flaky (o `grant_premium` JIT×CLI
  de sempre, verdes no retry) · 130 skipped. Os 12 vermelhos eram **4 classes, nenhuma nova depois do tratamento**:
  (a) `.tf-price--md` sumiu de `/calcular` para a semente — o par de cartões saiu (T142) e o cartão único só é `md` a partir de
  R$ 10.000: o teste de geometria A5 passou a GERAR R$ 950.096,00 para seguir exercitando o variant; (b) `getByText("R$ 24,24")`
  não casa mais — o cartão divide o valor em spans: regex no `price-hero`; (c) **achado novo**: ≥1280 a gaveta não existe (a
  coluna larga é permanente) e 3 testes que assumiam um `<dialog>` nessa faixa ramificam por largura; e ao verificar (c) no
  browser real, deslogado a 1280, apareceram **três** "Assinar Premium" na tela — o teaser da calculadora e, colado a ele, o
  do vazio da coluna. Tratado no produto: o vazio da coluna monta com `teaser={false}` (a página mantém os 2 convites por
  desenho; a gaveta estreita mantém o dela — FR-1906), com teste unitário nos dois sentidos; (d) SC-611 intermitente só sob a
  carga da suíte — o focus-guard do Radix ainda fechando deixava o botão `aria-hidden`; `waitFor` na causa. Rerodagem dos 9
  specs afetados: chromium todos verdes · mobile 51 passed / 2 flaky (idem) · vitest completo **1564/1564** com o SC-611 sob carga.
- **A regressão da PR-D que só a stack real pegou**: entre 1024 e 1279 o nome de filamento/impressora/produto na `tf-table` era
  INVISÍVEL e INCLICÁVEL — `btnOffsetWidth: 0, scrollWidth: 61` medidos, coluna "Peça" em branco na imagem
  (`qa-repro-tftable-{1024,1279,long-*}.png`, mantidas como prova). Causa: o `<button>` do nome repetia a classe `tf-table__name`
  da célula; o `max-width: 0` da folha é inerte numa célula (`table-layout: auto`) e vale de verdade num botão. As capturas
  `tf-table-1024/1279` da PR-D não denunciaram porque a asserção era `toContainText` — um elemento de largura zero contém o
  texto. Corrigido (classe só na célula) + guarda permanente `catalog-table-name-visible.spec.ts` (1024/1279 × 3 abas,
  `offsetWidth > 40` + o clique abre a edição). **Lição (a 4ª vez do projeto): visibilidade é geometria, não texto — a guarda
  de uma lista densa mede a caixa do elemento interativo, não o `textContent` da célula.**
- **Screenshots** (`porte-screenshots-pr-f.spec.ts`, `animations: "disabled"`, medidas fundidas): `simulacoes-{1280,1920}-*`,
  `simulacoes-aberta-{1280,1920}-*`, `simulacoes-390-*` nos dois temas — a gaveta 390 é **idêntica ao baseline** (mesmo tamanho
  de arquivo no escuro, 56 bytes de antialiasing no claro; geometria igual por asserção). Ponto para a 2ª passada: a lista a
  1280/1920 não destaca visualmente a simulação aberta (a barra de contexto a nomeia).
- Órfãos: dois `vite preview --port 4175` (das minhas reproduções do main loop) sobreviveram fora das 4 portas vigiadas — a
  lista de portas a matar antes do e2e ganha a 4175.
- Gate final: frontend 2028/2028 (cobertura 89,75%) · backend 577 passed (cov 84%) · exit 0. Push autorizado ("pode seguir", 29/08) — **PR #63** aberta contra `develop` (`6d55474`), CORREÇÃO DECLARADA.

---

## PR-E — Montar e Enviar (US6) · branch `019-pr-e-montar-enviar` (do develop `410b574`, pós-merge do PR #63) · **escalação OPUS** (ADR-0022)

### T087 — a transcrição (2026-08-29)

- **Prancheta congelada** `Orcamentos - Montar e Enviar` (escura verbatim via DesignSync; clara pela transformação da T009 — a 18
  não tem o véu da 20a). Hashes no README.
- **Namespace `quote`** (30 chaves, verbatim): 18a `newQuote`; 18b `clientLabel`, `searchPlaceholder`, `unitPriceMeta`, `lineMeta`
  "{n} un. × {valor}", `kitLineMeta`, `stoppedCannotQuote`, `itemCount`, `continueAction`; 18d `discountLabel`, `subtotal`,
  `discountLine`, `total`, `marginOverCost` (+`Sub` "custo de {valor}", sem "frete incluído"), `tightMarginTitle/Body` (18d·2),
  `belowCost` (18d·3, a linha do campo); 18e `sendTitle` "Enviar congela este preço", `totalSent`, `validUntil`, `validUntilSub`,
  `freezeNote`, `back`, `send`, `sentCaption`, `noUnfixForSent` "Voltar a acompanhar não vale para orçamentos enviados"; 18f
  `documentKicker`, `documentDates`.
- **Leituras registradas (prancheta × decisões da spec)**: (1) a prancheta desenha Orçamentos como 3º segmento do Catálogo e chama
  isso de "decisão sua" — a spec/018 já decidiram: a lista é a aba Orçamentos (ex-Histórico) e o construtor entra por
  `/historico?construir=1` (rota de 1 segmento, armadilha `base:'./'`); (2) a 18c inteira (o degrau do atacado, "Usar 10 un.",
  "10 un. sai mais barato que 9") é a **US18 RETIRADA** (Q6: venda direta torna o total monotônico) — não transcrita; (3) a 18d
  mostra o piso BLOQUEANDO ("O desconto máximo aqui é 25%" + Continuar desabilitado) — **Q10 decidiu AVISA**: só a linha "Abaixo do
  custo — …" entra, como aviso, e o alerta de bloqueio não; (4) "Frete" (18d/18f) está fora do escopo (spec §fora: "frete real");
  (5) os cinco estados da lista (rascunho · vence em N dias · aceito · recusado · venceu) e "Marcar aceito/recusado" (18a/18e·2/18g)
  não estão em US6/US16/US17 — um orçamento enviado é um snapshot imutável `kind=QUOTE` com "Válido até" como TEXTO (Q7, não vence
  como estado); registrados como lacuna de produto para o dono (PO); (6) "Hoje a mesma lista daria R$ X" (18e·2/18g) exige
  recalcular um QUOTE — a T135 decide que "Recalcular hoje"/comparar NÃO valem para QUOTE; só a frase fixa `noUnfixForSent` entra;
  (7) "Como sai no WhatsApp", "Copiar texto", "Compartilhar" e o "prazo de produção" escrito à mão (18f) — fora (Q8 = PDF pelo
  servidor, "sem link/e-mail pelo app"); lacuna registrada; (8) o item com preço PARADO não entra no orçamento (18b) — e um KIT com
  linha degradada entra por D6 com "(avulsa)" (T083): as duas regras convivem (produto parado × kit com linha parada); (9) a 18b
  marca "12 un. · atacado"/"3 un. · varejo" por item — na Q6 cada item entra pelo preço de VENDA DIRETA (o varejo do motor;
  `grossTotal === bom.precoVarejo`), sem degrau de atacado: as metas transcritas não trazem o nível; (10) a razão do Enviar offline
  (DECISÃO 4) não está na prancheta — `sendOffline` segue o molde da família "precisa de conexão" (registrado como derivada).

### T080 · T079 · T085 — o motor 4.2.0 (dev-estrutura-de-dados **opus**, 2026-08-29)

- **A fixture antes do bump** (o checkpoint da fase): `equality-4.1.0.json` (2,3 MB, SHA-256 `41122df1a0d3005913a9be3ddaa8dad9dc0d9cccee7c9d7b9141beb70c740513`)
  gerada com `src/index.ts` INTOCADO por `mulberry32(20260827)` (determinismo provado por dupla execução, mesmo SHA); 500 `calculator`
  (250 com canais / 250 sem) + 200 `bom` (474 linhas, **415 rollups** comparados, 21 com preço `null`, 37 slots com erro isolado);
  306 casos com `otherCosts`; meio-centavo injetado em `costPerRoll`, `otherCosts[].value` e no desconto; `failurePct` 100–1000% em
  ~35%. **O gerador recusa rodar contra 4.2.0** — a fixture não pode ser "reconciliada" regenerando (a maneira óbvia de apagar a
  prova). **Não-vácuo**: `ROUND_HALF_UP → ROUND_HALF_DOWN` ⇒ vermelho; e `skippedLines: 0` no rollup — uma mutação que não muda
  NENHUM preço — ⇒ vermelho: a varredura enxerga `result.channels[]`.
- **`computeQuote`** (`index.ts:636-763`): `QuoteInput { lines: (BomLineInput & { name? })[]; discount?: { mode: "PCT" | "AMOUNT";
  value } }` → `QuoteResult { bom, lines[]: { name, quantity, unitPrice, subtotal }, grossTotal, discountAmount, netTotal, costFloor,
  belowCost, modelVersion }` — tudo `Decimal`/`toMoney` (ADR-0008); `belowCost = netTotal < costFloor` (estrito); `ValidationError`
  para desconto não-finito/negativo/pct > 100/reais > bruto e para `lines[i].input.channels` não-vazio (em RUNTIME, antes de qualquer
  cálculo — o tipo não barra); **devolve números** (a string decimal é do documento, T133). `PRICING_MODEL_VERSION` 4.1.0 → **4.2.0**
  (MINOR aditiva; `package.json` junto; `version.test.ts` com o porquê). Varredura 4.1→4.2 **verde contra 4.2.0**. 216/216, cobertura
  **100%** (ratchet). Declarado para o gate: `QuoteResult` é SUPERSET do esboço do ADR-0034 §Decision 1 (+`lines[]` — o documento
  exige `unitPrice`/`subtotal` por linha —, +`modelVersion`); `origin` fica de fora (é procedência de catálogo, do cliente).

### T081 · T082 · T131 · T086 · T070 — a migração 0009 e o documento QUOTE (dev-backend **opus**, 2026-08-29)

- **0009**: DROP+ADD dos TRÊS CHECKs no mesmo ato (`kind` +QUOTE · `headline_basis` +PRECO_ORCAMENTO · `headline_matches_totals` com
  `WHEN 'PRECO_ORCAMENTO' THEN 'precoOrcamento'`). **A mutação vive dentro do teste**: numa transação revertida o CHECK é recriado SEM
  o ramo e o mesmo INSERT divergente PASSA — o `CASE` devolve NULL e um CHECK NULL é satisfeito no Postgres. `downgrade()` é
  irreversível na presença de um QUOTE (`trg_snapshots_forbid_delete` da 0006 impede apagar antes) — declarado no docstring, provado
  em container próprio; custo zero enquanto o deploy está adiado.
- **O documento QUOTE** aceito por `_validate_frozen_document`: `kind`, `modelVersion "4.2.0"`, `schemaVersion 1`, `lines[] { name,
  quantity, unitPrice, subtotal, origin }`, `discount { mode, value, amount, grossTotal }`, `costFloor`, `totals.precoOrcamento` (=
  `headlineTotal`, VR-503 + CHECK); `quoteValidityDays` é a COLUNA (CHECK 1..3650), não payload. Regras (422 no pydantic, nunca
  `IntegrityError` — 500 vira laço infinito no outbox): todo dinheiro STRING decimal incl. `discount.value`; `_MONEY_POSITION_KEYS`
  ganha as FOLHAS `unitPrice/subtotal/costFloor/amount/grossTotal` — **nunca `lines` nem `discount`** (o KIT com `quantity` inteiro
  continua 201 — o teste que obriga as folhas a entrarem uma a uma); `mode ∈ {PCT, AMOUNT}`, PCT em [0,100], `amount ≤ grossTotal`,
  `grossTotal − amount == precoOrcamento`; `origin` não é lido; `value` em AMOUNT não é obrigado a igualar `amount` (JSONB sobrevive
  a um bump do motor). Mutações: folhas revertidas ⇒ 4 vermelhos; fallback `precoVarejo` restaurado ⇒ 6; ramo QUOTE do PDF desligado
  ⇒ 6; validador do desconto ⇒ 10.
- **PDF** (`quote_render.py`): ramo QUOTE itemiza `lines` por `subtotal`, bloco bruto→desconto→total, `_basis_key` sem fallback (erro
  explícito), legenda TRADUZIDA (teste exige que nenhuma chave crua chegue ao cliente), `<b>`/`&amp;` literais via `_xml`, geometria do
  nome de 300 chars (`_assert_no_overprint` promovida a módulo). Decisão aditiva para o gate: no opt-in "mostrar custos" o QUOTE imprime
  `Custo total = costFloor` (sem isso o interruptor não faria nada — a classe do defeito que o teste do KIT já guarda). Os rótulos do
  PDF são a cópia da 18d duplicada em Python (servidor sem i18n) — par sem guarda automática, registrado. CSV intocado.
- **Espelhos**: 4 por igualdade de conjuntos E de chaves (`_BASIS_TOTAL_KEY == _BASIS_TOTAL` — senão a rota grava um número e o PDF
  imprime outro) + `kind` × CHECK do modelo × `pg_get_constraintdef` vivo.
- Contrato 2× byte-idêntico (`openapi.json 64092ea2…`, `generated.ts 6e785567…`; diff de 4 linhas); Schemathesis 45 passed em 54 s
  (o `extra="forbid"` da PR-D não foi tocado — o payload QUOTE é `dict` opaco). **622 passed**, ruff/basedpyright/import-linter/
  migration-guard ok. Commit `6fd47eb`.

### T133 · T135 · T083 — o envelope QUOTE e a varredura (dev-frontend **opus**, 2026-08-29)

- **T133** (`frozen-payload.ts`, vermelho 8 → verde 39/39): `kind` admite `"QUOTE"`; `FrozenTotals.precoOrcamento?`; `FrozenQuoteLine
  { name, quantity, unitPrice, subtotal, origin }` (NÃO reusa `FrozenKitLine`, que carrega `input/breakdown/totals`); `FrozenQuoteDiscount
  { mode, value, amount, grossTotal }`; `costFloor?`; `lines?: FrozenKitLine[] | FrozenQuoteLine[]` (união de ARRAYS — foi ela que quebrou
  os consumidores e forçou cada decisão da T135), com dois leitores estreitos atrás do teste de `kind`. `buildQuotePayload(result, { lines:
  (FrozenProvenance | null)[], discount? })` converte TODO dinheiro (e `discount.value`) para string decimal — o payload gerado casa com o
  `QUOTE_PAYLOAD` que o backend congelou em `test_history.py`. `FROZEN_PAYLOAD_SCHEMA_VERSION` continua **1**. Escolhas declaradas:
  `catalogVersion: null` e `provenance: null` explícitos (N origens, uma por linha); `discount.value` gravado "10.00" e formatado "10%" na
  leitura.
- **T135** — por arquivo, com teste e não-vácuo no SINGLE: `snapshot-detail-page` itemiza `lines`, bruto→desconto→total, `documentDates`
  "válido até" como TEXTO (Q7) e `noUnfixForSent`; `recalc-today` e `compare-today` devolvem `null` para QUOTE (US17: nenhuma origem a
  repreçar); `historico-page` rotula por `kindLabel` (o ternário antigo chamava todo orçamento de "Peça única"); `history-format.ts` (9º
  arquivo) ganha `kindLabel`/`validUntil` e `basisCaption` vira Record sobre a união (PRECO_ORCAMENTO = "Total enviado" — antes cairia
  em "Preço de varejo", o defeito silencioso); `record-snapshot-sheet` NÃO grava QUOTE **por tipo** (`Exclude<…,"QUOTE">`) e por dados;
  `export-sheet` exporta pelo mesmo caminho só com id do servidor (`pdfWaitsSync` antes); `outbox` drena QUOTE sem ramo novo;
  `scenario-context-bar` nunca oferece "salvar simulação" de um orçamento.
- **T083** — o teste-contrato do construtor (15 casos) deixado VERMELHO de propósito (a suíte não coleta: `./quote-builder` não existe);
  fixa props, testids e o fluxo 18b→18d→18e. **PARADA de Princípio VIII resolvida pelo main loop**: `features/history` não pode importar
  `features/calculator` (`productToForm`/`computeFromForm`); decidido pelo precedente da T124 (PR-D) — a PAGE compõe e o construtor
  recebe `toLineInput` por prop; a alternativa "descer o mapeamento para `entities`" (três telas já reimplementam o caminho) vai para o
  arquiteto como follow-up. Extra: `price-observations.test` lia "4.1.0" literal — passou a ler `PRICING_MODEL_VERSION`. Suíte 1594/0
  fora o T083.

### T088 · T083(verde) — o construtor (dev-frontend, 2026-08-29)

- `features/history/quote-builder.tsx` contra o teste-contrato (15/15): seleção 18b (produto/kit, quantidade, item PARADO apagado
  com `stoppedCannotQuote` — a data vem de `product.updatedAt`, nunca de observação), desconto %|R$, readout bruto/desconto/total/
  piso ("Sobra sobre o custo" apagada), `belowCost` como AVISO com Enviar habilitado (Q10), "Cliente" = `SnapshotIn.label`, o passo
  final é o cartão 18e (título "Enviar congela este preço" + "Total enviado" + Válido até + `freezeNote` + Voltar | Enviar — a
  prancheta o desenha como CARTÃO do fluxo; **leitura registrada: não é um modal por cima** — para a 2ª passada), envio em UMA
  requisição com guarda de reentrância dupla (`sendingRef` síncrono contra o duplo clique no mesmo commit do React; `sentRef`
  porque reenviar é duplicar), offline `disabled` + `sendOffline` e NADA no outbox (DECISÃO 4).
- **Fronteira (T124-precedente)**: `pages/historico/quote-line-input.ts` monta `toLineInput` — reusa LITERALMENTE `bomLineToInput`
  (exportado de `recalc-today.tsx`) e `productToForm`+`computeFromForm`; `directSale()` remove `channels` (Q6). Follow-up ao
  arquiteto: TRÊS telas já reimplementam o mapeamento — descer para `entities` eliminaria a triplicação.
- **18d·2 ("aperta, mas passa") OMITIDO e registrado**: não há limiar de % decidido em lugar nenhum (o "12%" da prancheta é
  exemplo) — `tightMarginTitle/Body` transcritas ficam sem consumidor até o design decidir. **Ícones**: `check`/`share-2` existiam
  no bundle e entraram no mapa; `percent/minus/user/folder` NÃO estão no bundle (o desconto usa sufixo textual); `lock` → `info`.
- **A guarda T125 (ADR-0033) pegou de verdade**: a 1ª versão vazava `usePriceObservations`/`observedPrice` para
  `pages/historico/**` — vermelho na hora, corrigido (o construtor não lê observação nenhuma).
- Suíte FE 1609/1609 · tsc 0 · boundaries/depcruise ok. T084 escrito; o veredito é da rodada limpa do main loop (as duas rodadas
  do agente morreram por briga de portas — lição: UMA stack por vez, o coordenador roda o e2e quando dois agentes competem).

