from fastapi import APIRouter, Depends
from app.core.security import require_admin_auth
from app.core.supabase import db as get_db

router = APIRouter(prefix="/admin", tags=["admin-health"], dependencies=[Depends(require_admin_auth)])


@router.get("/health")
async def admin_health() -> dict:
    db = get_db()
    try:
        db.table("queries").select("id").limit(1).execute()
        db_status = "ok"
    except Exception as exc:
        db_status = f"error: {str(exc)[:100]}"

    try:
        sources = db.table("dataset_sources").select("uf, status, last_synced_at").execute()
        sources_data = sources.data
    except Exception:
        sources_data = []

    try:
        recent_jobs = (
            db.table("sync_jobs")
            .select("uf, status, created_at")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        jobs_data = recent_jobs.data
    except Exception:
        jobs_data = []

    return {
        "database": db_status,
        "provider": "supabase",
        "dataset_sources": sources_data,
        "recent_jobs": jobs_data,
    }


@router.get("/dashboard/overview")
async def dashboard_overview() -> dict:
    db = get_db()
    try:
        queries_res = db.table("queries").select("paid, created_at").execute()
        total_queries = len(queries_res.data)
        paid_queries = sum(1 for q in queries_res.data if q.get("paid"))
    except Exception:
        total_queries = paid_queries = 0

    try:
        payments_res = (
            db.table("payments")
            .select("status, amount_brl_centavos")
            .eq("status", "APPROVED")
            .execute()
        )
        revenue = sum(p["amount_brl_centavos"] for p in payments_res.data) / 100
        approved_payments = len(payments_res.data)
    except Exception:
        revenue = approved_payments = 0

    try:
        jobs_res = (
            db.table("sync_jobs")
            .select("status, uf, created_at")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        recent_jobs = jobs_res.data
    except Exception:
        recent_jobs = []

    return {
        "total_queries": total_queries,
        "paid_queries": paid_queries,
        "revenue_brl": round(revenue, 2),
        "approved_payments": approved_payments,
        "conversion_rate": round(paid_queries / total_queries, 4) if total_queries else 0,
        "recent_jobs": recent_jobs,
    }
