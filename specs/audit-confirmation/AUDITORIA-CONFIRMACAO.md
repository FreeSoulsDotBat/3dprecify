# Auditoria de Confirmação pós-v1 — 2026-07-23

**Insumo**: `develop` com 013 (audit remediation, #29) + 012 E6 PR-A (billing, #28) mergeados = v1 completo (E1–E6).
**Forma**: 6 lentes adversariais read-only (a mesma análise que gerou `AUDITORIA.md`), consolidadas aqui. Lentes individuais em `lenses/L{1..6}-*.md`.
**Método**: cada achado carrega evidência arquivo:linha e `[VERIFICADO]`/`[INFERIDO ~X%]`; os load-bearing foram re-conferidos na main-loop pela leitura direta do código, não pela palavra do agente.

---

## Veredito

**A remediação 013 é REAL e sólida: L1 verificou 24/24 claims CORRIGIDO/TESTE-GUARDA independentemente; nenhum Crítico; a camada de dados backend está limpa; o merge 013→E6 não enfraqueceu o billing; nenhum teste auto-consistente-errado.** MAS a auditoria de confirmação achou **1 Alto de dinheiro silencioso** (numa mudança do próprio 013) + 1 Médio de honestidade (uma lacuna do próprio 013 que a homologação T034 não pegou) + os itens de billing pré-cutover (Onda 2, diferidos por design) + 1 residual de parser.

**Não está "tudo certo" — está quase, com 1 Alto que precisa de fix antes de v1 sair.**

---

## Achados novos (ranqueados)

### [F1] **ALTO** — override de "Taxa fixa" num slot Shopee zera silenciosamente a comissão · [VERIFICADO]
`apps/web/src/features/calculator/calculator-model.ts:195` — `commissionOverridden = edited.commissionPct !== undefined || edited.fixedFee !== undefined`. Digitar SÓ `fixedFee` num slot Shopee coberto derruba os `priceBands`; mas o `commissionPct` top-level da entry Shopee é `null` (`seed.ts:30`; a comissão vive nas bands) e `entryToChannelFees` faz `entry.commissionPct ?? 0` (`fee-prefill.ts:83`) → o gross-up cobra **0%** em vez de 14–20%. Entrada: Shopee, `fixedFee="4"` → anúncio 46,98 / comissão 0 / líquido 22,98, vs. correto (band) anúncio 58,73 com 20% → líquido superestimado **~R$9–12**. Selo diz "ajustado", o colapso é invisível. UI-alcançável (campo renderizado p/ todo marketplace), NÃO pinado por teste (só freightCost-only e commissionPct-only são testados). **Causa raiz**: a decisão do dono (2026-07-23) foi "digitou COMISSÃO → bands caem"; a implementação estendeu a fixedFee, e como Shopee não tem comissão top-level, cai a 0. **Fix**: `commissionOverridden = edited.commissionPct !== undefined` (uma linha) + teste do caso fixedFee-only (bands mantidas, comissão da band, nunca 0). Restaura a decisão real do dono.

### [F-lapsed] **MÉDIO** (honestidade) — `ProductsPanel` não passa `lapsed` · [VERIFICADO]
`apps/web/src/features/catalog/products-panel.tsx` chama `<CatalogPanel>` SEM `lapsed` (os irmãos filaments/printers passam — `filaments-panel.tsx:45`). Consequência na aba Produtos de uma conta lapsed: (a) o Excluir abre o **confirm destrutivo funcional que só 403-a no submit** — exatamente o nit que 013/T034 afirma ter corrigido (o fix em `catalog-panel` nunca engatou p/ products, o flag nunca foi passado); (b) sem banner "Premium pausado"; (c) sem hint read-only. Add/edit SÃO honestos (navegam p/ o ProdutoPage read-only). Servidor 403 ainda enforce → sem risco de dado/dinheiro; é defeito de honestidade. **Pré-existente no 013** (verificado byte-idêntico no merge 42cc45c); escapou porque os testes lapsed só exercitam a aba filaments default. **Fix**: passar `lapsed` em products-panel (uma linha, espelha os irmãos) + teste da aba Produtos lapsed.

### [F2] **MÉDIO** — parser: `0.125` (ponto + 3 decimais) → 125 · [VERIFICADO]
`decimal-ptbr.ts` — a regex de milhar `^\d{1,3}(\.\d{3})+(,\d+)?$` engole qualquer `d.ddd`: `0.125` casa como milhar → "0125" → 125. É a extensão do tradeoff DOCUMENTADO `1.500`≡1500 (pt-BR vence), mas para um decimal en-US de 3 casas (ex. `0.125` kW) produz número finito errado sem erro — a classe FA-01, residual. Tende a ser alto/absurdo (loud), mas silencioso. Todos os outros adversariais (`1.2.3`, `1e3`, fullwidth, `5x3`, empty) rejeitam corretamente. **Decisão do dono** (é refinamento da gramática de dinheiro): manter o tradeoff documentado OU afiar a regra (ex. um grupo líder "0" não é milhar). Não altero a gramática de dinheiro sem sign-off.

### [L2-N1] **MÉDIO (pré-cutover)** — evento `payment` sem `period_end` → grant PERPÉTUO · [VERIFICADO mecanismo]
`providers/mercadopago.py:172` `period_end = _parse_dt(period_end or next_payment_date)` (→ None se ambos ausentes); `grant_writer.py:84` grava `expires_at=period_end`; `entitlement/__init__.py:65` trata `None` como ativo para sempre. Um `authorized_payment` aprovado sem esses campos → premium vitalício sem caminho de expiração/revogação (refund é PR-B). Não dispara no stub (sempre seta 30d); silencioso contra MP real. **Fix (pré-cutover)**: payment grant DEVE exigir `period_end` não-nulo — senão 422/deny.

### [L1-01 / L3] **BAIXO** — docstring de `resolveSlotFees` contradiz o código · [VERIFICADO]
`calculator-model.ts:164-172` — o docstring da função ainda descreve "typed commission neutralized by preserved bands" (comportamento PRÉ-decisão); o comentário inline (:186-192) e o código implementam o oposto (comissão digitada DERRUBA bands). Cosmético, comportamento correto — mas é a classe "comentário enganoso" que a auditoria nomeou como risco sistêmico nº 1. **Fix**: reescrever o docstring (será tocado junto do F1). 

### [L6-01] **BAIXO** — `test_migrations.py` `_OWNED_TABLES` sem as tabelas E6 · [VERIFICADO]
Quando o 0005 mergeou, a nota-de-follow-up do próprio T051 (adicionar `subscriptions`/`billing_events`) ficou por fazer. LOW porque o round-trip roda o downgrade do 0005 indiretamente, mas a asserção explícita deve incluí-las. **Fix**: adicionar as 2 tabelas.

### [F3 / info] **BAIXO** — trap `commissionPct ?? 0` dormente
O único entry null-commission (Shopee) tem bands que cobrem o 0; mas o schema permite `null` e a validação de boot não pega. Uma entry futura não-band curada com comissão nula → 0% selado como "referência". Relevante para o incremento **014** (curadoria ML/Amazon). Já registrado em `us8-fee-proposal.md §10`.

### Info — string órfã `billing.openingCheckout` (definida, não usada).

---

## Onda 2 (billing pré-cutover) — AINDA ABERTAS, por design

Diferidas pelo PLANO-CORRECAO ao gate MP-live, NÃO regressões:
- **E6-01** (Médio, L2+L6 cross-confirmado): assinatura testada circularmente — stub, teste e prod re-codificam a MESMA crença sobre o manifesto do MP; nenhum vetor real capturado; o ramo `.lower()` de id alfanumérico nunca exercitado. **Gate #1 do cutover.** Se a canonicalização real do MP divergir, prod rejeita 100% dos webhooks com 401.
- **E6-02** (Médio): `data.id` lido do body, não do query param. Não é bypass de forja (sem secret não há HMAC); é falsa-rejeição/disponibilidade.
- **E6-04** (Médio): preço i18n vs plano MP sem guarda. Smoke de deploy.
- **E6-05** (Baixo): sem sinal de billing-não-configurado no boot/health.

---

## O que a confirmação ABSOLVEU com evidência

- **24/24 remediações 013 verificadas** (L1) — parser estrito + afixo ancorado, F-02 rotas migradas, FB-02 lapsed ligado, ceilings 422-nunca-500 nos 6 routers.
- **Vazamento cross-account (E2-03) fechado EM TODO LUGAR** (L1+L5 independentes) — `owner_uid` no `_live_links` e em todo path de resolve (scenarios/boms/history owner-scoped).
- **Camada de dados backend limpa** (L5) — head único de migração, `validation.py` totalmente adotado, contratos import-linter 5/5.
- **Merge 013→E6 não enfraqueceu billing** (L2) — CORS não afeta webhook (server-to-server), `/conta?checkout=retorno` funciona, ambos os contratos import-linter HOLD.
- **Billing security fresh** (L2) — constant-time, verify-before-lookup, inbox exactly-once, frescor 300s, dois-guards sandbox↔prod, SecretStr sem log, minimização LGPD, grant append-only.
- **Testes genuinamente mordem** (L1+L5+L6) — providers.test purge por-chave, parser pina o reject-list estrito, migração round-trip; **nenhum auto-consistente-errado**.
- **Debris estrutural limpo, cobertura honesta** (L6) — 10 ícones removidos grep-verificados, zero TODO/FIXME, cobertura 86,85%/84,03% real.

---

## Recomendação

**Antes de v1 sair:** corrigir **F1 (Alto)** — uma linha + teste; e **F-lapsed (Médio)** — uma linha + teste (fecha a lacuna que a homologação T034 não pegou). **L1-01 + L6-01** (Baixos) vão junto, triviais.

**Gate MP-live (cutover):** E6-01 (vetor real do MP — gate #1) + E6-02 + E6-04 + L2-N1 (`period_end` não-nulo). Já eram Onda 2.

**Decisão do dono:** F2 (afiar a gramática do parser p/ `d.ddd` ou manter o tradeoff documentado) + F3 (o trap null-commission entra no 014).
