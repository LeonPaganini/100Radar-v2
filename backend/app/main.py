from __future__ import annotations
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="100Radar API",
        version="2.0.0",
        description="API do sistema RadarCheck — consulta de radares e medidores de velocidade.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── rotas v1 ──────────────────────────────────────────
    from app.api.v1 import consulta, pagamento_mercadopago, webhook_mercadopago
    from app.api.v1.admin import auth, bases, jobs, finance, health as admin_health

    app.include_router(consulta.router, prefix="/v1")
    app.include_router(pagamento_mercadopago.router, prefix="/v1")
    app.include_router(webhook_mercadopago.router, prefix="/v1")
    app.include_router(auth.router, prefix="/v1")
    app.include_router(bases.router, prefix="/v1")
    app.include_router(jobs.router, prefix="/v1")
    app.include_router(finance.router, prefix="/v1")
    app.include_router(admin_health.router, prefix="/v1")

    # ── health público ─────────────────────────────────────
    @app.get("/health", tags=["health"])
    async def health_check() -> dict:
        return {"status": "ok", "env": settings.app_env, "version": "2.0.0"}

    # ── handler global de erros ───────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled exception path=%s error=%s", request.url.path, exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "Erro interno. Tente novamente."}},
        )

    logger.info("app startup env=%s cors=%s", settings.app_env, settings.cors_allow_origins)
    return app


app = create_app()
