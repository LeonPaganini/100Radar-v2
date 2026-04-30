from datetime import date
from app.services.status_service import resolve_status_from_historico


def test_status_from_historico_ac():
    historico = [
        {"data_laudo": date(2023, 7, 10), "data_validade": date(2024, 7, 9), "resultado": "Aprovado"},
        {"data_laudo": date(2024, 7, 4), "data_validade": date(2025, 7, 3), "resultado": "Aprovado"},
        {"data_laudo": date(2025, 7, 3), "data_validade": date(2026, 7, 2), "resultado": "Aprovado"},
    ]
    out = resolve_status_from_historico(historico, date(2026, 4, 28))
    assert out["status"] == "VALIDO"
    assert str(out["selected"]["data_laudo"]) == "2025-07-03"
    assert str(out["selected"]["data_validade"]) == "2026-07-02"
