"""SQLAlchemy 2.0 typed models (E2 ADR-0013 + E3 migration 0002) — the ratified schemas of
``specs/007-e2-catalog-entitlement/data-model.md`` §2 and ``specs/008-e3-multi-piece-bom/``
``data-model.md``.

Twelve tables across six epics, ONE module per aggregate. This ``__init__`` re-exports every
public symbol, so ``from app.models import X`` keeps working exactly as before for every caller
(incl. Alembic's ``env.py``) — only the internal layout changed.

Map — what lives where:

* ``base.py`` — ``NAMING_CONVENTION``, ``Base``, the uuid7 generator, the type domains
  (``MONEY_SETTLED``/``MONEY_RATE``/``QTY_*``/``PERCENT``), and ``name_norm_default``.
* ``account.py`` — ``Account`` (E2 D1) + ``EntitlementGrant`` (E2 D2 / ADR-0012, the append-only
  premium ledger).
* ``catalog.py`` — ``Filament`` + ``Printer`` (E2 FR-305, the premium catalog leaves).
* ``product.py`` — ``Product`` (E2 FR-310, live-recompute + reference-with-fallback D3).
* ``kit.py`` — ``Bom`` + ``BomLine`` (E3, the multi-piece assembly and its priced lines).
* ``observation.py`` — ``PriceObservation`` (019/PR-D, the "era R$ …" read-marker).
* ``snapshot.py`` — ``Snapshot`` + ``SNAPSHOT_MUTABLE_COLUMNS`` + the immutability
  ``before_update`` listener (E4, ADR-0019) — the rule and the table it protects, side by side.
* ``scenario.py`` — ``Scenario`` (E5, ADR-0021, the mutable opposite of a Snapshot).
* ``billing.py`` — ``Subscription`` + ``BillingEvent`` (E6, ADR-0023).

Seven tables: ``accounts`` (uid PK, JIT-provisioned), ``entitlement_grants`` (append-only
ledger — the ADR-0012 source of truth + audit), ``filaments``, ``printers``, ``products``
(nullable FK ``ON DELETE SET NULL`` + typed resolved-value columns + the "link OR full
snapshot" CHECK, D3/US6-4), and E3's ``boms`` + ``bom_lines`` — the SAME link-or-snapshot
machinery one level up (``bom_line : product :: product : filament/printer``). Money is
NUMERIC per ADR-0008 (never floats, never NaN — the ``<> 'NaN'`` CHECKs close Postgres's
NUMERIC-NaN hole). Soft-delete (``deleted_at``) covers VOLUNTARY deletion only — a premium
lapse never touches data (Q3 freeze, zero schema footprint). snake_case here; camelCase is
the wire's job (ADR-0002).
"""

from __future__ import annotations

from app.models.account import Account, EntitlementGrant
from app.models.base import (
    MONEY_RATE,
    MONEY_SETTLED,
    NAMING_CONVENTION,
    PERCENT,
    QTY_G,
    QTY_H,
    QTY_KG,
    QTY_KW,
    Base,
    name_norm_default,
    uuid7_default,
)
from app.models.billing import BillingEvent, Subscription
from app.models.catalog import Filament, Printer
from app.models.kit import Bom, BomLine
from app.models.observation import PriceObservation
from app.models.product import Product
from app.models.scenario import Scenario
from app.models.snapshot import SNAPSHOT_MUTABLE_COLUMNS, Snapshot

# Importing app.models.snapshot above is what REGISTERS the immutability listener
# (`_forbid_snapshot_content_mutation`, module-private) — the `before_update` decorator runs at
# module import time regardless of which names are pulled into this namespace.

__all__ = [
    "MONEY_RATE",
    "MONEY_SETTLED",
    "NAMING_CONVENTION",
    "PERCENT",
    "QTY_G",
    "QTY_H",
    "QTY_KG",
    "QTY_KW",
    "SNAPSHOT_MUTABLE_COLUMNS",
    "Account",
    "Base",
    "BillingEvent",
    "Bom",
    "BomLine",
    "EntitlementGrant",
    "Filament",
    "PriceObservation",
    "Printer",
    "Product",
    "Scenario",
    "Snapshot",
    "Subscription",
    "name_norm_default",
    "uuid7_default",
]
