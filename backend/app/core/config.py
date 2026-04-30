from __future__ import annotations

import json
from collections.abc import Iterable

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors_origins(value: str | Iterable[str] | None) -> list[str]:
    raw_items: list[str] = []

    if value is None:
        return []

    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                raw_items = [str(item) for item in parsed]
            else:
                raw_items = raw.split(",")
        else:
            raw_items = raw.split(",")
    else:
        raw_items = [str(item) for item in value]

    sanitized: list[str] = []
    seen: set[str] = set()
    for origin in raw_items:
        clean = origin.strip().rstrip("/")
        if not clean:
            continue
        if clean == "*":
            raise ValueError("CORS wildcard '*' is not allowed")
        if clean not in seen:
            seen.add(clean)
            sanitized.append(clean)
    return sanitized


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""

    # Mercado Pago
    mp_access_token: str = ""
    mp_api_base_url: str = "https://api.mercadopago.com"
    mp_webhook_secret: str = ""
    mp_webhook_enabled: bool = True
    mp_payer_document: str = ""

    # App
    app_env: str = "local"
    price_brl_centavos: int = 500
    cors_allow_origins_raw: str = Field(
        default='["https://one00radar-v2-mt38.onrender.com","http://localhost:5173","http://localhost:3000"]',
        validation_alias="CORS_ALLOW_ORIGINS",
    )
    cors_allow_origin_regex: str | None = Field(
        default=r"^https://one00radar-v2-[a-zA-Z0-9-]+\.onrender\.com$|^http://localhost(:[0-9]+)?$",
        validation_alias="CORS_ALLOW_ORIGIN_REGEX",
    )
    gov_dataset_url_template: str = "https://servicos.rbmlq.gov.br/dados-abertos/{UF}/medidores.json"

    @property
    def cors_allow_origins(self) -> list[str]:
        return parse_cors_origins(self.cors_allow_origins_raw)


settings = Settings()  # type: ignore[call-arg]
