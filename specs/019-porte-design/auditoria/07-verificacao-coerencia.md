# Verificação pós-auditoria — parecer 07: coerência entre artefatos (arquiteto, opus)

> 2026-08-27, só leitura. Veredito: **PRONTO COM 24 CORREÇÕES** (9 bloqueiam a PR-B; nenhuma reabre decisão do dono;
> 3 pontos condicionais marcados). As 19+8+5+6+9 tasks novas dos seis pareceres foram todas absorvidas — zero perdidas.
> Diagnóstico: as decisões entraram no `tasks.md` e no `spec.md`, mas os artefatos-autoridade que o executor lê
> ainda dizem o contrário em 14 pontos.

## Contradições residuais entre artefatos

| arquivo:linha | diz | deveria dizer (fonte) | sev. |
| --- | --- | --- | --- |
| `contracts/ui-porte.md:65-66` | "Aberto ao gate da PR-B: visitante DESLOGADO… default (a)" | E-5 TOMADA: mesmo caminho sem parede (spec §Clarifications, FR-1906, T044/T048) | ALTA |
| `plan.md:110-112` | Constituição VIII "um ponto ainda aberto… E-5… default (a)" | zero pontos abertos; citar a Clarification de 27/08 | ALTA |
| `ui-porte.md:51` + tabela `:56-60` | `premiumGate` de 4 estados com `lapsed-com-itens`, sem deslogado | união de CINCO: `active \| lapsed \| free-nunca-teve \| signed-out \| unknown`; "-com-itens" é composição da tela (T036) | ALTA |
| `data-model.md:118` | mesma união de 4 | idem | ALTA |
| `research.md:248-250` | "nomes finais: active · lapsed-com-itens · free-nunca-teve · unknown" | idem + nota da E-5 | ALTA |
| `research.md:317-318` (§H) | store do "Entendi" em `features/calculator` | `shared/lib/plausibility-dismiss-store.ts` (`plausibilidade.ts:26-29`, `eslint.config.mjs:83`; T050/T056) | ALTA |
| `data-model.md:117` | "store em memória (`features/calculator`)" | idem `shared/lib` | ALTA |
| `docs/adr/0034:147-172` (§3) | "Ponto ABERTO, roteado ao dono — Q9 × Q6" com 3 opções vivas | RESOLVIDO: US18 retirada (spec `:53`, FR-1918, research §D-3, T087) | ALTA |
| `docs/adr/0034:130` | "`lines[]` … a forma que o PDF já lê" | FALSO: `quote_render.py:202` lê `line.totals[key]`; ramo QUOTE novo (`data-model.md:82-84`) | ALTA |
| `docs/adr/0034:83,:131` | `discount.value: number` sem dizer a fronteira | no DOCUMENTO todo dinheiro (incl. `value`) é STRING (`validation.py:106-110`); a entrada do motor pode ser number — dizer onde a fronteira está | ALTA |
| `contracts/api-019.md:63` | payload QUOTE traz `quoteValidityDays` | sai do payload (coluna `models:652`); entram `modelVersion`/`schemaVersion`; dinheiro string | ALTA |
| `contracts/api-019.md:48` | "`POST/PATCH … { name }`" | `POST/PUT`; o `PATCH` novo é de UM campo (`name` ⇒ 422) | MÉDIA |
| `docs/adr/0032:191-192` | "a PR-A porta os primitivos sem tocar em `:focus-visible` (F-1)" | contradiz o §7 (`:167`, F-2 resolvido) e a T029 executada | MÉDIA |
| `spec.md:86-87` (US1 AC2) · `ui-porte.md:25` · `tasks.md` T016/T017 · `quickstart.md:31` | "`background: var(--bg-muted)`" e contraste "≥5,67 / ≥18,23" | o produto usa `--border-subtle` (`frozen.css:3-10`, razão medida) e a guarda asseriu AA 4,5:1 (T016) — AC/SC que o dono reverifica na segunda passada: hoje reprovariam por TEXTO | ALTA (homologação) |
| `research.md:100` (§B) | "Proíbe: segundo `matchMedia`, limiar diferente" | proíbe limiar SEM NOME fora de `use-is-wide.ts`; a emenda 2 (T130) autoriza `LIST_DENSE_QUERY` 1024 | MÉDIA |
| `ui-porte.md:101` (§C6) | "Mesmo limiar (1280px)…" sem hospedeiro | DECISÃO 2: coluna larga de `/calcular`; 1024 e 1280 nomeados na emenda 2 | MÉDIA |
| `ui-porte.md:104` | "D1: um só dos três textos" | SETE chaves nomeadas (T090) | MÉDIA |
| `ui-porte.md:74` · `quickstart.md:33` | "troca de modo ⇒ confirmação antes de descartar" | só em "Usar estimativa por ritmo" quando `detectRitmoMode(currentHours) === null`; "Ajustar" nunca pergunta (T051/T057) | MÉDIA |
| `docs/adr/0033:113` (§2) e §4 | `observed_at` sem dizer quem carimba; sem tetos; sem `_dedup_match` | servidor carimba `now()`; lote 500; nome 120; `_dedup_match` por `name_norm` (T129 emenda o 0017 — nada emenda o 0033) | MÉDIA |
| `quickstart.md:32` | SC-1903 = diff vazio só em `app/entitlement` | QUATRO caminhos contra `origin/develop` + `test_entitlement_gate.py` (T047) | MÉDIA |
| `plan.md:161` | `app/api/catalog*.py` | não existe; 8 sítios (T072) | BAIXA |
| `plan.md:50` | "Duas chaves novas de localStorage… e nada mais" | uma FAMÍLIA de chaves (dispensa do selo, 50 recentes) | BAIXA |
| `plan.md:60` | "desktop ≥1280px" | 1280 e 1024 nomeado | BAIXA |
| `analise-implementabilidade.md:91` | "tasks marcadas ⛔ DONO" | nenhuma; decisões tomadas | BAIXA |
| `tasks.md` T095 | "monta `ScenariosList`" | `ScenariosList` não existe — T092 extrai `ScenarioListBody` para export; T095 monta esse | MÉDIA |

## Ordem/dependências

- **T130 está DEPOIS de T076 — inverter**: a T076 cria `useIsListDense()` e o §Emenda 6 vigente do ADR-0031 proíbe "abrir um segundo gate"; enquanto a emenda 2 não existir, a T076 é violação escrita do VIII. T130 = primeira task de Implementation da Phase 7.
- **T084** não declara depender de T086 (0009 + rotas) e T088 (o construtor) — declarar.
- **T083** depende também de T133; **T133/T135 estão em "Tests" mas editam produção** — declarar "tipo + teste no mesmo commit, vermelho antes" ou mover.
- T080→T085 ✔; transcrição primeiro ✔; T096 retirada e não referenciada ✔; T138 inexistente (nada referencia) ✔.
- **17 IDs vagos** (T110, T113, T116, T117, T119–T123, T126, T128, T132, T134, T136–T138) — registrar "numeração absorvida" para um retomador não achar que se perdeu task.
- **`[P]` falsos**: T037/T038/T106 (mesmo `catalog-panel.test.tsx`); T072/T073 (mesmo `products.py`, ambos após T071); T057 edita `calculator-form.tsx` depois de T056.
- Diagrama ✔ (a nota "NÃO de F" ficou na coluna da Phase 9 em vez da 8).

## Ambiguidades residuais (task → frase que fecha)

1. **T085/T079 — `computeQuote` devolve número ou string?** → devolve NÚMEROS (`toMoney(): number`, `index.ts:483`, `rounding.ts:11`); a conversão para STRING acontece só na montagem do payload congelado no cliente (`frozen-payload.ts`), porque `validation.py:106-110` rejeita float.
2. **T041 × T037/T045 — quantos convites com o formulário inerte aberto?** → único POR ESTADO RENDERIZADO: com o formulário aberto, o `TeaserUpgrade` do vazio não é renderizado e o rodapé é o único; contagem `== 1` asserida nos DOIS estados, a 390 e a 1920 (`teaser-sweep.spec.ts:40`). (Se o dono preferir os dois visíveis, a SC-006 muda junto.)
3. **T044/T040 — deslogado na aba Produtos**: `router.tsx:115-117` exige conta com `?produto=` e o `beforeLoad` não muda → o inerte é alcançável em Filamentos/Impressoras/Kits; em Produtos o clique leva a `/sign-in?redirect=…` — a T040 asserta isso nominalmente.
4. **T067/T124 — "todos os itens" com um degradado na lista** → "todos os RECOMPUTÁVEIS"; o degradado fica fora do lote e não impede o PUT.
5. **T065 — como a corrida é forçada** → conexão psycopg direta insere a linha concorrente e mantém a transação ABERTA; o `POST` do `TestClient` bloqueia no índice único e, ao COMMIT, recebe `IntegrityError` e renomeia — determinístico.
6. **T038/T090 — apagar `catalogo.lapsedTitle/lapsedBody`?** Há um 2º consumidor: `produto-page.tsx:289-291` → a T038 remove as DUAS faixas e apaga as chaves; a T090 vigia as SEIS restantes.
7. **T043 — `GateChecking`/`GateError`** → as 4 telas mantêm os próprios; `premiumGate` devolve `unknown`; unificação = follow-up declarado.
8. **T068 — `fmtDate`** → promover `fee-seal.tsx:40-43` a `shared/lib/format-date.ts`.
9. **T076 — `rowPrice/rowWas/rowFlag` em filaments/printers** → `undefined`; o `<Plist>` renderiza sem a coluna; teste de AUSÊNCIA.
10. **T059 — se a prancheta implicar MOVER o `.tf-calc-footer` no DOM** → a task PARA e vai ao dono (mudança estrutural mobile fora do `sticky`).
11. **T046 — qual vazio de Kits** → UMA frase (T042) para `/catalogo?tab=kits` e `/kits`; em `/kits` quando o composer está sem linhas e sem kit.

## Cobertura

- FR-1901…1920 e SC-1901…1909: todos com task. US3–US7 com checkpoint.
- **LACUNA ALTA**: testes existentes que a PR-B vira vermelhos e nenhuma task adota: `pages/bom/bom-teaser.test.tsx:83-87,106-110,117`, `pages/bom/bom-page.test.tsx:630-644`, `pages/bom/bom-save.test.tsx`, `pages/catalogo/catalogo.test.tsx:185-197`, `features/catalog/products-panel.test.tsx:165-175`, `pages/historico/historico.test.tsx`, `features/scenarios/save-scenario-sheet.test.tsx` (conferir). Sem task-irmã da T105, a PR-B nasce vermelha e mistura asserção com produto (R3/§J).
- **MÉDIA**: `produto-page.tsx:289-291` (faixa lapsed da ficha) sem task.
- **MÉDIA**: brief US13 AC5 "O cálculo continua grátis" (`scope-brief.md:284`) sem chave na T074.
- **BAIXA**: "produto FIXADO entra pelo preço do MOTOR" tem teste (T083) mas a T088 não repete a regra.

## Princípio VIII

(a) `useIsListDense()` antes da emenda — corrigido pela inversão T130/T076; (b) T043/T068 — frases 7 e 8; (c) T059 — verbo de parada; (d) `app/lib` com contrato ✔.
