from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class MercadoPagoPixRequest(BaseModel):
    query_id: str


class MercadoPagoPixResponse(BaseModel):
    query_id: str
    payment_id: str
    provider_payment_id: str | None = None
    status: str
    qr_code: str | None = None
    qr_code_text: str | None = None
    pix_copy_paste: str | None = None
    qr_code_base64: str | None = None
    ticket_url: str | None = None
    amount_brl: float
    paid: bool = False
    provider: str = "mercadopago"
    expires_at: datetime | None = None
