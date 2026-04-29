from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from app.core.security import require_finance_admin, AuthenticatedAdmin
from app.core.supabase import db as get_db

router = APIRouter(
    prefix="/admin/finance",
    tags=["admin-finance"],
    dependencies=[Depends(require_finance_admin)],
)


@router.get("/summary")
async def finance_summary(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
) -> dict:
    db = get_db()
    q = db.table("payments").select("status, amount_brl_centavos, created_at, provider")
    if date_from:
        q = q.gte("created_at", date_from)
    if date_to:
        q = q.lte("created_at", date_to)
    res = q.execute()

    approved = [p for p in res.data if p["status"] == "APPROVED"]
    pending = [p for p in res.data if p["status"] == "PENDING"]
    total_brl = sum(p["amount_brl_centavos"] for p in approved) / 100

    return {
        "total_approved": len(approved),
        "total_pending": len(pending),
        "total_payments": len(res.data),
        "total_brl": round(total_brl, 2),
        "conversion_rate": round(len(approved) / len(res.data), 4) if res.data else 0,
    }


@router.get("/payments")
async def list_payments(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    status: str | None = Query(default=None),
) -> dict:
    db = get_db()
    q = (
        db.table("payments")
        .select("id, query_id, provider, provider_payment_id, amount_brl_centavos, status, payment_method, created_at, paid_at")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if date_from:
        q = q.gte("created_at", date_from)
    if date_to:
        q = q.lte("created_at", date_to)
    if status:
        q = q.eq("status", status.upper())
    res = q.execute()
    return {"payments": res.data, "count": len(res.data)}


@router.get("/by-uf")
async def finance_by_uf() -> dict:
    db = get_db()
    queries_res = db.table("queries").select("uf, paid").execute()
    by_uf: dict[str, dict] = {}
    for q in queries_res.data:
        uf = q["uf"]
        if uf not in by_uf:
            by_uf[uf] = {"uf": uf, "total": 0, "paid": 0}
        by_uf[uf]["total"] += 1
        if q["paid"]:
            by_uf[uf]["paid"] += 1
    return {"by_uf": sorted(by_uf.values(), key=lambda x: x["paid"], reverse=True)}
