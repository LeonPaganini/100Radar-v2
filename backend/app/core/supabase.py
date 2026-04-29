from __future__ import annotations
from functools import lru_cache
from supabase import create_client, Client


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Retorna singleton do client Supabase com service_role (acesso total ao banco)."""
    from app.core.config import settings
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. "
            "Configure as variáveis de ambiente."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def db() -> Client:
    """Atalho para uso nos endpoints."""
    return get_supabase()
