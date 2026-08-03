# F04b — Billing (Mercado Pago) e a superfície do Play

## Resumo

A verificação de assinatura é **sólida**: falha fechada em todo caminho (segredo ausente, header
ausente, formato inválido, `ts` velho **ou futuro** — o `abs()` fecha os dois lados), comparação em
tempo constante, e o `data.id` minusculizado conforme a peculiaridade documentada do MP. A
idempotência é **estrutural** (o `UNIQUE` do inbox), não esperteza de aplicação. O `live_mode` é um
segundo portão independente. A superfície do Play não existe com a flag desligada.
**Um achado BLOQUEANTE**: uma indisponibilidade transitória da API do MP durante o webhook produz
**perda permanente e silenciosa de um grant pago** — o erro de rede vira `None`, o `None` vira
`200 "ignored"`, o 200 diz ao MP para **não reentregar**, a reconciliação que seria a rede de
segurança **não está agendada** (é CLI manual), e **nada é logado**. O vendedor paga e não recebe.

---

## O que está correto

### Verificação de assinatura (`billing/signature.py`)

| propriedade | onde | veredito |
| --- | --- | --- |
| falha fechada sem segredo configurado | `:47` | ✅ SEC-403 |
| falha fechada sem header ou sem `data.id` | `:47` | ✅ |
| formato estrito `ts=<dígitos>,v1=<64 hex>` | `:27,49` | ✅ nada de parse tolerante |
| janela de frescor 300s | `:55` | ✅ e com `abs()` — um `ts` no FUTURO também é barrado |
| comparação em tempo constante | `:59` `hmac.compare_digest` | ✅ SEC-107 |
| `data.id` minusculizado | `:32` | ✅ a peculiaridade documentada do MP |
| nunca levanta exceção | `:46` | ✅ negar é um booleano |

**Replay dentro dos 300s**: possível na camada de assinatura, e **neutralizado na camada seguinte**
pelo `UNIQUE` do inbox — o mesmo `event_key` converge para uma linha. Defesa em profundidade real,
não coincidência.

### Ordem do pipeline (SEC-103)

`api/billing.py:78-122` — parse mínimo → **verificar assinatura** → **assert `live_mode`** → só então
consultar o provedor → terminus. Falha em qualquer um dos dois portões é 401 **antes de qualquer
toque no banco**. O `live_mode` é independente da assinatura: um evento de sandbox não escreve grant
de produção nem com assinatura válida (impossível, dados os segredos por ambiente — mas o portão
existe mesmo assim, e é o certo).

### Idempotência

Estrutural: `pg_insert(...).on_conflict_do_nothing(index_elements=[BillingEvent.event_key])` nos
**três** caminhos de escrita (pagamento `grant_writer.py:98`, carência `:150`, estorno `:210`). O
webhook e a reconciliação convergem no banco, não na aplicação.

### Superfície do Play

Com a flag desligada as rotas **não são registradas** (`api/billing.py`, `play_router` devolve
`None`), então o roteador responde 404 — não há handler que possa vazar. Verificado por teste
próprio com controle positivo (com a flag ligada a rota existe e responde 503, nunca 404).

---

## Achado

### [F04b-001] Indisponibilidade transitória do MP = perda permanente e silenciosa de um grant pago

- **Severidade**: **Bloqueante**
- **Bloqueia provisionamento**: **SIM**
- **Certeza**: **90%** — a cadeia de código está verificada linha a linha; os 10% são a semântica de
  retry do MP, que eu li no comentário da própria casa e **não** na documentação do MP (ver §Não
  verificado).
- **Local**: `backend/app/billing/providers/mercadopago.py:110-119` (`_get`) →
  `backend/app/api/billing.py:118-127` (o ack) → `backend/app/scripts/reconcile_subscriptions.py`
  (não agendado)
- **Origem**: `develop` (PR-A do E6)

**A cadeia, elo por elo:**

1. `_get` devolve `None` em `httpx.HTTPError` — **timeout, DNS, conexão recusada, 5xx do MP** — e
   também em qualquer não-200. `mercadopago.py:110-115`.
2. `lookup_verified_event` propaga o `None`.
3. A rota lê `None` e devolve **`200 {"status":"ignored"}`**. `billing.py:124-127`.
4. **O 200 diz ao MP que a entrega foi processada.** O comentário do próprio arquivo reconhece a
   semântica: *"MP retries on non-2xx"* (`billing.py:9`). Não haverá reentrega.
5. A rede de segurança seria a reconciliação — e ela é **CLI manual**
   (`uv run python -m app.scripts.reconcile_subscriptions`). Varri `.github/workflows/`: o único
   `schedule` existente é o da sonda da Amazon. **Nada agenda a reconciliação.**
6. **Nada é logado**: `grep -n "logger|log\.|structlog" backend/app/api/billing.py` → **zero**.

**Resultado**: o vendedor paga, o MP entrega o webhook, a API do MP está instável naquele segundo, e
o grant nunca é escrito. Não há erro, não há log, não há reentrega, não há alarme. A conta fica
gratuita e **ninguém descobre** — nem o vendedor (que pagou), nem o operador.

**A causa raiz tem nome, e a casa já a nomeou antes.** O `None` de `_get` carrega **dois
significados incompatíveis**:

- *"consultei e não existe"* — assinatura desconhecida, SEC-105. Ack 200 é **certo**.
- *"não consegui consultar"* — falha transitória. Ack 200 é **errado**; aqui é preciso não-2xx para
  o MP reentregar.

Este projeto já pagou por exatamente essa forma. `packages/fee-ingest/src/amazon-parse.ts:55`:

> *"The predecessor returned `ParsedBand[] | null`, and `null` carried two incompatible meanings…
> The caller could not tell them apart"*

O conserto lá foi tornar os casos **irrepresentáveis** como o mesmo valor (uma união de três casos).
A mesma cura serve aqui, e a lição está escrita no repositório — em outro pacote.

**Por que nenhum teste pegou**: os testes de webhook exercitam assinatura, isolamento, idempotência e
o caso "assinatura desconhecida". Nenhum injeta uma **falha de transporte** no meio de um evento
legítimo — o stub sempre responde. A distinção que falta no código também falta no teste.

**Conserto mínimo (não aplicado — R8)**: `_get` distinguir "não achei" de "não consegui perguntar"
(devolver um resultado de três casos, ou levantar em erro de transporte), e a rota responder **502/503**
no segundo caso para o MP reentregar. Complementarmente: agendar a reconciliação e logar o `ignored`.
São mudanças pequenas e independentes — viram spec na F15.

---

## Não verificado nesta fase

1. **A política de retry do MP, na fonte.** Eu a li no comentário desta casa (`billing.py:9`) e ela é
   a semântica convencional de webhook, mas **não abri a documentação do Mercado Pago**. Se o MP
   reentregar mesmo com 200, a severidade cai de Bloqueante para Médio. **Esta é a única pergunta
   que separa as duas leituras, e ela é respondível em minutos com a doc na mão.** → `PENDENCIAS.md`
   §P-009.
2. **Se o deploy planeja agendar a reconciliação.** `research.md` menciona Cloud Scheduler → Cloud
   Run job "no deploy da v1". Se o agendamento entrar junto com o provisionamento, o elo 5 fecha —
   mas os elos 1-4 e 6 continuam, e o vendedor esperaria até a próxima varredura.
3. **`live_mode` ausente no corpo** (não `false`, ausente): `bool(body.get("live_mode"))` dá `False`,
   que em `dev` casa com o esperado. Em produção o esperado é `True`, então um corpo sem o campo é
   rejeitado — falha fechada. Confirmado por leitura; não construí o caso.
