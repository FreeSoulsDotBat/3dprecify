# F04a — Entitlement e ledger

## Resumo

A derivação do ADR-0012 está **exata** (`entitlement/__init__.py:64-66`): ativo = existe grant não
revogado com expiry nula ou futura. O portão é server-side de verdade, o cliente nunca é consultado,
e não há rota HTTP que conceda grant. Matriz de 8 estados montada e conferida.
**Um achado ALTO, provado por execução**: o `expiresAt` que a API reporta é o do grant **concedido
por último**, não o que **expira por último** — medi **370 dias** de diferença num caso construído.
Isso (a) diz ao vendedor que o premium acaba antes do que acaba, e (b) **desliga de forma
determinística** a linha da §4.3 que o dono ratificou em 2026-08-02, porque o comparador que eu
mesmo escrevi assume — por escrito, e errado — que o campo é o mais distante.

---

## A derivação está correta

`backend/app/entitlement/__init__.py:55-70`:

```python
grants = todos os grants da conta
if not grants:                    -> "none"
active = [g for g in grants if g.revoked_at is None
                            and (g.expires_at is None or g.expires_at > now)]
if not active:                    -> "lapsed"
                                  -> "active"
```

Bate com o ADR-0012 e com o docstring do modelo (`models/__init__.py:92-93`). Três propriedades:

- **Avaliada AGORA, nunca cacheada** (`:63`, `datetime.now(UTC)`) — não há campo derivado
  persistido que possa divergir do ledger.
- **`expiry` nula = sem prazo**, e não "expirado" — a leitura oposta transformaria um grant vitalício
  em conta morta.
- **Dois portões distintos** (`:81` e `:94`): escrita exige ATIVO; leitura aceita ativo **ou**
  lapsed. É o congelamento do Q3 — quem já teve grant continua lendo. `none` é negado nos dois.

O cliente nunca é consultado (Constituição IV) e **não existe rota HTTP de concessão** — só o CLI de
operador e o `grant_writer` alimentado por evento verificado do PSP.

## Matriz de estados

| estado do vendedor | ledger | `GET /entitlement` | escrita | leitura |
| --- | --- | --- | --- | --- |
| nunca teve nada | sem grant | `none` | 403 | **403** |
| cortesia/beta ativa | grant `comp`/`beta` válido | `active` | ok | ok |
| pagou (assinatura ativa) | grant `payment` válido | `active` | ok | ok |
| em carência (renovação recusada) | grant de carência válido (`period_end + 10d`) | `active` | ok | ok |
| cancelou, período correndo | grant `payment` ainda válido | `active` | ok | ok |
| período acabou | grant expirado | `lapsed` | 403 | **ok** (congelamento) |
| estornou / chargeback | grant com `revoked_at` | `lapsed` | 403 | **ok** |
| offline com cache | — | o cliente serve a ÚLTIMA resposta do servidor | o servidor decide no sync | ok |

Duas coisas que a matriz mostra e valem dizer:

- **Estorno e expiração convergem para o mesmo estado visível** (`lapsed`). A causa não trafega — é
  a raiz do follow-up já registrado sobre o rótulo ("expirado" afirmava causa; virou "pausado").
- **O congelamento preserva a leitura em TODOS os caminhos de queda.** Nenhum deles apaga dado.

---

## Achados

### [F04a-001] O `expiresAt` reportado é o do grant mais RECENTE, não o mais DISTANTE

- **Severidade**: **Alto**
- **Bloqueia provisionamento**: **não** (nada de dinheiro é calculado errado; o que erra é o que se
  diz ao vendedor) — mas **deve** virar spec na F15.
- **Certeza**: **100%** — provado por execução, evidência em `../evidencias/F04a-expires-at.txt`.
- **Local**: `backend/app/entitlement/__init__.py:69`
  — `newest = max(active, key=lambda g: g.granted_at)`
- **Origem**: `develop` (o campo é de E2/ADR-0012); a CONSEQUÊNCIA (b) abaixo nasceu no PR #35 (PR-B).

**Evidência medida.** Conta com dois grants válidos:

| grant | concedido | expira |
| --- | --- | --- |
| `comp` (cortesia) | há 200 dias | **2027-09-07** |
| `payment` | agora | 2026-09-02 |

`read_entitlement_state` devolveu `source=payment`, `expires_at=2026-09-02`. O grant válido mais
distante expira **370 dias depois**.

**Consequência (a) — a API subestima o acesso.** `GET /entitlement` diz ao vendedor que o premium
acaba em 30 dias quando ele dura mais de um ano. A Conta renderiza esse campo direto
(`conta-page.tsx`, legenda "expira em {data}").

**Consequência (b) — e esta é a cara: a linha da §4.3 está MORTA no caso canônico.**
`apps/web/src/features/billing/plan-view.ts:111` diz, no meu próprio comentário:

> *"o `expiresAt` do ledger é o grant válido MAIS DISTANTE"*

**É falso**, e a detecção depende disso:

```ts
cortesiaSobrevive = new Date(ent.expiresAt) > new Date(sub.currentPeriodEnd)
```

O grant de pagamento nasce com `expires_at = period_end` **e** `sub.current_period_end = period_end`
— os dois do mesmo valor (`grant_writer.py:109` e `:114`). Como ele é o mais recente sempre que
alguém assina **tendo** cortesia, a comparação vira `period_end > period_end` ⇒ **sempre falsa**.

A linha *"Seu acesso de cortesia continua depois disso."* — ratificada pelo dono em 2026-08-02 — não
aparece exatamente no caso para o qual ela existe. Ela só apareceria na ordem inversa (cortesia
concedida DEPOIS da assinatura), que é a menos comum.

**Por que nenhum teste pegou**: os testes de unidade de `plan-view` alimentam `entitlement` e
`subscription` **como dados independentes**, com o `expiresAt` que eu escolhi. Nenhum deles passa
pelo backend, então nenhum vê que o campo não significa o que o comparador assume. É a mesma família
do *fake-active* que a caminhada de navegador achou: **combinações coerentes por construção não
testam a coerência**.

**Conserto mínimo (não aplicado — R8)**: em `entitlement/__init__.py:69`, separar as duas perguntas —
o `source` que interessa é o do grant mais recente (é ele que descreve *por que* a conta está ativa),
mas o `expires_at` que interessa é `max(g.expires_at)`, com `None` (sem prazo) vencendo qualquer
data. São duas linhas, e mudam um campo de contrato já consumido — por isso vira spec, não patch.

---

## Não verificado nesta fase

1. **Se algum outro consumidor** de `expiresAt` depende da semântica errada além do
   `cortesiaSobrevive` e da legenda da Conta. Uma varredura de todos os leitores do campo cabe na
   F15, quando a spec de correção for escrita.
2. **A corrida de concessão JIT** (`ensure_account` + grant no mesmo instante) — há nota histórica de
   endurecimento no `grantPremium` dos e2e, mas não reproduzi a corrida aqui.
3. **O caminho do CLI de operador** (`app/scripts/grant_premium.py`) — cobertura medida em 60% no
   gate. Fica para a **F10**.
