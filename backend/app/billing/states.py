"""019/polish — the billing state vocabulary, in one place instead of raw strings scattered across
`checkout.py`/`grant_writer.py`/`reconcile.py`/`subscription.py`.

`SubscriptionStatus` mirrors `subscriptions.status`'s CHECK verbatim (`app/models/billing.py`,
`status_enum`) — five members, no more, no less; a sixth value added to the DB CHECK without a
matching member here is a mismatch this file makes easy to SEE. `StrEnum` is deliberate: a member
compares equal to, and serializes as, its own string (`SubscriptionStatus.authorized ==
"authorized"` is `True`), so assigning `SubscriptionStatus.authorized` to the `Text`-typed
`Subscription.status` column round-trips exactly like the plain string literal it replaces —
confirmed by the existing test suite, unchanged.

`NON_TERMINAL_STATUSES` moved here from `reconcile.py` (it was never reconciliation-specific: the
checkout conflict check in `checkout.py` imports the SAME tuple to answer "does this account already
have a subscription in flight").

`GrantSource` is deliberately NOT introduced here: `EntitlementGrant.source`'s three-member CHECK
(`'beta','comp','payment'`, `app/models/account.py`) is an ENTITLEMENT-domain enum, not a billing
one — `beta`/`comp` are operator-grant concepts with no relationship to a payment provider. A
billing-only enum could model just `payment` (the one member billing ever writes), which would be
a partial, misleading mirror of a three-member CHECK it does not own.
"""

from __future__ import annotations

from enum import StrEnum


class SubscriptionStatus(StrEnum):
    """`subscriptions.status` (data-model §5) — mirrors `status_enum`'s CHECK, verbatim."""

    PENDING = "pending"
    AUTHORIZED = "authorized"
    GRACE = "grace"
    PAUSED = "paused"
    CANCELLED = "cancelled"


#: The state machine's non-terminal statuses (a subscription still expecting MP-side activity).
#: `cancelled` is terminal for reconciliation/checkout-conflict purposes even though its grant can
#: still be running out the paid period (that lapse is expiry-driven, not reconciliation-driven).
NON_TERMINAL_STATUSES = (
    SubscriptionStatus.PENDING,
    SubscriptionStatus.AUTHORIZED,
    SubscriptionStatus.GRACE,
    SubscriptionStatus.PAUSED,
)
