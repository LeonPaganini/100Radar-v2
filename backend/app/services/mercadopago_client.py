from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

import httpx

from app.core.config import settings


@dataclass
class MercadoPagoCreateResponse:
    provider_payment_id: str
    status: str
    provider_status_detail: str | None
    qr_code: str | None
    pix_copy_paste: str | None
    qr_code_base64: str | None
    ticket_url: str | None
    payload: dict[str, Any]


class MercadoPagoClient:
    def __init__(self, *, access_token: str | None = None, api_base_url: str | None = None) -> None:
        self.access_token = access_token or settings.mp_access_token
        self.api_base_url = api_base_url or settings.mp_api_base_url

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def _payment_headers(self, *, idempotency_key: str) -> dict[str, str]:
        headers = self._headers()
        headers["X-Idempotency-Key"] = idempotency_key
        return headers

    def has_valid_credentials(self) -> bool:
        token = (self.access_token or "").strip()
        return bool(token) and token != "<PLACEHOLDER>"

    def _normalize_document(self, document: str | None) -> str | None:
        if not document:
            return None
        normalized = "".join(char for char in document if char.isdigit())
        return normalized or None

    def _payer_identification(self, *, document: str | None) -> dict[str, str] | None:
        normalized = self._normalize_document(document)
        if not normalized:
            return None
        if len(normalized) == 14:
            return {"type": "CNPJ", "number": normalized}
        if len(normalized) == 11:
            return {"type": "CPF", "number": normalized}
        return None

    async def create_pix_payment(
        self,
        *,
        amount_brl: float,
        description: str,
        external_reference: str,
        payer_email: str = "equipe.nutripaganini@gmail.com",
        payer_first_name: str = "Radar",
        payer_last_name: str = "Check",
        payer_document: str | None = None,
    ) -> MercadoPagoCreateResponse:
        identification = self._payer_identification(document=payer_document or settings.mp_payer_document)

        payload = {
            "transaction_amount": amount_brl,
            "description": description,
            "payment_method_id": "pix",
            "external_reference": external_reference,
            "payer": {
                "email": payer_email,
                "first_name": payer_first_name,
                "last_name": payer_last_name,
            },
        }
        if identification:
            payload["payer"]["identification"] = identification

        idempotency_key = str(uuid4())
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{self.api_base_url}/v1/payments",
                headers=self._payment_headers(idempotency_key=idempotency_key),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        point = data.get("point_of_interaction", {}).get("transaction_data", {})
        pix_copy_paste = point.get("qr_code") or point.get("pix_code") or data.get("qr_code")
        qr_code_base64 = point.get("qr_code_base64") or data.get("qr_code_base64")
        return MercadoPagoCreateResponse(
            provider_payment_id=str(data.get("id")),
            status=str(data.get("status", "")),
            provider_status_detail=data.get("status_detail"),
            qr_code=pix_copy_paste,
            pix_copy_paste=pix_copy_paste,
            qr_code_base64=qr_code_base64,
            ticket_url=point.get("ticket_url"),
            payload=data,
        )

    async def get_payment(self, payment_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(f"{self.api_base_url}/v1/payments/{payment_id}", headers=self._headers())
            response.raise_for_status()
            return response.json()

    def parse_webhook_payload(self, payload: dict[str, Any]) -> str | None:
        if payload.get("type") in {"payment", "topic"}:
            return str(payload.get("data", {}).get("id") or payload.get("id")) if (payload.get("data", {}).get("id") or payload.get("id")) else None
        if payload.get("data", {}).get("id"):
            return str(payload["data"]["id"])
        return str(payload.get("id")) if payload.get("id") else None

    def verify_webhook_signature(self, *, body: bytes, headers: dict[str, str], query_params: dict[str, str]) -> bool:
        if not settings.mp_webhook_enabled:
            return True
        signature = headers.get("x-signature", "")
        request_id = headers.get("x-request-id", "")
        data_id = query_params.get("data.id") or query_params.get("id")
        secret = settings.mp_webhook_secret
        if not signature or not secret:
            return False

        parts = dict(item.split("=", 1) for item in signature.split(",") if "=" in item)
        ts = parts.get("ts", "")
        v1 = parts.get("v1", "")
        manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
        digest = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        if v1:
            return hmac.compare_digest(digest, v1)

        fallback = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(fallback, signature)


async def sanitize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    redacted = json.loads(json.dumps(payload))
    if "payer" in redacted and isinstance(redacted["payer"], dict):
        if redacted["payer"].get("email"):
            redacted["payer"]["email"] = "***"
        if isinstance(redacted["payer"].get("identification"), dict) and redacted["payer"]["identification"].get("number"):
            redacted["payer"]["identification"]["number"] = "***"
    return redacted
