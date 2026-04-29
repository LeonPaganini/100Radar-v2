from fastapi import APIRouter, Depends
from app.core.security import AuthenticatedAdmin, require_admin_auth
from app.core.supabase import db as get_db

router = APIRouter(
    prefix="/admin/bases",
    tags=["admin-bases"],
    dependencies=[Depends(require_admin_auth)],
)


@router.get("")
async def list_bases() -> dict:
    db = get_db()
    res = db.table("dataset_sources").select("*").order("uf").execute()
    return {"bases": res.data}


@router.get("/{uf}")
async def get_base(uf: str) -> dict:
    db = get_db()
    res = db.table("dataset_sources").select("*").eq("uf", uf.upper()).limit(1).execute()
    return res.data[0] if res.data else {}


@router.post("/{uf}/sync")
async def sync_base(
    uf: str,
    auth: AuthenticatedAdmin = Depends(require_admin_auth),
) -> dict:
    from app.services.gov_sync_service import sync_uf
    return await sync_uf(uf.upper())
