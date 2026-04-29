from __future__ import annotations
import logging
from dataclasses import dataclass
from typing import Iterable

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from jwt.exceptions import InvalidTokenError

from app.core.config import settings

logger = logging.getLogger(__name__)

VALID_ROLES = {"super_admin", "operator", "finance"}


@dataclass(slots=True)
class AuthenticatedAdmin:
    user_id: str
    email: str
    role: str
    full_name: str


async def require_admin_auth(
    request: Request,
    authorization: str | None = Header(default=None),
) -> AuthenticatedAdmin:
    token: str | None = None
    if authorization:
        scheme, _, raw = authorization.partition(" ")
        if scheme.lower() == "bearer" and raw.strip():
            token = raw.strip()

    if not token:
        logger.warning("admin auth: missing bearer token path=%s", request.url.path)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required")

    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth não configurada (SUPABASE_JWT_SECRET ausente).",
        )

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except InvalidTokenError as exc:
        logger.warning("admin auth: invalid JWT — %s", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado") from exc

    user_id: str = payload.get("sub", "")
    email: str = payload.get("email", "")
    role: str = payload.get("app_metadata", {}).get("role", "operator")
    full_name: str = payload.get("user_metadata", {}).get("full_name", email)

    if not user_id or role not in VALID_ROLES:
        logger.warning("admin auth: forbidden role='%s' user=%s", role, email)
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=f"Perfil '{role}' não autorizado")

    logger.info("admin auth ok user=%s role=%s path=%s", email, role, request.url.path)
    return AuthenticatedAdmin(user_id=user_id, email=email, role=role, full_name=full_name)


def ensure_role(auth: AuthenticatedAdmin, allowed: Iterable[str]) -> AuthenticatedAdmin:
    if auth.role not in set(allowed):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=f"Perfil '{auth.role}' sem acesso a esta operação.",
        )
    return auth


async def require_finance_admin(
    auth: AuthenticatedAdmin = Depends(require_admin_auth),
) -> AuthenticatedAdmin:
    return ensure_role(auth, ["finance", "super_admin"])
