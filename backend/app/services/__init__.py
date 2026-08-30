"""Domain services (no HTTP, no session lifecycle) — imported BY `app.api`, never the reverse.

The direction is enforced by the `api -> services -> models` import-linter contract: a service that
reaches back into a router closes a cycle, and the boundary is the reason this layer exists.
"""
