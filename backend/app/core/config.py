from __future__ import annotations

import json

from pydantic import Field
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
    cors_allow_origins_raw: str = Field(
        default='["https://one00radar-v2-mt38.onrender.com","http://localhost:5173","http://localhost:3000"]',
        validation_alias="CORS_ALLOW_ORIGINS",
    )
    cors_allow_origin_regex: str = (
        r"^https://one00radar-v2-[a-zA-Z0-9-]+\.onrender\.com$|^http://localhost(:[0-9]+)?$"
    )
    gov_dataset_url_template: str = "https://servicos.rbmlq.gov.br/dados-abertos/{UF}/medidores.json"

    @property
    def cors_allow_origins(self) -> list[str]:
        defaults = [
            "https://one00radar-v2-mt38.onrender.com",
            "http://localhost:5173",
            "http://localhost:3000",
        ]

        raw = (self.cors_allow_origins_raw or "").strip()
        parsed: list[str] = []

        if raw:
            if raw.startswith("["):
                try:
                    candidate = json.loads(raw)
                except json.JSONDecodeError:
                    candidate = []
                if isinstance(candidate, list):
                    parsed = [str(item) for item in candidate]
            else:
                parsed = raw.split(",")

        sanitized: list[str] = []
        seen: set[str] = set()
        for origin in [*parsed, *defaults]:
            clean = str(origin).strip().rstrip("/")
            if not clean or clean == "*":
                continue
            if clean not in seen:
                seen.add(clean)
                sanitized.append(clean)

        return sanitized


settings = Settings()  # type: ignore[call-arg]
