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
