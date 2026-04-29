from __future__ import annotations
import hashlib
import logging
import uuid
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.core.supabase import db as get_db

logger = logging.getLogger(__name__)


async def sync_uf(uf: str) -> dict:
    db = get_db()
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    db.table("sync_jobs").insert({
        "id": job_id,
        "uf": uf,
        "status": "running",
        "triggered_by": "manual",
        "started_at": now,
    }).execute()

    url = settings.gov_dataset_url_template.replace("{UF}", uf)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url, headers={"User-Agent": "100Radar/2.0 (radarcheck.com.br)"}
            )
            response.raise_for_status()
            data = response.json()

        new_hash = hashlib.sha256(response.content).hexdigest()

        # Verifica se há mudança
        source_res = (
            db.table("dataset_sources")
            .select("last_hash")
            .eq("uf", uf)
            .limit(1)
            .execute()
        )
        if source_res.data and source_res.data[0].get("last_hash") == new_hash:
            db.table("sync_jobs").update({
                "status": "unchanged",
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "records_added": 0,
            }).eq("id", job_id).execute()
            logger.info("sync_uf unchanged uf=%s", uf)
            return {"job_id": job_id, "status": "unchanged", "uf": uf}

        added, updated = _upsert_radares(db, uf, data, url)

        db.table("dataset_sources").upsert({
            "uf": uf,
            "source_url": url,
            "last_hash": new_hash,
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
            "record_count": added + updated,
            "status": "synced",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="uf").execute()

        db.table("sync_jobs").update({
            "status": "success",
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "records_added": added,
            "records_updated": updated,
        }).eq("id", job_id).execute()

        logger.info("sync_uf success uf=%s added=%d updated=%d", uf, added, updated)
        return {"job_id": job_id, "status": "success", "uf": uf, "added": added, "updated": updated}

    except httpx.HTTPStatusError as exc:
        msg = f"HTTP {exc.response.status_code} ao acessar {url}"
        logger.error("sync_uf failed uf=%s error=%s", uf, msg)
        _fail_job(db, job_id, msg)
        return {"job_id": job_id, "status": "failed", "uf": uf, "error": msg}

    except Exception as exc:
        msg = str(exc)[:500]
        logger.error("sync_uf failed uf=%s error=%s", uf, msg, exc_info=True)
        _fail_job(db, job_id, msg)
        return {"job_id": job_id, "status": "failed", "uf": uf, "error": msg}


def _fail_job(db, job_id: str, error_message: str) -> None:
    db.table("sync_jobs").update({
        "status": "failed",
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "error_message": error_message[:500],
    }).eq("id", job_id).execute()


def _upsert_radares(db, uf: str, data: list | dict, source_url: str) -> tuple[int, int]:
    """Upserta radares no banco. Retorna (inserted, updated)."""
    items: list = data if isinstance(data, list) else (
        data.get("equipamentos") or data.get("radares") or data.get("data") or []
    )
    inserted = 0
    updated = 0

    for item in items:
        inmetro = str(item.get("numero_inmetro") or "").strip() or None
        serie = str(item.get("numero_serie") or "").strip() or None
        if not inmetro and not serie:
            continue

        municipio = str(item.get("municipio") or "").strip().upper() or None
        local_text = str(item.get("local") or item.get("logradouro") or "").strip() or None
        lat = item.get("latitude") or item.get("lat")
        lng = item.get("longitude") or item.get("lng") or item.get("lon")

        # Verifica existência
        existing = None
        if inmetro:
            res = (
                db.table("radar_sites")
                .select("id")
                .eq("uf", uf)
                .eq("numero_inmetro", inmetro)
                .limit(1)
                .execute()
            )
            existing = res.data[0] if res.data else None

        if not existing and serie:
            res = (
                db.table("radar_sites")
                .select("id")
                .eq("uf", uf)
                .eq("numero_serie", serie)
                .limit(1)
                .execute()
            )
            existing = res.data[0] if res.data else None

        payload = {
            "uf": uf,
            "numero_inmetro": inmetro,
            "numero_serie": serie,
            "municipio": municipio,
            "local_text": local_text,
            "source_url": source_url,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if lat is not None:
            payload["latitude"] = float(lat)
        if lng is not None:
            payload["longitude"] = float(lng)

        if existing:
            db.table("radar_sites").update(payload).eq("id", existing["id"]).execute()
            updated += 1
        else:
            payload["id"] = str(uuid.uuid4())
            db.table("radar_sites").insert(payload).execute()
            inserted += 1

    return inserted, updated
