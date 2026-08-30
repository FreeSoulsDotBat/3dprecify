"""US1 — protected /me endpoint (proves the server-side boundary, Constitution Principle IV)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.auth import current_claims
from app.errors import AUTH_ERRORS, CamelModel

router = APIRouter(tags=["me"])


class CurrentUser(CamelModel):
    uid: str
    email: str | None = None


# A21/FR-210: publish the REACHABLE error statuses (401 from current_claims) — and only those.
@router.get("/me", responses=AUTH_ERRORS)
async def get_me(claims: Annotated[dict[str, Any], Depends(current_claims)]) -> CurrentUser:
    uid = claims["uid"]
    email = claims.get("email")
    return CurrentUser(uid=uid, email=email)
