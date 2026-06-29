"""US1 — protected /me endpoint (proves the server-side boundary, Constitution Principle IV)."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.auth import current_claims
from app.errors import CamelModel

router = APIRouter(tags=["me"])


class CurrentUser(CamelModel):
    uid: str
    email: str | None = None


@router.get("/me")
async def get_me(claims: Annotated[dict[str, Any], Depends(current_claims)]) -> CurrentUser:
    uid = claims["uid"]
    email = claims.get("email")
    return CurrentUser(uid=uid, email=email)
