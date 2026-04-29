from fastapi import APIRouter, Depends
from app.core.security import AuthenticatedAdmin, require_admin_auth

router = APIRouter(prefix="/admin", tags=["admin-auth"])


@router.get("/me")
async def admin_me(auth: AuthenticatedAdmin = Depends(require_admin_auth)) -> dict:
    return {
        "user": {
            "id": auth.user_id,
            "email": auth.email,
            "role": auth.role,
            "full_name": auth.full_name,
        }
    }
