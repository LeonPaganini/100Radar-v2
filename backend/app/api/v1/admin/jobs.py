from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.security import AuthenticatedAdmin, require_admin_auth
from app.core.supabase import db as get_db

router = APIRouter(
    prefix="/admin/jobs",
    tags=["admin-jobs"],
    dependencies=[Depends(require_admin_auth)],
)


class SyncRequest(BaseModel):
    uf: str


@router.get("")
async def list_jobs() -> dict:
    db = get_db()
    res = (
        db.table("sync_jobs")
        .select("*")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"jobs": res.data}


@router.post("/sync")
async def trigger_sync(
    payload: SyncRequest,
    auth: AuthenticatedAdmin = Depends(require_admin_auth),
) -> dict:
    from app.services.gov_sync_service import sync_uf
    return await sync_uf(payload.uf.upper())
