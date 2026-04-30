from __future__ import annotations

from datetime import datetime, date
from typing import Any


def _norm(v: str | None) -> str:
    return (v or "").strip().upper()


def _parse_br_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, "%d/%m/%Y").date()


def find_record_by_inmetro_from_json(data: list[dict[str, Any]], uf: str, numero_inmetro: str) -> dict[str, Any] | None:
    target = _norm(numero_inmetro)
    for item in data:
        if _norm(item.get("SiglaUf")) != _norm(uf):
            continue
        for faixa in item.get("Faixas") or []:
            if _norm(str(faixa.get("NumeroInmetro") or "")) == target:
                return item
    return None


def find_record_by_serial_from_json(data: list[dict[str, Any]], uf: str, numero_serie: str) -> dict[str, Any] | None:
    target = _norm(numero_serie)
    for item in data:
        if _norm(item.get("SiglaUf")) != _norm(uf):
            continue
        for faixa in item.get("Faixas") or []:
            if _norm(str(faixa.get("NumeroSerie") or "")) == target:
                return item
    return None


def resolve_status_from_gov_json(historico: list[dict[str, Any]], data_infracao: date) -> dict[str, Any]:
    selected = None
    for entry in historico:
        laudo = _parse_br_date(entry.get("DataLaudo"))
        if laudo and laudo <= data_infracao and (selected is None or laudo > _parse_br_date(selected.get("DataLaudo"))):
            selected = entry
    if not selected:
        return {"status": "INDETERMINADO", "selected": None}

    validade = _parse_br_date(selected.get("DataValidade"))
    resultado = selected.get("Resultado") or selected.get("ResultadoLaudo")
    if not validade:
        return {"status": "INDETERMINADO", "selected": selected, "resultado_laudo": resultado}
    return {
        "status": "VALIDO" if validade >= data_infracao else "VENCIDO",
        "selected": selected,
        "resultado_laudo": resultado,
    }
