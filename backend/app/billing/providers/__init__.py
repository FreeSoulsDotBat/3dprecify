"""E6 payment providers — each normalises its PSP's wire shape into `app.billing.events`'s
`VerifiedEvent`.

`mercadopago.py` is the only LIVE provider in E6; the Play provider (ADR-0023 §6, flag-gated OFF)
lands at E7 behind the same `PaymentProvider` shape."""

from __future__ import annotations
