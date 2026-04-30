from __future__ import annotations
import uuid
from datetime import date

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.errors import raise_api_error
from app.core.supabase import db as get_db
from app.core.config import settings

router = APIRouter(prefix="/consulta", tags=["consulta"])


class PrecheckRequest(BaseModel):
    uf: str
    numero_inmetro: str | None = None
    numero_serie: str | None = None
    data_infracao: date
    identifier_type: str = "inmetro"
    municipio: str | None = None
    local_text: str | None = None


class PrecheckResponse(BaseModel):
    query_id: str
    status: str
    found: bool
    amount_brl: float


@router.post("/precheck", response_model=PrecheckResponse)
async def precheck(payload: PrecheckRequest) -> PrecheckResponse:
    db = get_db()
    query_id = str(uuid.uuid4())
    site_id: str | None = None
    found = False
    status_na_data = "INDETERMINADO"

    uf = payload.uf.upper().strip()

    # Busca por Inmetro
    if payload.numero_inmetro:
        res = (
            db.table("radar_sites")
            .select("id")
            .eq("uf", uf)
            .eq("numero_inmetro", payload.numero_inmetro.strip())
            .limit(1)
            .execute()
        )
        if res.data:
            site_id = res.data[0]["id"]
            found = True

    # Busca por Série
    elif payload.numero_serie:
        res = (
            db.table("radar_sites")
            .select("id")
            .eq("uf", uf)
            .eq("numero_serie", payload.numero_serie.strip())
            .limit(1)
            .execute()
        )
        if res.data:
            site_id = res.data[0]["id"]
            found = True

    # Busca por local/município (modo local)
    elif payload.municipio:
        q = db.table("radar_sites").select("id").eq("uf", uf)
        if payload.municipio:
            q = q.ilike("municipio", f"%{payload.municipio.strip()}%")
        if payload.local_text:
            q = q.ilike("local_text", f"%{payload.local_text.strip()}%")
        res = q.limit(1).execute()
        if res.data:
            site_id = res.data[0]["id"]
            found = True

    # Verifica situação na data da infração
    if site_id:
        data_str = payload.data_infracao.isoformat()
        ver = (
            db.table("site_verifications")
            .select("status")
            .eq("site_id", site_id)
            .lte("valid_from", data_str)
            .or_(f"valid_until.is.null,valid_until.gte.{data_str}")
            .order("valid_from", desc=True)
            .limit(1)
            .execute()
        )
        if ver.data:
            status_na_data = ver.data[0]["status"]
        else:
            latest = (
                db.table("site_verifications")
                .select("status,valid_until")
                .eq("site_id", site_id)
                .lte("valid_from", data_str)
                .order("valid_from", desc=True)
                .limit(1)
                .execute()
            )
            if latest.data:
                latest_verification = latest.data[0]
                valid_until = latest_verification.get("valid_until")
                if valid_until and valid_until < data_str:
                    status_na_data = "VENCIDO"
                else:
                    status_na_data = latest_verification.get("status") or status_na_data

    # Persiste consulta
    db.table("queries").insert({
        "id": query_id,
        "uf": uf,
        "numero_inmetro": payload.numero_inmetro,
        "numero_serie": payload.numero_serie,
        "data_infracao": payload.data_infracao.isoformat(),
        "site_id": site_id,
        "status_na_data": status_na_data,
        "identifier_type": payload.identifier_type,
        "amount_brl_centavos": settings.price_brl_centavos,
    }).execute()

    return PrecheckResponse(
        query_id=query_id,
        status=status_na_data,
        found=found,
        amount_brl=settings.price_brl_centavos / 100,
    )


@router.get("/{query_id}")
async def get_query(query_id: str) -> dict:
    db = get_db()
    res = db.table("queries").select("*").eq("id", query_id).limit(1).execute()
    if not res.data:
        raise_api_error(404, "query_not_found", "Consulta não encontrada")
    return res.data[0]


@router.get("/{query_id}/pdf")
async def get_pdf(query_id: str) -> StreamingResponse:
    import io
    db = get_db()
    res = db.table("queries").select("*").eq("id", query_id).limit(1).execute()
    if not res.data:
        raise_api_error(404, "query_not_found", "Consulta não encontrada")
    query = res.data[0]
    if not query.get("paid"):
        raise_api_error(402, "payment_required", "Pagamento necessário para baixar o PDF")

    from app.services.pdf_service import generate_pdf
    pdf_bytes = generate_pdf(query)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=radarcheck_{query_id[:8]}.pdf"},
    )


@router.get("/fontes/atualizacoes")
async def fontes_atualizacoes() -> dict:
    db = get_db()
    res = db.table("dataset_sources").select("*").order("uf").execute()
    return {"fontes": res.data}
