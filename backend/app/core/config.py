from __future__ import annotations

import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    cors_allow_origins: list[str] = [
        "https://one00radar-v2-mt38.onrender.com",
        "https://one00radar-v2-be.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    cors_allow_origin_regex: str = r"https://one00radar-v2-[a-zA-Z0-9-]+\.onrender\.com|http://localhost(:\\d+)?"
    gov_dataset_url_template: str = "https://servicos.rbmlq.gov.br/dados-abertos/{UF}/medidores.json"

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(origin).strip() for origin in value if str(origin).strip()]

        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            if raw.startswith("["):
                parsed = json.loads(raw)
                if not isinstance(parsed, list):
                    msg = "CORS_ALLOW_ORIGINS JSON must be an array"
                    raise ValueError(msg)
                return [str(origin).strip() for origin in parsed if str(origin).strip()]

            return [origin.strip() for origin in raw.split(",") if origin.strip()]

        msg = "CORS_ALLOW_ORIGINS must be list or string"
        raise ValueError(msg)


settings = Settings()  # type: ignore[call-arg]
