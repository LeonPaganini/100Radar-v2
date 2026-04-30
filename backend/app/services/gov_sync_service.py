from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any

import httpx

from app.core.config import settings
from app.core.supabase import db as get_db

logger = logging.getLogger(__name__)


async def sync_uf(uf: str) -> dict:
    uf = uf.upper().strip()
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
    """Upsert GOV radar records into Supabase. Returns (inserted, updated)."""
    inserted = 0
    updated = 0

    for record in _iter_radar_records(uf, data):
        inmetro = record["numero_inmetro"]
        serie = record["numero_serie"]
        if not inmetro and not serie:
            continue

        existing = _find_existing_site(db, uf, inmetro, serie)
        payload = {
            "uf": uf,
            "numero_inmetro": inmetro,
            "numero_serie": serie,
            "municipio": record["municipio"],
            "local_text": record["local_text"],
            "source_url": source_url,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if record["latitude"] is not None:
            payload["latitude"] = record["latitude"]
        if record["longitude"] is not None:
            payload["longitude"] = record["longitude"]

        if existing:
            db.table("radar_sites").update(payload).eq("id", existing["id"]).execute()
            site_id = existing["id"]
            updated += 1
        else:
            payload["id"] = str(uuid.uuid4())
            db.table("radar_sites").insert(payload).execute()
            site_id = payload["id"]
            inserted += 1

        _upsert_verifications(db, site_id, record["verifications"])

    return inserted, updated


def _find_existing_site(db, uf: str, inmetro: str | None, serie: str | None) -> dict | None:
    if inmetro:
        res = (
            db.table("radar_sites")
            .select("id")
            .eq("uf", uf)
            .eq("numero_inmetro", inmetro)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]

    if serie:
        res = (
            db.table("radar_sites")
            .select("id")
            .eq("uf", uf)
            .eq("numero_serie", serie)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]

    return None


def _iter_source_items(data: list | dict) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("equipamentos", "radares", "data", "items", "medidores"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []


def _iter_radar_records(uf: str, data: list | dict) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    wanted_uf = uf.upper().strip()

    for item in _iter_source_items(data):
        item_uf = (_text(_pick(item, "SiglaUf", "uf", "UF")) or wanted_uf).upper()
        if item_uf != wanted_uf:
            continue

        municipio = _text(_pick(item, "Municipio", "municipio"))
        local_text = _text(_pick(item, "LocalVerificacao", "local", "logradouro", "local_text"))
        latitude = _float_or_none(_pick(item, "Latitude", "latitude", "lat"))
        longitude = _float_or_none(_pick(item, "Longitude", "longitude", "lng", "lon"))
        verifications = _extract_verifications(item)
        faixas = _pick(item, "Faixas", "faixas")

        if isinstance(faixas, list) and faixas:
            for faixa in faixas:
                if not isinstance(faixa, dict):
                    continue
                records.append({
                    "numero_inmetro": _text(_pick(faixa, "NumeroInmetro", "numero_inmetro")),
                    "numero_serie": _text(_pick(faixa, "NumeroSerie", "numero_serie")),
                    "municipio": municipio.upper() if municipio else None,
                    "local_text": local_text,
                    "latitude": latitude,
                    "longitude": longitude,
                    "verifications": verifications,
                })
            continue

        records.append({
            "numero_inmetro": _text(_pick(item, "NumeroInmetro", "numero_inmetro")),
            "numero_serie": _text(_pick(item, "NumeroSerie", "numero_serie")),
            "municipio": municipio.upper() if municipio else None,
            "local_text": local_text,
            "latitude": latitude,
            "longitude": longitude,
            "verifications": verifications,
        })

    return records


def _extract_verifications(item: dict[str, Any]) -> list[dict[str, Any]]:
    verifications: list[dict[str, Any]] = []
    history = _pick(item, "Historico", "historico")

    if isinstance(history, list):
        for entry in history:
            if not isinstance(entry, dict):
                continue
            valid_from = _parse_date(_pick(entry, "DataLaudo", "data_laudo", "valid_from"))
            valid_until = _parse_date(_pick(entry, "DataValidade", "data_validade", "valid_until"))
            if not valid_from:
                continue
            verifications.append({
                "valid_from": valid_from.isoformat(),
                "valid_until": valid_until.isoformat() if valid_until else None,
                "status": _verification_status(_text(_pick(entry, "Resultado", "resultado"))),
                "source_doc": _text(_pick(entry, "NumeroCertificado", "numero_certificado")),
            })

    current_from = _parse_date(_pick(item, "DataUltimaVerificacao", "data_ultima_verificacao"))
    current_until = _parse_date(_pick(item, "DataValidade", "data_validade"))
    if current_from:
        current = {
            "valid_from": current_from.isoformat(),
            "valid_until": current_until.isoformat() if current_until else None,
            "status": _verification_status(_text(_pick(item, "UltimoResultado", "ultimo_resultado"))),
            "source_doc": None,
        }
        if not any(
            verification["valid_from"] == current["valid_from"]
            and verification["valid_until"] == current["valid_until"]
            and verification["status"] == current["status"]
            for verification in verifications
        ):
            verifications.append(current)

    return verifications


def _upsert_verifications(db, site_id: str, verifications: list[dict[str, Any]]) -> None:
    for verification in verifications:
        query = (
            db.table("site_verifications")
            .select("id")
            .eq("site_id", site_id)
            .eq("valid_from", verification["valid_from"])
            .eq("status", verification["status"])
            .limit(1)
        )
        if verification["valid_until"]:
            query = query.eq("valid_until", verification["valid_until"])
        else:
            query = query.is_("valid_until", "null")
        existing = query.execute()

        payload = {
            "site_id": site_id,
            "valid_from": verification["valid_from"],
            "valid_until": verification["valid_until"],
            "status": verification["status"],
            "source_doc": verification["source_doc"],
        }
        if existing.data:
            if payload["source_doc"] is None:
                payload.pop("source_doc")
            db.table("site_verifications").update(payload).eq("id", existing.data[0]["id"]).execute()
        else:
            payload["id"] = str(uuid.uuid4())
            db.table("site_verifications").insert(payload).execute()


def _pick(item: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in item:
            return item[key]
    return None


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _float_or_none(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _parse_date(value: Any) -> date | None:
    text = _text(value)
    if not text:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def _verification_status(resultado: str | None) -> str:
    if not resultado:
        return "INDETERMINADO"
    normalized = resultado.strip().lower()
    if "aprov" in normalized:
        return "REGULAR"
    if "reprov" in normalized or "venc" in normalized:
        return "VENCIDO"
    return "INDETERMINADO"
