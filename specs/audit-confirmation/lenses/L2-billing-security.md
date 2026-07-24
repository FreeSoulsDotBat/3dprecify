# Lens 2 — Billing / Security (auditoria de confirmação, 2026-07-23)

Escopo: domínio E6 (PR-A #28) sobre `develop`, pós-013. Read-only. **Contexto**: o billing roda contra o STUB (`tests/mp_stub/stub.py`); o MP real foi diferido para v1 (SEC-405). Não há webhook público live — **nada aqui é explorável por atacante externo HOJE**; achados são condições **pré-cutover** salvo indicação.

## 1. Onda-2 diferidas — re-verificadas no código mergeado

### [E6-01] Assinatura testada circularmente · Médio (pré-cutover) · [VERIFICADO] · AINDA ABERTO
Prod monta o manifesto com `data_id.lower()` (`backend/app/billing/signature.py:30-32,57-58`); o teste frozen `_sign` monta **sem** `.lower()` (`test_billing_security.py:74-76`) e o stub **com** (`stub.py:140-141`). Todos os `data_id` de teste são numéricos → `.lower()` no-op → as três strings coincidem; nenhum caminho de teste computa o HMAC diferente da produção. Continua auto-referencial; o ramo mais frágil (lowercasing de id alfanumérico, ex. preapproval) nunca é exercitado com caso divergente. Gate §8.1 (known-good MP vector) **não satisfeito**. Falha: se a canonicalização real do MP divergir, prod rejeita 100% dos webhooks com 401 e só a reconciliação salva o vendedor. Fix: fixar 1 vetor real do simulador MP + 1 caso alfanumérico maiúsculo.

### [E6-02] `data.id` lido do body, não do query param · Médio (pré-cutover) · [VERIFICADO] · AINDA ABERTO
`backend/app/api/billing.py:78-80` lê `data.id` do corpo. O contrato MP usa o `data.id` do **query parameter**. **Não é bypass de forja** (sem secret não há HMAC válido — o INFERIDO ~55% original superestimava). Risco = correção/disponibilidade: body ≠ query → 401 → retries → reconcile cura. Fix: extrair de `request.query_params` com fallback ao body.

### [E6-04] Preço exibido vs cobrado sem guarda · Médio (pré-cutover) · [VERIFICADO] · AINDA ABERTO
Exibido em `apps/web/src/features/billing/billing-plans.ts:16-31`; cobrado = plano MP via `settings.mp_plan_id_*` (`api/billing.py:136-138`). Duas fontes à mão, zero guarda entre a string i18n e o preço configurado no MP. Fix: smoke de deploy comparando `unit_price` do plano MP com a constante i18n.

### [E6-05] Billing "não-configurado" sem sinal operacional · Baixo (pré-cutover) · [VERIFICADO] · PARCIAL
API honesta: checkout sem plan_id → 503 (`api/billing.py:161-167`); webhook sem secret → fail-closed 401 (SEC-403). Mas **nenhum sinal no boot/health** — `lifespan` (`main.py:34-37`) só faz `init_firebase`. Ambiente sobe "saudável" com billing morto. Fix: log de boot `billing_configured=false` ou campo no `/health`.

## 2. Auditoria fresh

**Absolvidos com evidência [VERIFICADO]**: constant-time `hmac.compare_digest` (`signature.py:59`); verify-before-lookup (verify → live_mode → lookup, zero DB/MP antes); inbox `billing_events.event_key` UNIQUE + `on_conflict_do_nothing`, grant só `if inserted` (`grant_writer.py:63-77`); frescor 300s simétrico; dois-guards sandbox↔prod + 3º guard base-url prod (`settings.py:55-63`); segredos `SecretStr|None` default None, sem log no pacote billing; minimização `_prune_raw` whitelist (`mercadopago.py:48-72`); grant append-only na mesma transação; derivação de entitlement pura sem vazar `granted_by`; VR-710 (CLI rejeita `source=payment`).

### [L2-N1] NOVO — evento `payment` sem `period_end` cunha grant PERPÉTUO · Médio (pré-cutover) · [VERIFICADO mecanismo]
`normalise_authorized_payment` (`mercadopago.py:162-180`) retorna `VerifiedEvent` mesmo com `period_end=None`; `grant_writer.py:80-84` grava `EntitlementGrant(expires_at=None)`; `entitlement/__init__.py:65` trata `expires_at is None` como **ativo para sempre** (mesma semântica dos `comp`/`beta` vitalícios). Um `authorized_payment` aprovado sem `period_end`/`next_payment_date` parseável → premium vitalício; refund/chargeback é PR-B (`grant_writer.py:53-55` só trata `kind=="payment"`), então esse grant não tem hoje caminho de expiração/revogação. Não explode no build (stub sempre seta 30 dias); contra MP real é silencioso. Fix: um payment grant DEVE exigir `period_end` não-nulo — senão 422/deny, nunca expiry-null.

### [L2-N2] info — `live_mode` lido do body (`api/billing.py:94`)
Aceitável como defesa-em-profundidade (assinatura verificada antes). Sem ação.

**Fraquezas de teste (Baixo)**: SEC-107 constant-time verificado por grep de substring (trocar por `==` passaria — T-05 confirmado); SEC-101 assere "zero grants" mas não "zero chamadas MP".

## 3. Integridade do merge 013 → E6 — **NÃO enfraqueceu o billing** [VERIFICADO]
- **CORS** (restrito em 013, `main.py:82-99`): webhook é server-to-server, CORS não se aplica; checkout (browser POST) tem POST + Authorization + Content-Type presentes.
- **Router**: `_back_url` monta `/conta?checkout=retorno` (1 segmento + query); front trata em `pages/conta/conta-page.tsx:186-192`. Retorno funciona.
- **Import-linter — ambos HOLD**: "api → billing → models" e "Financial validators leaf" (grep=0 em ambos).

**Nenhum Crítico, nenhum Alto, nenhum bug explorável no build atual.**

**Gate #1 do cutover MP-live**: o caminho de assinatura nunca foi provado contra um vetor real do MP (E6-01+E6-02+lowercasing). Capturar 1 vetor real do simulador é o gate #1, junto com o cross-check de preço (E6-04) e o guard de `period_end` (L2-N1).
