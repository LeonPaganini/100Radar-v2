from __future__ import annotations
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
    cors_allow_origins: str = "http://localhost:5173,http://localhost:3000"
    gov_dataset_url_template: str = "https://servicos.rbmlq.gov.br/dados-abertos/{UF}/medidores.json"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


settings = Settings()  # type: ignore[call-arg]
