from __future__ import annotations

from datetime import datetime
from typing import Any


def _parse_br_date(value: str | None):
    if not value:
        return None
    return datetime.strptime(value, "%d/%m/%Y").date()


def parse_site_record(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "uf": (record.get("SiglaUf") or "").strip().upper(),
        "municipio": record.get("Municipio"),
        "local_verificacao": record.get("LocalVerificacao"),
        "data_ultima_verificacao": _parse_br_date(record.get("DataUltimaVerificacao")),
        "data_validade": _parse_br_date(record.get("DataValidade")),
        "ultimo_resultado": record.get("UltimoResultado"),
        "tipo_medidor": record.get("TipoMedidor"),
    }


def parse_lane_records(record: dict[str, Any]) -> list[dict[str, Any]]:
    lanes = []
    for faixa in (record.get("Faixas") or []):
        inmetro = str(faixa.get("NumeroInmetro") or "").strip()
        serial = str(faixa.get("NumeroSerie") or "").strip()
        lanes.append({
            "numero_faixa": str(faixa.get("NumeroFaixa") or "").strip() or None,
            "numero_inmetro": inmetro or None,
            "numero_inmetro_normalized": inmetro or None,
            "numero_serie": serial or None,
            "numero_serie_normalized": serial.upper() or None,
            "sentido": faixa.get("Sentido"),
            "velocidade_nominal": str(faixa.get("VelocidadeNominal")) if faixa.get("VelocidadeNominal") is not None else None,
        })
    return lanes


def parse_verification_records(record: dict[str, Any]) -> list[dict[str, Any]]:
    verifications = []
    for h in (record.get("Historico") or []):
        verifications.append({
            "numero_certificado": h.get("NumeroCertificado"),
            "data_laudo": _parse_br_date(h.get("DataLaudo")),
            "data_validade": _parse_br_date(h.get("DataValidade")),
            "resultado": h.get("Resultado") or h.get("ResultadoLaudo"),
        })
    return verifications
