# E6 — handoff fiscal (Q9): o que o contador precisa confirmar

**Data**: 2026-08-02 · **Origem**: 012-e6-billing, tarefa T042 · **Natureza**: rastreio de bloqueador
de LANCAMENTO, nao codigo. Nada aqui bloqueia o merge do PR-C.

## Por que este documento existe

A cobranca recorrente ja funciona ponta a ponta contra o stub, e o produto **nao emite nota fiscal**
— por decisao (FR-713: nenhuma superficie fiscal existe em lugar nenhum, e isso foi varrido duas
vezes, por codigo e por tela). A pergunta que sobra nao e de engenharia:

> **O comprovante que o Mercado Pago emite basta para o regime tributario do dono, ou o produto
> precisa emitir documento fiscal proprio antes de cobrar do primeiro cliente real?**

## O que o contador precisa responder

1. **Suficiencia do comprovante do MP** para o regime atual (MEI / Simples / outro): ele serve como
   documento de receita, ou e preciso NF-e de servico por assinatura?
2. **Se for preciso NF-e**: emitida por quem, com que periodicidade, e a partir de que evento — o
   pagamento aprovado (`payment`), ou o fim do periodo?
3. **Estorno e chargeback**: o que acontece com o documento ja emitido. O E6 ja registra os dois
   eventos de forma auditavel (`billing_events` + `revoked_at` no grant), entao o dado existe.
4. **Retencao**: por quanto tempo os registros precisam sobreviver. Hoje o ledger e append-only e
   nada e apagado — o que ATENDE qualquer prazo, mas convem confirmar que nao ha exigencia de
   formato.

## O que o E6 ja tem, e que o contador pode usar

- `billing_events` — cada evento verificado do PSP, com o recurso consultado (podado de PII: sem
  cartao, sem e-mail, sem documento) e o carimbo de processamento.
- `entitlement_grants` — append-only, com `granted_at`, `expires_at`, `revoked_at`/`revoked_by`.
- `subscriptions` — o espelho do PSP: plano, periodo, status. **Nenhuma folha de dinheiro** (VR-701).

## Estado

**ABERTO.** Bloqueia o LANCAMENTO (cobrar do primeiro cliente real), nao o merge nem o E7.
