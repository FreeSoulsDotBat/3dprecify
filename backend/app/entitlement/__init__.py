"""Entitlement seam (E2, ADR-0012): the server-authoritative premium check.

`require_entitlement` (US1/T010) is THE single dependency every catalog route passes
through; grants live in the append-only ledger (app.models). Populated in T010/T013.
"""
