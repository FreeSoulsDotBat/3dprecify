# Tasks: 019 — O porte do design (157 superfícies) + as features que o dono incluiu

**Feature**: `019-porte-design` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Autoridade técnica**: [research.md](./research.md) (A–K) · **ADRs**: 0032 (PR-A) · 0031 §Emenda (PR-F) ·
0033 (PR-D) · 0034 (PR-E) — Proposed; o dono flipa cada um no gate da fatia.
**Autoridade de design**: `docs/design/handoff-019/` + pranchetas remotas (Claude Design `a90ed7d4`) —
**copy sempre transcrita verbatim; divergência de um caractere é defeito.**

**Tests são obrigatórios** (Constituição III) — e neste incremento cada teste novo é provado
**não-vacuoso** (vermelho antes do verde; mutação onde a guarda for estrutural), porque o projeto já
pagou três vezes por guarda que passava em tudo.

**Ordem das fatias** (cada uma é um PR autorizado pelo dono, squash em `develop`; homologação do dono
ESPERA a Rodada 1 — cada fatia entrega em **CORREÇÃO DECLARADA**):

| Fatia | Fases | Conteúdo | Depende de | Escalação |
| --- | --- | --- | --- | --- |
| **V0** | 1 | medição — não vira PR | — | — |
| **PR-A** | 2 + 3 + 4 | fundação DS (US1) + marca/foco/texto/vocabulário (US2) | V0 | — |
| **PR-B** | 5 | Premium sem parede (US3) | PR-A | — |
| **PR-C** | 6 | Calculadora (US4) | PR-A | — |
| **PR-D** | 7 | Recálculo do Catálogo (US5) — migração 0008 | PR-A | **opus** (ADR-0022) |
| **PR-E** | 8 | Montar e Enviar (US6) — pricing-core 4.2.0, migração 0009 | PR-A, PR-D | **opus** |
| **PR-F** | 9 | Simulações desktop + D1/D2 (US7) | PR-A | — |
| Polish | 10 | evidência, ledger, ADRs | todas | — |

B, C, D, F são independentes entre si depois de A. **Ordem decidida pelo dono (27/08): B → C → D → F → E.** E é a única tudo-ou-nada e sai por último.

---

## Phase 1: Setup — V0, a medição que dimensiona a PR-A (não vira PR)

- [x] T001 Classificar cada item do handoff §1 (8 primitivos) e §3 (8 adaptações) + itens de marca em **(a) já correto · (b) existe local e sobe · (c) não existe**, com arquivo:linha ou screenshot por item, em `specs/019-porte-design/dod-evidence.md` §V0. Partir das 5 correções já medidas pelo arquiteto (research §"Correções de escopo") — NÃO reconferir o que já tem arquivo:linha; conferir o resto. **Feito 27/08** → dod-evidence §V0 (22 linhas: 10 c · 1 b · 8 a · 1 misto · 2 n/a; o README erra `--tf-warning-deep` — o token real é `--tf-amber-deep`).
- [x] T002 [P] Medir o contraste de `--tf-amber-deep` (`#bd6c0e`) como TEXTO sobre `#ffffff` e sobre `--tf-warning-soft` nos dois temas (WCAG sRGB, com o mesmo método do `a11y-targets-contrast.spec.ts`) e registrar em dod-evidence §V0. **Se < 4,5:1: decisão do dono JÁ TOMADA (27/08) — escurecer só o TEXTO até ≥4,5:1** (ícone/badge/botões seguem no laranja da marca; ADR-0032 §4). **Feito 27/08** → §T002: `#bd6c0e` = 3,95 / 3,46 — REPROVA; `--warning-text` nasce claro `#9a570a` (5,61 / 4,92) · escuro `var(--tf-orange)` (7,94 / 6,08).
- [x] T003 [P] Contar as ocorrências de `canal|canais|Canal|Canais` em `apps/web/src/**` (produto) e `apps/web/tests/**` (teste) separadamente e registrar os dois números em dod-evidence §V0 — substituem os "374" da prancheta e são o tamanho real da US2/T033. **Feito 27/08** → §T003: produto 63 (31 em `messages.pt-br.ts`) · testes 95 (53 no cf-010) · backend 0.
- [x] T004 [P] Registrar a estimativa de tokens do incremento em `docs/token-ledger.md` (uma linha por fatia; real fecha no Polish). **Feito 27/08** — linha "019 V0 + estimativas por fatia" (~4,4M total).
- [x] T005 Subir a stack pelo `quickstart.md` e registrar em `specs/019-porte-design/evidencias/ambiente.md`: /health 200 · /api/v1/entitlement 401 · alembic em `0007 (head)` · porta do emulador usada (a armadilha 9099 está documentada). **Feito 27/08** → [evidencias/ambiente.md](./evidencias/ambiente.md): 200 · 401 · 0007 · emulador em 9500.

**Checkpoint**: a tabela (a)/(b)/(c) existe e é ela — não a contagem de `NOVO` — que abre a Phase 2.

---

## Phase 2: Foundational — as guardas de folha e a transcrição (BLOQUEIA tudo)

- [x] T006 Escrever o teste VERMELHO `apps/web/src/styles/tf-class-uniqueness.test.ts`: varre `apps/web/src/**/*.css`, extrai toda definição `.tf-[a-z0-9_-]+` (seletor simples e composto), falha em nome definido em **dois arquivos**. Previa vermelho por `tf-alert--compact`; **ficou vermelho 27/08 por `tf-grafismo`** (`styles/base.css` × `shared/ui/grafismo.css`, achado novo) — `tf-alert--compact` só tem UMA definição em `src` hoje; a guarda protege a transição da T021. Registrado em dod-evidence §T006.
- [x] T007 [P] Escrever o teste `apps/web/src/styles/prancheta-devices.test.ts`: zero ocorrência de `tf-phone-scroll` e `tf-price--rola` em `apps/web/src/**` E no bundle (`apps/web/dist/**/*.css` após `pnpm build`). Provar não-vácuo inserindo a classe num CSS temporário e vendo vermelho; reverter. **Feito 27/08** — vermelho provado e revertido (§T007).
- [x] T008 [P] Criar `specs/019-porte-design/design/README.md` com a regra de transcrição: cada fatia busca as pranchetas de que precisa via DesignSync (projeto `a90ed7d4`), salva a cópia `.dc.html` em `design/` (prettierignored via `specs/*/design/**`) e transcreve a copy para `messages.pt-br.ts` **byte a byte** — nunca de memória, nunca "melhorada". Listar por fatia quais pranchetas: A → `Primitivos - A Camada de Baixo`, `Shell - O Cromo e a Navegacao`, `Entrada e Bordas` · B → `Premium - O Caminho Sem Parede`, `Catalogo - Os Estados da Lista` · C → `Calculadora - Aviso de Plausibilidade`, `Bloco da Maquina`, `Selo de Procedencia`, `A Conta e os Precos` · D → `Catalogo - Lista e o Recalculo`, `O Item Aberto` · E → `Orcamentos - Montar e Enviar` · F → `Simulacoes - A Estrategia Viva`, `As Escritas Congeladas`.
- [x] T009 Baixar via DesignSync as pranchetas da fatia A (as 3 da T008, tema escuro E claro) para `specs/019-porte-design/design/` e registrar o hash de cada uma em `design/README.md` (cópia congelada = contrato). **Feito 27/08** — 6 arquivos (3 pranchetas × 2 temas), hashes em [design/README.md](./design/README.md).
- [x] T010 Ampliar o vetor compartilhado de normalização de nome: criar `contracts/fixtures/name-norm.json` (casos: acento, maiúscula, `ß`, espaços duplos, trim, NFD/NFC equivalentes) — lido por pytest E vitest nas fases 7. Sem implementação ainda; só o vetor. **Feito 27/08** — 18 casos (inclui `ß`, NFD/NFC, tab, numeral romano).

**Checkpoint**: T006 vermelho (duplicata real), T007 verde, pranchetas da fatia A congeladas.

---

## Phase 3: US1 — A camada de baixo: os oito primitivos + o tom de ATENÇÃO (P1 · PR-A)

**Meta**: os primitivos do handoff §1 no DS, cada um com a medida que o justificou; `--warning-text`;
as adaptações desfeitas; os consertos do produto preservados.
**Teste independente**: cada primitivo renderizado nos dois temas com as medidas (frozen ≥5,67:1 /
≥18,23:1; plist ≥9 itens a 390px; close 44×44 sem alterar altura); T006 verde após a promoção.

### Tests (vermelhos primeiro)

- [x] T011 [P] [US1] `apps/web/src/shared/ui/frozen.test.tsx`: `<Frozen>` renderiza `<fieldset disabled class="tf-frozen">`; não existe prop que desligue o `disabled`; um botão FORA dele continua clicável; a dica (`tf-field__hint`) dentro dele mantém `color` sem `opacity` no wrapper (asserção de estilo computado). **Feito 27/08** (dev-frontend) — 5/5; ver dod-evidence §T011.
- [x] T012 [P] [US1] `apps/web/src/shared/ui/plist.test.tsx` + `table.test.tsx` + `aviso.test.tsx`: estrutura/roles (`list`/`listitem`; `table` com `columnheader`; `aviso` com `role="status"` e botão de dispensa); `Aviso` NÃO é `alert`.
- [x] T013 [P] [US1] `apps/web/src/shared/ui/alert.test.tsx` (casos novos): `compact` aplica `tf-alert--compact`; `action` renderiza `tf-alert__action`; `onDismiss` renderiza `tf-alert__close` com nome acessível; `tone="warning"` aplica `tf-alert--warning`; o alvo do `__close` é 44×44 por pseudo-elemento e a altura do alerta com uma linha NÃO cresce (comparar com o alerta sem `onDismiss`).
- [x] T014 [P] [US1] `apps/web/src/shared/ui/button.test.tsx` + `segmented.test.tsx` + `badge.test.tsx` (casos novos): `width="full"|"half"` → classes; `split` → `tf-segmented--split`; `tone="warning"` no Badge. `tf-badge--success/--danger` NÃO são criados (já existem — asserção de ausência de duplicata via T006).
- [x] T015 [P] [US1] Atualizar `apps/web/src/styles/token-parity.test.ts`: baseline 87 → **88** (`--warning-text` nos dois temas), como mudança revisada; o teste fica vermelho até a T020.
- [x] T016 [US1] `apps/web/tests/e2e/a11y-targets-contrast.spec.ts` (casos novos): contraste MEDIDO de dica e rótulo dentro de um `<Frozen>` nos dois temas (≥5,67:1 e ≥18,23:1 — contra o fundo REAL `--bg-muted`); `tf-plist` a 390px com 12 itens → ≥9 visíveis sem rolar (caixas dentro do viewport). **Feito 27/08** — `tests/e2e/porte-medidas.spec.ts` (marcação da prancheta injetada contra o bundle real; nenhuma tela usa Frozen/Plist antes da PR-B/PR-D): 8/8 chromium+mobile. Limiar asserido = AA 4,5:1 (normativo); os 5,67/18,23 da folha são a medida de um tema — registrada, não asserida.

### Implementation

- [x] T017 [US1] Criar `apps/web/src/shared/ui/frozen.tsx` + `frozen.css` (regra do handoff: esmaecimento nos CONTROLES + `background: var(--bg-muted)` obrigatório; adaptações desfeitas) e exportar em `shared/ui/index.ts`.
- [x] T018 [P] [US1] Criar `apps/web/src/shared/ui/plist.tsx`+`.css`, `table.tsx`+`.css`, `aviso.tsx`+`.css` a partir de `docs/design/handoff-019/tf-components.css` (`grep NOVO`), desfazendo as 8 adaptações do §3 (nome do token `--border-default`, `fixed`, ícone via `TF_ICON_BASE`, componente, sem regra de `text-decoration`, `12vw`, `min-width:0`), e exportar em `index.ts`.
- [x] T019 [P] [US1] Estender `alert.tsx`/`alert.css` (`compact`, `action`, `onDismiss`, `tone="warning"` + `.tf-alert__action` com cor por tom + `.tf-alert__close` com alvo por `::after`), `button.tsx`/`.css` (`width`), `segmented.tsx`/`.css` (`split`), `badge.tsx`/`.css` (`tone="warning"`).
- [x] T020 [US1] Adicionar `--warning-text` em `apps/web/src/styles/tokens/colors.css` nos dois temas (valor = resultado do gate T002: `--tf-amber-deep` se ≥4,5:1, senão o tom que o dono escolher) + `--warning-soft` se faltar; T015 fica verde.
- [x] T021 [US1] **Promover** `tf-alert--compact`: apagar as regras locais de `apps/web/src/features/calculator/shopee-warnings.css` e trocar `shopee-warnings.tsx` para `<Alert compact>`; **e juntar `tf-grafismo` numa casa só** (os 4 declarativos de `styles/base.css:173` vão para `shared/ui/grafismo.css` — o achado da T006); T006 fica verde. Re-medir a seção Shopee a **360px** contra a medida do 016/PR-F (a geometria muda ~8px — research §A) e registrar em dod-evidence. **Feito 27/08** (dod-evidence §T021) — promoção + `tf-grafismo` juntado, guarda 3/3 com dívida vazia; re-medida a 360px: selo 60→**75px** (+15, não ~8; registrado).
- [ ] T022 [US1] Rodar `pnpm gate:all` + `a11y-targets-contrast` + `overflow-geometria` (10 larguras) e registrar; os consertos 015/A6 e 016/T018-A1 em `price-hero.css` continuam intocados (diff vazio no arquivo).

**Checkpoint**: 8 primitivos no DS com medida registrada; T006/T007/T015 verdes; nenhuma tela mudou ainda além da Shopee (re-medida).

---

## Phase 4: US2 — Marca, foco, texto e vocabulário (P1 · PR-A)

**Meta**: guardas de marca; **remoção do indicador de foco** (decisão do dono 25/08, reafirmada 27/08 —
exceção explícita ao WCAG 2.4.7); TabBar 10px; grafismos fora de 404/erro; acentos; "1 ano";
canal→marketplace no texto visível.
**Teste independente**: zero "canal" em superfície legível (UI + PDF/CSV); símbolos `channel*` intactos;
zero anel em `:focus-visible` (guarda do inverso); orçamento antigo abre idêntico.

### Tests (vermelhos primeiro)

- [x] T023 [P] [US2] `apps/web/src/widgets/top-bar/top-bar.test.tsx` (caso novo): nenhum `<img>` com `tf-lockup` em rota alguma; o wordmark é `logo-inteira-{white,black}.png` e o símbolo só na top-bar — guarda anti-regressão (já correto: V0(a)). **Feito 27/08** — 3 casos em `top-bar.test.tsx` (wordmark nos 2 temas · zero `tf-lockup` em src · `<Logo>` só em top-bar e sign-in-screen); 6/6.
- [x] T024 [P] [US2] `apps/web/tests/e2e/focus-none.spec.ts` (NOVO — a guarda do INVERSO): para cada tipo de controle (botão, link do menu, aba segmentada, switch, campo, dispensa de alerta), focar por Tab e asserir `outline-style: none` e `box-shadow: none` computados; campo mantém `border-color` de acento. Provar não-vácuo restaurando um anel temporariamente → vermelho → reverter. Substitui o medidor de foco do 018 (`_diag-foco`, que fica obsoleto). **Feita 27/08** — verde nos 2 projetos × 2 larguras na rodada final (350/0). A 1ª rodada achou 2 bugs do spec (switch disabled; `has` não-relativo) e a transição de `border-color` (`expect.poll`). Não-vácuo PROVADO: anel global temporário em `base.css` → 4 vermelhas → revertido (a 1ª prova, em `.tf-btn`, mirava a classe errada — registrado).
- [x] T025 [P] [US2] `apps/web/src/widgets/app-nav/app-nav.test.tsx` (caso novo): rótulo da TabBar a 10px com ≥7px de respiro em cada célula a 390px (medir "Orçamentos", a mais longa) — geometria, não texto. **Feito 27/08** em e2e (`porte-medidas.spec.ts` — jsdom não mede texto): 5 rótulos a 10px, sem transbordo, ≥7px por lado.
- [x] T026 [P] [US2] `apps/web/src/features/calculator/calculator-model.test.ts` (caso novo): `paybackYearsLabel` com `n=1` → "1 ano"; `n=3` → "3 anos". **Escrita 27/08 em `calculator-model.test.ts` contra `PAYBACK_YEAR_OPTIONS` (onde o rótulo nasce), VERMELHA** (`"1 anos"`); verde na T031.
- [x] T027 [P] [US2] `apps/web/src/shared/i18n/messages.test.ts` (NOVO): (a) nenhuma string visível de `messages.pt-br.ts` contém `canal`/`canais` (case-insensitive) exceto uma lista explícita de exceções justificadas (vazia ao fim); (b) `avisoAtacadoAcimaDoVarejo` contém "preço", "só", "é". **Escrita 27/08, VERMELHA por desenho**: 22 folhas visíveis com "canal" (não 31 — a V0 contou substrings, incl. comentários e chaves) + o acento; fica verde na T031/T032.
- [x] T028 [US2] `apps/web/tests/e2e/history-export.spec.ts` (caso novo): um snapshot gerado APÓS a fatia exporta PDF/CSV dizendo "marketplace"; um snapshot criado com payload contendo "canal" (inserido via API, ADR-0019) abre e exporta **idêntico** ao byte. **Resolvido 27/08 por ESTRUTURA** (dod-evidence §T028): o servidor tem 0 strings de vocabulário e o CSV são as linhas armazenadas; a guarda que sobra vive onde o texto do PDF é legível — `backend/tests/test_export.py::test_the_quote_never_says_canal` (3 payloads, artefato completo, não-vácuo por tamanho). O e2e não grepa PDF deflatado (o próprio spec explica por quê).

### Implementation

- [x] T029 [US2] Zerar `:focus-visible` em `button.css`, `card.css` (`--interactive`), `app-nav.css`, `segmented.css`, `switch.css`, `plist.css`, `alert.css` (`__action`, `__close`), `aviso.css`; campos: `field.css` mantém só a borda de acento. Remover a asserção geométrica de anel do 018 onde existir (`apps/web/tests/e2e/a11y-*`), com nota apontando para o T024. **Feito 27/08** (dev-frontend) — 11 arquivos (incl. o reset global `base.css`, `category-picker.css`, `dialog.css`, `toast.css`, achados por grep); `_diag-foco` apagado; nenhuma asserção de anel existia; `--ring`/`--focus-ring` órfãos (mantidos, baseline 88).
- [x] T030 [P] [US2] `apps/web/src/widgets/app-nav/app-nav.css`: rótulo 12→10px + respiro; `apps/web/src/pages/not-found/not-found-page.{tsx,css}` e `pages/error/error-page.{tsx,css}`: remover `Grafismo`, centrar nos dois eixos. **Feito 27/08** (dod-evidence §T030) — a prancheta 24c resolve o item 13 da V0: é TIRAR; 17/17 verdes.
- [x] T031 [P] [US2] `apps/web/src/shared/i18n/messages.pt-br.ts`: acentos em `avisoAtacadoAcimaDoVarejo` (`:179`); `paybackYearsLabel` com singular (`:486`) — e o `machine-cost.ts` que o consome. **Feito 27/08** — o consumidor real é `PAYBACK_YEAR_OPTIONS` em `calculator-schema.ts` (chave nova `paybackYearLabel: "{n} ano"`); acentos aplicados; T026 verde.
- [x] T032 [US2] Vocabulário: trocar "canal/canais" → "marketplace(s)" nos VALORES de `messages.pt-br.ts` (31 medidas) e no texto embutido de `calculator-form.tsx`/`channel-rollup.tsx`/`export` (extraindo para chave quando for hard-code); **símbolos, chaves, rotas, nomes de arquivo intactos**; PDF/CSV (`backend/app/api/history_export.py` ou equivalente — as strings do exportador) incluídos. **Feito 27/08** — 17 folhas em `messages.pt-br.ts`; zero hard-code fora de `messages`; backend 0 (§T028); T027 verde com `EXCECOES` vazia.
- [x] T033 [US2] Atualizar os testes que assertam a string antiga (`cf-010-canais.spec.ts` mantém o NOME; 48 asserções medidas + as demais da T003) — **commit separado** do commit de produto, revisado como mudança de asserção (R3/research §J). **Feito 27/08** — 1 asserção (`bom-page.test.tsx:509`); os 94 restantes já assertavam via `messages` ou são identificadores/metadados; commit separado.
- [ ] T034 [US2] Rodar `pnpm gate:all` + e2e completo; screenshots 1:1 nos dois temas de: TabBar 390px, 404, erro, um selo com `tf-alert--compact`, um `<Frozen>`; registrar em `specs/019-porte-design/evidencias/pr-a/`.
- [ ] T035 [US2] Abrir o PR-A com o corpo assertando AUSÊNCIAS (zero `tf-lockup`, zero anel, zero "canal" visível, zero classe duplicada) e pedir ao dono o flip do **ADR-0032** no gate.

**Checkpoint PR-A**: fundação completa; nenhuma outra fatia começa antes do merge.

---

## Phase 5: US3 — Premium sem parede (P1 · PR-B) — MUDANÇA DE COMPORTAMENTO

**Meta**: bloquear SÓ no salvar. Vazio didático + formulário inerte; lapsed-com-itens preenchido;
vazios de Orçamentos/Simulações → calculadora. Servidor intocado.
**Teste independente**: `git diff develop -- backend/app/entitlement` VAZIO; mock de rede com zero
escritas no estado grátis; outbox 0; as 6 frases byte-idênticas; os dois caminhos (nunca-teve ×
venceu) exercitados com ledger.

### Tests (vermelhos primeiro)

- [ ] T036 [P] [US3] `apps/web/src/shared/billing/premium-gate.test.ts` (NOVO): `premiumGate({status:"none"}, session)` → `free-nunca-teve`; `lapsed` → `lapsed-com-itens`; `active` → `active`; sem resposta → `unknown` (nunca presume); função pura, sem imports de `entities`/`features`.
- [ ] T037 [P] [US3] `apps/web/src/features/catalog/catalog-panel.test.tsx` (casos novos): no estado `free-nunca-teve` o painel renderiza o vazio didático (título "Nenhum filamento cadastrado" — verbatim) no ramo `ENTITLEMENT_REQUIRED`; NÃO renderiza `PremiumTeaser` na lista; "Adicionar filamento" abre o formulário; o formulário está dentro de `<Frozen>`; **o `onSubmit` de rede não é passado** (mock de `fetch`/mutação com **zero** chamadas ao clicar em tudo); "Salvar" existe, está `disabled` e visível; "Assinar Premium" é `secondary`; a frase "Salvar faz parte do Premium." está ANTES da linha de botões no DOM.
- [ ] T038 [P] [US3] `catalog-panel.test.tsx` (caso lapsed): com `lapsed` e itens no cache, os itens aparecem, o formulário abre PREENCHIDO dentro de `<Frozen>`, a mensagem é "Reative o Premium… Seus itens estão salvos." (verbatim 32e), a faixa de topo antiga (`lapsedTitle`) NÃO renderiza.
- [ ] T039 [P] [US3] `apps/web/src/pages/historico/historico-page.test.tsx` + `features/scenarios/scenarios-list-sheet.test.tsx` (casos novos): no grátis, o vazio mostra a frase verbatim de Orçamentos/Simulações (32c) e o botão "Fazer um cálculo" navega para `/calcular`; exatamente UM `TeaserUpgrade` por tela (invariante 016/US1).
- [ ] T040 [US3] `apps/web/tests/e2e/premium-sem-parede.spec.ts` (NOVO): conta grátis real → Catálogo → vazio didático → "Adicionar filamento" → formulário inerte visível com dica legível → "Salvar" desabilitado; tentar escrever via UI não gera requisição (`page.route` contando POST/PATCH = 0); `outbox` em IDB = 0 itens. Conta com grant expirado (CLI `grant` + expiração) → itens listados + formulário preenchido inerte + "Reative". Deslogado (E-5 decidida): o MESMO vazio + formulário inerte; "Assinar Premium" visível; clique → tela de entrada-com-intenção (copy da prancheta 32h quando existir) → após login, cai na oferta (`redirect` preservado) — zero escrita, zero outbox.
- [ ] T041 [US3] `apps/web/tests/e2e/teaser-sweep.spec.ts` (atualizar): SC-006 continua valendo — exatamente um convite por tela grátis, 1920 e 390px, agora com o vazio didático no lugar da parede.

### Implementation

- [ ] T042 [US3] Baixar as pranchetas da fatia B (`Premium - O Caminho Sem Parede`, `Catalogo - Os Estados da Lista`, dois temas) para `design/` e transcrever as 6 frases dos vazios + "Salvar faz parte do Premium." + "Reative o Premium…" + "Fazer um cálculo" para `messages.pt-br.ts` (chaves novas em `§ premiumTeaser`/`§ catalogo`), byte a byte.
- [ ] T043 [US3] Criar `apps/web/src/shared/billing/premium-gate.ts` (união discriminada pura) + `shared/billing/vazio-didatico.tsx` (o `tf-empty` com a frase por feature, sem coroa, sem preço) e exportar.
- [ ] T044 [US3] `apps/web/src/pages/catalogo/catalogo-page.tsx` (`:106-110`): remover a parede `if (signedOut || status === "none") → <PremiumTeaser>` para o logado; `features/catalog/catalog-panel.tsx` (`:228-231`): o ramo `ENTITLEMENT_REQUIRED` renderiza o vazio didático; o botão de criar nunca fica `disabled` por plano.
- [ ] T045 [US3] `filament-form.tsx` / `printer-form.tsx` / `produto-page.tsx`: no estado `free-nunca-teve` montar em `<Frozen>` com campos vazios e SEM `onSubmit` de rede; no `lapsed-com-itens` montar em `<Frozen>` com os valores e a linha "Reative"; remover o aviso de reativação para quem nunca teve (`catalogo.reactivate*` só no lapsed).
- [ ] T046 [P] [US3] `pages/bom/bom-page.tsx`: "Montar kit" deixa de ser `disabled` por plano (bloqueio no salvar); `historico-page.tsx` e `scenarios-list-sheet.tsx`: vazio com "Fazer um cálculo" → `/calcular`.
- [ ] T047 [US3] Provar SC-1903: `git diff develop -- backend/app/entitlement` = vazio (registrar o comando e a saída em dod-evidence §PR-B); rodar gate:all + e2e; screenshots 1:1 dos 4 estados × 2 temas em `evidencias/pr-b/`.
- [ ] T048 [US3] E-5 decidida: implementar o deslogado no mesmo caminho (T044/T045 cobrem os dois estados via `premiumGate`: `free-nunca-teve` e `signed-out`); a tela de entrada-com-intenção usa a copy da prancheta 32h (`docs/design/prompts/019-lote32h-deslogado.md` → o dono desenha ANTES do PR-B; se a prancheta não existir ao abrir a fatia, o deslogado usa a tela de entrada de hoje com o `redirect` e a copy nova fica como follow-up declarado). Abrir o PR-B.

---

## Phase 6: US4 — Comportamentos da calculadora (P2 · PR-C)

**Meta**: plausibilidade (blur/anúncio/Entendi/erro-não-come/dinheiro); máquina (readout/dois modos/
zero/confirmação/copy); selo compact + dispensa até a fonte mudar; T212 sticky; R$/kWh íntegra; "0,00".
**Teste independente**: aviso ausente no `change`, presente no `blur`; 850 dispensado, 2.400 volta;
tarifa 3+ casas == motor; selo dispensado reaparece ao mudar `effectiveDate`; resumo visível na rolagem a
390px (caixa); `PRICING_MODEL_VERSION` inalterado.

### Tests (vermelhos primeiro)

- [ ] T049 [P] [US4] `apps/web/src/features/calculator/plausibility.test.tsx` (NOVO): digitar "85"→"850" sem blur ⇒ zero `Aviso`; blur ⇒ `Aviso` com `role="status"` (anunciado); "Entendi" ⇒ some; mudar para 2.400 + blur ⇒ volta; erro de validação no campo ⇒ o aviso PERMANECE; valor em R$ formatado `R$ 6.000.061,60`.
- [ ] T050 [P] [US4] `apps/web/src/features/calculator/plausibility-store.test.ts` (NOVO): chave `${campo}:${valor}`; sobrevive a unmount/remount; não usa `localStorage`.
- [ ] T051 [P] [US4] `apps/web/src/features/calculator/machine-cost.test.tsx` (casos novos): readout "de R$ 4.000,00 ÷ 3.600 h" nos modos estimar E ajustar; valor 0 ⇒ ressalva verbatim (não "R$ 0,00/h"); troca de modo com valor digitado ⇒ diálogo de confirmação (3 frases verbatim) e NADA é descartado antes do "sim"; rótulos "Estimar"/"Ajustar". `calculator-model.test.ts`: `PRICING_MODEL_VERSION` continua `4.1.0` e o vetor canônico 27,55/41,33/35,82 intacto.
- [ ] T052 [P] [US4] `apps/web/src/features/calculator/fee-seal.test.tsx` (casos novos): renderiza `<Alert compact action onDismiss>`; dispensar grava a chave `(marketplace, source, effectiveDate)` em `localStorage` (sem uid); mesma fonte ⇒ oculto após reload; `effectiveDate` diferente ⇒ VISÍVEL; lista limitada a **50** chaves (as mais recentes).
- [ ] T053 [P] [US4] `apps/web/src/shared/ui/number-field.test.tsx` (casos novos): `currency` com `precision=4` para tarifa não trunca "0,8734" no blur; valor "0" salvo reabre como "0,00"; `calculator-model.test.ts`: energia = 0,8734 × kW × h com igualdade numérica.
- [ ] T054 [US4] `apps/web/tests/e2e/calculator-layout.spec.ts` (caso T212): a 390px, com o formulário rolado ao meio e ao fim, a caixa do resumo fixo (`data-testid="price-summary-sticky"`) está dentro do viewport nos DOIS eixos e NÃO sobrepõe o toaster nem a TabBar; ancestral com `overflow` ≠ `visible` faz o teste falhar (prova por mutação).

### Implementation

- [ ] T055 [US4] Baixar as pranchetas da fatia C para `design/` e transcrever: 3 frases da confirmação de modo, "Estimar"/"Ajustar", "falta o valor da máquina", a divisão "de {valor} ÷ {horas} h", "Entendi", e a copy do selo compact, para `messages.pt-br.ts`.
- [ ] T056 [US4] `features/calculator/plausibility-store.ts` (Zustand em memória) + refatorar `calculator-form.tsx`: gatilho `onBlur`, `<Aviso role="status">` com "Entendi", erro não desmonta o aviso, `formatBRL` no texto.
- [ ] T057 [P] [US4] `features/calculator/machine-cost.ts` + o bloco em `calculator-form.tsx`: readout com a divisão nos dois modos; ressalva no zero; diálogo de confirmação (`shared/ui/dialog`) na troca de modo; rótulos. `PriceInput` intocado.
- [ ] T058 [P] [US4] `features/calculator/fee-seal.tsx` + `fee-seal-dismiss-store.ts` (`localStorage`, chave de fonte, N recentes): `<Alert compact action="Ver fonte" onDismiss>`; apagar o CSS local do selo que o `--compact` promovido substituiu.
- [ ] T059 [P] [US4] T212 (prancheta: `Calculadora - A Conta e os Precos`, o bloco de preços; conferir no índice remoto se `Kits Mobile` traz variante): `pages/calcular/calcular-page.tsx` + `calcular-page.css`: resumo `position: sticky; top` no topo da coluna do formulário a <1280px, com `data-testid`; conferir que nenhum ancestral tem `overflow` que mate o sticky.
- [ ] T060 [P] [US4] `shared/ui/number-field.tsx`: precisão por campo (tarifa 4 casas na máscara ao vivo); `"0"` → `"0,00"` na hidratação de simulação (`features/scenarios/scenario-bridge.ts`).
- [ ] T061 [US4] gate:all + e2e; screenshots 1:1 (aviso, readout nos dois modos, confirmação, selo compact aberto/dispensado, T212 no meio da rolagem) em `evidencias/pr-c/`; abrir o PR-C (sem ADR para flipar; registrar "sem bump" no corpo).

---

## Phase 7: US5 — Recálculo do Catálogo (P2 · PR-D · **OPUS**) — FEATURE NOVA

**Meta**: observação de preço (servidor, escrita pelo cliente pós-render), preço fixado (número final,
não compõe), unicidade de nome (norm + sufixo silencioso), duplicar, `tf-plist`/`tf-table` na lista.
**Teste independente**: mudar o custo de um filamento ⇒ "N preços mudaram" + "era R$ X" corretos; item
fixado não muda e avisa; desfixar volta; nome repetido recusado no formulário; corrida no servidor
renomeia sem perder; `ProductOut` sem dinheiro calculado (drift-guard).

### Tests (vermelhos primeiro)

- [ ] T062 [P] [US5] `backend/tests/test_migration_0008.py`: round-trip upgrade/downgrade em DB descartável; `price_observations` com `UNIQUE (owner_uid, subject_kind, subject_id)` e CHECKs de dinheiro; `products.seller_fixed_price` nullable com CHECK; `name_norm` NOT NULL + índice único parcial em `filaments/printers/products/boms`; **backfill** de `name_norm` para linhas existentes (asserido).
- [ ] T063 [P] [US5] `backend/tests/test_name_norm.py` + `apps/web/src/shared/lib/name-norm.test.ts`: os dois leem `specs/019-porte-design/contracts/fixtures/name-norm.json` e concordam caso a caso (`ß` incluso: `lower`, não `casefold`).
- [ ] T064 [P] [US5] `backend/tests/test_price_observations.py`: `PUT` em lote upserta por (kind,id); `GET` devolve só a conta; `PUT` com `lapsed` ⇒ 403; `GET` com `lapsed` ⇒ 200; dinheiro negativo/NaN ⇒ 422; o servidor NÃO altera o valor (guarda o que recebeu).
- [ ] T065 [P] [US5] `backend/tests/test_catalog_name_conflict.py`: criar "Gancho" e "gancho " ⇒ o segundo grava "gancho (2)" (200/201, sem erro); **corrida**: duas criações concorrentes do mesmo `name_norm` (threads/asyncio) ⇒ uma "(2)", zero perdidas, zero 500.
- [ ] T066 [P] [US5] `backend/tests/test_products_fixed_price.py`: `PATCH sellerFixedPrice` grava e devolve; `null` desfixa; `ProductOut` NÃO tem nenhum campo de preço calculado; `POST /boms` com produto fixado compõe pelo motor (o fixado NÃO aparece no rollup).
- [ ] T067 [P] [US5] `apps/web/src/entities/catalog/price-observations.test.ts` (NOVO): o `PUT` só dispara DEPOIS do recompute de todos os itens (ordem de chamadas); falha do `PUT` ⇒ a próxima visita repete o aviso; sem observação ⇒ nenhum texto (nem "0 mudaram").
- [ ] T068 [P] [US5] `apps/web/src/features/catalog/products-panel.test.tsx` (casos novos): 12 produtos, 3 com observação ≠ recomputado ⇒ "3 preços mudaram desde a sua última visita" + "era R$ 38,90" + "Salvo em 12/05" (verbatim, formatos pt-BR); item fixado mostra "Preço fixado por você" e o valor do vendedor; `custoHoje > fixado` ⇒ `<Alert tone="warning">`; "Voltar a acompanhar o custo" ⇒ recomputado; nome repetido ⇒ "Este nome já está no catálogo" no campo ANTES do submit; duplicar ⇒ "Gancho (cópia)"; cópia de degradado continua degradada.
- [ ] T069 [US5] `apps/web/tests/e2e/catalog-recalculo.spec.ts` (NOVO, stack real): filamento 100 → produtos → sair/voltar ⇒ nada; editar filamento para 120 → voltar ⇒ contagem e "era" corretos; fixar ⇒ editar filamento ⇒ preço fixado NÃO muda + aviso ATENÇÃO quando custo > fixado; desfixar; nome duplicado recusado; densidade `tf-table` a 1280/1920 contada (itens visíveis sem rolar, antes/depois).
- [ ] T070 [US5] Contrato: regen OpenAPI + Orval (`backend` export + `pnpm gen:api` da RAIZ) e rodar o drift-guard duas vezes (idempotente); asserir que `ProductOut` não ganhou campo de dinheiro calculado.

### Implementation

- [ ] T071 [US5] Migração `backend/alembic/versions/0008_*.py` (aditiva, com backfill de `name_norm`) + modelos em `backend/app/models/__init__.py` (`PriceObservation`, colunas novas, `name_norm`) + **reescrever o comentário FR-310/FR-313** (`:198-204`) com a redação do ADR-0033 §1.
- [ ] T072 [P] [US5] `backend/app/api/price_observations.py` (GET/PUT, portas `require_catalog_read`/`require_entitlement`) + router; `backend/app/lib/name_norm.py` (a normalização) + aplicação nos writes de `catalog*.py` com o sufixo "(2)" em conflito (retry sob `IntegrityError` da corrida).
- [ ] T073 [P] [US5] `catalog*.py` / schemas: `sellerFixedPrice`/`sellerFixedAt` no `PATCH` e no `ProductOut`; nunca um `price`.
- [ ] T074 [US5] Baixar as pranchetas da fatia D para `design/` e transcrever a copy (US13/US14/US15, verbatim) para `messages.pt-br.ts`.
- [ ] T075 [US5] `apps/web/src/entities/catalog/price-observations.ts` (client + hook: ler, comparar com o recomputado, derivar contagem/"era", escrever em lote pós-render) + `shared/lib/name-norm.ts`.
- [ ] T076 [US5] `features/catalog/products-panel.tsx` + `produto-page.tsx`: faixa "N preços mudaram", "era"/"Salvo em" por item, fixar/desfixar, aviso warning, duplicar, validação de nome no formulário; lista mobile em `tf-plist`, ≥1024px em `tf-table`; `kits-panel.tsx` idem para `subject_kind=KIT`.
- [ ] T077 [US5] Aplicar/conferir a Clarification datada na `specs/007-e2-catalog-entitlement/spec.md` (já aplicada pelo plan — conferir que o texto é o do ADR-0033 §5) e registrar a escalação opus no ledger.
- [ ] T078 [US5] gate:all + e2e + drift-guard; screenshots 1:1 (faixa de mudados, item fixado com aviso, `tf-table` 1280/1920, `tf-plist` 390) em `evidencias/pr-d/`; abrir o PR-D e pedir o flip do **ADR-0033**.

---

## Phase 8: US6 — Montar e Enviar (P3 · PR-E · **OPUS**) — FEATURE NOVA, a maior

**Meta**: `computeQuote` 4.2.0; construtor multi-item (venda direta, desconto no total, piso avisa,
"Válido até" texto); Enviar = snapshot `QUOTE` + PDF com bruto→desconto→total. **US18 RETIRADA.**
**Teste independente**: 3 itens × quantidades soma pelo motor com igualdade exata; desconto no limite ⇒
"Abaixo do custo"; enviado resiste a UPDATE; PDF com nome adversarial sem colisão; varredura de
igualdade 4.1.0↔4.2.0 antes do bump.

### Tests (vermelhos primeiro)

- [ ] T079 [P] [US6] `packages/pricing-core/tests/computeQuote.test.ts` (NOVO): vetor numérico (3 linhas × quantidades; `PCT` 10% e `AMOUNT` R$ 10); `grossTotal == bom.precoVarejo`; `netTotal = toMoney(gross − discount)`; `costFloor == bom.custoTotal`; `belowCost` estrito (empate = false); desconto > total ⇒ `ValidationError`; sem `channels` (tipo não aceita); `PRICING_MODEL_VERSION == "4.2.0"`.
- [ ] T080 [P] [US6] `packages/pricing-core/tests/version-equality-4.1-4.2.test.ts` (NOVO): varredura de igualdade — as mesmas entradas em `computeCalculator`/`computeBom` dão os mesmos centavos antes e depois (fixture gravada a partir do 4.1.0 ANTES de tocar o código; a lição do 014/C).
- [ ] T081 [P] [US6] `backend/tests/test_migration_0009.py`: enums `QUOTE`/`PRECO_ORCAMENTO` aceitos; **inserir snapshot QUOTE com `headline_total ≠ payload.totals.precoOrcamento` ⇒ RECUSADO pelo CHECK** (a prova de que o `CASE` foi estendido); linhas existentes intocadas; trigger de imutabilidade continua rejeitando UPDATE em QUOTE.
- [ ] T082 [P] [US6] `backend/tests/test_history_basis_mirror.py`: `set(SnapshotIn.headlineBasis Literal) == set(_BASIS_TOTAL_KEY.keys())`; `POST /history` com `kind=QUOTE` + payload válido ⇒ 201; export PDF de um QUOTE com `discount` traz bruto → desconto → total; sem `discount` não traz.
- [ ] T083 [P] [US6] `apps/web/src/features/history/quote-builder.test.tsx` (NOVO): N itens do catálogo + quantidades; total vem de `computeQuote` (mock do motor observando a chamada — nenhuma soma na tela); desconto % e R$; "Abaixo do custo" (tom warning) quando `belowCost`; item degradado entra com "(avulsa)"; antes de enviar nada congela; "Válido até" é texto com `quoteValidityDays`.
- [ ] T084 [US6] `apps/web/tests/e2e/quote-builder.spec.ts` (NOVO, stack real): montar 3 itens × (1,2,10) → total == soma item a item pelo motor (igualdade); desconto até o piso ⇒ aviso; Enviar ⇒ registro em Orçamentos com `kind=QUOTE`; tentar editar ⇒ imutável; exportar PDF; **nome de item de 300 caracteres sem espaço** ⇒ colunas do PDF não colidem (geometria na página, lição E4/T034).

### Implementation

- [ ] T085 [US6] `packages/pricing-core/src/index.ts`: `computeQuote` (Decimal/toMoney, ADR-0008) + `PRICING_MODEL_VERSION = "4.2.0"` + `package.json` 4.2.0 — **só depois** de T080 verde com a fixture 4.1.0.
- [ ] T086 [US6] Migração `backend/alembic/versions/0009_*.py`: enums + `CASE` do `CHECK headline_matches_totals` estendido no mesmo ato; `backend/app/api/history.py`: `_BASIS_TOTAL_KEY['PRECO_ORCAMENTO']='precoOrcamento'` + `Literal`; exportador: linhas de desconto quando houver.
- [ ] T087 [US6] Baixar `Orcamentos - Montar e Enviar` (dois temas) para `design/` e transcrever a copy (US16/US17 verbatim: "Válido até", "Enviar congela este preço", "Voltar a acompanhar não vale para orçamentos enviados", "Abaixo do custo", as 5 palavras de estado) para `messages.pt-br.ts`. A frase "10 un. sai mais barato que 9" NÃO é transcrita (US18 retirada — nota na prancheta copiada).
- [ ] T088 [US6] `apps/web/src/features/history/quote-builder.tsx` (+ `.css`) e a rota/entrada em `pages/historico/`: seleção de itens do catálogo (produtos e kits), quantidade, desconto (% | R$), readout de bruto/desconto/total/piso, "Válido até", botão "Enviar" que grava o snapshot QUOTE pelo `record-snapshot` existente + abre o export PDF.
- [ ] T089 [US6] Regen OpenAPI + Orval (raiz) + drift-guard idempotente; gate:all + e2e; screenshots 1:1 (construtor 390/1280, aviso de piso, documento enviado, PDF) em `evidencias/pr-e/`; ledger com a escalação opus; abrir o PR-E e pedir o flip do **ADR-0034**.

---

## Phase 9: US7 — Simulações desktop + as divergências (P3 · PR-F)

**Meta**: Simulações ≥1280px (prancheta 20g, mesmo componente); D1 teste de mudança conjunta; D2 chave
única; A11-r medido; Q1/Q2 ao dono no gate.
**Teste independente**: largura útil medida 1280/1440/1920 antes/depois; zero transbordo 2 eixos; D1
vermelho sob mutação de UM texto; mobile idêntico.

### Tests (vermelhos primeiro)

- [ ] T090 [P] [US7] `apps/web/src/shared/i18n/premium-pausado-trio.test.ts` (NOVO, D1): os três textos (`scenarios.*`, `bom.*`, `historico.*` de "Premium pausado") são comparados a um snapshot conjunto — mudar UM sem os outros ⇒ vermelho. Provar por mutação.
- [ ] T091 [P] [US7] `apps/web/src/features/scenarios/rename-key.test.ts` (NOVO, D2): `scenarios-list-sheet.tsx` e `scenario-context-bar.tsx` leem a MESMA chave de i18n para título e rótulo do renomear (asserção por referência de chave, não por texto).
- [ ] T092 [P] [US7] `apps/web/src/features/scenarios/scenarios-wide.test.tsx` (NOVO): com `matchMedia` largo, a lista de simulações é o MESMO componente `ScenariosList` montado no hospedeiro largo (uma instância, sem cópia); com `matchMedia` estreito, a gaveta de hoje; `useIsWide` é o único gate.
- [ ] T093 [US7] `apps/web/tests/e2e/pages-desktop-width.spec.ts` + `overflow-geometria.spec.ts`: Simulações a 1280/1440/1920 — largura útil medida (número antes registrado ANTES da implementação) e zero transbordo nos dois eixos; a 390px screenshot a screenshot idêntico ao baseline (capturar baseline ANTES, como o 018/T001).

### Implementation

- [ ] T094 [US7] Baixar `Simulacoes - A Estrategia Viva` + `As Escritas Congeladas` (dois temas) para `design/`; capturar baseline mobile 390/360 em `evidencias/pr-f/baseline-mobile/` ANTES de tocar código.
- [ ] T095 [US7] `apps/web/src/pages/calcular/calcular-page.tsx` (ou o hospedeiro que a prancheta 20g define): composição ≥1280px montando `ScenariosList` (extraído de `scenarios-list-sheet.tsx` sem duplicar) na coluna larga; abaixo do corte, a gaveta inalterada. Emenda do ADR-0031 é a autoridade.
- [ ] T096 [P] [US7] D2: unificar as chaves de renomear em `messages.pt-br.ts` e apontar as duas folhas para elas.
- [ ] T097 [US7] A11-r: aplicar `tf-table` na lista do Catálogo ≥1024px se a PR-D ainda não aplicou (senão só medir); registrar itens visíveis sem rolar a 1280/1920 antes/depois.
- [ ] T098 [US7] Q1/Q2 DECIDIDAS (27/08): o vazio de busca do Catálogo passa a citar o termo (mesmo molde de `historico.searchEmpty`); a ressalva "pode estar desatualizada" por linha SAI de `catalog-panel.tsx` (fica só a faixa "Modo leitura offline"). Teste: vazio com termo em `catalog-panel.test.tsx`; zero `staleHint` por linha.
- [ ] T099 [US7] gate:all + e2e; screenshots 1:1 (Simulações 1280/1920 dois temas; mobile idêntico) em `evidencias/pr-f/`; abrir o PR-F e pedir o flip da **emenda do ADR-0031**.

---

## Phase 10: Polish & fechamento

- [ ] T100 [P] Rodar o vetor canônico (27,55/41,33/35,82) e o `band-dominance.test.ts` após TODAS as fatias e registrar: nenhum valor existente mudou (SC-007 herdado); `catalogVersion` intocado.
- [ ] T101 [P] Conferir que `apps/web/tests/homologacao/_diag-foco.spec.ts` (obsoleto pela decisão de foco) foi removido ou marcado; e que nenhuma asserção de anel sobrou na suíte.
- [ ] T102 Atualizar `specs/019-porte-design/dod-evidence.md` com as evidências das 6 fatias (V0, PR-A…PR-F), as escalações opus, e fechar o `docs/token-ledger.md` (real vs. estimado por fatia).
- [ ] T103 Registrar em `docs/homologacao/rodadas/` que as 6 fatias estão em **CORREÇÃO DECLARADA** aguardando a Rodada 1 fechar (D5) — sem abrir cenário novo.
- [ ] T104 Confirmar com o dono os 4 flips (ADR-0032 / 0033 / 0034 / emenda 0031) e atualizar `docs/adr/README.md` (índice parado no 0023 — registrar 0024–0034 com status real).

---

## Dependências e paralelismo

```
Phase 1 (V0) → Phase 2 (guardas + transcrição) → Phase 3 (US1) → Phase 4 (US2)  ═══ PR-A
                                                                      │
                     ┌──────────────┬──────────────┬─────────────────┼──────────────┐
                  Phase 5 (US3)  Phase 6 (US4)  Phase 7 (US5, opus)  Phase 9 (US7)  │
                     PR-B           PR-C           PR-D                 PR-F         │
                                                     │                               │
                                                  Phase 8 (US6, opus) — PR-E ←───────┘ (só depende de A e da 0008)
                                                     │
                                                  Phase 10 (Polish)
```

- Dentro de cada fase, os `[P]` são arquivos diferentes sem dependência entre si — podem rodar em
  paralelo (ex.: T011–T016 juntos; T062–T068 juntos).
- **Testes antes**: em cada fase, a seção Tests roda e fica VERMELHA antes da seção Implementation.
- Escalação: T062–T078 e T079–T089 rodam em **opus** (leaf de dinheiro / pricing-core / schema —
  ADR-0022); registrar a escalação no ledger por operação.

## Estratégia de entrega

1. **MVP = V0 + PR-A**: a fundação sozinha já entrega valor (guardas de folha, tom ATENÇÃO, marca,
   vocabulário) e destrava tudo.
2. Depois de A, o dono escolhe a ordem de B/C/D/F pelo valor que quer ver primeiro (recomendação: B).
3. E sai por último e é tudo-ou-nada; a rota de fuga "E vira 020" fica disponível até a T079.
4. Nada fecha antes da Rodada 1: cada PR entrega evidência pronta para a segunda passada do dono.
