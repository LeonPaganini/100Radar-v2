from __future__ import annotations
import logging

import httpx
from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.supabase import db as get_db
from app.services.mercadopago_client import MercadoPagoClient
from app.services.payment_service import (
    FINAL_STATUSES,
    map_mercadopago_status,
    update_payment_status,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/mercadopago", tags=["webhooks"])


@router.post("")
async def mercadopago_webhook(
    request: Request,
    x_signature: str | None = Header(default=None),
) -> dict:
    body = await request.body()
    client = MercadoPagoClient()

    if not client.verify_webhook_signature(
        body=body,
        headers=dict(request.headers),
        query_params=dict(request.query_params),
    ):
        logger.warning("webhook: invalid signature")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    provider_payment_id = client.parse_webhook_payload(payload)
    if not provider_payment_id:
        return {"received": True, "action": "ignored"}

    db = get_db()
    res = (
        db.table("payments")
        .select("*")
        .eq("provider_payment_id", provider_payment_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        logger.warning("webhook: payment not found provider_payment_id=%s", provider_payment_id)
        return {"received": True, "action": "not_found"}

    payment = res.data[0]
    if payment["status"] in FINAL_STATUSES:
        return {"received": True, "action": "already_final", "status": payment["status"]}

    try:
        provider_data = await client.get_payment(provider_payment_id)
        new_status = map_mercadopago_status(provider_data.get("status"))
        update_payment_status(
            db,
            payment["id"],
            status=new_status,
            provider_status_detail=provider_data.get("status_detail"),
            raw_payload=provider_data,
            raw_webhook=payload,
        )
        logger.info("webhook processed payment_id=%s new_status=%s", payment["id"], new_status)
    except httpx.HTTPError as exc:
        logger.error("webhook: failed to fetch payment from MP error=%s", exc)

    return {"received": True, "action": "processed"}
