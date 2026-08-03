# F05 — Auth, dados e segurança

## Resumo

**Nenhum vazamento entre contas.** Varri as **31** consultas de `app/api`, `app/services` e
`app/billing`: 25 filtram por dono na própria consulta, e as 6 restantes foram examinadas uma a uma —
4 são de billing (resolvidas por referência do PSP, sem uid, e é o desenho correto) e 2 são de
`bom_lines`, cuja proteção é **herdada do pai** e cuja disciplina eu verifiquei em **todos os três
chamadores**. O cliente não carrega segredo nenhum: tudo é `VITE_*` (público por natureza), nenhum
`.env` é versionado, e o `.env.example` avisa por escrito. A minimização de PII no billing é real —
o `raw` do PSP passa por lista branca antes de persistir.
**Um achado ALTO**: **não existe exclusão de conta** — nem rota, nem CLI, nem procedimento. Para um
produto brasileiro que coleta e-mail e referência de pagador, isso é obrigação legal ausente, não
recurso faltando.

---

## Isolamento entre contas — tabela a tabela

O equivalente local do RLS é o filtro por `owner_uid`/`account_uid` na consulta, mais os dois portões
de entitlement. Não há RLS no Postgres (a decisão de arquitetura é FastAPI + SQLAlchemy, ADR-0013).

| tabela | coluna de dono | como é isolada | veredito |
| --- | --- | --- | --- |
| `accounts` | `account_uid` (PK) | provisionada JIT a partir das claims verificadas | ✅ |
| `entitlement_grants` | `account_uid` | toda leitura filtra; escrita só por CLI de operador e `grant_writer` | ✅ |
| `filaments` | `owner_uid` | 2 selects, 3 filtros | ✅ |
| `printers` | `owner_uid` | 2 selects, 3 filtros | ✅ |
| `products` | `owner_uid` | 6 selects, 8 filtros | ✅ |
| `boms` | `owner_uid` | 6 selects filtrados; `_owned()` devolve **404** para dono errado (não 403 — não confirma existência) | ✅ |
| `bom_lines` | — (filha de `boms`) | **herdada**: as 2 consultas filtram por `bom_id`, e o `bom_id` sempre vem de uma consulta já filtrada | ⚠️ ver [F05-002] |
| `snapshots` | `owner_uid` | 3 selects, 6 filtros | ✅ |
| `scenarios` | `owner_uid` | 4 selects, 7 filtros | ✅ |
| `subscriptions` | `owner_uid` | resolvida por `uid` do token na leitura; por `mp_preapproval_id` no webhook (SEC-204 — server-side, sem campo forjável) | ✅ |
| `billing_events` | — (filha de `subscriptions`) | resolvida via `subscription_id`, e a assinatura veio do PSP | ✅ |

**O que verifiquei além da contagem**: as 6 consultas sem filtro de dono no bloco, uma a uma.

- `grant_writer.py:54` — resolve a assinatura por `mp_preapproval_id`. **Correto por desenho**: o
  webhook não tem uid, e a resolução server-side por referência do PSP é exatamente o que a SEC-204
  manda (nunca por campo do corpo).
- `grant_writer.py:220`, `subscription.py:103` — filtram por `subscription_id` de uma assinatura já
  resolvida. ✅
- `reconcile.py:37` — varre todas as assinaturas não-terminais. É um job em lote. ✅
- `boms.py:264` e `:378` — ver [F05-002].

## Segredos e configuração do cliente

| verificação | resultado |
| --- | --- |
| `.env` versionado | **nenhum** — só `apps/web/.env.example`, com valores `demo-*` |
| o `.env.example` alerta? | sim, por escrito: *"All VITE_\* vars are public (shipped to the browser) — never put secrets here"* |
| segredo de servidor no cliente | **nenhum** — grep por `secret`/`service.role`/`private.key` em `apps/web/src` volta vazio |
| o que o cliente lê de env | só `VITE_*`, validado por Zod (`shared/lib/env.ts`) — chave do Firebase (pública por natureza), URL da API, DSN do Sentry |
| segredos do servidor | `SecretStr` no `settings.py` (token do MP, segredo do webhook, ids de plano) |

## Minimização de PII (LGPD, o lado que ESTÁ feito)

Dado pessoal existente no banco, inventariado:

| dado | onde | observação |
| --- | --- | --- |
| e-mail | `accounts.email` | vem das claims verificadas do Firebase |
| referência do pagador | `subscriptions.payer_ref` | documentado como identificador mínimo do MP — *"Never a name/CPF/address"* (`models:818`) |
| recurso do PSP | `billing_events.raw` | **podado por LISTA BRANCA** antes de persistir (`mercadopago.py:61`) — o payer é reduzido ao id; e-mail, documento, endereço e dígitos do cartão são descartados **antes** de o escritor ver |

A poda por lista branca é a forma certa: uma lista negra deixaria passar todo campo novo que o MP
inventasse. **Não há coluna de dinheiro ou de cartão em `subscriptions`** (VR-701).

---

## Achados

### [F05-001] Não existe exclusão de conta

- **Severidade**: **Alto**
- **Bloqueia provisionamento**: **depende de decisão** (ver abaixo) — tecnicamente não impede cobrar,
  legalmente é obrigação de quem cobra.
- **Certeza**: 95% (busca por rota, CLI e procedimento; ver §Não verificado)
- **Local**: ausência — `backend/app/api/` não tem rota de exclusão; `backend/app/scripts/` tem
  `grant_premium.py` e `reconcile_subscriptions.py`, e nada mais.
- **Origem**: `develop` (nunca existiu)

O produto coleta **e-mail** e **referência de pagador**, e vai passar a cobrar de brasileiros. A LGPD
dá ao titular o direito de eliminação (art. 18, VI). Hoje não há:

- rota autenticada de exclusão,
- CLI de operador para atender um pedido manual,
- procedimento escrito de como atender um pedido.

**O que existe e ajuda**: `deleted_at` em `boms`, `products`, `scenarios`, `subscriptions` — mas é
**soft-delete de item**, não eliminação de titular, e o `accounts` não tem sequer isso.

**O que agrava**: o histórico é **imutável por gatilho PL/pgSQL** (ADR-0019). Uma exclusão de conta
vai esbarrar nisso, e a resposta não é óbvia — é decisão de produto e jurídica ao mesmo tempo
(anonimizar o snapshot? excluir a conta e manter o registro contábil? o que a legislação fiscal
exige reter?). **Descobrir isso no dia do pedido é o pior momento.**

**Bloqueia provisionamento?** Eu não decido. Registro o que medi: o produto vai cobrar de pessoas e
não tem como excluir os dados delas. → `PENDENCIAS.md` §P-010.

### [F05-002] O isolamento de `bom_lines` é herdado, não imposto

- **Severidade**: **Baixo** (observação de robustez — **não há defeito hoje**)
- **Bloqueia provisionamento**: **não**
- **Certeza**: 100% (verifiquei os três chamadores)
- **Local**: `backend/app/api/boms.py:260` (`_lines_of`) e `:368` (`_lines_by_bom`)

As duas consultas de linha filtram por `bom_id` e **não** por `owner_uid`. Isso é seguro **hoje**
porque os três chamadores resolvem o kit antes:

- `:563` — `list_boms`, que filtra `Bom.owner_uid == uid`
- `:604` — `_rendered`, que recebe um `Bom` já resolvido
- `:636` — precedido de `bom = await _owned(session, uid, bom_id)`

**O risco não é atual, é de manutenção**: um chamador futuro que busque um kit por id sem passar pelo
`_owned` vaza as linhas de outra conta, e nenhuma consulta reclama. As demais tabelas do vendedor não
dependem de disciplina — elas carregam o filtro. Esta é a única exceção.

---

## Não verificado nesta fase

1. **Se existe procedimento de exclusão FORA do repositório** (um runbook, um acordo com o dono).
   `[F05-001]` afirma a ausência **no código**; a pergunta está em `PENDENCIAS.md` §P-004 e §P-010.
2. **Validação server-side campo a campo** — confirmei que os endpoints validam via Pydantic/
   `validation.py` e que `import-linter` mantém os validadores como folha sem dependência, mas não
   percorri cada campo de cada payload. Volume, não incerteza; cabe na F10.
3. **Rotação de segredo do webhook** — o segredo é por ambiente (`SecretStr`), mas não há
   procedimento de rotação escrito. Adjacente ao runbook de revogação que o parecer do `seguranca`
   exige para a fatia ML (condição 8), e que também está pendente.
4. **A superfície de autenticação em si** (Firebase, verificação de token) — `app/auth.py` foi lido
   apenas o suficiente para confirmar que `current_claims` é a fonte do uid. Uma auditoria do fluxo
   de token (expiração, revogação, troca de aparelho) não coube nesta fase.
