from __future__ import annotations
import uuid
from datetime import datetime, timezone

from supabase import Client

FINAL_STATUSES = {"APPROVED", "REJECTED", "CANCELLED", "EXPIRED", "REFUNDED", "CHARGED_BACK", "FAILED"}


def map_mercadopago_status(status: str | None) -> str:
    mapping = {
        "approved": "APPROVED",
        "pending": "PENDING",
        "in_process": "PENDING",
        "rejected": "REJECTED",
        "cancelled": "CANCELLED",
        "refunded": "REFUNDED",
        "charged_back": "CHARGED_BACK",
        "expired": "EXPIRED",
    }
    return mapping.get((status or "").lower(), "FAILED")


def has_approved_payment(db: Client, query_id: str) -> bool:
    res = (
        db.table("payments")
        .select("id")
        .eq("query_id", query_id)
        .eq("status", "APPROVED")
        .limit(1)
        .execute()
    )
    return bool(res.data)


def get_latest_payment(db: Client, query_id: str) -> dict | None:
    res = (
        db.table("payments")
        .select("*")
        .eq("query_id", query_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def create_payment(
    db: Client,
    *,
    query_id: str,
    provider: str,
    provider_payment_id: str | None,
    external_reference: str,
    amount_brl_centavos: int,
    payment_method: str,
    status: str,
    provider_status_detail: str | None,
    qr_code: str | None,
    qr_code_base64: str | None,
    ticket_url: str | None,
    raw_create_payload: dict | None,
) -> dict:
    row = {
        "id": str(uuid.uuid4()),
        "query_id": query_id,
        "provider": provider,
        "provider_payment_id": provider_payment_id,
        "external_reference": external_reference,
        "amount_brl_centavos": amount_brl_centavos,
        "currency": "BRL",
        "payment_method": payment_method,
        "status": status,
        "provider_status_detail": provider_status_detail,
        "qr_code": qr_code,
        "qr_code_base64": qr_code_base64,
        "ticket_url": ticket_url,
        "raw_create_payload": raw_create_payload,
    }
    res = db.table("payments").insert(row).execute()
    return res.data[0]


def update_payment_status(
    db: Client,
    payment_id: str,
    *,
    status: str,
    provider_status_detail: str | None = None,
    raw_payload: dict | None = None,
    raw_webhook: dict | None = None,
) -> dict:
    updates: dict = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if provider_status_detail is not None:
        updates["provider_status_detail"] = provider_status_detail
    if raw_payload is not None:
        updates["raw_payment_payload"] = raw_payload
    if raw_webhook is not None:
        updates["raw_webhook_payload"] = raw_webhook
    if status == "APPROVED":
        updates["paid_at"] = datetime.now(timezone.utc).isoformat()

    res = db.table("payments").update(updates).eq("id", payment_id).execute()
    payment = res.data[0]

    if status == "APPROVED":
        db.table("queries").update({"paid": True}).eq("id", payment["query_id"]).execute()

    return payment


def mercadopago_client():
    from app.services.mercadopago_client import MercadoPagoClient
    return MercadoPagoClient()
