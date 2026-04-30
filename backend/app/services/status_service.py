from __future__ import annotations

from datetime import date
from typing import Any


def resolve_status_from_historico(historico: list[dict[str, Any]], data_infracao: date) -> dict[str, Any]:
    eligible = [h for h in historico if h.get("data_laudo") and h["data_laudo"] <= data_infracao]
    if not eligible:
        return {"status": "INDETERMINADO", "selected": None, "reason": "no_laudo_on_or_before_date"}

    selected = max(eligible, key=lambda h: h["data_laudo"])
    validade = selected.get("data_validade")
    if not validade:
        return {"status": "INDETERMINADO", "selected": selected, "reason": "missing_data_validade"}
    status = "VALIDO" if validade >= data_infracao else "VENCIDO"
    return {"status": status, "selected": selected, "reason": None}
