from __future__ import annotations
import logging

import httpx
from fastapi import APIRouter, HTTPException, Query as QueryParam, Request, status

from app.core.errors import raise_api_error
from app.core.supabase import db as get_db
from app.schemas.payment import MercadoPagoPixRequest, MercadoPagoPixResponse
from app.services.payment_service import (
    create_payment,
    get_latest_payment,
    has_approved_payment,
    map_mercadopago_status,
    mercadopago_client,
    update_payment_status,
    FINAL_STATUSES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pagamento/mercadopago", tags=["pagamento-mercadopago"])


@router.post("/pix", response_model=MercadoPagoPixResponse)
async def create_pix_payment(
    payload: MercadoPagoPixRequest,
    request: Request,
) -> MercadoPagoPixResponse:
    db = get_db()
    query_id = str(payload.query_id)

    # Busca consulta
    res = db.table("queries").select("*").eq("id", query_id).limit(1).execute()
    if not res.data:
        raise_api_error(404, "query_not_found", "Consulta não encontrada")
    query = res.data[0]

    # Já pago?
    if has_approved_payment(db, query_id):
        raise_api_error(400, "already_paid", "Esta consulta já foi paga")

    # Pagamento PENDING existente → reutiliza
    existing = get_latest_payment(db, query_id)
    if existing and existing["status"] == "PENDING":
        logger.info("pix reused existing pending payment query_id=%s", query_id)
        return MercadoPagoPixResponse(
            query_id=query_id,
            payment_id=existing["id"],
            provider_payment_id=existing.get("provider_payment_id"),
            status=existing["status"],
            qr_code=existing.get("qr_code"),
            qr_code_text=existing.get("qr_code"),
            pix_copy_paste=existing.get("qr_code"),
            qr_code_base64=existing.get("qr_code_base64"),
            ticket_url=existing.get("ticket_url"),
            amount_brl=query["amount_brl_centavos"] / 100,
            paid=False,
        )

    # Valida credenciais MP
    client = mercadopago_client()
    if not client.has_valid_credentials():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {
                "code": "provider_misconfigured",
                "message": "Integração de pagamento indisponível no ambiente atual.",
            }},
        )

    # Cria PIX no Mercado Pago
    try:
        create_result = await client.create_pix_payment(
            amount_brl=query["amount_brl_centavos"] / 100,
            description=f"Consulta RadarCheck {query_id[:8]}",
            external_reference=query_id,
        )
    except httpx.HTTPStatusError as exc:
        logger.error("mp create payment failed status=%d query_id=%s", exc.response.status_code, query_id)
        if exc.response.status_code in {401, 403}:
            raise HTTPException(
                status_code=502,
                detail={"error": {"code": "provider_auth_failed", "message": "Falha de autenticação com o provedor de pagamento."}},
            ) from exc
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "provider_unavailable", "message": "Erro ao gerar PIX. Tente novamente."}},
        ) from exc
    except httpx.HTTPError as exc:
        logger.error("mp create payment http error query_id=%s error=%s", query_id, exc)
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "provider_unavailable", "message": "Erro ao gerar PIX. Tente novamente."}},
        ) from exc

    internal_status = map_mercadopago_status(create_result.status)
    payment = create_payment(
        db,
        query_id=query_id,
        provider="mercadopago",
        provider_payment_id=create_result.provider_payment_id,
        external_reference=query_id,
        amount_brl_centavos=query["amount_brl_centavos"],
        payment_method="pix",
        status=internal_status if internal_status != "FAILED" else "CREATED",
        provider_status_detail=create_result.provider_status_detail,
        qr_code=create_result.pix_copy_paste or create_result.qr_code,
        qr_code_base64=create_result.qr_code_base64,
        ticket_url=create_result.ticket_url,
        raw_create_payload=create_result.payload,
    )

    # Atualiza query com provider
    db.table("queries").update({
        "payment_provider": "mercadopago",
        "payment_id": create_result.provider_payment_id,
    }).eq("id", query_id).execute()

    logger.info("pix created query_id=%s provider_payment_id=%s status=%s",
                query_id, create_result.provider_payment_id, payment["status"])

    return MercadoPagoPixResponse(
        query_id=query_id,
        payment_id=payment["id"],
        provider_payment_id=payment.get("provider_payment_id"),
        status=payment["status"],
        qr_code=payment.get("qr_code"),
        qr_code_text=payment.get("qr_code"),
        pix_copy_paste=payment.get("qr_code"),
        qr_code_base64=payment.get("qr_code_base64"),
        ticket_url=payment.get("ticket_url"),
        amount_brl=query["amount_brl_centavos"] / 100,
        paid=payment["status"] == "APPROVED",
    )


@router.get("/status", response_model=MercadoPagoPixResponse)
async def get_pix_status(
    query_id: str = QueryParam(...),
    payment_id: str | None = QueryParam(default=None),
) -> MercadoPagoPixResponse:
    db = get_db()

    res = db.table("queries").select("*").eq("id", query_id).limit(1).execute()
    if not res.data:
        raise_api_error(404, "query_not_found", "Consulta não encontrada")
    query = res.data[0]

    # Busca payment
    pq = db.table("payments").select("*").eq("query_id", query_id).eq("provider", "mercadopago")
    if payment_id:
        pq = pq.or_(f"id.eq.{payment_id},provider_payment_id.eq.{payment_id}")
    res_p = pq.order("created_at", desc=True).limit(1).execute()

    if not res_p.data:
        raise_api_error(404, "payment_not_found", "Pagamento não encontrado")
    payment = res_p.data[0]

    # Consulta MP se status não final
    if payment["status"] not in FINAL_STATUSES and payment.get("provider_payment_id"):
        client = mercadopago_client()
        try:
            provider_data = await client.get_payment(payment["provider_payment_id"])
            new_status = map_mercadopago_status(provider_data.get("status"))
            if new_status != payment["status"]:
                payment = update_payment_status(
                    db,
                    payment["id"],
                    status=new_status,
                    provider_status_detail=provider_data.get("status_detail"),
                    raw_payload=provider_data,
                )
        except httpx.HTTPError as exc:
            logger.warning("pix status mp lookup failed payment_id=%s error=%s",
                           payment.get("provider_payment_id"), exc)

    return MercadoPagoPixResponse(
        query_id=query_id,
        payment_id=payment["id"],
        provider_payment_id=payment.get("provider_payment_id"),
        status=payment["status"],
        qr_code=payment.get("qr_code"),
        qr_code_text=payment.get("qr_code"),
        pix_copy_paste=payment.get("qr_code"),
        qr_code_base64=payment.get("qr_code_base64"),
        ticket_url=payment.get("ticket_url"),
        amount_brl=query["amount_brl_centavos"] / 100,
        paid=payment["status"] == "APPROVED",
    )
