"""E6 (T009) — the ONE shared terminus: inbox insert + ledger grant, same transaction,
on-conflict-no-op (ADR-0023 §2-3, data-model §2/§4). The webhook route (T010) and the
reconciliation runner (T011) both call `process_verified_event` AFTER their own verify-then-lookup
— convergence is structural (VR-702/SC-703), never application-level dedup cleverness (the
ADR-0018 §3 lesson, restated server-side).

**Escopo hoje: `payment` (T009) e `payment_failed` (carência, T023/T024).** `refund`/`chargeback`
(revogar, T033/T034) seguem território da PR-C e NÃO são inventados aqui (Princípio VIII: nenhuma
regra de entitlement inferida). `cancel` não passa por aqui de propósito — ele é ação do vendedor,
não evento do PSP, e mora em `app.billing.subscription` (T022). Um evento de tipo ainda não tratado
resolve a assinatura (para que isolamento entre contas e "assinatura desconhecida" se comportem
igual para todo tipo) e não escreve nada.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BillingEvent, EntitlementGrant, Subscription

from .events import VerifiedEvent
from .states import SubscriptionStatus

log = structlog.get_logger(__name__)

#: T003 — MEDIDO na doc oficial do MP (2026-07-21, fonte em `research.md` §D10): uma cobrança
#: recusada entra num esquema de reciclagem de até 4 retentativas numa janela de ~10 dias, com
#: auto-cancelamento após 3 recusas.
MP_RETRY_WINDOW_DAYS = 10
#: Piso humano — decisão do dono (Q5). Não deriva do MP: é a garantia de que a carência não encolhe
#: junto se o MP um dia publicar uma janela menor.
GRACE_FLOOR_DAYS = 7
#: A janela de carência é o `max` dos dois, e é a REGRA que importa, não o número de hoje.
GRACE_WINDOW_DAYS = max(MP_RETRY_WINDOW_DAYS, GRACE_FLOOR_DAYS)


@dataclass(frozen=True)
class ProcessResult:
    #: A local subscription was resolved for this event (server-side only — SEC-204/VR-703).
    matched: bool
    #: THIS call's insert won the exactly-once race (a new grant/state change actually happened).
    granted: bool


async def process_verified_event(session: AsyncSession, event: VerifiedEvent) -> ProcessResult:
    """The terminus. Resolves the owning subscription by `event.subscription_ref` (the LOOKED-UP
    preapproval id) ONLY — never by any client/body-supplied account field (SEC-204/VR-703, T3 in
    seguranca-round.md). An event that resolves to no local subscription is SEC-105:
    deny-by-default, zero writes, `matched=False`."""
    sub = (
        await session.execute(
            select(Subscription).where(
                Subscription.mp_preapproval_id == event.subscription_ref,
                Subscription.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if sub is None:
        # SEC-105 deny-by-default: nenhuma assinatura local resolve este evento (conta isolada,
        # ou o PSP falou de algo que não é nosso). Zero escrita.
        log.info("event_unmatched", subscription_ref=event.subscription_ref, kind=event.kind)
        return ProcessResult(matched=False, granted=False)

    if event.kind == "payment_failed":
        return await _open_grace(session, sub, event)

    if event.kind in ("refund", "chargeback"):
        return await _revoke_for_refund(session, sub, event)

    if event.kind != "payment":
        # Sobra `cancel`, que NAO passa por aqui: cancelar e acao do vendedor, nao evento do PSP, e
        # mora em `app.billing.subscription` (T022).
        log.info("event_kind_not_processed", subscription_id=str(sub.id), kind=event.kind)
        return ProcessResult(matched=True, granted=False)

    now = datetime.now(UTC)
    # Clock-skew rule (spec §Edge Cases): the grant's `expires_at` is MP's `period_end`,
    # VERBATIM — never a server-side floor/recompute that could land earlier than MP's
    # authoritative boundary (the boundary always favors the paying seller).
    period_end = event.period_end
    # L2-N1 (confirmation audit): a payment grant MUST carry a bounded expiry. A null `period_end`
    # (MP omitted both `period_end` and `next_payment_date`, or they were unparseable) would write
    # `expires_at=None`, which the entitlement resolver reads as PREMIUM FOREVER — and since
    # refund/chargeback revocation is a later task, that perpetual grant has no path to expire. A
    # payment we cannot bound is not a payment we grant: deny-by-default (matched, not granted), so
    # reconciliation retries rather than the seller getting free lifetime premium.
    if period_end is None:
        log.info("event_unboundable", subscription_id=str(sub.id), kind=event.kind)
        return ProcessResult(matched=True, granted=False)

    stmt = (
        pg_insert(BillingEvent)
        .values(
            subscription_id=sub.id,
            event_key=event.event_key,
            kind=event.kind,
            mp_status=event.mp_status,
            raw=event.raw,
            processed_at=now,
        )
        .on_conflict_do_nothing(index_elements=[BillingEvent.event_key])
        .returning(BillingEvent.id)
    )
    inserted = (await session.execute(stmt)).first() is not None
    if inserted:
        # Same transaction as the inbox insert above (VR-702) — both commit or neither does.
        session.add(
            EntitlementGrant(
                account_uid=sub.owner_uid,
                source="payment",
                granted_by="mercadopago",
                expires_at=period_end,
                subscription_id=sub.id,
            )
        )
        sub.status = SubscriptionStatus.AUTHORIZED.value
        sub.current_period_end = period_end  # guaranteed non-null by the L2-N1 guard above
        log.info(
            "grant_written",
            account_uid=sub.owner_uid,
            subscription_id=str(sub.id),
            expires_at=period_end.isoformat(),
        )
    await session.commit()
    return ProcessResult(matched=True, granted=inserted)


async def _open_grace(
    session: AsyncSession, sub: Subscription, event: VerifiedEvent
) -> ProcessResult:
    """T023/T024 (US5/FR-708/VR-707) — a renovação falhou: abre a janela de carência.

    UM grant acrescentado ao ledger append-only (`source="payment"` — o CHECK não ganha valor novo)
    e o status vai a `grace`. **Zero mutação e zero mudança de derivação**: a derivacao
    `active` do ADR-0012 continua exatamente como esta (SC-709), e e a expiracao que faz o lapso
    quando a janela esgotar. Nada e revogado e nada e apagado.

    A ancora e `current_period_end` — o fim do periodo que o vendedor PAGOU —, nunca `hoje`.
    Ancorar no relogio do servidor daria carencias de tamanhos diferentes para o MESMO evento
    conforme a hora em que ele chegasse, e daria 10 dias de premium a quem nunca pagou.
    """
    period_end = sub.current_period_end
    # Irmão do L2-N1: sem período pago conhecido não há de que medir a carência, e um `expires_at`
    # ancorado em `hoje` seria premium de graça. Deny-by-default — a reconciliação tenta de novo
    # depois que um pagamento aprovado tiver estabelecido o período.
    if period_end is None:
        log.info("event_unboundable", subscription_id=str(sub.id), kind=event.kind)
        return ProcessResult(matched=True, granted=False)

    stmt = (
        pg_insert(BillingEvent)
        .values(
            subscription_id=sub.id,
            event_key=event.event_key,
            kind=event.kind,
            mp_status=event.mp_status,
            raw=event.raw,
            processed_at=datetime.now(UTC),
        )
        .on_conflict_do_nothing(index_elements=[BillingEvent.event_key])
        .returning(BillingEvent.id)
    )
    # A mesma convergência estrutural do caminho de pagamento (VR-702/SC-703): o webhook e a
    # reconciliação veem o MESMO evento recusado, e duas carências empilhadas prorrogariam o premium
    # de graça. Quem decide é o UNIQUE do inbox, não esperteza de aplicação.
    inserted = (await session.execute(stmt)).first() is not None
    if inserted:
        session.add(
            EntitlementGrant(
                account_uid=sub.owner_uid,
                source="payment",
                granted_by="mercadopago",
                expires_at=period_end + timedelta(days=GRACE_WINDOW_DAYS),
                subscription_id=sub.id,
            )
        )
        sub.status = SubscriptionStatus.GRACE.value
        log.info(
            "grace_opened",
            account_uid=sub.owner_uid,
            subscription_id=str(sub.id),
            expires_at=(period_end + timedelta(days=GRACE_WINDOW_DAYS)).isoformat(),
        )
    await session.commit()
    return ProcessResult(matched=True, granted=inserted)


async def _revoke_for_refund(
    session: AsyncSession, sub: Subscription, event: VerifiedEvent
) -> ProcessResult:
    """T033/T034 (US8/D7/VR-708/SC-710) — o dinheiro voltou: revoga o grant de pagamento ATIVO.

    O buraco que isto fecha tem nome: **premium silencioso**. Um estorno que ninguem processa deixa
    o vendedor premium de graca e ninguem descobre — nao ha erro, nao ha log, so uma conta ativa
    que nao devia estar.

    A revogacao e append-only no sentido do ADR-0012: carimba `revoked_at`/`revoked_by` na linha
    que ja existe, sem `DELETE` e sem linha nova, e o premium cai NA HORA pela derivacao `active`
    que ja esta la. Nenhuma regra nova de entitlement.

    DUAS coisas que ele deliberadamente NAO faz:

    1. **Nao toca em `beta`/`comp`.** Sao decisoes de OPERADOR, sem relacao nenhuma com o cartao do
       vendedor; um estorno que as apagasse tiraria o acesso de quem nunca pagou por ele. E o
       defeito seria invisivel, porque "o premium do pagamento caiu" e exatamente o que se espera.
    2. **Nao revoga um grant JA expirado.** Chargebacks chegam semanas depois, e o comum e a conta
       ja ter caido sozinha. Revogar ali nao mudaria nada para o vendedor, mas SOBRESCREVERIA o
       motivo da queda: o registro passaria a dizer "revogado por estorno" sobre quem apenas deixou
       de renovar. O evento entra no inbox mesmo assim: auditavel, e sem efeito.
    """
    now = datetime.now(UTC)
    stmt = (
        pg_insert(BillingEvent)
        .values(
            subscription_id=sub.id,
            event_key=event.event_key,
            kind=event.kind,
            mp_status=event.mp_status,
            raw=event.raw,
            processed_at=now,
        )
        .on_conflict_do_nothing(index_elements=[BillingEvent.event_key])
        .returning(BillingEvent.id)
    )
    # A idempotencia e o UNIQUE do inbox, como nos outros dois caminhos. Importa mais aqui do que
    # parece: um `revoked_at` que se reescrevesse a cada reentrega apagaria QUANDO a revogacao
    # aconteceu, e essa data e o registro auditavel.
    inserted = (await session.execute(stmt)).first() is not None
    if not inserted:
        await session.commit()
        return ProcessResult(matched=True, granted=False)

    revocable_grants = (
        (
            await session.execute(
                select(EntitlementGrant).where(
                    EntitlementGrant.subscription_id == sub.id,
                    EntitlementGrant.source == "payment",
                    EntitlementGrant.revoked_at.is_(None),
                    or_(
                        EntitlementGrant.expires_at.is_(None),
                        EntitlementGrant.expires_at > now,
                    ),
                )
            )
        )
        .scalars()
        .all()
    )

    for grant in revocable_grants:
        grant.revoked_at = now
        grant.revoked_by = "mercadopago"
    log.info(
        "grants_revoked",
        account_uid=sub.owner_uid,
        subscription_id=str(sub.id),
        count=len(revocable_grants),
    )
    await session.commit()
    return ProcessResult(matched=True, granted=len(revocable_grants) > 0)
